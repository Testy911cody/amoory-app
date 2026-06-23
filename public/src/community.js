/* Talk Board — community word contributions (Phase 1: localStorage + IndexedDB)
   Phase 2: sync approved rows from Supabase — see docs/supabase-community-words.sql */

import { getSupabase, SUPABASE_READY, AUDIO_BUCKET, getCurrentUser, isOnline } from "./supabase.js";
import { openTalkBoardDB } from "./idb.js";
import { moderateForCommunity, logModerationRejection } from "./moderation.js";
import { fallbackDialectFor } from "./dialect-fallback.js";

const QUEUE_KEY = "talkboard_community_queue";
const REMOTE_CACHE_KEY = "talkboard_community_remote";
const AUDIO_PREFIX = "community__";

async function openDB() {
  return openTalkBoardDB();
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
  for (const row of mapped) {
    if (row.audioUrl) await cacheCommunityAudioFromUrl(row.id, row.audioUrl);
  }
  return mapped;
}

async function cacheCommunityAudioFromUrl(id, audioUrl) {
  if (!audioUrl || !isOnline()) return;
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) return;
    const blob = await res.blob();
    await saveCommunityAudio(id, blob);
  } catch { /* optional */ }
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
  if (!SUPABASE_READY || !isOnline()) return;
  try {
    await pullApprovedFromSupabase();
    await syncShareQueue();
  } catch (err) {
    console.warn("[Talk Board] Supabase community sync skipped:", err?.message || err);
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
  const primary = approvedFromAllSources(localeCode, dialectId);
  const fb = fallbackDialectFor(localeCode, dialectId);
  if (!fb) return primary;
  const fallback = approvedFromAllSources(localeCode, fb);
  const seen = new Set(primary.map(w => w.text?.toLowerCase()));
  const merged = [...primary];
  for (const w of fallback) {
    const norm = w.text?.toLowerCase();
    if (norm && !seen.has(norm)) {
      merged.push({ ...w, dialectFallback: fb });
      seen.add(norm);
    }
  }
  return merged;
}

function audioKey(id) {
  return `${AUDIO_PREFIX}${id}`;
}

async function saveCommunityAudio(id, blob) {
  const database = await openDB();
  return new Promise((res, rej) => {
    const tx = database.transaction("community_audio", "readwrite");
    tx.objectStore("community_audio").put(blob, audioKey(id));
    tx.oncomplete = res;
    tx.onerror = rej;
  });
}

export async function getCommunityAudio(id) {
  const database = await openDB();
  const cached = await new Promise(res => {
    const tx = database.transaction("community_audio", "readonly");
    const rq = tx.objectStore("community_audio").get(audioKey(id));
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => res(null);
  });
  if (cached) return cached;

  const remote = readRemoteApproved().find(w => w.id === id);
  if (remote?.audioUrl && isOnline()) {
    try {
      const res = await fetch(remote.audioUrl);
      if (res.ok) {
        const blob = await res.blob();
        await saveCommunityAudio(id, blob);
        return blob;
      }
    } catch { /* fall through */ }
  }
  return null;
}

/** Submit a new community word (starts as pending).
   Runs client-side moderation first — rejected words never enter the queue.
   When `shareOnline` is set and Supabase is configured + the contributor is
   signed in, the word + audio are also pushed to the shared online library. */
