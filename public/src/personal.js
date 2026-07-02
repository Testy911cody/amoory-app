/* Talk Board — personal recordings & custom words
   Local IndexedDB cache + optional Supabase cloud sync when signed in. */

import {
  getSupabase, SUPABASE_READY, getCurrentUser, USER_AUDIO_BUCKET, isOnline
} from "./supabase.js";
import { ttsLangFor } from "./locales.js";
import { openTalkBoardDB } from "./idb.js";
import { siblingDialectFor } from "./dialect-fallback.js";
import { queueFetchBlob, runBatched, PRIORITY } from "./audio-loader.js";

const CUSTOM_KEY = "talkboard_custom_words";
const META_KEY = "talkboard_personal_meta";
const SYNC_QUEUE_KEY = "talkboard_personal_sync";

let db = null;

async function openDB() {
  db = await openTalkBoardDB();
  return db;
}

/** BCP-47 lang code for a locale + dialect (e.g. ar-SD, en-US, fr). */
export function recordingLangCode(locale, dialect) {
  const tag = ttsLangFor(locale, dialect);
  return tag || locale;
}

export function recKey(wordId, locale, dialect) {
  return `${wordId}__${recordingLangCode(locale, dialect)}`;
}

function saveBlobLocal(key, blob) {
  return openDB().then(() => new Promise((res, rej) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").put(blob, key);
    tx.oncomplete = res;
    tx.onerror = rej;
  }));
}

function getBlobLocal(key) {
  return openDB().then(() => new Promise(res => {
    const tx = db.transaction("recordings", "readonly");
    const rq = tx.objectStore("recordings").get(key);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => res(null);
  }));
}

function deleteBlobLocal(key) {
  return openDB().then(() => new Promise((res, rej) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").delete(key);
    tx.oncomplete = res;
    tx.onerror = rej;
  }));
}

let recordedKeys = new Set();

export function getRecordedKeys() {
  return recordedKeys;
}

export async function loadRecordedKeys() {
  await openDB();
  return new Promise(res => {
    const tx = db.transaction("recordings", "readonly");
    const rq = tx.objectStore("recordings").getAllKeys();
    rq.onsuccess = () => { recordedKeys = new Set(rq.result || []); res(recordedKeys); };
    rq.onerror = () => res(recordedKeys);
  });
}

function readCustomWordsLocal() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCustomWordsLocal(items) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(items));
}

function readMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function readSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSyncQueue(items) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items));
}

function queuePersonalSync(entry) {
  const q = readSyncQueue();
  const existing = q.findIndex(e =>
    e.action === entry.action &&
    e.wordId === entry.wordId &&
    e.lang === entry.lang &&
    e.userId === entry.userId
  );
  if (existing >= 0) q[existing] = { ...entry, queuedAt: new Date().toISOString() };
  else q.push({ ...entry, queuedAt: new Date().toISOString() });
  writeSyncQueue(q);
}

