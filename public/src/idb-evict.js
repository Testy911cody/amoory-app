/* IndexedDB LRU eviction stub — caps community/global caches; never touches personal. */

import { openTalkBoardDB } from "./idb.js";

const LRU_KEY = "talkboard_audio_lru_v1";
const PERSONAL_KEYS = "talkboard_personal_blob_keys";

/** Soft caps (blob count). Tunable without schema migration. */
export const COMMUNITY_AUDIO_CAP = 80;
export const GLOBAL_CACHE_CAP = 120;

function readLru() {
  try {
    const raw = localStorage.getItem(LRU_KEY);
    return raw ? JSON.parse(raw) : { community: {}, global: {} };
  } catch {
    return { community: {}, global: {} };
  }
}

function writeLru(store) {
  localStorage.setItem(LRU_KEY, JSON.stringify(store));
}

export function markPersonalBlobKey(key) {
  if (!key) return;
  try {
    const raw = localStorage.getItem(PERSONAL_KEYS);
    const set = new Set(raw ? JSON.parse(raw) : []);
    set.add(key);
    localStorage.setItem(PERSONAL_KEYS, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

export function isPersonalBlobKey(key) {
  try {
    const raw = localStorage.getItem(PERSONAL_KEYS);
    if (!raw) return false;
    return JSON.parse(raw).includes(key);
  } catch {
    return false;
  }
}

/** Record access time for community_audio keys (prefix-aware). */
export function touchCommunityAudio(key) {
  if (!key) return;
  const store = readLru();
  store.community[key] = Date.now();
  writeLru(store);
}

/** Record access for global dialect cache blobs in the recordings store. */
export function touchGlobalCache(key) {
  if (!key || isPersonalBlobKey(key)) return;
  if (String(key).startsWith("sync_global__")) return;
  const store = readLru();
  store.global[key] = Date.now();
  writeLru(store);
}

async function deleteKeys(storeName, keys) {
  if (!keys.length) return 0;
  const db = await openTalkBoardDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, "readwrite");
    const os = tx.objectStore(storeName);
    keys.forEach(k => os.delete(k));
    tx.oncomplete = () => res(keys.length);
    tx.onerror = rej;
  });
}

function oldestKeys(map, overBy) {
  return Object.entries(map)
    .sort((a, b) => (a[1] || 0) - (b[1] || 0))
    .slice(0, overBy)
    .map(([k]) => k);
}

/** Evict oldest community_audio blobs over COMMUNITY_AUDIO_CAP. */
export async function evictCommunityAudioIfNeeded() {
  const store = readLru();
  const keys = Object.keys(store.community);
  if (keys.length <= COMMUNITY_AUDIO_CAP) return 0;
  const drop = oldestKeys(store.community, keys.length - COMMUNITY_AUDIO_CAP);
  const n = await deleteKeys("community_audio", drop);
  drop.forEach(k => { delete store.community[k]; });
  writeLru(store);
  return n;
}

/**
 * Evict oldest global cache blobs over GLOBAL_CACHE_CAP.
 * Skips personal keys and sync_global__ queue drafts (queue has its own lifecycle).
 */
export async function evictGlobalCacheIfNeeded() {
  const store = readLru();
  const entries = Object.keys(store.global).filter(k => !isPersonalBlobKey(k));
  if (entries.length <= GLOBAL_CACHE_CAP) return 0;
  const drop = oldestKeys(
    Object.fromEntries(entries.map(k => [k, store.global[k]])),
    entries.length - GLOBAL_CACHE_CAP
  );
  const n = await deleteKeys("recordings", drop);
  drop.forEach(k => { delete store.global[k]; });
  writeLru(store);
  return n;
}

/** Run both eviction passes (safe to call after prefetch bursts). */
export async function evictAudioCachesIfNeeded() {
  const community = await evictCommunityAudioIfNeeded();
  const global = await evictGlobalCacheIfNeeded();
  return { community, global };
}
