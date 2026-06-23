/* Talk Board — global approved word recordings (baseline voices per locale/dialect)
   Public read for approved rows; contributors submit pending; admins approve. */

import {
  getSupabase, SUPABASE_READY, getCurrentUser, GLOBAL_AUDIO_BUCKET, isOnline
} from "./supabase.js";
import { recKey, recordingLangCode, getRecordedKeys, loadRecordedKeys } from "./personal.js";
import { openTalkBoardDB } from "./idb.js";
import { checkIsAdmin } from "./community.js";
import { dialectsToLoad, siblingDialectFor } from "./dialect-fallback.js";

const REMOTE_CACHE_KEY = "talkboard_global_remote";
const GLOBAL_SYNC_KEY = "talkboard_global_sync_queue";

function readRemoteApproved() {
  try {
    const raw = localStorage.getItem(REMOTE_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRemoteApproved(rows) {
  localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(rows));
}

function readGlobalSyncQueue() {
  try {
    const raw = localStorage.getItem(GLOBAL_SYNC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeGlobalSyncQueue(items) {
  localStorage.setItem(GLOBAL_SYNC_KEY, JSON.stringify(items));
}

function queueGlobalSubmission({ wordId, locale, dialect, audioBlob }) {
  const lang = recordingLangCode(locale, dialect);
  const syncKey = `sync_global__${wordId}__${lang}`;
  saveBlobLocal(syncKey, audioBlob);
  const q = readGlobalSyncQueue();
  q.push({ wordId, locale, dialect, syncKey, queuedAt: new Date().toISOString() });
  writeGlobalSyncQueue(q);
}

async function saveBlobLocal(key, blob) {
  const db = await openTalkBoardDB();
  return new Promise((res, rej) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").put(blob, key);
    tx.oncomplete = res;
    tx.onerror = rej;
  });
}

async function fetchBlobToCache(key, audioUrl) {
  if (!audioUrl) return null;
  if (!isOnline()) return null;
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    await saveBlobLocal(key, blob);
    getRecordedKeys().add(key);
    return blob;
  } catch {
    return null;
  }
}

function mergeRemoteApproved(locale, dialects, newRows) {
  const keep = readRemoteApproved().filter(r =>
    r.locale !== locale || !dialects.includes(r.dialect ?? null)
  );
  writeRemoteApproved([...keep, ...newRows]);
}

/** Use cached metadata + IndexedDB when offline. */
async function loadFromCacheOnly(locale, dialect) {
  await loadRecordedKeys();
  const dialects = dialectsToLoad(locale, dialect);
  const rows = readRemoteApproved().filter(r =>
    r.locale === locale && dialects.includes(r.dialect ?? null)
  );
  return { loaded: rows.length, fromCache: true };
}

/** Pull approved global recordings from Supabase and cache audio in IndexedDB. */
export async function loadGlobalRecordings(locale, dialect) {
  if (!SUPABASE_READY) return loadFromCacheOnly(locale, dialect);
  if (!isOnline()) return loadFromCacheOnly(locale, dialect);

  const supabase = await getSupabase();
  if (!supabase) return loadFromCacheOnly(locale, dialect);

  const dialects = dialectsToLoad(locale, dialect);
  let query = supabase
    .from("global_word_recordings")
    .select("id,word_key,locale,dialect,lang,audio_url,status,fallback_from_dialect")
    .eq("status", "approved")
    .eq("locale", locale);
  if (dialects.length === 1 && dialects[0] === null) {
    query = query.is("dialect", null);
  } else if (dialects.length === 1) {
    query = query.eq("dialect", dialects[0]);
  } else if (dialects.length > 1) {
    query = query.in("dialect", dialects);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[Talk Board] global recordings fetch:", error.message);
    return loadFromCacheOnly(locale, dialect);
  }

  const rows = data || [];
  mergeRemoteApproved(locale, dialects, rows);

  let loaded = 0;
  for (const row of rows) {
    const key = recKey(row.word_key, row.locale, row.dialect);
    const blob = await fetchBlobToCache(key, row.audio_url);
    if (blob) loaded++;
  }
  await loadRecordedKeys();
  return { loaded };
}

async function getGlobalRecordingDirect(wordId, locale, dialect) {
  const key = recKey(wordId, locale, dialect);
  const db = await openTalkBoardDB();
  const local = await new Promise(res => {
    const tx = db.transaction("recordings", "readonly");
    const rq = tx.objectStore("recordings").get(key);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => res(null);
  });
  if (local) return local;

  const remote = readRemoteApproved().find(r =>
    r.word_key === wordId &&
    r.locale === locale &&
    (r.dialect === dialect || (!r.dialect && !dialect))
  );
  if (remote?.audio_url && isOnline()) {
    return fetchBlobToCache(key, remote.audio_url);
  }
  return null;
}

/** Approved global baseline for a locale/dialect (optional sibling shared pool). */
export async function getGlobalRecording(wordId, locale, dialect, { directOnly = false } = {}) {
  const direct = await getGlobalRecordingDirect(wordId, locale, dialect);
  if (direct) return direct;
  if (directOnly) return null;
  const sibling = siblingDialectFor(locale, dialect);
  if (!sibling) return null;
  return getGlobalRecordingDirect(wordId, locale, sibling);
}

/** Push queued global recording submissions when back online. */
export async function syncGlobalQueue() {
  if (!SUPABASE_READY || !isOnline()) return { uploaded: 0, pendingAuth: 0 };
  const queue = readGlobalSyncQueue();
  if (!queue.length) return { uploaded: 0, pendingAuth: 0 };

  const user = await getCurrentUser();
  if (!user) return { uploaded: 0, pendingAuth: queue.length };

  let uploaded = 0;
  const remaining = [];
  for (const entry of queue) {
    const blob = entry.syncKey
      ? await new Promise(res => {
          openTalkBoardDB().then(db => {
            const tx = db.transaction("recordings", "readonly");
            const rq = tx.objectStore("recordings").get(entry.syncKey);
            rq.onsuccess = () => res(rq.result || null);
            rq.onerror = () => res(null);
          });
        })
      : null;
    if (!blob) continue;
    const res = await submitGlobalRecordingNow({
      wordId: entry.wordId,
      locale: entry.locale,
      dialect: entry.dialect,
      audioBlob: blob
    });
    if (res.ok) {
      uploaded++;
      if (entry.syncKey) {
        const db = await openTalkBoardDB();
        const tx = db.transaction("recordings", "readwrite");
        tx.objectStore("recordings").delete(entry.syncKey);
      }
    } else if (res.reason === "auth") {
      remaining.push(entry);
    } else {
      remaining.push(entry);
    }
  }
  writeGlobalSyncQueue(remaining);
  return { uploaded, pendingAuth: remaining.length && !user ? remaining.length : 0 };
}

async function submitGlobalRecordingNow({ wordId, locale, dialect, audioBlob }) {
  if (!SUPABASE_READY || !audioBlob?.size) return { skipped: true };
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, reason: "not-configured" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };

  const lang = recordingLangCode(locale, dialect);
  const path = `pending/${user.id}/${wordId}/${lang}.webm`;
  const { error: upErr } = await supabase.storage
    .from(GLOBAL_AUDIO_BUCKET)
    .upload(path, audioBlob, { contentType: audioBlob.type || "audio/webm", upsert: true });
  if (upErr) return { ok: false, reason: upErr.message };

  const audioUrl = supabase.storage.from(GLOBAL_AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabase.from("global_word_recordings").insert({
    word_key: wordId,
    locale,
    dialect: dialect || null,
    lang,
    audio_url: audioUrl,
    status: "pending",
    submitted_by: user.id
  }).select("id").maybeSingle();
  if (error) return { ok: false, reason: error.message };
  return { ok: true, id: data?.id };
}

/** Submit a builtin-word recording for global approval (signed-in + share). */
export async function submitGlobalRecording({ wordId, locale, dialect, audioBlob }) {
  if (!SUPABASE_READY || !audioBlob?.size) return { skipped: true };
  if (!isOnline()) {
    queueGlobalSubmission({ wordId, locale, dialect, audioBlob });
    return { queued: true };
  }
  const user = await getCurrentUser();
  if (!user) return { needsAuth: true };
  return submitGlobalRecordingNow({ wordId, locale, dialect, audioBlob });
}

export async function fetchPendingGlobalRecordings() {
  if (!isOnline()) return { items: [], isAdmin: false };
  const supabase = await getSupabase();
  if (!supabase) return { items: [], isAdmin: false };
  const user = await getCurrentUser();
  if (!user) return { items: [], isAdmin: false };
  const isAdmin = await checkIsAdmin();
  let query = supabase
    .from("global_word_recordings")
    .select("id,word_key,locale,dialect,lang,audio_url,status,submitted_by,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (!isAdmin) query = query.eq("submitted_by", user.id);
  const { data, error } = await query;
  if (error) throw error;
  return {
    isAdmin,
    items: (data || []).map(row => ({
      id: row.id,
      wordId: row.word_key,
      text: row.word_key,
      locale: row.locale,
      dialect: row.dialect || null,
      lang: row.lang,
      audioUrl: row.audio_url,
      submittedBy: row.submitted_by,
      submittedAt: row.created_at,
      kind: "global-recording"
    }))
  };
}

export async function approveGlobalRecording(id) {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, reason: "not-configured" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };

  const { data: row, error: fetchErr } = await supabase
    .from("global_word_recordings")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (fetchErr) return { ok: false, reason: fetchErr.message };
  if (!row) return { ok: false, reason: "not-found" };

  const approvedPath = `approved/${row.locale}/${row.dialect || "default"}/${row.word_key}/${row.lang}.webm`;
  let audioUrl = row.audio_url;

  try {
    const pendingRes = await fetch(row.audio_url);
    if (pendingRes.ok) {
      const blob = await pendingRes.blob();
      const { error: upErr } = await supabase.storage
        .from(GLOBAL_AUDIO_BUCKET)
        .upload(approvedPath, blob, { contentType: blob.type || "audio/webm", upsert: true });
      if (!upErr) {
        audioUrl = supabase.storage.from(GLOBAL_AUDIO_BUCKET).getPublicUrl(approvedPath).data.publicUrl;
      }
    }
  } catch { /* keep pending URL if copy fails */ }

  const { error } = await supabase
    .from("global_word_recordings")
    .update({
      status: "approved",
      audio_url: audioUrl,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, reason: error.message };

  if (row.dialect && !row.fallback_from_dialect) {
    await supabase
      .from("global_word_recordings")
      .delete()
      .eq("word_key", row.word_key)
      .eq("locale", row.locale)
      .eq("dialect", row.dialect)
      .not("fallback_from_dialect", "is", null);
  }

  try { await loadGlobalRecordings(row.locale, row.dialect); } catch { /* optional */ }
  return { ok: true };
}

/** Admin overview: approved global recordings with fallback metadata. */
export async function fetchGlobalRecordingsOverview({ locale = "ar", dialect = null } = {}) {
  const supabase = await getSupabase();
  if (!supabase) return { items: [], isAdmin: false };
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return { items: [], isAdmin: false };

  let query = supabase
    .from("global_word_recordings")
    .select("id,word_key,locale,dialect,lang,audio_url,status,fallback_from_dialect,created_at")
    .eq("status", "approved")
    .eq("locale", locale)
    .order("word_key", { ascending: true });
  if (dialect === "sd" || dialect === "juba") {
    query = query.in("dialect", ["sd", "juba"]);
  } else if (dialect) {
    query = query.eq("dialect", dialect);
  }
  const { data, error } = await query;
  if (error) throw error;
  return {
    isAdmin,
    items: (data || []).map(row => ({
      id: row.id,
      wordId: row.word_key,
      locale: row.locale,
      dialect: row.dialect || null,
      lang: row.lang,
      audioUrl: row.audio_url,
      fallbackFrom: row.fallback_from_dialect || null,
      kind: "global-approved"
    }))
  };
}

export async function rejectGlobalRecording(id) {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, reason: "not-configured" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };
  const { error } = await supabase
    .from("global_word_recordings")
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