async function uploadRecordingToCloud(user, wordId, lang, blob) {
  const supabase = await getSupabase();
  if (!supabase || !user) return { ok: false, error: "not-configured" };
  const path = `${user.id}/${wordId}/${lang}.webm`;
  const up = await uploadAudio(user, path, blob);
  if (!up.ok) return up;
  const { error: dbErr } = await supabase.from("user_recordings").upsert({
    user_id: user.id,
    word_key: wordId,
    lang,
    audio_path: path,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,word_key,lang" });
  return dbErr ? { ok: false, error: dbErr.message } : { ok: true };
}

/** Push queued personal recording uploads when back online. */
export async function syncPersonalQueue() {
  if (!SUPABASE_READY || !isOnline()) return { synced: 0, pendingAuth: 0 };
  const queue = readSyncQueue();
  if (!queue.length) return { synced: 0, pendingAuth: 0 };

  const user = await getCurrentUser();
  if (!user) return { synced: 0, pendingAuth: queue.length };

  let synced = 0;
  const remaining = [];
  for (const entry of queue) {
    if (entry.userId !== user.id) {
      remaining.push(entry);
      continue;
    }
    if (entry.action === "save") {
      const blob = await getBlobLocal(entry.key);
      if (!blob) continue;
      const res = await uploadRecordingToCloud(user, entry.wordId, entry.lang, blob);
      if (res.ok) synced++;
      else remaining.push(entry);
    } else if (entry.action === "delete") {
      const supabase = await getSupabase();
      if (supabase) {
        const path = `${user.id}/${entry.wordId}/${entry.lang}.webm`;
        await supabase.storage.from(USER_AUDIO_BUCKET).remove([path]);
        await supabase.from("user_recordings")
          .delete()
          .eq("user_id", user.id)
          .eq("word_key", entry.wordId)
          .eq("lang", entry.lang);
        synced++;
      } else {
        remaining.push(entry);
      }
    }
  }
  writeSyncQueue(remaining);
  return { synced, pendingAuth: remaining.length && !user ? remaining.length : 0 };
}

async function signedUrl(path) {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(USER_AUDIO_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

async function uploadAudio(user, path, blob) {
  const supabase = await getSupabase();
  if (!supabase || !user) return { ok: false, error: "not-configured" };
  const { error } = await supabase.storage
    .from(USER_AUDIO_BUCKET)
    .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });
  return error ? { ok: false, error: error.message } : { ok: true };
}

async function downloadToCache(key, path, priority = PRIORITY.normal, { direct = false } = {}) {
  if (getRecordedKeys().has(key)) {
    const existing = await getBlobLocal(key);
    if (existing) return existing;
  }
  const url = await signedUrl(path);
  if (!url) return null;
  try {
    let blob;
    if (direct) {
      const res = await fetch(url);
      if (!res.ok) return null;
      blob = await res.blob();
    } else {
      blob = await queueFetchBlob(`personal:${key}`, url, { priority });
    }
    if (!blob) return null;
    await saveBlobLocal(key, blob);
    recordedKeys.add(key);
    const wordId = key.split("__")[0];
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("talkboard:recording-cached", {
        detail: { key, wordId }
      }));
    }
    return blob;
  } catch {
    return null;
  }
}

async function downloadPersonalRows(recs, priority = PRIORITY.normal) {
  let recordings = 0;
  await runBatched(recs, async (row) => {
    const key = `${row.word_key}__${row.lang}`;
    if (getRecordedKeys().has(key)) return null;
    const blob = await downloadToCache(key, row.audio_path, priority, { direct: true });
    if (blob) recordings++;
    return blob;
  });
  return recordings;
}

/** Fetch cloud recordings + custom words for signed-in user. */
export async function syncFromCloud(user) {
  if (!SUPABASE_READY || !user || !isOnline()) return { recordings: 0, words: 0 };
  const supabase = await getSupabase();
  if (!supabase) return { recordings: 0, words: 0 };

  let recordings = 0;
  const { data: recs, error: recErr } = await supabase
    .from("user_recordings")
    .select("word_key,lang,audio_path")
    .eq("user_id", user.id);
  if (!recErr && recs?.length) {
    const meta = readMeta();
    meta.cloudSyncedAt = new Date().toISOString();
    writeMeta(meta);
    const pending = recs.filter(row => {
      const key = `${row.word_key}__${row.lang}`;
      return row.audio_path && !getRecordedKeys().has(key);
    });
    if (pending.length) {
      downloadPersonalRows(pending, PRIORITY.background).then(n => {
        recordings = n;
        loadRecordedKeys();
      }).catch(() => {});
    }
  }

  await loadRecordedKeys();

  let words = 0;
  const { data: cloudWords, error: wordErr } = await supabase
    .from("user_words")
    .select("*")
    .eq("user_id", user.id);
  if (!wordErr && cloudWords?.length) {
    const local = readCustomWordsLocal();
    const seen = new Set(local.map(w => w.word_key));
    for (const row of cloudWords) {
      if (seen.has(row.word_key)) continue;
      const entry = cloudRowToWord(row);
      if (row.audio_path) {
        const key = recKey(row.word_key, row.locale, row.dialect);
        if (!getRecordedKeys().has(key)) {
          downloadToCache(key, row.audio_path, PRIORITY.background).catch(() => {});
        }
      }
      local.push(entry);
      seen.add(row.word_key);
      words++;
    }
    writeCustomWordsLocal(local);
  }

  await loadRecordedKeys();
  return { recordings, words };
}

