import { auth, db, ref, push, onValue, off, serverTimestamp } from "./firebase.js";
import { $, state, escapeHtml, toast } from "./app.js";

let chatRef = null;
let chatBound = false;

export function initChat(roomId) {
  stopChat();
  chatRef = ref(db, `rooms/${roomId}/chat`);
  onValue(chatRef, (snap) => renderChat(snap.val() || {}));
}

export function stopChat() {
  if (chatRef) off(chatRef);
  chatRef = null;
  $("chatMessages").innerHTML = "";
}

export function bindChatForm() {
  if (chatBound) return;
  $("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.currentRoomId) return;
    const text = $("chatInput").value.trim().replace(/\s+/g, " ");
    if (!text) return;
    if (text.length > 180) return toast("Message is too long.", "error");
    await push(ref(db, `rooms/${state.currentRoomId}/chat`), {
      uid: auth.currentUser.uid,
      username: state.profile?.username || "Player",
      text,
      date: serverTimestamp()
    });
    $("chatInput").value = "";
  });
  chatBound = true;
}

function renderChat(messages) {
  const rows = Object.values(messages).sort((a, b) => Number(a.date || 0) - Number(b.date || 0)).slice(-60);
  $("chatMessages").innerHTML = rows.map((m) => `<div class="chat-line"><strong>${escapeHtml(m.username)}:</strong> ${escapeHtml(m.text)}</div>`).join("");
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
}
