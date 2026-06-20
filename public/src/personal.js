/* Talk Board — personal recordings & custom words
   Local IndexedDB cache + optional Supabase cloud sync when signed in. */

import {
  getSupabase, SUPABASE_READY, getCurrentUser, USER_AUDIO_BUCKET
} from "./supabase.js";
import { ttsLangFor } from "./locales.js";
import { openTalkBoardDB } from "./idb.js";

const CUSTOM_KEY = "talkboard_custom_words";
const META_KEY = "talkboard_personal_meta";

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

async function downloadToCache(key, path) {
  const url = await signedUrl(path);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    await saveBlobLocal(key, blob);
    recordedKeys.add(key);
    return blob;
  } catch {
    return null;
  }
}

/** Fetch cloud recordings + custom words for signed-in user. */
export async function syncFromCloud(user) {
  if (!SUPABASE_READY || !user) return { recordings: 0, words: 0 };
  const supabase = await getSupabase();
  if (!supabase) return { recordings: 0, words: 0 };

  let recordings = 0;
  const { data: recs, error: recErr } = await supabase
    .from("user_recordings")
    .select("word_key,lang,audio_path")
    .eq("user_id", user.id);
  if (!recErr && recs?.length) {
    for (const row of recs) {
      const key = `${row.word_key}__${row.lang}`;
      const blob = await downloadToCache(key, row.audio_path);
      if (blob) recordings++;
    }
    const meta = readMeta();
    meta.cloudSyncedAt = new Date().toISOString();
    writeMeta(meta);
  }

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
        await downloadToCache(key, row.audio_path);
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

export async function getPersonalRecording(wordId, locale, dialect) {
  const key = recKey(wordId, locale, dialect);
  return getBlobLocal(key);
}

export async function savePersonalRecording(wordId, locale, dialect, blob, user, { shareWithCommunity = false } = {}) {
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
    const supabase = await getSupabase();
    if (supabase) {
      const path = `${user.id}/${wordId}/${lang}.webm`;
      const up = await uploadAudio(user, path, blob);
      if (!up.ok) {
        const err = new Error(up.error || "upload-failed");
        err.code = "cloud-upload";
        throw err;
      }
      const { error: dbErr } = await supabase.from("user_recordings").upsert({
        user_id: user.id,
        word_key: wordId,
        lang,
        audio_path: path,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,word_key,lang" });
      if (dbErr) {
        const err = new Error(dbErr.message);
        err.code = "cloud-db";
        throw err;
      }
    }
  }
  return key;
}

export async function deletePersonalRecording(wordId, locale, dialect, user) {
  const key = recKey(wordId, locale, dialect);
  const lang = recordingLangCode(locale, dialect);
  await deleteBlobLocal(key);
  recordedKeys.delete(key);

  const meta = readMeta();
  if (meta.recordings?.[key]) {
    delete meta.recordings[key];
    writeMeta(meta);
  }

  if (user && SUPABASE_READY) {
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
  }
}

export async function addCustomWord({ label, englishHint, emoji, category, locale, dialect, audioBlob }, user) {
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

  if (user && SUPABASE_READY) {
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
  if (user) {
    return syncFromCloud(user);
  }
  return { recordings: 0, words: 0 };
}
