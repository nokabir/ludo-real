# Ludo Real

Free online Ludo game for Android: play with tables, timer games, private rooms with friends, Pass & Play and vs Computer. Coins are virtual and for fun only.

- `www/` — the app screens (bundled into the Android app by Capacitor)
- `server/` — game server (Node.js): Firebase sign-in check, coins, matchmaking, live games
- `android/` — Capacitor Android project (package `com.definiteautomation.dreamludo`)

## Run the server locally
```bash
npm install
npm start          # http://localhost:3090  (set ALLOW_DEV_LOGIN=1 in .env to test in a browser)
```

## Build the Android app
```bash
npx cap sync android
cd android && ./gradlew assembleDebug     # needs android/keystore.properties + the upload key
```
