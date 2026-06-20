/* Talk Board — community word contributions (Phase 1: localStorage + IndexedDB)
   Phase 2: sync approved rows from Supabase — see docs/supabase-community-words.sql */

import { getSupabase, SUPABASE_READY } from "./supabase.js";

const QUEUE_KEY = "talkboard_community_queue";
const REMOTE_CACHE_KEY = "talkboard_community_remote";
const AUDIO_PREFIX = "community__";

let db = null;

function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((res, rej) => {
    const r = indexedDB.open("talkboard", 3);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains("recordings")) d.createObjectStore("recordings");
      if (!d.objectStoreNames.contains("community_audio")) d.createObjectStore("community_audio");
    };
    r.onsuccess = e => { db = e.target.result; res(db); };
    r.onerror = e => rej(e);
  });
}

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

async function pullApprovedFromSupabase() {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("community_words")
    .select("id,text,category,emoji,locale,dialect,audio_url,status,source")
    .eq("status", "approved");
  if (error) throw error;
  const mapped = (data || []).map(row => ({
    id: row.id,
    text: row.text,
    category: row.category,
    emoji: row.emoji || "💬",
    locale: row.locale,
    dialect: row.dialect || null,
    source: "community",
    status: "approved",
    hasAudio: !!row.audio_url,
    audioUrl: row.audio_url || null,
    submittedAt: null
  }));
  localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(mapped));
  return mapped;
}

function readRemoteApproved() {
  try {
    const raw = localStorage.getItem(REMOTE_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function initCommunity() {
  await openDB();
  if (SUPABASE_READY) {
    try {
      await pullApprovedFromSupabase();
    } catch (err) {
      console.warn("[Talk Board] Supabase community sync skipped:", err?.message || err);
    }
  }
}

export function getAllSubmissions() {
  return readQueue();
}

export function getPendingSubmissions() {
  return readQueue().filter(w => w.status === "pending");
}

function approvedFromAllSources(localeCode, dialectId) {
  const local = readQueue().filter(w =>
    w.status === "approved" &&
    w.locale === localeCode &&
    (w.dialect === dialectId || !w.dialect)
  );
  const remote = readRemoteApproved().filter(w =>
    w.locale === localeCode &&
    (w.dialect === dialectId || !w.dialect)
  );
  const seen = new Set(local.map(w => w.id));
  return [...local, ...remote.filter(w => !seen.has(w.id))];
}

export function getApprovedWords(localeCode, dialectId) {
  return approvedFromAllSources(localeCode, dialectId);
}

function audioKey(id) {
  return `${AUDIO_PREFIX}${id}`;
}

async function saveCommunityAudio(id, blob) {
  await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("community_audio", "readwrite");
    tx.objectStore("community_audio").put(blob, audioKey(id));
    tx.oncomplete = res;
    tx.onerror = rej;
  });
}

export async function getCommunityAudio(id) {
  const remote = readRemoteApproved().find(w => w.id === id);
  if (remote?.audioUrl) {
    try {
      const res = await fetch(remote.audioUrl);
      if (res.ok) return await res.blob();
    } catch {
      /* fall through to IndexedDB */
    }
  }
  await openDB();
  return new Promise(res => {
    const tx = db.transaction("community_audio", "readonly");
    const rq = tx.objectStore("community_audio").get(audioKey(id));
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => res(null);
  });
}

/** Submit a new community word (starts as pending). */
export async function submitWord({ text, category, emoji, locale, dialect, audioBlob }) {
  const entry = {
    id: `cw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: String(text).trim(),
    category,
    emoji: emoji || "💬",
    locale,
    dialect: dialect || null,
    source: "community",
    status: "pending",
    hasAudio: !!audioBlob,
    submittedAt: new Date().toISOString()
  };
  if (audioBlob) await saveCommunityAudio(entry.id, audioBlob);
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  return entry;
}

export function approveSubmission(id) {
  const queue = readQueue();
  const item = queue.find(w => w.id === id);
  if (item) item.status = "approved";
  writeQueue(queue);
  return item;
}

export function rejectSubmission(id) {
  const queue = readQueue();
  const item = queue.find(w => w.id === id);
  if (item) item.status = "rejected";
  writeQueue(queue);
  return item;
}

/** Merge approved community words into a category word list. */
export function mergeCommunityWords(builtinWords, categoryId, localeCode, dialectId) {
  const approved = getApprovedWords(localeCode, dialectId)
    .filter(w => w.category === categoryId)
    .map(w => ({
      id: w.id,
      emoji: w.emoji,
      labels: { [localeCode]: w.text },
      source: "community",
      status: "approved",
      communityId: w.id
    }));
  return [...builtinWords, ...approved];
}

export function communityWordToPlayable(entry) {
  return {
    id: entry.id,
    emoji: entry.emoji,
    labels: { [entry.locale]: entry.text },
    source: "community",
    status: entry.status,
    communityId: entry.id
  };
}
