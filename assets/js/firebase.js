import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  remove,
  onValue,
  off,
  onDisconnect,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {

  apiKey: "AIzaSyA4CkPF84V-aoVZEgp40BNPrmMI8wKaDJA",
  authDomain: "casino-web-page.firebaseapp.com",
  databaseURL: "https://casino-web-page-default-rtdb.firebaseio.com",
  projectId: "casino-web-page",
  storageBucket: "casino-web-page.firebasestorage.app",
  messagingSenderId: "634053798802",
  appId: "1:634053798802:web:b76164e9cc545522eb2f4b"

};


export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
await setPersistence(auth, browserLocalPersistence);

export {
  ref,
  set,
  get,
  update,
  push,
  remove,
  onValue,
  off,
  onDisconnect,
  serverTimestamp,
  runTransaction,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
};
