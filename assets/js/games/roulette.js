import { db, ref, update } from "../firebase.js";
import { $, fmt } from "../app.js";
import { settleRoom } from "../rooms.js";

const red = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

export async function startRoulette(room) {
  await update(ref(db, `rooms/${room.id}`), { status: "playing", game: { type: "roulette", bet: null, spun: false } });
}

export function renderRoulette(room, uid) {
  const g = room.game || {};
  const locked = Boolean(g.bet) || room.status !== "playing";
  $("gameMount").innerHTML = `<div class="game-card" aria-live="polite">
    <h4>Roulette</h4><p class="text-white-50">Stake ${fmt(room.bet)} · Red/black and odd/even pay 2x. Exact number pays 36x.</p>
    <div class="roulette-wheel ${g.spun ? "spin" : ""}" role="img" aria-label="Roulette result">${g.number ?? "?"}</div>
    <div class="roulette-actions">
      <button class="btn btn-gold roulette-bet" data-kind="red" ${locked ? "disabled" : ""}>Red</button>
      <button class="btn btn-dark roulette-bet" data-kind="black" ${locked ? "disabled" : ""}>Black</button>
      <button class="btn btn-outline-gold roulette-bet" data-kind="odd" ${locked ? "disabled" : ""}>Odd</button>
      <button class="btn btn-outline-gold roulette-bet" data-kind="even" ${locked ? "disabled" : ""}>Even</button>
      <label class="visually-hidden" for="rouletteNumber">Exact number</label>
      <input id="rouletteNumber" class="form-control" type="number" min="0" max="36" inputmode="numeric" placeholder="0-36" ${locked ? "disabled" : ""}>
      <button id="rouletteNumberBtn" class="btn btn-outline-gold" ${locked ? "disabled" : ""}>Number</button>
    </div>
    <p class="mt-3 mb-0">${room.resultText || (g.bet ? `Bet: ${g.bet.kind} ${g.bet.value ?? ""}` : "Place your wager.")}</p>
  </div>`;
  document.querySelectorAll(".roulette-bet").forEach((btn) => btn.addEventListener("click", () => spin(room, uid, { kind: btn.dataset.kind })));
  document.getElementById("rouletteNumberBtn")?.addEventListener("click", () => {
    const value = Number($("rouletteNumber").value);
    if (Number.isInteger(value) && value >= 0 && value <= 36) spin(room, uid, { kind: "number", value });
  });
}

async function spin(room, uid, bet) {
  if (room.game?.bet || room.status !== "playing") return;
  const number = Math.floor(Math.random() * 37);
  const color = number === 0 ? "green" : red.has(number) ? "red" : "black";
  const win = (bet.kind === color) ||
    (bet.kind === "odd" && number % 2 === 1) ||
    (bet.kind === "even" && number > 0 && number % 2 === 0) ||
    (bet.kind === "number" && bet.value === number);
  const multiplier = bet.kind === "number" ? 36 : 2;
  const payoutMap = { [uid]: win ? room.bet * multiplier : 0 };
  await update(ref(db, `rooms/${room.id}/game`), { bet, spun: true, number, color });
  await settleRoom(room, win ? [uid] : [], `Roulette landed ${number} ${color}. ${win ? "Winner paid." : "No winning wager."}`, payoutMap);
}
