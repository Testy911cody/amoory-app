# Talk Board — Store Listing (copy/paste)

Ready-to-paste metadata for Google Play Console and App Store Connect.

---

## App identity

| Field | Value |
|-------|-------|
| **App name** | Talk Board |
| **Subtitle (iOS)** | Picture communication for kids |
| **Package / Bundle ID** | `com.talkboard.app` |
| **Version** | 1.0.0 |
| **Privacy policy URL** | https://housegames.club/amoory/privacy.html |
| **Support email** | test911code@gmail.com |
| **Website** | https://housegames.club/amoory/ |

---

## Short description (Play Store — 80 chars max)

Tap pictures to speak. Free AAC app for nonspeaking children with dialect voices.

---

## Full description (EN)

**Talk Board** is a free picture-and-voice communication app designed for nonspeaking children, families, and educators.

Tap a picture to hear the word spoken aloud. Build simple sentences, use a First/Then visual schedule, and record personal voice clips so the board sounds like home.

**Features**
- Kid-first layout with large, calm picture cards
- Works offline after the first load — no account required for daily use
- Text-to-speech in multiple languages and dialects
- Record your own voice for any word
- First/Then visual schedule for routines
- Optional community word library (caregiver sign-in; moderated before publishing)
- Caregiver mode: hold ⚙️ for 2 seconds to adjust settings, reorder cards, and manage words

**Privacy**
- No ads, no tracking, no analytics SDKs
- Core board data stays on the device
- Microphone is used only when you tap Record
- See our privacy policy for full details

Built for accessibility and everyday communication — at home, in therapy, and at school.

---

## Full description (AR — optional)

**لوحة الحديث** تطبيق مجاني للتواصل بالصور والصوت، مصمّم للأطفال غير الناطقين والعائلات والم educators.

اضغط على صورة لسماع الكلمة. أنشئ جملاً بسيطة، استخدم جدول «أولاً / ثم»، وسجّل صوتك للكلمات.

- يعمل دون اتصال بعد التحميل الأول
- لا حاجة لحساب للاستخدام اليومي
- تسجيل صوت شخصي للكلمات
- وضع مقدّم الرعاية (اضغط مطوّلاً على ⚙️)
- بدون إعلانات أو تتبّع

---

## Keywords (App Store — comma-separated, 100 chars)

AAC,autism,communication,speech,picture board,nonspeaking,accessibility,Arabic,visual schedule

---

## Category

| Store | Primary | Secondary (optional) |
|-------|---------|----------------------|
| **Google Play** | Education | Medical (or Parenting) |
| **App Store** | Education | Medical |

---

## Age rating / audience

- **Target audience:** Families with young children; designed for accessibility (AAC)
- **Google Play:** Designed for children — declare in Play Console; complete IARC questionnaire
- **App Store:** Age rating likely 4+ (no objectionable content)
- **Not a medical device** — communication aid / educational tool (state in review notes if asked)

---

## Screenshot checklist

Capture on a **real phone** (not emulator-only) after `npm run build` + install from Android Studio.

### Phone (required)
- [ ] Home board — kid view with picture cards
- [ ] Sentence bar with 2–3 words selected
- [ ] First/Then schedule panel
- [ ] Caregiver settings (language / voice)
- [ ] Recording overlay (optional)

### Tablet (Play Store — if supporting tablets)
- [ ] Home board in landscape or large layout

### App Store device sizes (Mac + Xcode simulator or device)
- [ ] 6.7" iPhone (1290 × 2796)
- [ ] 6.5" iPhone (1284 × 2778) — if required by Connect
- [ ] 12.9" iPad Pro — if iPad supported

**Tips:** Use light mode, hide status bar clutter, no personal child photos in screenshots.

---

## App Privacy questionnaire (Apple) — suggested answers

| Data type | Collected? | Linked to user? | Tracking? |
|-----------|------------|-----------------|-----------|
| Contact info (email) | Only if caregiver creates account | Yes | No |
| User content (audio recordings) | Yes — local; optional upload for community | Optional | No |
| Identifiers (advertising) | No | — | No |
| Usage data / analytics | No | — | No |
| Location | No | — | No |

- **Data not collected:** Precise location, contacts, photos, browsing history, diagnostics (unless you add Crashlytics later)
- **Microphone:** Used for explicit user-initiated voice recording only
- **Privacy policy URL:** https://housegames.club/amoory/privacy.html

---

## Google Play Data safety — suggested answers

- **Data collected:** Email (optional, account), audio files (optional community upload)
- **Data shared:** None sold; Supabase processes optional community uploads
- **Encryption in transit:** Yes (HTTPS)
- **Users can request deletion:** Yes — email test911code@gmail.com
- **Committed to Play Families policy:** Yes (if targeting children)

---

## Feature graphic (Play Store)

1024 × 500 PNG — teal brand (#2E8C8C) with Talk Board logo centered. Generate from `assets/icon-source.png` or design tool.

---

## What's New (v1.0.0)

Initial release: picture communication board, offline support, personal recordings, First/Then schedule, and optional community dialect library.
