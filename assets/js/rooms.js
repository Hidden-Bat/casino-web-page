import { auth, db, ref, get, set, update, remove, onValue, off, push, runTransaction, serverTimestamp } from "./firebase.js";
import { $, state, gameNames, escapeHtml, fmt, avatars, toast, clamp } from "./app.js";
import { initChat, stopChat, bindChatForm } from "./chat.js";
import { renderBlackjack, startBlackjack } from "./games/blackjack.js";
import { renderDice, startDice } from "./games/dice.js";
import { renderCoinflip, startCoinflip } from "./games/coinflip.js";
import { renderHighcard, startHighcard } from "./games/highcard.js";
import { renderHorseRace, startHorseRace } from "./games/horserace.js";
import { renderRoulette, startRoulette } from "./games/roulette.js";

let roomRef = null;
let roomsBound = false;
let claiming = false;

const starters = { blackjack: startBlackjack, dice: startDice, coinflip: startCoinflip, highcard: startHighcard, horserace: startHorseRace, roulette: startRoulette };
const renderers = { blackjack: renderBlackjack, dice: renderDice, coinflip: renderCoinflip, highcard: renderHighcard, horserace: renderHorseRace, roulette: renderRoulette };

export function initRooms() {
  if (!roomsBound) {
    bindChatForm();
    $("createRoomForm").addEventListener("submit", createRoom);
    $("leaveRoomBtn").addEventListener("click", leaveRoom);
    $("readyBtn").addEventListener("click", toggleReady);
    $("startGameBtn").addEventListener("click", startRoomGame);
    $("roomGameType").addEventListener("change", syncRoomSettingControls);
    syncRoomSettingControls();
    roomsBound = true;
  }
  restoreCurrentRoom();
}

export function stopRooms() {
  if (roomRef) off(roomRef);
  roomRef = null;
  state.currentRoomId = null;
  state.currentRoom = null;
  stopChat();
  $("roomPanel").classList.add("d-none");
}

async function restoreCurrentRoom() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const snap = await get(ref(db, `users/${uid}/currentRoom`));
  const id = snap.val();
  if (!id) return;
  const roomSnap = await get(ref(db, `rooms/${id}`));
  if (roomSnap.exists() && roomSnap.val().players?.[uid]) watchRoom(id);
  else await update(ref(db, `users/${uid}`), { currentRoom: null });
}

async function createRoom(e) {
  e.preventDefault();
  const uid = auth.currentUser.uid;
  if (state.currentRoomId || state.profile?.currentRoom) return toast("Leave your current room first.", "error");
  const gameType = $("roomGameType").value;
  const bet = Math.floor(Number($("roomBet").value));
  const maxPlayers = clamp(Math.floor(Number($("roomMaxPlayers").value)), 1, 4);
  const limits = limitsFor(gameType);
  if (bet < 10 || maxPlayers < limits.min || maxPlayers > limits.max) return toast("Room settings are invalid for this game.", "error");
  if (!(await escrowBet(uid, bet, "room escrow"))) return;

  const id = await uniqueCode();
  const username =
    state.profile?.username ||
    auth.currentUser?.email?.split("@")[0] ||
    "Player";
  
  const room = {
    id,
    code: id,
    name: `${username}'s Table`,
    gameType,
    bet,
    maxPlayers,
    private: $("roomPrivate").checked,
    hostId: uid,
    hostName: username,
    status: "waiting",
    createdAt: serverTimestamp(),
    pot: bet,
    players: { [uid]: playerPayload(true) }
  };
  try {
    await set(ref(db, `rooms/${id}`), room);
    await update(ref(db, `users/${uid}`), { currentRoom: id });
    bootstrap.Modal.getInstance(document.getElementById("createRoomModal"))?.hide();
    watchRoom(id);
    toast(`Room ${id} created.`, "success");
  } catch (err) {
    await refundEscrow(uid, bet, "room create rollback");
    toast(err.message, "error");
  }
}

export async function joinRoomById(id) {
  id = String(id || "").trim().toUpperCase();
  if (!id) return toast("Enter a room code.", "error");
  const uid = auth.currentUser.uid;
  if (state.currentRoomId || state.profile?.currentRoom) return toast("Leave your current room first.", "error");
  const snap = await get(ref(db, `rooms/${id}`));
  if (!snap.exists()) return toast("Room not found.", "error");
  const room = snap.val();
  if (room.status !== "waiting") return toast("This room is already in play.", "error");
  if (room.players?.[uid]) return watchRoom(id);
  if (!(await escrowBet(uid, room.bet, "room escrow"))) return;

  const tx = await runTransaction(ref(db, `rooms/${id}`), (current) => {
    if (!current || current.status !== "waiting") return;
    const players = current.players || {};
    if (players[uid]) return current;
    if (Object.keys(players).length >= current.maxPlayers) return;
    players[uid] = playerPayload(false);
    current.players = players;
    current.pot = Number(current.pot || 0) + Number(current.bet || 0);
    return current;
  });
  if (!tx.committed) {
    await refundEscrow(uid, room.bet, "join failed refund");
    return toast("Room is no longer available.", "error");
  }
  await update(ref(db, `users/${uid}`), { currentRoom: id });
  watchRoom(id);
  toast(`Joined ${id}.`, "success");
}

