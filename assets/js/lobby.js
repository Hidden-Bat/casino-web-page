import { auth, db, ref, onValue, off } from "./firebase.js";
import { $, gameNames, escapeHtml, fmt, avatars } from "./app.js";
import { joinRoomById } from "./rooms.js";

let refs = [];
let board = "richest";
let lobbyBound = false;
let cachedUsers = {};
let cachedPresence = {};

export function initLobby() {
  const roomsRef = ref(db, "rooms");
  const usersRef = ref(db, "users");
  const presenceRef = ref(db, "presence");
  refs.push(roomsRef, usersRef, presenceRef);
  onValue(roomsRef, (snap) => renderRooms(snap.val() || {}));
  onValue(usersRef, (snap) => {
    cachedUsers = snap.val() || {};
    renderLeaderboard(cachedUsers);
    renderPresence(cachedPresence, cachedUsers);
  });
  onValue(presenceRef, (snap) => {
    cachedPresence = snap.val() || {};
    renderPresence(cachedPresence, cachedUsers);
  });

  if (!lobbyBound) {
    $("joinCodeBtn").addEventListener("click", () => joinRoomById($("roomCodeInput").value.trim().toUpperCase()));
    $("roomCodeInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") joinRoomById($("roomCodeInput").value.trim().toUpperCase());
    });
    document.querySelectorAll("[data-board]").forEach((btn) => btn.addEventListener("click", () => {
      document.querySelectorAll("[data-board]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      board = btn.dataset.board;
      renderLeaderboard(cachedUsers);
    }));
    lobbyBound = true;
  }
}

export function stopLobby() {
  refs.forEach((r) => off(r));
  refs = [];
  cachedUsers = {};
  cachedPresence = {};
}

function renderRooms(rooms) {
  const list = Object.entries(rooms)
    .filter(([, r]) => r.status !== "ended" && !r.private)
    .sort((a, b) => Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0));
  $("roomsList").innerHTML = list.length ? list.map(([id, r]) => {
    const count = Object.keys(r.players || {}).length;
    return `<article class="room-card">
      <div><span class="badge text-bg-dark">${escapeHtml(gameNames[r.gameType] || r.gameType)}</span><span class="badge text-bg-warning text-dark ms-2">${fmt(r.bet)} bet</span></div>
      <h4>${escapeHtml(r.name || "Casino Room")}</h4>
      <p>${count}/${r.maxPlayers} players · Host ${escapeHtml(r.hostName || "Player")} · ${escapeHtml(r.status || "waiting")}</p>
      <button class="btn btn-sm btn-gold join-room" data-id="${id}" ${r.status !== "waiting" ? "disabled" : ""}>Join Table</button>
    </article>`;
  }).join("") : `<p class="text-white-50 mb-0">No public rooms yet. Create the first table.</p>`;
  document.querySelectorAll(".join-room").forEach((btn) => btn.addEventListener("click", () => joinRoomById(btn.dataset.id)));
}

function renderPresence(presence, users) {
  const online = Object.entries(presence).filter(([, p]) => p.online).slice(0, 30);
  $("onlinePlayers").innerHTML = online.length ? online.map(([uid]) => {
    const user = users[uid] || {};
    return `<div class="side-row"><span class="avatar-sm">${avatars[user.avatar] || avatars.dealer}</span><span>${uid === auth.currentUser.uid ? "You" : escapeHtml(user.username || uid.slice(0, 8))}</span></div>`;
  }).join("") : `<p class="text-white-50 mb-0">No players online.</p>`;
}

function renderLeaderboard(users) {
  let rows = Object.values(users).map((u) => ({ ...u, rate: u.totalGames ? (u.totalWins || 0) / u.totalGames : 0 }));
  if (board === "wins") rows.sort((a, b) => (b.totalWins || 0) - (a.totalWins || 0));
  else if (board === "rate") rows.sort((a, b) => b.rate - a.rate || (b.totalGames || 0) - (a.totalGames || 0));
  else rows.sort((a, b) => (b.balance || 0) - (a.balance || 0));
  rows = rows.slice(0, 10);
  $("leaderboard").innerHTML = rows.length ? rows.map((u, i) => `<div class="side-row"><span class="rank">${i + 1}</span><span>${escapeHtml(u.username || "Player")}</span><strong>${board === "rate" ? Math.round(u.rate * 100) + "%" : fmt(board === "wins" ? u.totalWins : u.balance)}</strong></div>`).join("") : `<p class="text-white-50 mb-0">No leaderboard data.</p>`;
}
