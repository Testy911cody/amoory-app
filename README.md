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
cp .env.example .env.local   # paste Supabase URL + anon key when ready
npm run dev                  # http://localhost:3000
```

`npm run dev` injects `public/src/config.js` from `.env.local` then serves `public/`.

## Build

```bash
npm run build   # writes config.js + copies public/ → dist/
```

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_SUPABASE_URL` | Phase 2+ | Project URL from Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Phase 2+ | Anon public key (safe in client) |

House Games sync also reads `NEXT_PUBLIC_SUPABASE_*` from its `.env.local`.

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

## What works today (Phase 1)

- Multi-language board with TTS fallback
- Per-word voice recording (device-local IndexedDB)
- Community word suggestions with local approval queue
- Offline PWA after first load
- Supabase pull of **approved** community words when keys are configured

## Roadmap

See `talk-board-build-plan.md` for phases 2–6 (online sync, storage, 600 pictures, app stores, scale).

## License

Private — Amoory / Talk Board.
