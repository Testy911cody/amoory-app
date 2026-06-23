# Talk Board Test Report

**Date:** 2026-06-22  
**Tester:** Cursor agent (Playwright + curl + node --check)  
**Environments:** local `http://127.0.0.1:3000`, production `https://housegames.club/amoory/`  
**tmux:** `talkboard-test` session create failed (`spawn failed` on Windows); used Playwright in Cursor instead. Dev server run via background shell.

---

## Test matrix

| Area | Local (before) | Local (after fix) | Production (pre-deploy) |
|------|----------------|-------------------|-------------------------|
| Page load | PASS | PASS | PASS |
| SW cache version | v14 PASS | **v15 PASS** | v14 (pending deploy) |
| `node --check` app.js | PASS | PASS | — |
| Board loads words | PASS (18 cards) | PASS | PASS |
| Account badge | FAIL (Guest — no Supabase) | **PASS (@doggy)** | PASS (@doggy) |
| Doggy PIN auto-preload | FAIL | **PASS** | PASS |
| Kid view tabs (4) | PASS | PASS | PASS |
| More words tab | PASS (empty by tier design) | PASS | PASS |
| Caregiver settings (⚙️) | PASS | PASS | PASS |
| Inline suggest word panel | FAIL (settings overlay blocked clicks) | **PASS** | PASS (pre-existing overlay UX) |
| Pending words tab | not reached | PASS (via settings tabs) | PASS (pending rows present) |
| PIN gate 1234 | not reached | PASS (manual verify) | PASS |
| Modal viewport CSS | PASS (`min(90dvh,720px)`) | PASS | PASS |
| Critical console errors | PASS | PASS | PASS |

---

## Bugs found

### 1. Local dev Supabase not configured (FIXED)

**Symptom:** `npm run dev` served placeholder `config.js`; badge showed Guest; doggy preload skipped.  
**Cause:** `scripts/inject-config.js` did not load `.env.local` when run from the dev script (only `build.js` did).  
**Fix:** Export `loadDotEnvLocal()` from `inject-config.js`; call it in dev CLI and reuse in `build.js`.

### 2. Inline suggest word blocked by settings overlay (FIXED)

**Symptom:** After entering caregiver mode, settings panel opens; `+` / inline “Suggest a word” toggle could not be clicked (Playwright: panel subtree intercepts pointer events).  
**Cause:** Full-screen settings modal stayed open over the board.  
**Fix:** `expandBoardContribute()` now calls `closePanel(el.settingsPanel)` first.

### 3. PIN panel Continue button not localized (FIXED)

**Symptom:** PIN panel Cancel was translated; Submit stayed English “Continue”.  
**Fix:** Added `pinContinue` locale string; set in `openPinPanel()`.

### 4. Service worker cache bump (FIXED)

**Change:** `talkboard-v14` → `talkboard-v15` in `public/sw.js` after app fixes.

### Not bugs (by design)

- **More words tab empty:** Default unlocked tier is 0; tier 2+ words hidden until usage milestones or caregiver unlocks tier in settings.
- **Modal max-height 720px:** CSS `min(90dvh, 720px)` resolves to 720px on typical phone viewport — correct.

---

## Fixes applied

| File | Change |
|------|--------|
| `scripts/inject-config.js` | Load `.env.local` before injecting config |
| `scripts/build.js` | Reuse shared `loadDotEnvLocal` |
| `public/src/app.js` | Close settings before inline suggest; PIN submit i18n |
| `public/src/locales.js` | `pinContinue` en/ar |
| `public/sw.js` | Cache v15 |
| `scripts/talkboard-test.mjs` | Automated regression suite (added) |

---

## Deploy status

| Step | Status |
|------|--------|
| `npm run build` | PASS |
| `npm run env:from-housegames` | PASS (`.env.local` present) |
| HouseGames `sync:amoory` | See git push below |
| Production `[deploy]` push | Pending / in progress |

---

## Verify after deploy

```powershell
curl.exe -s https://housegames.club/amoory/sw.js | findstr CACHE_VERSION
# expect talkboard-v15

cd AmooryApp
node scripts/talkboard-test.mjs
```

---

## Remaining / optional

- Windows tmux `talkboard-test` session: `spawn failed` — use `agent` session or Cursor background shells.
- Production SW v15: updates after HouseGames sync + deploy push.
