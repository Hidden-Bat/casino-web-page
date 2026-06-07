# Aurum Casino

A production-ready static multiplayer virtual casino for GitHub Pages with Firebase Authentication and Firebase Realtime Database.

This is an entertainment app using virtual credits only. It includes no real money gambling, no cryptocurrency, no payment processing, and no cash-out flow.

## Features

- Firebase email/password authentication with session persistence
- Usernames, avatars, player profiles, balances, match history, and transaction history
- Simulated deposits and withdrawals with balance validation
- Public and private multiplayer rooms with room codes
- Host controls, ready state, leave/delete room flow, host migration, and room chat
- Realtime presence, online player list, active lobby, and leaderboard
- Blackjack Duel, Dice Duel, Coin Flip Duel, High Card Duel, Horse Racing Arena, and Roulette
- Mobile-first Bootstrap 5 layout with a dark premium casino theme

## Create Firebase Project

1. Open the Firebase Console.
2. Create a new project.
3. Add a Web App to the project.
4. Enable Authentication.
5. In Authentication, enable the Email/Password provider.
6. Create a Realtime Database.
7. Start in locked mode, then replace the rules with `firebase.rules` from this project.

## Obtain Firebase Keys

1. Open Project Settings.
2. Select your Web App.
3. Copy the Firebase SDK configuration object.
4. Open `assets/js/firebase.js`.
5. Replace every `PASTE_FIREBASE_*` value in `firebaseConfig`.

Required values:

```js
export const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Install Database Rules

1. In Firebase Console, open Realtime Database.
2. Open the Rules tab.
3. Paste the contents of `firebase.rules`.
4. Publish the rules.

## Push To GitHub

```bash
git init
git add .
git commit -m "Create virtual casino platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

## Enable GitHub Pages

1. Open your GitHub repository.
2. Go to Settings.
3. Open Pages.
4. Under Build and deployment, choose Deploy from a branch.
5. Select branch `main`.
6. Select folder `/root`.
7. Save.

GitHub Pages will publish the app at:

```text
https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/
```

## Deploy

After pushing changes to `main`, GitHub Pages deploys automatically. No build step is required because the app is static HTML, CSS, and JavaScript.

## Local Preview

Use any static server from the project root:

```bash
npx serve .
```

Then open the printed local URL.

## Firebase Notes

- All balances are virtual credits.
- Realtime game state is stored under `rooms`.
- User profile data is stored under `users`.
- Per-user transactions are stored under `transactions`.
- Match history is stored under `matches`.
- Presence is stored under `presence`.

Client-side validation and Firebase rules reduce invalid actions, but this project is intentionally for virtual-credit entertainment only and is not suitable for regulated gambling or real-money wagering.