function watchRoom(id) {
  if (roomRef) off(roomRef);
  roomRef = ref(db, `rooms/${id}`);
  state.currentRoomId = id;
  initChat(id);
  $("roomPanel").classList.remove("d-none");
  onValue(roomRef, (snap) => {
    if (!snap.exists()) {
      stopRooms();
      return toast("Room closed.", "info");
    }
    state.currentRoom = snap.val();
    renderRoom();
  });
}

function renderRoom() {
  const r = state.currentRoom;
  const uid = auth.currentUser.uid;
  const players = Object.entries(r.players || {});
  $("roomTitle").textContent = `${gameNames[r.gameType]} · ${r.code}`;
  $("roomMeta").textContent = `${fmt(r.bet)} bet · ${fmt(r.pot || r.bet * players.length)} pot · ${r.private ? "Private" : "Public"} · ${r.status}`;
  $("readyBtn").textContent = r.players?.[uid]?.ready ? "Unready" : "Ready";
  $("readyBtn").disabled = r.status !== "waiting";
  $("startGameBtn").classList.toggle("d-none", r.hostId !== uid || r.status !== "waiting");
  $("playersList").innerHTML = players.map(([pid, p]) => `<div class="player-pill ${p.ready ? "ready" : ""}"><span class="avatar-sm">${avatars[p.avatar] || avatars.dealer}</span><span>${escapeHtml(p.username)}</span>${r.hostId === pid ? "<b>Host</b>" : ""}</div>`).join("");
  const renderer = renderers[r.gameType];
  if (renderer) renderer(r, uid);
  if (r.status === "ended" && r.result && r.players?.[uid] && !r.claims?.[uid]) claimResult(r, uid);
}

async function toggleReady() {
  const uid = auth.currentUser.uid;
  const room = state.currentRoom;
  if (!room || room.status !== "waiting" || !room.players?.[uid]) return;
  await update(ref(db, `rooms/${room.id}/players/${uid}`), { ready: !room.players[uid].ready });
}

async function startRoomGame() {
  const r = state.currentRoom;
  const uid = auth.currentUser.uid;
  if (!r || r.hostId !== uid || r.status !== "waiting") return toast("Only the host can start this room.", "error");
  const players = Object.keys(r.players || {});
  const limits = limitsFor(r.gameType);
  if (players.length < limits.min) return toast("More players required.", "error");
  if (!players.every((id) => r.players[id].ready || id === r.hostId)) return toast("All guests must be ready.", "error");
  const tx = await runTransaction(ref(db, `rooms/${r.id}/status`), (status) => status === "waiting" ? "starting" : undefined);
  if (!tx.committed) return toast("Game is already starting.", "error");
  await starters[r.gameType]({ ...r, status: "starting" });
}

export async function settleRoom(room, winners, label, payoutMap = null) {
  if (!room || room.settled) return;
  const lock = await runTransaction(ref(db, `rooms/${room.id}/settleLock`), (v) => v ? undefined : true);
  if (!lock.committed) return;
  const players = Object.keys(room.players || {});
  const pot = Number(room.pot || room.bet * players.length || 0);
  const payouts = {};
  if (payoutMap) {
    players.forEach((uid) => payouts[uid] = Math.max(0, Math.floor(Number(payoutMap[uid] || 0))));
  } else {
    const split = winners.length ? Math.floor(pot / winners.length) : 0;
    players.forEach((uid) => payouts[uid] = winners.includes(uid) ? split : 0);
  }
  await update(ref(db, `rooms/${room.id}`), {
    status: "ended",
    settled: true,
    endedAt: serverTimestamp(),
    resultText: label,
    result: { winners, payouts, pot, label }
  });
}

