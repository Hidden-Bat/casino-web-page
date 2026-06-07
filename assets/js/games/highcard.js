import { db, ref, update } from "../firebase.js";
import { $, fmt } from "../app.js";
import { settleRoom } from "../rooms.js";

const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export async function startHighcard(room) {
  const deck = ranks.flatMap((rank, i) => suits.map((suit) => ({ rank, suit, value: i + 2 }))).sort(() => Math.random() - 0.5);
  const players = Object.keys(room.players || {});
  const cards = {};
  players.forEach((id, i) => cards[id] = deck[i]);
  const high = Math.max(...players.map((id) => cards[id].value));
  const winners = players.filter((id) => cards[id].value === high);
  await update(ref(db, `rooms/${room.id}`), { status: "playing", game: { type: "highcard", cards } });
  await settleRoom({ ...room, game: { cards } }, winners, `High card ${cards[winners[0]].rank}${cards[winners[0]].suit}.`);
}

export function renderHighcard(room) {
  const players = Object.keys(room.players || {});
  const cards = room.game?.cards || {};
  $("gameMount").innerHTML = `<div class="game-card" aria-live="polite">
    <h4>High Card Duel</h4><p class="text-white-50">Pot ${fmt(room.pot || room.bet * players.length)} · Highest card wins.</p>
    <div class="card-row">${players.map((id) => `<div class="playing-card ${cards[id]?.suit === "♥" || cards[id]?.suit === "♦" ? "red" : ""}"><strong>${cards[id]?.rank || "?"}</strong><span>${cards[id]?.suit || ""}</span><small>${room.players[id].username}</small></div>`).join("")}</div>
    <p class="mt-3 mb-0">${room.resultText || "Drawing cards..."}</p>
  </div>`;
}
