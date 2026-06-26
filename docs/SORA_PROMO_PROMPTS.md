# Talk Board — Sora Promo Video Prompts

Production-ready prompts for OpenAI **Sora** (or similar cinematic video models).  
**App:** Talk Board — free AAC picture board for nonspeaking children  
**Production URL:** https://housegames.club/amoory/  
**Landing:** https://housegames.club/amoory/promo.html

**Brand accent:** `#2E8C8C` (soft teal) · **Background:** `#F2F6F8` (calm off-white)  
**Tone:** Warm, hopeful, professional — never exploitative, never fabricated social proof.

**Related:** `docs/MARKETING_AD_KIT.md` · `public/promo.html` · `feedback/agent/CLAUDE_DIRECTIVE.md`

---

## App visual reference (for Sora / compositing)

When generating UI shots, match the real app aesthetic:

| Element | Description |
|---------|-------------|
| **Header** | White top bar, bold **Talk Board** title, teal accent buttons, optional language chip (e.g. Arabic / Sudanese) |
| **Picture cards** | Large rounded white cards (~108px grid), emoji icon on top, short label below, soft shadow, calm spacing |
| **Categories** | Horizontal pill tabs with colored dots (people, feelings, food, actions) |
| **Sentence strip** | White bar with tapped chips + large teal **Say** button |
| **Palette** | Teal `#2E8C8C`, ink `#1E3A45`, soft gray-blue `#5B7886`, white cards on light gray background |

**Best practice:** Generate lifestyle footage in Sora; capture UI as screen recordings from https://housegames.club/amoory/ or clean static mockups. Composite in edit — Sora often hallucinates app UI.

---

## 1. Master prompt — 60s hero (cinematic)

**Duration:** 60 seconds · **Aspect ratio:** 16:9 (YouTube hero) or 9:16 (Reels cutdown)  
**Audio note:** Leave room for VO from `docs/MARKETING_AD_KIT.md` 30s script (extend with B-roll).

### Full Sora prompt

```
Cinematic commercial for a family communication app called Talk Board. Warm documentary-style film, not stock-ad cliché. Soft natural daylight in a modest, lived-in home — kitchen table and living room, Middle Eastern and East African family details without stereotypes (woven textiles, tea cups, family photos on shelf). Diverse caregivers: a mother in hijab, a father, a grandmother — gentle, patient, hopeful expressions. A nonspeaking child around 6–8 years old uses a tablet and phone; we see capability and dignity, never pity.

Color grade: soft teal accent (#2E8C8C) in wardrobe accents, mug, or subtle UI glow; overall palette warm cream and calm off-white (#F2F6F8). Shallow depth of field, 35mm anamorphic feel, slow motivated camera moves, golden-hour window light mixed with soft fill. Emotional but restrained — joy in small moments, not melodrama.

Scene flow (single continuous montage feel):
OPEN (0–8s): Close-up — child's small finger taps a large picture card on a tablet screen showing emoji-style icons and Arabic labels. Card animates with a gentle press. Cut to caregiver watching with a relieved, loving smile. Voice-over space.

APP DEMO (8–22s): Over-shoulder macro on tablet: grid of large calm picture cards (water 💧, eat 🍽️, mom 👩, happy 😊), white rounded cards on light gray background, header reads "Talk Board" in clean sans-serif. Child taps "water" — subtle ripple on card. Sentence strip at top fills with the word chip. Slow push-in on teal Say button.

VOICE RECORDING (22–34s): Caregiver holds phone, taps settings/record icon, speaks warmly into mic recording the word "love" in Arabic. Cut to child tapping the same card — intimate close-up on child's face as familiar voice plays; small smile. Warm practical lighting, shallow DOF on hands and device.

DIALECT MOMENT (34–44s): Medium shot — language picker visible on screen showing Arabic / Sudanese / Juba options (RTL text legible but not overly sharp). Child taps "eat" — mouth of caregiver off-screen reacts. Sense of "finally sounds like home." Respectful, authentic, not caricature.

OFFLINE MOMENT (44–52s): Phone shows airplane mode icon or offline badge. Same Talk Board board still works — child scrolls category pills, taps pinned favorite with star icon on home. Caregiver in background packing school bag. Confidence, independence.

CLOSING (52–60s): Pull back to family at table, child communicates with board, caregiver nods. Fade to end card: Talk Board logo (speech-bubble / board icon), teal background #2E8C8C, white text "Try free" and URL housegames.club/amoory — clean minimal motion graphics, no fake star ratings or review quotes.

Camera: slow dolly, gentle handheld micro-movement, rack focus between hands and faces. Lighting: soft key from window, warm fill, no harsh clinical hospital lighting. Mood: hopeful, professional, inclusive, privacy-respecting. Target caregivers of nonspeaking children — Arabic and Sudanese-speaking families.
```

