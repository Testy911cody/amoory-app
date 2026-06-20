# Talk Board — Android release guide

Step-by-step from this repo to a signed AAB on Google Play. **Windows is fully supported.**

---

## Prerequisites

- [ ] Node.js 20+
- [ ] [Android Studio](https://developer.android.com/studio) (latest stable)
- [ ] JDK 17+ (bundled with Android Studio)
- [ ] Google Play Developer account (**$25 one-time** — you pay)
- [ ] Supabase keys: `npm run env:from-housegames` (from HouseGames `.env.local`)

---

## 1. Build web assets

```powershell
cd "C:\Users\sudan\Desktop\VSCODE - Copy\Projects\AmooryApp"
npm ci
npm run env:from-housegames   # once per machine
npm run build:all             # icons + dist/
```

Verify `dist/privacy.html` and `dist/sw.js` exist.

---

## 2. Add / sync Android project (first time)

```powershell
npm run cap:add:android       # only if android/ folder missing
npm run assets:android        # mipmap icons + splash from assets/
npm run cap:sync
```

Open in Android Studio:

```powershell
npm run cap:open:android
```

Or manually: **File → Open** → select the `android/` folder.

---

## 3. What's already configured in repo

| Item | Location |
|------|----------|
| App ID | `com.talkboard.app` (`capacitor.config.ts`) |
| App name | `Talk Board` (`android/app/src/main/res/values/strings.xml`) |
| INTERNET permission | `AndroidManifest.xml` |
| RECORD_AUDIO permission | `AndroidManifest.xml` |
| Splash + icons | `@capacitor/assets` via `npm run assets:android` |
| Native plugins | Splash Screen, Status Bar, App (back button) |

---

## 4. Test on device

1. Enable **Developer options** + **USB debugging** on your Android phone.
2. In Android Studio: select device → **Run** (green play).
3. Checklist:
   - [ ] Board loads offline (airplane mode after first open)
   - [ ] Tap word → TTS speaks
   - [ ] Record button → mic permission → playback works
   - [ ] Hold ⚙️ 2s → caregiver settings
   - [ ] Privacy policy link opens
   - [ ] Back button closes panels / minimizes app

---

## 5. Create signing keystore (one time — you do this)

**Android Studio:** Build → Generate Signed App Bundle / APK → **Android App Bundle** → Create new keystore.

Or CLI (PowerShell):

```powershell
keytool -genkey -v -keystore talkboard-release.keystore -alias talkboard -keyalg RSA -keysize 2048 -validity 10000
```

Store the keystore and passwords **outside git** (password manager + backup drive).  
Add to `.gitignore` if kept in project folder: `*.keystore`

---

## 6. Build release AAB

**Android Studio (recommended):**

1. Build → Generate Signed App Bundle / APK
2. Choose **Android App Bundle**
3. Select release keystore
4. Build variant: **release**
5. Output: `android/app/release/app-release.aab`

**Gradle CLI:**

```powershell
cd android
.\gradlew bundleRelease
```

Sign the bundle if using CLI-only signing (Play App Signing can manage the upload key).

---

## 7. Play Console upload

1. [Google Play Console](https://play.google.com/console) → Create app
2. **Store listing:** paste from `docs/STORE_LISTING.md`
3. **Privacy policy URL:** https://housegames.club/amoory/privacy.html
4. **App content:** Target audience (children), Data safety, Content rating (IARC)
5. **Release → Production** (or Internal testing first) → Upload AAB
6. Complete **Pre-launch report** and fix any crashes

---

## 8. Version bumps (future releases)

1. Bump `version` in root `package.json`
2. Bump `versionCode` + `versionName` in `android/app/build.gradle`
3. `npm run build:all && npm run cap:sync`
4. New signed AAB → Play Console

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| White screen on launch | Run `npm run build` then `npm run cap:sync` |
| Mic denied | Settings → Apps → Talk Board → Permissions → Microphone |
| Missing icons | `npm run icons && npm run assets:android && npm run cap:sync` |
| Gradle sync failed | Android Studio → File → Sync Project with Gradle Files |

---

## Commands quick reference

```powershell
npm run build:all
npm run cap:sync
npm run cap:open:android
```
