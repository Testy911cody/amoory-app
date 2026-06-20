# Talk Board — iOS release guide

**Requires a Mac with Xcode 15+.** This repo prepares Capacitor config and docs; the `ios/` folder is created on Mac only (`npm run cap:add:ios`).

---

## Prerequisites

- [ ] Mac with Xcode 15+ and Apple Developer account (**$99/year** — you pay)
- [ ] Node.js 20+ on Mac
- [ ] Same Supabase env as Android: copy HouseGames keys → `.env.local`

---

## 1. Clone repo on Mac

```bash
git clone https://github.com/Testy911cody/amoory-app.git
cd amoory-app
npm ci
npm run env:from-housegames
npm run build:all
```

---

## 2. Add iOS platform (Mac only)

```bash
npm run cap:add:ios        # creates ios/
npm run assets:ios         # App Icon + Splash from assets/
npm run cap:sync
npm run cap:open:ios       # opens Xcode
```

Do **not** run `cap:add:ios` on Windows — it will fail. The Android project in `android/` is the Windows-prepared shell.

---

## 3. Required Info.plist entries

After `cap add ios`, open `ios/App/App/Info.plist` in Xcode (or text editor) and ensure:

### Microphone (required — voice recording)

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Talk Board uses the microphone only when you tap Record, to save a personal voice clip for a word.</string>
```

### Optional but recommended

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

(COMMUNICATION app with HTTPS only — standard export compliance exemption.)

### Display name

In Xcode → **App** target → **General** → **Display Name:** `Talk Board`  
**Bundle Identifier:** `com.talkboard.app`

---

## 4. Capacitor plugins (already in package.json)

Sync installs native code for:

- `@capacitor/splash-screen`
- `@capacitor/status-bar`
- `@capacitor/app`

Run `npm run cap:sync` after any web or config change.

---

## 5. Signing in Xcode

1. Select **App** target → **Signing & Capabilities**
2. Team: your Apple Developer team
3. Enable **Automatically manage signing**
4. Connect iPhone or choose simulator → **Run** (⌘R)

Test the same checklist as Android (offline, TTS, mic, caregiver mode, privacy link).

---

## 6. App Store Connect

1. [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **+** New App
2. Platform: iOS  
   Name: **Talk Board**  
   Bundle ID: `com.talkboard.app`  
   SKU: e.g. `talkboard-ios`
3. **App Privacy:** answers in `docs/STORE_LISTING.md`
4. **Privacy policy URL:** https://housegames.club/amoory/privacy.html
5. Upload screenshots (required iPhone sizes — see STORE_LISTING.md)
6. Paste description / keywords from `docs/STORE_LISTING.md`

---

## 7. Archive and upload

1. Xcode → destination **Any iOS Device (arm64)**
2. **Product → Archive**
3. **Distribute App → App Store Connect → Upload**
4. In Connect: submit for review when processing completes

---

## 8. Version bumps

1. Root `package.json` version
2. Xcode → **General → Version** (marketing) and **Build** (integer, must increase each upload)
3. `npm run build:all && npm run cap:sync`
4. New archive → upload

---

## Windows developers

Prepare everything in this repo on Windows (web build, Android, docs). Hand off to Mac for:

```bash
npm run cap:add:ios
npm run assets:ios
npm run cap:sync
# Add NSMicrophoneUsageDescription to Info.plist
npm run cap:open:ios
```

Commit `ios/` from Mac if you want CI/Xcode Cloud to build later (currently `ios/` is gitignored until first Mac add — remove from `.gitignore` after generating if desired).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Mic prompt missing text | Add `NSMicrophoneUsageDescription` to Info.plist |
| White screen | Re-run `npm run build && npm run cap:sync` |
| Signing errors | Match bundle ID `com.talkboard.app` in Xcode and Connect |
| Plugin not found | `npm ci && npm run cap:sync` |
