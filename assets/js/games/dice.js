import { db, ref, update } from "../firebase.js";
import { $, fmt } from "../app.js";
import { settleRoom } from "../rooms.js";

export async function startDice(room) {
  await update(ref(db, `rooms/${room.id}`), { status: "playing", game: { type: "dice", rolls: {}, message: "Roll to challenge the table." } });
}

export function renderDice(room, uid) {
  const g = room.game || {};
  const players = Object.keys(room.players || {});
  const mine = g.rolls?.[uid];
  $("gameMount").innerHTML = `<div class="game-card" aria-live="polite">
    <h4>Dice Duel</h4><p class="text-white-50">Pot ${fmt(room.pot || room.bet * players.length)} · Higher number wins.</p>
    <div class="dice-row">${players.map((id) => `<div class="dice-face ${g.rolls?.[id] ? "rolled" : ""}">${g.rolls?.[id] || "?"}<small>${room.players[id].username}</small></div>`).join("")}</div>
    <button id="rollDiceBtn" class="btn btn-gold" ${mine || room.status !== "playing" ? "disabled" : ""}>Roll Dice</button>
    <p class="mt-3 mb-0">${room.resultText || g.message || ""}</p>
  </div>`;
  document.getElementById("rollDiceBtn")?.addEventListener("click", async () => {
    if ((room.game?.rolls || {})[uid] || room.status !== "playing") return;
    const value = 1 + Math.floor(Math.random() * 6);
    const rolls = { ...(g.rolls || {}), [uid]: value };
    await update(ref(db, `rooms/${room.id}/game/rolls/${uid}`), value);
    await maybeSettle(rolls, players, room);
  });
}

async function maybeSettle(rolls, players, room) {
  if (!players.every((id) => rolls[id])) return;
  const high = Math.max(...Object.values(rolls));
  const winners = players.filter((id) => rolls[id] === high);
  await settleRoom(room, winners, `Highest roll: ${high}`);
}