async function claimResult(room, uid) {
  if (claiming) return;
  claiming = true;
  try {
    const claim = await runTransaction(ref(db, `rooms/${room.id}/claims/${uid}`), (v) => v ? undefined : { at: Date.now() });
    if (!claim.committed) return;
    const payout = Number(room.result?.payouts?.[uid] || 0);
    const won = payout > room.bet;
    const pushResult = payout === room.bet;
    let balanceAfter = state.profile?.balance || 0;
    if (payout > 0) {
      const tx = await runTransaction(ref(db, `users/${uid}/balance`), (b) => {
        balanceAfter = Number(b || 0) + payout;
        return balanceAfter;
      });
      balanceAfter = tx.snapshot.val();
      await push(ref(db, `transactions/${uid}`), { type: "payout", amount: payout, balanceAfter, date: serverTimestamp(), roomId: room.id });
    }
    await push(ref(db, `matches/${uid}`), {
      roomId: room.id,
      game: gameNames[room.gameType],
      result: won ? "Win" : pushResult ? "Push" : "Loss",
      delta: payout - room.bet,
      date: serverTimestamp()
    });
    await Promise.all([
      runTransaction(ref(db, `users/${uid}/totalGames`), (v) => Number(v || 0) + 1),
      runTransaction(ref(db, `users/${uid}/totalWins`), (v) => Number(v || 0) + (won ? 1 : 0)),
      runTransaction(ref(db, `users/${uid}/totalLosses`), (v) => Number(v || 0) + (!won && !pushResult ? 1 : 0)),
      update(ref(db, `users/${uid}`), { currentRoom: null })
    ]);
    toast(`Result recorded: ${won ? "win" : pushResult ? "push" : "loss"} (${payout - room.bet >= 0 ? "+" : ""}${fmt(payout - room.bet)}).`, won ? "success" : "info");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    claiming = false;
  }
}

async function leaveRoom() {
  const id = state.currentRoomId;
  const r = state.currentRoom;
  const uid = auth.currentUser.uid;
  if (!id || !r || !r.players?.[uid]) return;
  if (r.status === "playing" || r.status === "starting") return toast("You cannot leave while a game is active.", "error");
  if (r.status === "ended") {
    await update(ref(db, `users/${uid}`), { currentRoom: null });
    stopRooms();
    return;
  }
  const players = Object.keys(r.players || {}).filter((p) => p !== uid);
  await remove(ref(db, `rooms/${id}/players/${uid}`));
  await refundEscrow(uid, r.bet, "left waiting room");
  await update(ref(db, `users/${uid}`), { currentRoom: null });
  if (!players.length) {
    await remove(ref(db, `rooms/${id}`));
  } else {
    const updates = { pot: Math.max(0, Number(r.pot || 0) - Number(r.bet || 0)) };
    if (r.hostId === uid) {
      updates.hostId = players[0];
      updates.hostName = r.players[players[0]].username;
      updates[`players/${players[0]}/ready`] = true;
    }
    await update(ref(db, `rooms/${id}`), updates);
  }
  stopRooms();
}

async function escrowBet(uid, amount, note) {
  amount = Math.floor(Number(amount));
  const result = await runTransaction(ref(db, `users/${uid}/balance`), (balance) => {
    balance = Number(balance || 0);
    return balance >= amount ? balance - amount : undefined;
  });
  if (!result.committed) {
    toast("Insufficient virtual balance for this bet.", "error");
    return false;
  }
  await push(ref(db, `transactions/${uid}`), { type: "bet", amount: -amount, balanceAfter: result.snapshot.val(), date: serverTimestamp(), note });
  return true;
}

async function refundEscrow(uid, amount, note) {
  const result = await runTransaction(ref(db, `users/${uid}/balance`), (balance) => Number(balance || 0) + Number(amount || 0));
  await push(ref(db, `transactions/${uid}`), { type: "refund", amount, balanceAfter: result.snapshot.val(), date: serverTimestamp(), note });
}

function playerPayload(host) {
  const username =
    state.profile?.username ||
    auth.currentUser?.email?.split("@")[0] ||
    "Player";

  return {
    uid: auth.currentUser.uid,
    username,
    avatar: state.profile?.avatar || "dealer",
    ready: host,
    joinedAt: Date.now()
  };
}
function syncRoomSettingControls() {
  const gameType = $("roomGameType").value;
  const limits = limitsFor(gameType);
  const maxInput = $("roomMaxPlayers");
  maxInput.min = String(limits.min);
  maxInput.max = String(limits.max);
  maxInput.value = String(clamp(Number(maxInput.value || limits.min), limits.min, limits.max));
}

function limitsFor(gameType) {
  if (gameType === "roulette") return { min: 1, max: 1 };
  if (gameType === "horserace") return { min: 2, max: 4 };
  return { min: 2, max: 2 };
}

async function uniqueCode() {
  for (let i = 0; i < 12; i++) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) return code;
  }
  return `${Date.now()}`.slice(-6);
}