### Paste-ready opening (first 2 paragraphs)

Use these as the lead-in when iterating in Sora:

> Cinematic commercial for a family communication app called Talk Board. Warm documentary-style film, not stock-ad cliché. Soft natural daylight in a modest, lived-in home — kitchen table and living room, Middle Eastern and East African family details without stereotypes (woven textiles, tea cups, family photos on shelf). Diverse caregivers: a mother in hijab, a father, a grandmother — gentle, patient, hopeful expressions. A nonspeaking child around 6–8 years old uses a tablet and phone; we see capability and dignity, never pity.
>
> Color grade: soft teal accent (#2E8C8C) in wardrobe accents, mug, or subtle UI glow; overall palette warm cream and calm off-white (#F2F6F8). Shallow depth of field, 35mm anamorphic feel, slow motivated camera moves, golden-hour window light mixed with soft fill. Emotional but restrained — joy in small moments, not melodrama.

---

## 2. Short prompt — 15s social ad

**Duration:** 15 seconds · **Aspect ratio:** 9:16 (Reels / Stories primary)

### Full Sora prompt

```
Vertical 9:16 social ad, 15 seconds. Fast but calm pacing. Opens on extreme close-up: child's finger taps a large emoji picture card on a phone — "water" droplet icon, Arabic label beneath, white rounded card on soft gray app background, Talk Board header visible. Satisfying tap animation, soft haptic feel.

Cut: tap "mom" card — jump to caregiver's warm recorded voice implied by child's smile. Quick insert: language setting flash showing Arabic / Sudanese / Juba. Phone tilts — airplane mode icon visible — board still works, child taps starred favorite on home grid.

Teal accent color #2E8C8C on Say button and end card. End card 3 seconds: Talk Board logo, bold text "Free · Works offline · No ads", URL housegames.club/amoory. Warm window light, modern modest home, diverse family hands only in frame — no faces required for privacy-friendly variant. Clean, hopeful, not clinical. Space for voice-over: "Tap a picture to speak — in your language, your dialect, or your voice."
```

### VO pairing (EN)

From `docs/MARKETING_AD_KIT.md`:

- 0–3s: "What if your child could speak — by tapping a picture?"
- 3–8s: "Talk Board. Free. Works offline."
- 8–12s: "Arabic, Sudanese, Juba — or your own voice."
- 12–15s: End card — "Try free"

---

## 3. Scene breakdown — shot list for iteration

Generate each scene as a **separate Sora clip** (4–12s), then edit together. Re-use character wardrobe and home set for continuity.

| # | Scene | Duration | Camera & action | Must show |
|---|-------|----------|-----------------|-----------|
| **A** | **Opening hook** | 4–6s | Slow push-in on tablet at kid height; rack focus child finger → screen | Large picture cards, tap gesture, emotional caregiver reaction OTS |
| **B** | **App demo — tap to speak** | 6–8s | Top-down or 45° macro on device; minimal hand movement | Talk Board header, emoji cards, sentence strip, teal Say button |
| **C** | **Dialect / voice moment** | 5–7s | Medium close on caregiver recording; cut to child hearing playback | Record UI or mic icon, Arabic/Sudanese/Juba in language picker, child's positive response |
| **D** | **Offline moment** | 4–6s | Wide → insert phone status bar / offline badge → board still usable | Airplane mode or offline badge, pinned ⭐ favorites, child independent use |
| **E** | **CTA end card** | 3–5s | Static or subtle zoom motion graphics | Teal `#2E8C8C` bg, Talk Board logo, "Try free", housegames.club/amoory, "Free · No ads" — **no fake reviews** |

### Per-scene micro-prompts

**A — Opening hook**
```
Documentary close-up, child taps large picture card on tablet, Talk Board app, warm home, golden hour, shallow DOF, hopeful mood, Arabic UI labels, capability not pity, 35mm cinematic.
```

**B — App demo**
```
Macro smartphone screen, grid of large emoji picture cards, white cards rounded corners, Talk Board header, child finger taps "eat" card, sentence strip fills, teal Say button, calm AAC app aesthetic, soft daylight reflection on glass.
```

**C — Dialect / voice**
```
Caregiver records voice on phone for Talk Board app, speaks Arabic warmly, cut to child tapping "love" card and smiling, language menu showing Sudanese and Juba Arabic options, authentic modest home, respectful representation.
```

**D — Offline**
```
Phone shows airplane mode, Talk Board picture board still active, child taps starred favorite word on home screen, caregiver packs bag in soft background, independent communication, warm practical lighting, 9:16 vertical.
```

**E — CTA end card**
```
Motion graphics end card, teal background #2E8C8C, Talk Board logo center, white text Try free, URL housegames.club/amoory, subtitle Free No ads Works offline, clean minimal no star ratings, 3 seconds.
```

---

## 4. Negative prompts

Append to every generation (Sora "avoid" field or prompt suffix):

```
Avoid: fake testimonials, star ratings, review quotes, invented statistics, "5 million downloads", clinical hospital setting, crying exploitation, pity framing, restraining or distressing child behavior, medical device claims, cluttered busy UI, tiny unreadable text buttons, generic English-only interface when targeting Arabic audience, wrong app name, competitor logos, Lorem ipsum text, garbled Arabic script, stereotypical or mocking cultural costumes, dark dystopian mood, aggressive sales tone, children targeted without caregiver present, watermark, shaky TikTok zoom spam, neon cyberpunk colors, horror lighting, violence, alcohol, political symbols.
```

### UI-specific negatives

```
Avoid: holographic sci-fi UI, neon purple gradients, desktop browser chrome with URL bar prominent, Android/iOS wrong platform chrome, misspelled Talk Board, English-only labels when scene specifies Arabic, overcrowded 20-icon grid, illegible font sizes, fake Apple App Store badge unless composited intentionally.
```

---

## 5. Technical notes

### Aspect ratios & placements

| Format | Ratio | Resolution (export) | Use |
|--------|-------|---------------------|-----|
| **Reels / Stories / TikTok** | 9:16 | 1080×1920 | Primary paid social, 15s cut |
| **YouTube / website hero** | 16:9 | 1920×1080 | 60s hero, embed on promo page |
| **Feed (FB/IG)** | 1:1 | 1080×1080 | Square crop from 16:9 master or dedicated gen |

### Frame rate & length

- Generate at **24fps** for cinematic feel; **30fps** acceptable for social.
- Sora clip length varies by model — plan **4–12s per scene**, extend in edit.
- Master edit: **60s** hero; cut **15s** and **30s** versions from same footage (`docs/MARKETING_AD_KIT.md` scripts).

### UI fidelity strategy

1. **Preferred:** Film lifestyle B-roll in Sora; **screen-record** real app at https://housegames.club/amoory/ for all UI moments (tap, record, offline, pin ⭐).
2. **Alternative:** Static high-res app screenshots from device — animate scale/parallax in CapCut/Premiere.
3. **Sora UI gen:** Use micro-prompts in Scene B/C/D only if compositing is planned; expect text/emoji errors — fix in post.

### Brand & compliance

- Target **caregivers 18+** in ad placement; child appears as subject of care, not ad "actor" callouts.
- On-screen or VO disclaimer optional: "Not a medical device. Communication aid for everyday use."
- Do **not** claim therapy outcomes or replace professional SLP advice.
- No fabricated family quotes — see `public/promo.html` trust placeholder policy.

### Audio

- Sora ambient: soft home sounds (clock, distant traffic, tea pour) — **no copyrighted music**.
- Add licensed track in post; duck under VO.
- For dialect demo, use **real app TTS/recordings** in post rather than Sora-generated speech.

### Export checklist

- [ ] 60s 16:9 master
- [ ] 15s 9:16 social (EN)
- [ ] 15s 9:16 social (AR) — see §6
- [ ] 30s 16:9 or 9:16 mid-form
- [ ] 1:1 feed stills from key frames for FB/Google Display
- [ ] End card URL readable: **housegames.club/amoory**

---

## 6. Arabic variant prompts

**Audience:** Arabic-speaking caregivers — Sudan, South Sudan, Egypt, Gulf, diaspora.  
**UTM:** `…/promo.html?utm_content=ar` (see `docs/MARKETING_AD_KIT.md`)

### 60s hero — Arabic (لوحة الحديث)

```
إعلان سينمائي دافئ لتطبيق تواصل "لوحة الحديث" Talk Board. عائلة عربية/سودانية في بيت modest وحقيقي — إضاءة نهارية ناعمة، ألوان هادئة مع لمسة تركواز #2E8C8C. أم أو أب أو جدة بجانب طفل غير ناطق (6–8 سنوات) يستخدم تابلت أو هاتف — كرامة وقدرة، بدون تعاطف مُ humiliating.

واجهة التطبيق بالعربية (RTL): بطاقات صور كبيرة بيضاء، رموز emoji، شريط جملة، زر "Speak/قل" بلون تركواز. الطفل يضغط "ماء" ثم "أم" — صوت مسجّل للوالدة. إعدادات اللغة: عربي، سوداني، جوبا. مشهد offline: وضع الطيران مفعّل واللوحة تعمل. نهاية: شعار Talk Board، "جرّبه مجاناً"، housegames.club/amoory. كاميرا بطيئة، فيلم وثائقي، احترافي ومليء بالأمل.
```

### 15s social — Arabic

```
فيديو عمودي 9:16، 15 ثانية. لوحة الحديث — طفل يضغط بطاقة "ماء" 💧 ثم "أم" 👩 على شاشة الهاتف، واجهة عربية RTL، بطاقات كبيرة هادئة. لقطة سريعة: إعدادات اللهجة السودانية/الجوباوية. وضع دون اتصال — الطفل يضغط كلمة مفضلة ⭐. بطاقة نهاية تركواز: "مجاني · يعمل دون اتصال · بدون إعلانات" — housegames.club/amoory. إضاءة دافئة، بيت عائلي، بدون تقييمات نجوم وهمية.
```

### Arabic VO script (15s)

```
[0–3s]  "طفلك يقدر يتواصل — بضغطة صورة."
[3–10s] "لوحة الحديث. مجاني. يعمل دون اتصال."
[10–15s] "جرّبه مجاناً — housegames.club/amoory"
```

### Arabic on-screen text (end card)

| Element | Copy |
|---------|------|
| Headline | لوحة الحديث |
| Subhead | تواصل بالصور والصوت |
| Bullets | مجاني · دون اتصال · بدون إعلانات |
| CTA | جرّبه مجاناً |
| URL | housegames.club/amoory |

---

## Quick reference — value props to visualize

| Feature | Visual beat |
|---------|-------------|
| Tap pictures to speak | Finger tap → card highlight → sentence strip |
| Record your voice | Caregiver mic → child hears familiar voice |
| Arabic / Sudanese / Juba | Language picker, RTL labels |
| Works offline | Airplane mode + board still active |
| Pin favorites ⭐ | Home screen with starred cards |
| Free, no ads | End card copy only — no fake proof |
| Privacy | Optional: caregiver calm, no signup pressure |

---

*Last updated: 2026-06-24 · Maintainer: marketing / agent handoff via `feedback/agent/CLAUDE_DIRECTIVE.md`*
