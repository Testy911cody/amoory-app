# Talk Board Test Report

**Date:** 2026-06-26  
**Tester:** Cursor agent (holistic improvement pass)  
**Environments:** local `http://127.0.0.1:3000`, production `https://housegames.club/amoory/`

---

## Summary

| Check | Result |
|-------|--------|
| `node --check` app.js / admin.js / kid-ui.js | PASS |
| `npm run build` | PASS |
| `node scripts/verify-more-words.mjs` | PASS — **209** More words, **227** builtin |
| Service worker cache | **talkboard-v19** |
| Default locale | Arabic + Juba (`ar` / `juba`) |

---

## Improvements this pass

| Area | Change |
|------|--------|
| **Mic visibility** | White bordered mic on every card; stronger z-index on small cards |
| **Pinned home border** | Fixed undefined `--c-more` CSS variable |
| **More words empty copy** | Updated stale tier-gate messaging in locales |
| **Settings** | Opens directly (no legacy PIN gate); account badge → settings |
| **Admin** | Pending counts on tabs; dialect badges on pending rows; clearer hints |
| **Marketing** | Removed First/Then references; pin favorites + 200+ words |
| **promo.html** | Mobile layout polish; accurate feature copy |
| **Tests** | `talkboard-test.mjs` updated for v19, 200+ More words, no PIN tests |

---

## Automated test matrix (`scripts/talkboard-test.mjs`)

Run locally: `npm run dev` then `node scripts/talkboard-test.mjs`

| Area | Expected |
|------|----------|
| Page load | 200 OK |
| SW cache version | talkboard-v19 |
| Board loads words | 18 home cards (Talk tab) |
| More words tab | ≥200 words |
| Pin-to-main | ⭐ on More words cards |
| Settings | Opens without PIN panel |
| Inline suggest word | Expandable panel below board |
| Mic on cards | One mic per word card |
| Account badge | Guest or @doggy |
| Console | No critical errors |

---

## Not bugs (by design)

- **Home tab shows ~18 words:** Tier-0 core mix + pinned; full vocabulary lives on **More words** (209 words).
- **Modal max-height 720px:** CSS `min(90dvh, 720px)` resolves to 720px on typical phone viewport — correct.

---

## Deploy status

| Step | Status |
|------|--------|
| AmooryApp commit | Pending user-facing changes |
| HouseGames `sync:amoory` | After AmooryApp commit |
| Production `[deploy]` | After sync — user requested deploy on user-facing changes |

**Production URL:** https://housegames.club/amoory/

---

## Future work (out of scope)

- 600-word vocabulary expansion (separate phase)
- First/Then visual schedule (removed from marketing; not in app)
- Real family testimonials on promo.html (placeholder intentional)
- STORE_LISTING.md still mentions First/Then — update at store submission time
