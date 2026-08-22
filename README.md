# Talk Board (amoory-app)

Picture-and-voice AAC for nonspeaking children. Tap picture cards to speak words via device TTS or recorded audio. Caregivers can record and share community voices for dialects where computer TTS is missing (for example Sudanese and Juba Arabic).

**Live:** [https://housegames.club/amoory/](https://housegames.club/amoory/) (shipped inside House Games)

## What it is

- Kid-first board: large core words first, usage-based sizing, simple Talk / Need / Feel / More tabs
- Offline-capable PWA (service worker + IndexedDB / localStorage queues)
- Community and personal word recordings with optional Supabase sync when signed in
- Caregiver unlock (long-press settings) for language, dialect, recording, and contributor tools
- Capacitor 8 wrappers for iOS/Android packaging (not claimed as store-listed apps)

## Stack

| Layer | Choice |
|-------|--------|
| Front end | Vanilla ES-module PWA under `public/` |
| Offline | Service worker, IndexedDB (`talkboard`), localStorage queues |
| Backend | Supabase Auth, Postgres, Storage (same project as House Games) |
| Mobile shell | Capacitor 8 (`core`, App, StatusBar, SplashScreen) |
| Tooling | npm, Playwright, esbuild for native shell builds |

No frontend bundler for the PWA itself — `public/` is served as-is after config inject.

## Quick start

```bash
npm install
cp .env.example .env.local
# Copy Supabase URL + anon key from HouseGames/.env.local (same project)
npm run dev                  # http://localhost:3000
```

Committed `public/src/config.js` is placeholders only. `npm run dev` / `npm run build` injects from gitignored `.env.local`. Never commit real keys.

## Build and deploy

```bash
npm run build      # inject config + copy public/ → dist/
npm run icons      # regenerate PWA icons
npm run build:all  # icons + build
```

**Primary host:** House Games Cloudflare site at `/amoory/`:

```bash
# From HouseGames repo after AmooryApp changes:
npm run sync:amoory
npm run dev:test              # http://localhost:3001/amoory/
```

Standalone: Cloudflare Pages (`wrangler pages deploy dist`), GitHub Pages workflow, or Firebase Hosting config in-repo — all need the same Supabase env vars as House Games.

## Environment

| Variable | Notes |
|----------|-------|
| `VITE_SUPABASE_URL` | Same as House Games `NEXT_PUBLIC_SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Same as House Games `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

Auth redirect URLs when using Supabase Auth: `http://localhost:3000/`, `http://localhost:3001/amoory/`, `https://housegames.club/amoory/`.

SQL for community tables: `docs/supabase-community-words.sql`.

## Project layout

```
public/           # PWA (index.html, sw.js, src/app.js, community, auth UI)
scripts/          # build.js, inject-config.js
docs/             # Supabase SQL and setup notes
capacitor.config.ts
```

## License

Source for Talk Board. Product also ships under House Games at `/amoory/`.
