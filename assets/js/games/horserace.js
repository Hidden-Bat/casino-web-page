import { db, ref, update } from "../firebase.js";
import { $, fmt } from "../app.js";
import { settleRoom } from "../rooms.js";

const raceTimers = new Map();

export async function startHorseRace(room) {
  const progress = {};
  Object.keys(room.players || {}).forEach((id) => progress[id] = 0);
  await update(ref(db, `rooms/${room.id}`), { status: "playing", game: { type: "horserace", progress, running: true, ticks: 0 } });
}

export function renderHorseRace(room, uid) {
  const g = room.game || {};
  const players = Object.keys(room.players || {});
  if (uid === room.hostId && room.status === "playing" && g.running && !raceTimers.has(room.id)) {
    raceTimers.set(room.id, window.setInterval(() => advanceRace(room), 850));
  }
  if ((room.status !== "playing" || !g.running) && raceTimers.has(room.id)) {
    window.clearInterval(raceTimers.get(room.id));
    raceTimers.delete(room.id);
  }
  $("gameMount").innerHTML = `<div class="game-card" aria-live="polite">
    <h4>Horse Racing Arena</h4><p class="text-white-50">Pot ${fmt(room.pot || room.bet * players.length)} · First racer to the finish wins.</p>
    <div class="race-track">${players.map((id) => `<div class="race-lane"><span>${room.players[id].username}</span><div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, g.progress?.[id] || 0)}"><b style="left:${Math.min(96, g.progress?.[id] || 0)}%">♞</b></div></div>`).join("")}</div>
    <button id="raceTickBtn" class="btn btn-gold" ${!g.running || room.status !== "playing" ? "disabled" : ""}>Advance Race</button>
    <p class="mt-3 mb-0">${room.resultText || "Race in progress."}</p>
  </div>`;
  $("raceTickBtn")?.addEventListener("click", () => advanceRace(room));
}

async function advanceRace(room) {
  if (room.status !== "playing" || !room.game?.running || room.settled) return;
  const players = Object.keys(room.players || {});
  const progress = { ...(room.game.progress || {}) };
  players.forEach((id) => progress[id] = Math.min(100, Number(progress[id] || 0) + 4 + Math.floor(Math.random() * 14)));
  const high = Math.max(...Object.values(progress));
  await update(ref(db, `rooms/${room.id}/game`), { progress, ticks: Number(room.game.ticks || 0) + 1 });
  if (high >= 100) {
    if (raceTimers.has(room.id)) {
      window.clearInterval(raceTimers.get(room.id));
      raceTimers.delete(room.id);
    }
    const winners = players.filter((id) => progress[id] === high);
    await settleRoom(room, winners, `${room.players[winners[0]].username} crossed the finish.`);
  }
}
