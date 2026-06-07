import { auth, db, ref, onAuthStateChanged, onDisconnect, serverTimestamp, set } from "./firebase.js";
import { initAuth, logout } from "./auth.js";
import { initLobby, stopLobby } from "./lobby.js";
import { initProfile, stopProfile } from "./profile.js";
import { initRooms, stopRooms } from "./rooms.js";

export const state = { user: null, profile: null, currentRoomId: null, currentRoom: null };

export const $ = (id) => document.getElementById(id);
export const fmt = (n) => Number(n || 0).toLocaleString();
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const avatars = { dealer: "◆", ace: "A", queen: "Q", chip: "●", star: "★" };
export const gameNames = { blackjack: "Blackjack Duel", dice: "Dice Duel", coinflip: "Coin Flip Duel", highcard: "High Card Duel", horserace: "Horse Racing Arena", roulette: "Roulette" };

export function toast(message, type = "info") {
  const host = $("toastHost");
  const el = document.createElement("div");
  el.className = `toast align-items-center border-0 text-bg-${type === "error" ? "danger" : type === "success" ? "success" : "dark"}`;
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  host.appendChild(el);
  const t = new bootstrap.Toast(el, { delay: 3200 });
  t.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function updateShell(user) {
  $("authView").classList.toggle("d-none", Boolean(user));
  $("appView").classList.toggle("d-none", !user);
  $("logoutBtn").classList.toggle("d-none", !user);
  $("navLinks").classList.toggle("d-none", !user);
}

function setupPresence(user) {
  const presenceRef = ref(db, `presence/${user.uid}`);
  set(presenceRef, { online: true, lastSeen: serverTimestamp() });
  onDisconnect(presenceRef).set({ online: false, lastSeen: serverTimestamp() });
}

initAuth();
$("logoutBtn").addEventListener("click", logout);

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  updateShell(user);
  stopLobby();
  stopProfile();
  stopRooms();
  if (!user) return;
  setupPresence(user);
  initProfile();
  initRooms();
  initLobby();
});
