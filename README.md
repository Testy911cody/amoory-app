# Talk Board (AmooryApp)

Picture-and-voice communication for nonspeaking children. Tap pictures, hear words in any language/dialect, and record community voices where computer TTS does not exist (e.g. Sudanese, Juba Arabic).

Also integrated on **[House Games](https://housegames.club/amoory/)** at `/amoory/`.

## Stack

- **Front end:** vanilla ES modules PWA (`public/`)
- **Mobile:** Capacitor 8 (iOS/Android wrappers — Phase 5)
- **Backend:** Supabase (Phase 2+) — accounts, community words, audio storage
- **Package manager:** npm

## Quick start

```bash
npm install
cp .env.example .env.local
# Recommended: copy Supabase keys from HouseGames/.env.local (same project)
npm run dev                  # http://localhost:3000
```

Committed `public/src/config.js` is placeholders only (`YOUR_SUPABASE_URL` / `your_anon_key_here`). Copy `.env.example` to `.env.local`, then `npm run dev` or `npm run build` injects real keys from `.env.local` (gitignored). Do not commit the injected file.

## Build

```bash
npm run build      # writes config.js + copies public/ → dist/
npm run icons      # regenerate PWA/store icons
npm run build:all  # icons + build
```

## Deploy (website)

**Primary (recommended):** Talk Board ships inside [House Games](https://housegames.club) at **`https://housegames.club/amoory/`** via Cloudflare Pages.

```bash
# After AmooryApp changes — from HouseGames repo:
npm run sync:amoory
npm run dev:test              # http://localhost:3001/amoory/
# Then deploy HouseGames when ready (see HouseGames PREVIEW_BEFORE_DEPLOY.md)
```

**Standalone repo** (`https://github.com/Testy911cody/amoory-app.git`):

| Target | Command |
|--------|---------|
| **Cloudflare Pages** | `npm run build && npx wrangler pages deploy dist --project-name=talk-board` |
| **GitHub Pages** | Push to `main`, enable Pages → GitHub Actions. Set secrets `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (same values as HouseGames) |
| **Firebase Hosting** | Edit `.firebaserc`, then `npm run build && npx firebase deploy --only hosting` |

Supabase keys: copy from `HouseGames/.env.local` — never commit `.env.local`.

Full store checklist: `docs/APP_STORE_CHECKLIST.md`

## Kid-first UI

Default view shows autism-priority core words (help, stop, yes/no, bathroom, etc.) large and first. Words unlock as the child uses the board. **Caregivers:** hold ⚙️ for 2 seconds for language, recording, and advanced settings.

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_SUPABASE_URL` | Phase 2+ | **Copy from HouseGames** `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`) |
| `VITE_SUPABASE_ANON_KEY` | Phase 2+ | **Copy from HouseGames** `.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) |

Same Supabase project as House Games. Canonical env file:

`C:/Users/sudan/Desktop/VSCODE - Copy/Projects/HouseGames/.env.local`

House Games sync reads either project's `.env.local`.

**Never commit** `.env.local` or real keys.

## Supabase setup

1. Create or reuse a Supabase project ([supabase.com](https://supabase.com)).
2. SQL Editor → run **`docs/supabase-community-words.sql`**.
3. Paste URL + anon key into `.env.local`.
4. Restart dev server — approved community words sync on load when configured.

For contributor auth and admin review, add Supabase Auth providers and a `profiles.is_admin` column (see SQL file).

Redirect URLs (when using auth):

- `http://localhost:3000/` (standalone)
- `http://localhost:3001/amoory/` (House Games dev)
- `https://housegames.club/amoory/` (production)

## House Games integration

Source lives here; House Games publishes a static copy:

```bash
# From HouseGames repo:
npm run sync:amoory
npm run dev:test   # open http://localhost:3001/amoory/
```

Details: `HouseGames/docs/development/AMOORY_SETUP.md`

## Project structure

```
AmooryApp/
├── public/              # PWA (served as-is)
│   ├── index.html
│   ├── sw.js
│   └── src/
│       ├── app.js       # main UI
│       ├── community.js # local + Supabase community words
│       ├── config.js    # generated Supabase config
│       └── supabase.js  # lazy Supabase client
├── scripts/
│   ├── build.js
│   └── inject-config.js
├── docs/
│   └── supabase-community-words.sql
├── capacitor.config.ts
└── package.json
```

## Capacitor (app stores)

```bash
npm run cap:add:ios
npm run cap:add:android
npm run cap:sync
```

Requires Apple/Google developer accounts for store submission.

## What works today

- Kid-first board: autism-priority tiers, usage-based card sizing, 4 simple tabs (Talk / Need / Feel / More)
- Multi-language board with TTS fallback
- First / Then visual schedule
- Per-word voice recording (device-local IndexedDB)
- Community word suggestions with local approval queue + optional Supabase sync
- Caregiver mode (hold ⚙️ 2s): language, dialect, full categories, contributor tools
- Offline PWA after first load
- Deploy-ready: House Games `/amoory/` sync + Cloudflare Pages, GitHub Pages workflow, Firebase/Wrangler configs

## Roadmap

See `talk-board-build-plan.md` for phases 2–6 (online sync, storage, 600 pictures, app stores, scale).

## License

Private — Amoory / Talk Board.
