/* Talk Board — kid-first board logic
   Autism-informed ordering: tier → priority → usage → stable id.
   Predictable layout; gentle promotion, never demote core words. */

import { CATEGORIES, WORDS } from "./data.js";
import {
  KID_VIEWS, VIEW_CATEGORIES, getWordTier, getPriorityOrder,
  isCoreWord, PROMOTE_THRESHOLD, HOME_MAX_WORDS
} from "./priorities.js";
import {
  getWordStats, getUnlockedTier, getPinnedWords, isWordVisible,
  getCardOrderForView
} from "./usage.js";

/** Toddler-first home mix: round-robin across communication categories. */
const HOME_MIX_CATEGORIES = ["feelings", "need", "do", "people", "food", "social"];

export function boardViewKey(locale, { fullBoard, kidView, category }) {
  if (fullBoard && category) return `${locale}:cat:${category}`;
  return `${locale}:view:${kidView || "home"}`;
}

/** Caregiver saved order first; new words keep smart-sort tail order. */
export function applySavedOrder(words, viewKey) {
  const saved = getCardOrderForView(viewKey);
  if (!saved.length) return words;
  const byId = new Map(words.map(w => [w.id, w]));
  const ordered = [];
  const seen = new Set();
  for (const id of saved) {
    const w = byId.get(id);
    if (w) {
      ordered.push(w);
      seen.add(id);
    }
  }
  for (const w of words) {
    if (!seen.has(w.id)) ordered.push(w);
  }
  return ordered;
}

/** Within-bucket: usage desc → priority → id. */
function sortByUsageWithinTier(words) {
  return [...words].sort((a, b) => {
    const ac = getWordStats(a.id).count;
    const bc = getWordStats(b.id).count;
    if (ac !== bc) return bc - ac;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id.localeCompare(b.id);
  });
}

/** Interleave feelings / wants / actions / people / food for predictable toddler layout. */
export function mixHomeWords(words) {
  if (words.length <= 1) return words;
  const buckets = Object.fromEntries(HOME_MIX_CATEGORIES.map(c => [c, []]));
  buckets._other = [];
  for (const w of words) {
    const key = HOME_MIX_CATEGORIES.includes(w.categoryId) ? w.categoryId : "_other";
    buckets[key].push(w);
  }
  for (const key of Object.keys(buckets)) {
    buckets[key] = sortByUsageWithinTier(buckets[key]);
  }
  const seq = [...HOME_MIX_CATEGORIES, "_other"].filter(k => buckets[k].length);
  const out = [];
  let round = 0;
  while (out.length < words.length) {
    let added = false;
    for (const k of seq) {
      if (round < buckets[k].length) {
        out.push(buckets[k][round]);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }
  return out;
}

/** Attach tier metadata to a word object (non-destructive). */
export function enrichWord(word) {
  return {
    ...word,
    tier: getWordTier(word.id),
    isCore: isCoreWord(word.id),
    priority: getPriorityOrder(word.id)
  };
}

/** Collect all builtin + community words as enriched flat list. */
export function allWordsFlat(mergeFn, locale, dialect) {
  const out = [];
  for (const cat of CATEGORIES) {
    const list = mergeFn(WORDS[cat.id] || [], cat.id, locale, dialect);
    list.forEach(w => out.push(enrichWord({ ...w, categoryId: cat.id })));
  }
  return out;
}

/** Stable sort: tier asc → priority asc → usage desc → id asc. */
export function sortWords(words) {
  return [...words].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.priority !== b.priority) return a.priority - b.priority;
    const ac = getWordStats(a.id).count;
    const bc = getWordStats(b.id).count;
    if (ac !== bc) return bc - ac;
    return a.id.localeCompare(b.id);
  });
}

/** Card size class from tier + usage. Core words never go below lg. */
export function cardSizeClass(word) {
  const count = getWordStats(word.id).count;
  const promoted = count >= PROMOTE_THRESHOLD;

  if (word.tier === 0 || word.isCore) {
    return promoted ? "word--xl" : "word--lg";
  }
  if (word.tier === 1) return promoted ? "word--lg" : "word--md";
  if (promoted) return "word--md";
  return "word--sm";
}

/** Words on the Talk (home) tab: tier 0 + pinned words, mixed & capped. */
export function computeHomeWords(all, pinnedIds) {
  const pinned = new Set(pinnedIds);
  const homePool = all.filter(w => w.tier === 0 || pinned.has(w.id));
  const core = sortWords(homePool.filter(w => w.isCore));
  const restPool = homePool.filter(w => !w.isCore);
  const rest = mixHomeWords(sortWords(restPool))
    .slice(0, Math.max(0, HOME_MAX_WORDS - core.length));
  return [...core, ...rest];
}

export function homeWordIdSet(all, pinnedIds) {
  return new Set(computeHomeWords(all, pinnedIds).map(w => w.id));
}

/** Words for the active kid view. */
export function wordsForKidView(viewId, mergeFn, locale, dialect) {
  const unlocked = getUnlockedTier();
  const allFlat = allWordsFlat(mergeFn, locale, dialect);
  const visible = allFlat.filter(w => isWordVisible(w, unlocked));
  const pinnedIds = getPinnedWords();
  const orderKey = boardViewKey(locale, { kidView: viewId });
  const finish = list => applySavedOrder(list, orderKey);

  if (viewId === "home") {
    return finish(computeHomeWords(visible, pinnedIds));
  }

  if (viewId === "need") {
    const cats = new Set(VIEW_CATEGORIES.need);
    return finish(sortWords(visible.filter(w =>
      cats.has(w.categoryId) && w.tier <= 1
    )));
  }

  if (viewId === "feel") {
    return finish(sortWords(visible.filter(w =>
      w.categoryId === "feelings" && w.tier <= 1
    )));
  }

  /** More words: full vocabulary minus home — no tier gate (caregiver browse layer). */
  if (viewId === "more") {
    const homeIds = homeWordIdSet(visible, pinnedIds);
    return finish(sortWords(allFlat.filter(w => !homeIds.has(w.id))));
  }

  return finish(sortWords(visible.filter(w => w.tier === 0)));
}

export function labelForKidView(view, locale) {
  return view.labels[locale] || view.labels.en || view.id;
}

export { KID_VIEWS, getUnlockedTier };