function cloudRowToWord(row) {
  const labels = { [row.locale]: row.label };
  if (row.dialect && row.dialect !== "default") {
    const lang = recordingLangCode(row.locale, row.dialect);
    labels[lang] = row.label;
  }
  if (row.english_hint) labels.en = row.english_hint;
  return {
    id: row.word_key,
    word_key: row.word_key,
    emoji: row.emoji || "💬",
    labels,
    categoryId: row.category,
    source: "personal",
    locale: row.locale,
    dialect: row.dialect,
    cloudId: row.id
  };
}

export function getCustomWords(locale, dialect) {
  return readCustomWordsLocal().filter(w =>
    w.locale === locale &&
    (w.dialect === dialect || !w.dialect || dialect === "default")
  );
}

export function getAllCustomWords() {
  return readCustomWordsLocal();
}

/** Merge custom personal words into a category list. */
export function mergePersonalWords(builtinWords, categoryId, locale, dialect) {
  const custom = getCustomWords(locale, dialect)
    .filter(w => w.categoryId === categoryId)
    .map(w => ({ ...w, source: "personal" }));
  return [...builtinWords, ...custom];
}

export async function prefetchPersonalRecording(wordId, locale, dialect, priority = PRIORITY.tap) {
  const key = recKey(wordId, locale, dialect);
  if (getRecordedKeys().has(key)) return true;
  const blob = await getBlobLocal(key);
  if (blob) return true;
  if (!isOnline() || !SUPABASE_READY) return false;
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await getSupabase();
  if (!supabase) return false;
  const lang = recordingLangCode(locale, dialect);
  const { data } = await supabase
    .from("user_recordings")
    .select("audio_path")
    .eq("user_id", user.id)
    .eq("word_key", wordId)
    .eq("lang", lang)
    .maybeSingle();
  if (!data?.audio_path) return false;
  return !!(await downloadToCache(key, data.audio_path, priority));
}

export async function getPersonalRecording(wordId, locale, dialect, { directOnly = false } = {}) {
  const key = recKey(wordId, locale, dialect);
  const blob = await getBlobLocal(key);
  if (blob) return blob;
  if (directOnly) return null;
  const sibling = siblingDialectFor(locale, dialect);
  if (!sibling) return null;
  return getBlobLocal(recKey(wordId, locale, sibling));
}

export async function savePersonalRecording(wordId, locale, dialect, blob, user, { shareWithCommunity = false } = {}) {
  if (!user) throw new Error("auth-required");
  const key = recKey(wordId, locale, dialect);
  const lang = recordingLangCode(locale, dialect);
  await saveBlobLocal(key, blob);
  recordedKeys.add(key);

  const meta = readMeta();
  if (!meta.recordings) meta.recordings = {};
  meta.recordings[key] = {
    shareWithCommunity: !!shareWithCommunity,
    updatedAt: new Date().toISOString()
  };
  writeMeta(meta);

  if (user && SUPABASE_READY) {
    if (!isOnline()) {
      queuePersonalSync({ action: "save", wordId, lang, key, userId: user.id });
      return key;
    }
    const up = await uploadRecordingToCloud(user, wordId, lang, blob);
    if (!up.ok) {
      queuePersonalSync({ action: "save", wordId, lang, key, userId: user.id });
    }
  }
  return key;
}

