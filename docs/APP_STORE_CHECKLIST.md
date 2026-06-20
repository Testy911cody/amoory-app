# Talk Board — App Store Checklist

What is **done in the repo** vs what **you must do** before App Store / Play Store submission.

---

## Done in repo

- [x] PWA with offline service worker (`public/sw.js`)
- [x] PWA manifest + icons (192, 512, maskable, apple-touch)
- [x] Privacy policy page (`public/privacy.html`) — **replace `CONTACT_EMAIL_HERE` before publish**
- [x] Capacitor 8 config (`capacitor.config.ts`, app id `com.talkboard.app`)
- [x] Source assets for store icons (`assets/icon.png`, splash screens)
- [x] GitHub Pages deploy workflow (`.github/workflows/deploy.yml`)
- [x] Firebase Hosting config (`firebase.json`)
- [x] Kid-first autism-priority UI with caregiver mode
- [x] First/Then visual schedule
- [x] Supabase community word schema + upload wiring (needs your keys)

---

## Website deploy (free)

### GitHub Pages
1. Push repo to GitHub
2. Settings → Pages → Source: **GitHub Actions**
3. Optional secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Push to `main` — workflow deploys `dist/` automatically

```bash
npm run build
# or with icons: npm run build:all
```

### Firebase Hosting
1. `npx firebase login`
2. Edit `.firebaserc` → set your Firebase project id
3. `npm run build && npx firebase deploy --only hosting`

---

## Android (Windows OK)

```bash
npm run build
npm run cap:add:android    # once
npm run cap:sync
npm run cap:open:android   # Android Studio
```

### You must provide
- [ ] Google Play Developer account (**$25 one-time**)
- [ ] App signing keystore (Android Studio → Generate signed bundle)
- [ ] Store listing: title, short/full description, screenshots (phone + tablet)
- [ ] Privacy policy URL (host at your deployed site `/privacy.html`)
- [ ] Content rating questionnaire (IARC via Play Console)
- [ ] Target audience: designed for children — declare in Play Console

### Recommended before submit
```bash
npm run icons
npx @capacitor/assets generate --android   # if @capacitor/assets installed
npm run cap:sync
```

---

## iOS (requires Mac + Xcode)

```bash
npm run build
npm run cap:add:ios        # on Mac only
npm run cap:sync
npm run cap:open:ios
```

### You must provide
- [ ] Apple Developer account (**$99/year**)
- [ ] Mac with Xcode 15+
- [ ] App Store Connect app record
- [ ] Screenshots for required device sizes
- [ ] Privacy policy URL
- [ ] App Privacy details (no tracking; local storage + optional Supabase)

---

## Supabase (community words online)

Uses the **same Supabase project as House Games**. Keys live in `HouseGames/.env.local`.

1. Run `AmooryApp/docs/supabase-community-words.sql` in Supabase SQL Editor (once).
2. AmooryApp: `npm run env:from-housegames` then `npm run build`
3. Auth redirect URLs: `https://housegames.club/amoory/`, `http://localhost:3001/amoory/`
4. Privacy contact: test911code@gmail.com

---

## Store metadata drafts

**App name:** Talk Board  
**Subtitle:** Picture communication for kids  
**Short description:** Tap pictures to speak. Free AAC app for nonspeaking children, with community dialect voices.  
**Keywords:** AAC, autism, communication, speech, picture board, nonspeaking, Sudanese Arabic  
**Category:** Education / Medical (Accessibility)

---

## House Games integration

Source lives here; House Games publishes a copy at `/amoory/`. If you have the HouseGames repo locally:

```bash
npm run sync:amoory   # from HouseGames repo
```

If not local, deploy this app standalone or via GitHub Pages / Firebase.

---

## Free tier limits (plan ahead)

| Service | Free tier | When you pay |
|---------|-----------|--------------|
| Supabase | 500 MB DB, 1 GB storage, 50k MAU | More storage/users |
| GitHub Pages | Public repos, 1 GB site | Private repo needs paid plan |
| Firebase Hosting | 10 GB/month transfer | High traffic |

---

## Pre-submit test checklist

- [ ] `npm run build` succeeds
- [ ] Works offline after first load
- [ ] Microphone recording works on real device
- [ ] TTS works (install voice pack if needed on Android)
- [ ] Caregiver mode: hold ⚙️ 2 seconds
- [ ] First/Then schedule works
- [ ] Privacy policy email updated
- [ ] No placeholder Supabase keys in production build (or app gracefully degrades)
