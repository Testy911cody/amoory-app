# Talk Board — App Store Checklist

What is **done in the repo** vs what **you must do** before App Store / Play Store submission.

---

## Done in repo

- [x] PWA with offline service worker (`public/sw.js` → copied to `dist/sw.js`)
- [x] PWA manifest + icons (192, 512, maskable, apple-touch)
- [x] Privacy policy (`public/privacy.html`) — contact: **test911code@gmail.com**
- [x] In-app privacy link in caregiver settings (`public/index.html`)
- [x] Capacitor 8 config (`capacitor.config.ts`, app id `com.talkboard.app`)
- [x] Capacitor plugins: Splash Screen, Status Bar, App (back button)
- [x] Native shell bundle (`scripts/native-shell.js` → `dist/src/native.js` on build)
- [x] Source assets for store icons (`assets/icon.png`, splash screens)
- [x] Icon generator (`npm run icons`) + Android asset generator (`npm run assets:android`)
- [x] Android project (`android/`) with INTERNET + RECORD_AUDIO permissions
- [x] GitHub Pages deploy workflow (`.github/workflows/deploy.yml`)
- [x] Firebase Hosting config (`firebase.json`)
- [x] Cloudflare Pages config (`wrangler.toml`)
- [x] Store docs: `docs/STORE_LISTING.md`, `docs/ANDROID_RELEASE.md`, `docs/IOS_RELEASE.md`
- [x] Kid-first UI, First/Then schedule, Supabase community wiring
- [x] Version **1.0.0** in `package.json`
- [x] Env copy script: `npm run env:from-housegames`

---

## You must do (manual)

### Accounts & fees
- [ ] Google Play Developer account (**$25 one-time**)
- [ ] Apple Developer account (**$99/year**) — Mac + Xcode required for iOS build

### Android (Windows OK)
- [ ] Create release keystore and sign AAB (see `docs/ANDROID_RELEASE.md`)
- [ ] Upload AAB to Play Console
- [ ] Complete store listing (paste from `docs/STORE_LISTING.md`)
- [ ] Content rating (IARC) + target audience (children)
- [ ] Real-device QA: mic, TTS, offline, caregiver mode

### iOS (Mac only)
- [ ] On Mac: `npm run cap:add:ios`, `npm run assets:ios`, `npm run cap:sync`
- [ ] Add `NSMicrophoneUsageDescription` to Info.plist (see `docs/IOS_RELEASE.md`)
- [ ] Archive in Xcode → upload to App Store Connect
- [ ] Screenshots + App Privacy questionnaire

### Deploy / hosting
- [ ] Push to GitHub; enable Pages (Actions source) if using standalone URL
- [ ] Optional GitHub secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Production privacy URL live: https://housegames.club/amoory/privacy.html
- [ ] Run `docs/supabase-community-words.sql` in Supabase (once)
- [ ] Supabase auth redirect URLs: `https://housegames.club/amoory/`, `http://localhost:3001/amoory/`

---

## Quick commands

```powershell
# Full web + icon build
npm run env:from-housegames
npm run build:all

# Android (Windows)
npm run cap:sync
npm run cap:open:android

# iOS (Mac only — do not run on Windows)
npm run cap:add:ios
npm run assets:ios
npm run cap:sync
npm run cap:open:ios
```

---

## Website deploy

### GitHub Pages
1. Push to `main` — workflow builds and deploys `dist/`
2. Settings → Pages → Source: **GitHub Actions**

### Firebase Hosting
```bash
npm run build && npx firebase deploy --only hosting
```

### House Games (primary production path)
Talk Board at **https://housegames.club/amoory/** via HouseGames sync.

---

## Pre-submit test checklist

- [ ] `npm run build` succeeds
- [ ] `dist/privacy.html` present; email is test911code@gmail.com
- [ ] `dist/sw.js` present — works offline after first load
- [ ] Microphone recording on real Android device
- [ ] TTS works (install voice pack on Android if needed)
- [ ] Caregiver mode: hold ⚙️ 2 seconds
- [ ] First/Then schedule works
- [ ] No placeholder Supabase keys in production (or graceful offline degrade)

---

## Doc index

| Document | Purpose |
|----------|---------|
| `docs/STORE_LISTING.md` | Titles, descriptions, keywords, privacy answers |
| `docs/ANDROID_RELEASE.md` | Keystore, AAB, Play Console steps |
| `docs/IOS_RELEASE.md` | Xcode, Info.plist, App Store Connect |

---

## Free tier limits

| Service | Free tier | When you pay |
|---------|-----------|--------------|
| Supabase | 500 MB DB, 1 GB storage, 50k MAU | More storage/users |
| GitHub Pages | Public repos | Private repo needs paid plan |
| Firebase Hosting | 10 GB/month transfer | High traffic |
