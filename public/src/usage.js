/* Talk Board — local word usage tracking (offline, privacy-safe)
   Drives progressive unlock and gentle usage-based card promotion. */

import { UNLOCK_RULES, getWordTier } from "./priorities.js";

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
    firstUsed: null, // ISO date
    manualTier: null // caregiver override: max tier unlocked (0-3)
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

/** Highest tier the child can see (0–3). */
export function getUnlockedTier() {
  const store = load();
  if (store.manualTier != null) return store.manualTier;

  let tier = 0;
  const unique = store.uniqueCount;
  const days = daysSinceFirstUse();

  if (unique >= UNLOCK_RULES[1].uniqueWords || days >= UNLOCK_RULES[1].daysUsed) tier = 1;
  if (unique >= UNLOCK_RULES[2].uniqueWords || days >= UNLOCK_RULES[2].daysUsed) tier = 2;
  if (unique >= UNLOCK_RULES[3].uniqueWords || days >= UNLOCK_RULES[3].daysUsed) tier = 3;

  return tier;
}

export function setManualTier(tier) {
  const store = load();
  store.manualTier = tier == null ? null : Math.max(0, Math.min(3, tier));
  save(store);
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
  localStorage.setItem(PIN_KEY, JSON.stringify(ids));
}

export function isWordVisible(word, unlockedTier) {
  const tier = word.tier ?? getWordTier(word.id);
  return tier <= unlockedTier;
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
