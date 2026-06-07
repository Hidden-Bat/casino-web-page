import { auth, db, ref, onValue, off, update, runTransaction, serverTimestamp } from "./firebase.js";
import { $, state, fmt, avatars, escapeHtml, toast } from "./app.js";

let refs = [];
let profileBound = false;

export function initProfile() {
  const uid = auth.currentUser.uid;
  const userRef = ref(db, `users/${uid}`);
  refs.push(userRef);
  onValue(userRef, (snap) => {
    state.profile = snap.val();
    renderProfile();
  });

  const txRef = ref(db, `transactions/${uid}`);
  const matchRef = ref(db, `matches/${uid}`);
  refs.push(txRef, matchRef);
  onValue(txRef, (snap) => renderTransactions(snap.val() || {}));
  onValue(matchRef, (snap) => renderMatches(snap.val() || {}));

  if (!profileBound) {
    document.querySelectorAll(".bank-deposit").forEach((btn) => btn.addEventListener("click", () => bank("deposit", Number(btn.dataset.amount))));
    $("withdrawForm").addEventListener("submit", (e) => {
      e.preventDefault();
      bank("withdraw", Number($("withdrawAmount").value));
      $("withdrawAmount").value = "";
    });
    $("profileForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = $("profileUsername").value.trim();
      if (username.length < 3) return toast("Username must be at least 3 characters.", "error");
      await update(ref(db, `users/${auth.currentUser.uid}`), { username, avatar: $("profileAvatarSelect").value });
      toast("Profile saved.", "success");
    });
    profileBound = true;
  }
}

export function stopProfile() {
  refs.forEach((r) => off(r));
  refs = [];
  state.profile = null;
}

function renderProfile() {
  const p = state.profile;
  if (!p) return;
  const rate = p.totalGames ? Math.round((p.totalWins || 0) / p.totalGames * 100) : 0;
  $("welcomeName").textContent = p.username;
  $("balanceText").textContent = fmt(p.balance);
  $("winsText").textContent = fmt(p.totalWins);
  $("winRateText").textContent = `${rate}%`;
  $("profileName").textContent = p.username;
  $("profileUsername").value = p.username;
  $("profileAvatarSelect").value = p.avatar || "dealer";
  $("profileAvatar").textContent = avatars[p.avatar] || avatars.dealer;
}

function renderTransactions(items) {
  const rows = Object.values(items).sort((a, b) => toMillis(b.date) - toMillis(a.date)).slice(0, 40);
  $("transactionHistory").innerHTML = rows.length ? rows.map((t) => `
    <div class="history-row"><span>${dateText(t.date)} · ${escapeHtml(t.type)} ${t.amount > 0 ? "+" : ""}${fmt(t.amount)}</span><strong>${fmt(t.balanceAfter)}</strong></div>
  `).join("") : `<p class="text-white-50 mb-0">No transactions yet.</p>`;
}

function renderMatches(items) {
  const rows = Object.values(items).sort((a, b) => toMillis(b.date) - toMillis(a.date)).slice(0, 40);
  $("matchHistory").innerHTML = rows.length ? rows.map((m) => `
    <div class="history-row"><span>${dateText(m.date)} · ${escapeHtml(m.game)} · ${escapeHtml(m.result)}</span><strong>${m.delta > 0 ? "+" : ""}${fmt(m.delta)}</strong></div>
  `).join("") : `<p class="text-white-50 mb-0">No matches yet.</p>`;
}

async function bank(type, rawAmount) {
  const uid = auth.currentUser.uid;
  const amount = Math.floor(Number(rawAmount));
  if (!Number.isFinite(amount) || amount <= 0) return toast("Enter a valid amount.", "error");
  let balanceAfter = 0;
  const result = await runTransaction(ref(db, `users/${uid}/balance`), (balance) => {
    balance = Number(balance || 0);
    if (type === "withdraw" && amount > balance) return;
    balanceAfter = type === "deposit" ? balance + amount : balance - amount;
    return balanceAfter;
  });
  if (!result.committed) return toast("Insufficient virtual balance.", "error");
  balanceAfter = result.snapshot.val();
  await update(ref(db, `transactions/${uid}/${Date.now()}`), {
    type,
    amount: type === "deposit" ? amount : -amount,
    balanceAfter,
    date: serverTimestamp()
  });
  toast(`${type === "deposit" ? "Deposited" : "Withdrew"} ${fmt(amount)} virtual credits.`, "success");
}

function toMillis(value) {
  return typeof value === "number" ? value : 0;
}

function dateText(value) {
  const ms = toMillis(value);
  return ms ? new Date(ms).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "Pending";
}
