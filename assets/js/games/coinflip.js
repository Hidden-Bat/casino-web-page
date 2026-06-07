import { db, ref, update } from "../firebase.js";
import { $, fmt } from "../app.js";
import { settleRoom } from "../rooms.js";

export async function startCoinflip(room) {
  await update(ref(db, `rooms/${room.id}`), { status: "playing", game: { type: "coinflip", picks: {}, result: null } });
}

export function renderCoinflip(room, uid) {
  const g = room.game || {};
  const players = Object.keys(room.players || {});
  $("gameMount").innerHTML = `<div class="game-card">
    <h4>Coin Flip Duel</h4><p class="text-white-50">Pot ${fmt(room.bet * players.length)} · Pick heads or tails.</p>
    <div class="coin ${g.result ? "flip" : ""}">${g.result ? g.result[0].toUpperCase() : "?"}</div>
    <div class="d-flex gap-2 justify-content-center">
      <button class="btn btn-gold coin-pick" data-pick="heads" ${g.picks?.[uid] || room.status !== "playing" ? "disabled" : ""}>Heads</button>
      <button class="btn btn-outline-gold coin-pick" data-pick="tails" ${g.picks?.[uid] || room.status !== "playing" ? "disabled" : ""}>Tails</button>
    </div>
    <p class="mt-3 mb-0">${room.resultText || Object.entries(g.picks || {}).map(([id, p]) => `${room.players[id].username}: ${p}`).join(" · ")}</p>
  </div>`;
  document.querySelectorAll(".coin-pick").forEach((btn) => btn.addEventListener("click", async () => {
    if (g.picks?.[uid]) return;
    const picks = { ...(g.picks || {}), [uid]: btn.dataset.pick };
    const result = Math.random() < 0.5 ? "heads" : "tails";
    await update(ref(db, `rooms/${room.id}/game`), { picks, result: players.every((id) => picks[id]) ? result : null });
    if (players.every((id) => picks[id])) await settleRoom(room, players.filter((id) => picks[id] === result), `Coin landed ${result}.`);
  }));
}
