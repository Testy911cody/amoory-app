/* Talk Board — global approved word recordings (baseline voices per locale/dialect)
   Public read for approved rows; contributors submit pending; admins approve. */

import {
  getSupabase, SUPABASE_READY, getCurrentUser, GLOBAL_AUDIO_BUCKET
} from "./supabase.js";
import { recKey, recordingLangCode, getRecordedKeys, loadRecordedKeys } from "./personal.js";
import { openTalkBoardDB } from "./idb.js";
import { checkIsAdmin } from "./community.js";

const REMOTE_CACHE_KEY = "talkboard_global_remote";

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

/** Pull approved global recordings from Supabase and cache audio in IndexedDB. */
export async function loadGlobalRecordings(locale, dialect) {
  if (!SUPABASE_READY) return { loaded: 0 };
  const supabase = await getSupabase();
  if (!supabase) return { loaded: 0 };

  let query = supabase
    .from("global_word_recordings")
    .select("id,word_key,locale,dialect,lang,audio_url,status")
    .eq("status", "approved")
    .eq("locale", locale);
  if (dialect) query = query.eq("dialect", dialect);
  else query = query.is("dialect", null);

  const { data, error } = await query;
  if (error) {
    console.warn("[Talk Board] global recordings fetch:", error.message);
    return { loaded: 0 };
  }

  const rows = data || [];
  writeRemoteApproved(rows);
  let loaded = 0;
  for (const row of rows) {
    const key = `${row.word_key}__${row.lang}`;
    const blob = await fetchBlobToCache(key, row.audio_url);
    if (blob) loaded++;
  }
  await loadRecordedKeys();
  return { loaded };
}

export async function getGlobalRecording(wordId, locale, dialect) {
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
  if (remote?.audio_url) {
    return fetchBlobToCache(key, remote.audio_url);
  }
  return null;
}

/** Submit a builtin-word recording for global approval (signed-in + share). */
export async function submitGlobalRecording({ wordId, locale, dialect, audioBlob }) {
  if (!SUPABASE_READY || !audioBlob?.size) return { skipped: true };
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, reason: "not-configured" };
  const user = await getCurrentUser();
  if (!user) return { needsAuth: true };

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

export async function fetchPendingGlobalRecordings() {
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

  try { await loadGlobalRecordings(row.locale, row.dialect); } catch { /* optional */ }
  return { ok: true };
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