export async function deletePersonalRecording(wordId, locale, dialect, user) {
  if (!user) return;
  const key = recKey(wordId, locale, dialect);
  const lang = recordingLangCode(locale, dialect);
  await deleteBlobLocal(key);
  recordedKeys.delete(key);

  const meta = readMeta();
  if (meta.recordings?.[key]) {
    delete meta.recordings[key];
    writeMeta(meta);
  }

  if (user && SUPABASE_READY && isOnline()) {
    const supabase = await getSupabase();
    if (supabase) {
      const path = `${user.id}/${wordId}/${lang}.webm`;
      await supabase.storage.from(USER_AUDIO_BUCKET).remove([path]);
      await supabase.from("user_recordings")
        .delete()
        .eq("user_id", user.id)
        .eq("word_key", wordId)
        .eq("lang", lang);
    }
  } else if (user && SUPABASE_READY) {
    queuePersonalSync({ action: "delete", wordId, lang, userId: user.id });
  }
}

export async function addCustomWord({ label, englishHint, emoji, category, locale, dialect, audioBlob }, user) {
  if (!user) throw new Error("auth-required");
  const wordKey = `uw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const labels = { [locale]: label };
  if (englishHint) labels.en = englishHint;
  const entry = {
    id: wordKey,
    word_key: wordKey,
    emoji: emoji || "💬",
    labels,
    categoryId: category || "social",
    source: "personal",
    locale,
    dialect: dialect || null
  };

  const local = readCustomWordsLocal();
  local.push(entry);
  writeCustomWordsLocal(local);

  if (audioBlob) {
    await savePersonalRecording(wordKey, locale, dialect, audioBlob, user);
  }

  if (user && SUPABASE_READY && isOnline()) {
    const supabase = await getSupabase();
    if (supabase) {
      let audioPath = null;
      if (audioBlob) {
        const lang = recordingLangCode(locale, dialect);
        audioPath = `${user.id}/${wordKey}/${lang}.webm`;
      }
      await supabase.from("user_words").insert({
        user_id: user.id,
        word_key: wordKey,
        label,
        english_hint: englishHint || null,
        emoji: entry.emoji,
        category: entry.categoryId,
        locale,
        dialect: dialect || null,
        audio_path: audioPath
      });
    }
  }
  return entry;
}

export async function deleteCustomWord(wordKey, user) {
  if (!user) return;
  const local = readCustomWordsLocal();
  const item = local.find(w => w.word_key === wordKey || w.id === wordKey);
  writeCustomWordsLocal(local.filter(w => w.word_key !== wordKey && w.id !== wordKey));

  if (item) {
    await deletePersonalRecording(item.id, item.locale, item.dialect, user);
  }

  if (user && SUPABASE_READY) {
    const supabase = await getSupabase();
    if (supabase) {
      await supabase.from("user_words")
        .delete()
        .eq("user_id", user.id)
        .eq("word_key", wordKey);
    }
  }
}

export async function listPersonalRecordings(locale, dialect) {
  const lang = recordingLangCode(locale, dialect);
  const suffix = `__${lang}`;
  const keys = [...recordedKeys].filter(k => k.endsWith(suffix));
  return keys.map(k => {
    const wordId = k.slice(0, -suffix.length);
    return { wordId, key: k, lang };
  });
}

export function getRecordingSharePreference(wordId, locale, dialect) {
  const key = recKey(wordId, locale, dialect);
  const meta = readMeta();
  return meta.recordings?.[key]?.shareWithCommunity ?? null;
}

export async function initPersonal(user) {
  await openDB();
  await loadRecordedKeys();
  if (user && isOnline()) {
    await syncFromCloud(user);
    await syncPersonalQueue();
  }
  return { recordings: 0, words: 0 };
}
