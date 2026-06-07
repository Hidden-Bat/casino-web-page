import { auth, db, ref, get, set, serverTimestamp, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "./firebase.js";
import { $, toast } from "./app.js";

const initialProfile = (uid, email, username, avatar) => ({
  uid,
  email,
  username,
  avatar,
  balance: 1000,
  totalWins: 0,
  totalLosses: 0,
  totalGames: 0,
  createdAt: serverTimestamp()
});

export function initAuth() {
  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("registerUsername").value.trim();
    const email = $("registerEmail").value.trim();
    const password = $("registerPassword").value;
    const avatar = $("registerAvatar").value;
    if (username.length < 3) return toast("Username must be at least 3 characters.", "error");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await set(ref(db, `users/${cred.user.uid}`), initialProfile(cred.user.uid, email, username, avatar));
      await set(ref(db, `transactions/${cred.user.uid}/${Date.now()}`), {
        type: "deposit",
        amount: 1000,
        balanceAfter: 1000,
        date: serverTimestamp(),
        note: "Starting credits"
      });
      toast("Account created with 1,000 virtual credits.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, $("loginEmail").value.trim(), $("loginPassword").value);
      toast("Logged in.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

export async function logout() {
  const user = auth.currentUser;
  if (user) {
    const snap = await get(ref(db, `users/${user.uid}/currentRoom`));
    if (snap.exists()) toast("Leave your room before logging out.", "error");
  }
  await signOut(auth);
}