export async function submitWord({ text, category, emoji, locale, dialect, audioBlob, shareOnline }) {
  const trimmed = String(text).trim();
  const mod = moderateForCommunity(trimmed, locale);
  if (!mod.ok) {
    logModerationRejection(trimmed, locale, mod.reason);
    return { rejected: true, reason: mod.reason };
  }

  const entry = {
    id: `cw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: trimmed,
    category,
    emoji: emoji || "💬",
    locale,
    dialect: dialect || null,
    source: "community",
    status: "pending",
    hasAudio: !!audioBlob,
    shareOnline: !!shareOnline,
    syncedOnline: false,
    submittedAt: new Date().toISOString()
  };
  if (audioBlob) await saveCommunityAudio(entry.id, audioBlob);
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);

  if (shareOnline && SUPABASE_READY) {
    try { await syncShareQueue(); } catch { /* retried later */ }
  }
  return { entry, rejected: false };
}

/** Upload one queued entry to Supabase Storage + community_words table. */
async function uploadEntryToSupabase(entry) {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, reason: "not-configured" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };

  let audioUrl = null;
  if (entry.hasAudio) {
    const blob = await getCommunityAudio(entry.id);
    if (blob) {
      const path = `${user.id}/${entry.id}.webm`;
      const up = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });
      if (up.error) return { ok: false, reason: up.error.message };
      audioUrl = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
    }
  }

  const { error } = await supabase.from("community_words").insert({
    text: entry.text,
    category: entry.category,
    emoji: entry.emoji,
    locale: entry.locale,
    dialect: entry.dialect,
    audio_url: audioUrl,
    status: "pending",
    submitted_by: user.id
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** Push any not-yet-synced "share online" entries. Safe to call repeatedly. */
export async function syncShareQueue() {
  if (!SUPABASE_READY || !isOnline()) return { uploaded: 0, pendingAuth: 0 };
  const queue = readQueue();
  let uploaded = 0, pendingAuth = 0;
  for (const entry of queue) {
    if (!entry.shareOnline || entry.syncedOnline) continue;
    const res = await uploadEntryToSupabase(entry);
    if (res.ok) { entry.syncedOnline = true; uploaded++; }
    else if (res.reason === "auth") { pendingAuth++; }
  }
  if (uploaded) writeQueue(queue);
  return { uploaded, pendingAuth };
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

/** Check if the signed-in user is a community moderator (profiles.is_admin). */
export async function checkIsAdmin() {
  const supabase = await getSupabase();
  if (!supabase) return false;
  const user = await getCurrentUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return false;
  return !!data?.is_admin;
}

/** Fetch pending community_words from Supabase (own submissions, or all if admin). */
export async function fetchOnlinePending() {
  const supabase = await getSupabase();
  if (!supabase) return { items: [], isAdmin: false };
  const user = await getCurrentUser();
  if (!user) return { items: [], isAdmin: false };
  const isAdmin = await checkIsAdmin();
  let query = supabase
    .from("community_words")
    .select("id,text,category,emoji,locale,dialect,audio_url,status,submitted_by,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (!isAdmin) query = query.eq("submitted_by", user.id);
  const { data, error } = await query;
  if (error) throw error;
  return {
    isAdmin,
    items: (data || []).map(row => ({
      id: row.id,
      text: row.text,
      category: row.category,
      emoji: row.emoji || "💬",
      locale: row.locale,
      dialect: row.dialect || null,
      hasAudio: !!row.audio_url,
      audioUrl: row.audio_url || null,
      submittedBy: row.submitted_by,
      submittedAt: row.created_at,
      source: "online"
    }))
  };
}

/** Admin: approve a pending online word (updates Supabase + refreshes local cache). */
export async function approveOnlineSubmission(id) {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, reason: "not-configured" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };
  const { data, error } = await supabase
    .from("community_words")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id,text,category,emoji,locale,dialect,audio_url")
    .maybeSingle();
  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: false, reason: "not-found" };
  try { await pullApprovedFromSupabase(); } catch { /* cache refresh optional */ }
  return { ok: true, row: data };
}

/** Admin: reject a pending online word. */
export async function rejectOnlineSubmission(id) {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, reason: "not-configured" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };
  const { error } = await supabase
    .from("community_words")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** Merge approved community words into a category word list. */
export function mergeCommunityWords(builtinWords, categoryId, localeCode, dialectId) {
  const approved = getApprovedWords(localeCode, dialectId)
    .filter(w => w.category === categoryId)
    .map(w => {
      const key = (dialectId && dialectId !== "default") ? `${localeCode}-${String(dialectId).toUpperCase()}` : localeCode;
      return {
        id: w.id,
        emoji: w.emoji,
        labels: { [key]: w.text },
        source: "community",
        status: "approved",
        communityId: w.id
      };
    });
  return [...builtinWords, ...approved];
}

export function communityWordToPlayable(entry) {
  const key = (entry.dialect && entry.dialect !== "default") ? `${entry.locale}-${String(entry.dialect).toUpperCase()}` : entry.locale;
  return {
    id: entry.id,
    emoji: entry.emoji,
    labels: { [key]: entry.text },
    source: "community",
    status: entry.status,
    communityId: entry.id
  };
}
