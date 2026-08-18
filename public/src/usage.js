/* Talk Board — local word usage tracking (offline, privacy-safe)
   Drives usage-based card ordering and gentle visual promotion. */

import { MAX_TIER, getWordTier } from "./priorities.js";

const KEY = "talkboard_usage";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultStore();
}

function defaultStore() {
  return {
    words: {},       // { [id]: { count, lastUsed } }
    uniqueCount: 0,
    firstUsed: null // ISO date
  };
}

function save(store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function getUsageStore() {
  return load();
}

/** Record a word tap. Returns updated stats for that word. */
export function recordWordUse(wordId) {
  const store = load();
  const now = Date.now();
  if (!store.firstUsed) store.firstUsed = new Date().toISOString();

  if (!store.words[wordId]) {
    store.words[wordId] = { count: 0, lastUsed: 0 };
    store.uniqueCount = Object.keys(store.words).length;
  }
  store.words[wordId].count++;
  store.words[wordId].lastUsed = now;
  save(store);
  return store.words[wordId];
}

export function getWordStats(wordId) {
  const store = load();
  return store.words[wordId] || { count: 0, lastUsed: 0 };
}

export function getUniqueWordCount() {
  return load().uniqueCount;
}

export function daysSinceFirstUse() {
  const store = load();
  if (!store.firstUsed) return 0;
  const ms = Date.now() - new Date(store.firstUsed).getTime();
  return Math.floor(ms / 86400000);
}

/** All vocabulary tiers are always visible. */
export function getUnlockedTier() {
  return MAX_TIER;
}

export function resetUsageStats() {
  const store = defaultStore();
  save(store);
  return store;
}

/** Pinned core word ids (caregiver override — always show on home). */
const PIN_KEY = "talkboard_pinned";

export function getPinnedWords() {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function setPinnedWords(ids) {
  localStorage.setItem(PIN_KEY, JSON.stringify([...new Set(ids.filter(Boolean))]));
}

export function isWordPinned(wordId) {
  return getPinnedWords().includes(wordId);
}

export function pinWord(wordId) {
  if (!wordId) return getPinnedWords();
  const ids = getPinnedWords();
  if (!ids.includes(wordId)) ids.push(wordId);
  setPinnedWords(ids);
  return ids;
}

export function unpinWord(wordId) {
  if (!wordId) return getPinnedWords();
  const ids = getPinnedWords().filter(id => id !== wordId);
  setPinnedWords(ids);
  return ids;
}

export function isWordVisible(word) {
  const tier = word.tier ?? getWordTier(word.id);
  return tier <= MAX_TIER;
}

/** Caregiver custom card order per locale + view (kid tab or category). */
const ORDER_KEY = "talkboard_card_order";

function loadOrderStore() {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveOrderStore(store) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(store));
}

export function getCardOrderForView(viewKey) {
  const store = loadOrderStore();
  return Array.isArray(store[viewKey]) ? store[viewKey] : [];
}

export function setCardOrderForView(viewKey, wordIds) {
  const store = loadOrderStore();
  store[viewKey] = wordIds.filter(Boolean);
  saveOrderStore(store);
}

export function clearCardOrderForView(viewKey) {
  const store = loadOrderStore();
  delete store[viewKey];
  saveOrderStore(store);
}

/** Move one word to position 1 in the saved order for a view. */
export function bringWordToTop(viewKey, wordId, currentWordIds) {
  if (!wordId || !Array.isArray(currentWordIds) || !currentWordIds.length) return;
  const rest = currentWordIds.filter(id => id && id !== wordId);
  if (!rest.length) return;
  setCardOrderForView(viewKey, [wordId, ...rest]);
}

/** Move one word to the last position in the saved order for a view. */
export function sendWordToBottom(viewKey, wordId, currentWordIds) {
  if (!wordId || !Array.isArray(currentWordIds) || !currentWordIds.length) return;
  const rest = currentWordIds.filter(id => id && id !== wordId);
  if (!rest.length) return;
  setCardOrderForView(viewKey, [...rest, wordId]);
}

/** Therapist handoff: pins + per-view card order as JSON. */
export function exportBoardLayout() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    pinned: getPinnedWords(),
    cardOrder: loadOrderStore()
  };
}

export function importBoardLayout(data) {
  if (!data || typeof data !== "object") return { ok: false, error: "invalid" };
  if (Array.isArray(data.pinned)) setPinnedWords(data.pinned);
  if (data.cardOrder && typeof data.cardOrder === "object") {
    const store = loadOrderStore();
    for (const [viewKey, ids] of Object.entries(data.cardOrder)) {
      if (Array.isArray(ids)) store[viewKey] = ids.filter(Boolean);
    }
    saveOrderStore(store);
  }
  return { ok: true };
}
