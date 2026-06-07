import { db, ref, update } from "../firebase.js";
import { $, fmt } from "../app.js";
import { settleRoom } from "../rooms.js";

const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export async function startBlackjack(room) {
  const deck = ranks.flatMap((rank) => suits.map((suit) => ({ rank, suit }))).sort(() => Math.random() - 0.5);
  const players = Object.keys(room.players || {});
  const hands = {};
  players.forEach((id) => hands[id] = [deck.pop(), deck.pop()]);
  await update(ref(db, `rooms/${room.id}`), { status: "playing", game: { type: "blackjack", deck, hands, stood: {}, turn: players[0] } });
}

export function renderBlackjack(room, uid) {
  const g = room.game || {};
  const players = Object.keys(room.players || {});
  const handHtml = (id) => (g.hands?.[id] || []).map((c) => `<span class="mini-card">${c.rank}${c.suit}</span>`).join("");
  $("gameMount").innerHTML = `<div class="game-card">
    <h4>Blackjack Duel</h4><p class="text-white-50">Pot ${fmt(room.bet * players.length)} · Closest to 21 wins.</p>
    <div class="blackjack-table">${players.map((id) => `<div class="hand ${g.turn === id ? "active" : ""}"><strong>${room.players[id].username}</strong><div>${handHtml(id)}</div><small>${score(g.hands?.[id] || [])}${g.stood?.[id] ? " · stood" : ""}</small></div>`).join("")}</div>
    <div class="d-flex gap-2 justify-content-center mt-3">
      <button id="hitBtn" class="btn btn-gold" ${g.turn !== uid || room.status !== "playing" ? "disabled" : ""}>Hit</button>
      <button id="standBtn" class="btn btn-outline-gold" ${g.turn !== uid || room.status !== "playing" ? "disabled" : ""}>Stand</button>
    </div>
    <p class="mt-3 mb-0">${room.resultText || (g.turn ? `${room.players[g.turn]?.username}'s turn` : "")}</p>
  </div>`;
  $("hitBtn")?.addEventListener("click", () => hit(room, uid));
  $("standBtn")?.addEventListener("click", () => stand(room, uid));
}

async function hit(room, uid) {
  const g = room.game;
  if (g.turn !== uid) return;
  const deck = [...g.deck];
  const hands = { ...g.hands, [uid]: [...g.hands[uid], deck.pop()] };
  const busted = score(hands[uid]) > 21;
  const stood = { ...(g.stood || {}), ...(busted ? { [uid]: true } : {}) };
  const next = nextTurn(Object.keys(room.players), uid, stood);
  await update(ref(db, `rooms/${room.id}/game`), { deck, hands, stood, turn: next });
  if (!next) await finish(room, hands);
}

async function stand(room, uid) {
  const stood = { ...(room.game.stood || {}), [uid]: true };
  const next = nextTurn(Object.keys(room.players), uid, stood);
  await update(ref(db, `rooms/${room.id}/game`), { stood, turn: next });
  if (!next) await finish(room, room.game.hands);
}

async function finish(room, hands) {
  const players = Object.keys(room.players);
  const live = players.map((id) => ({ id, total: score(hands[id]) })).filter((p) => p.total <= 21);
  const high = live.length ? Math.max(...live.map((p) => p.total)) : 0;
  const winners = live.filter((p) => p.total === high).map((p) => p.id);
  await settleRoom(room, winners.length ? winners : players, winners.length ? `Best hand: ${high}.` : "All players busted. Pot returned.");
}

function nextTurn(players, current, stood) {
  const start = players.indexOf(current);
  for (let i = 1; i <= players.length; i++) {
    const id = players[(start + i) % players.length];
    if (!stood[id]) return id;
  }
  return null;
}

function score(hand) {
  let total = 0, aces = 0;
  hand.forEach((c) => {
    if (c.rank === "A") { aces++; total += 11; }
    else total += ["K", "Q", "J"].includes(c.rank) ? 10 : Number(c.rank);
  });
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}
