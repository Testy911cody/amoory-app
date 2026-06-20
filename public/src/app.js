/* Talk Board — main app logic
   Multi-language/dialect via locale registry + Web Speech API TTS.
   Community words: local queue now, Supabase in Phase 2. */

import { CATEGORIES, WORDS, labelForWord, labelForCategory } from "./data.js";
import {
  LOCALES, loadSettings, saveSettings, getLocale, getDialect,
  uiString, ttsLangFor, effectiveDir
} from "./locales.js";
import { initTTS, say, previewVoice, voicesForLocale, unlockAudio } from "./tts.js";
import {
  initCommunity, mergeCommunityWords, submitWord, getPendingSubmissions,
  approveSubmission, rejectSubmission, getCommunityAudio
} from "./community.js";

/* ---------------- Toast ---------------- */
function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = "1";
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = "0"; }, 5000);
}

function t(key) {
  return uiString(settings.locale, key);
}

/* ---------------- Local recordings (IndexedDB) ---------------- */
let db = null;
function openDB() {
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
const recKey = (wordId, dialectId) => `${wordId}__${dialectId}`;
function saveRec(key, blob) {
  return new Promise((res, rej) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").put(blob, key);
    tx.oncomplete = res; tx.onerror = rej;
  });
}
function getRec(key) {
  return new Promise(res => {
    if (!db) return res(null);
    const tx = db.transaction("recordings", "readonly");
    const rq = tx.objectStore("recordings").get(key);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => res(null);
  });
}
let recordedKeys = new Set();
function loadRecordedKeys() {
  return new Promise(res => {
    if (!db) return res();
    const tx = db.transaction("recordings", "readonly");
    const rq = tx.objectStore("recordings").getAllKeys();
    rq.onsuccess = () => { recordedKeys = new Set(rq.result || []); res(); };
    rq.onerror = () => res();
  });
}
function playBlob(blob) {
  return new Promise(res => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.onended = () => { URL.revokeObjectURL(url); res(); };
    a.onerror = () => res();
    a.play().catch(() => res());
  });
}

/* ---------------- Recording with mic ---------------- */
let mediaRec = null, recChunks = [], recordingKey = null;
async function toggleRecord(word, cardEl) {
  if (mediaRec && mediaRec.state === "recording") { mediaRec.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("This device can't record audio."); return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast("Microphone blocked. Allow microphone access, then try again."); return; }

  recChunks = [];
  recordingKey = recKey(word.id, state.dialect);
  mediaRec = new MediaRecorder(stream);
  mediaRec.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
  mediaRec.onstop = async () => {
    stream.getTracks().forEach(tr => tr.stop());
    const blob = new Blob(recChunks, { type: mediaRec.mimeType || "audio/webm" });
    await saveRec(recordingKey, blob);
    recordedKeys.add(recordingKey);
    cardEl.classList.remove("recording");
    cardEl.classList.add("has-rec");
    if (!cardEl.querySelector(".reciic")) {
      const tick = document.createElement("span");
      tick.className = "reciic"; tick.textContent = "🎙️"; cardEl.appendChild(tick);
    }
    await playBlob(blob);
    toast(t("savedVoice"));
  };
  cardEl.classList.add("recording");
  mediaRec.start();
  toast("Recording… tap the mic again to stop.");
}

/* ---------------- Audio playback priority ----------------
   1. Personal recording (IndexedDB)
   2. Approved community audio
   3. Web Speech API TTS */
async function speakWord(word) {
  const key = recKey(word.id, state.dialect);
  const personal = await getRec(key);
  if (personal) { await playBlob(personal); return; }

  if (word.source === "community" && word.communityId) {
    const comm = await getCommunityAudio(word.communityId);
    if (comm) { await playBlob(comm); return; }
  }

  const text = labelForWord(word, settings.locale);
  const lang = ttsLangFor(settings.locale, state.dialect);
  try {
    await say(text, lang, { voiceURI: settings.voiceURI });
  } catch {
    toast(t("noVoice"));
  }
}

/* ---------------- State ---------------- */
let settings = loadSettings();
const state = {
  category: CATEGORIES[0].id,
  dialect: settings.dialect,
  sentence: []
};

/* ---------------- DOM refs ---------------- */
const el = {
  cats: document.getElementById("cats"),
  board: document.getElementById("board"),
  strip: document.getElementById("strip"),
  title: document.getElementById("appTitle"),
  sayLbl: document.getElementById("sayLbl"),
  localeSelect: document.getElementById("localeSelect"),
  dialectSelect: document.getElementById("dialectSelect"),
  voiceSelect: document.getElementById("voiceSelect"),
  settingsPanel: document.getElementById("settingsPanel"),
  contributePanel: document.getElementById("contributePanel"),
  pendingList: document.getElementById("pendingList")
};

/* ---------------- Render ---------------- */
function applyChrome() {
  el.title.textContent = t("title");
  el.sayLbl.textContent = t("say");
  el.strip.setAttribute("data-hint", t("hint"));
  document.body.setAttribute("dir", effectiveDir(settings.locale, settings.secondaryLocale, settings.bilingual));
  document.documentElement.lang = settings.locale;
}

function wordLabelHtml(w) {
  const primary = labelForWord(w, settings.locale);
  if (!settings.bilingual || !settings.secondaryLocale) {
    return `<span class="lbl">${primary}</span>`;
  }
  const secondary = labelForWord(w, settings.secondaryLocale);
  if (secondary === primary) return `<span class="lbl">${primary}</span>`;
  return `<span class="lbl">${primary}</span><span class="lbl sub">${secondary}</span>`;
}

const chipLabel = w => labelForWord(w, settings.locale);

function renderLocaleSelect() {
  el.localeSelect.innerHTML = "";
  LOCALES.forEach(loc => {
    const o = document.createElement("option");
    o.value = loc.code;
    o.textContent = `${loc.nativeName} (${loc.name})`;
    if (loc.code === settings.locale) o.selected = true;
    el.localeSelect.appendChild(o);
  });
}

function renderDialectSelect() {
  el.dialectSelect.innerHTML = "";
  const loc = getLocale(settings.locale);
  const dialects = loc.dialects.length
    ? loc.dialects
    : [{ id: "default", name: loc.name, nativeName: loc.nativeName }];
  dialects.forEach(d => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = d.nativeName || d.name;
    if (d.id === state.dialect) o.selected = true;
    el.dialectSelect.appendChild(o);
  });
  if (!dialects.find(d => d.id === state.dialect)) {
    state.dialect = dialects[0].id;
    settings = saveSettings({ dialect: state.dialect });
  }
}

function renderVoiceSelect() {
  el.voiceSelect.innerHTML = "";
  const ttsLang = ttsLangFor(settings.locale, state.dialect);
  const available = voicesForLocale(ttsLang);
  const auto = document.createElement("option");
  auto.value = "";
  auto.textContent = "Auto";
  el.voiceSelect.appendChild(auto);
  available.forEach(v => {
    const o = document.createElement("option");
    o.value = v.voiceURI;
    o.textContent = v.name;
    if (v.voiceURI === settings.voiceURI) o.selected = true;
    el.voiceSelect.appendChild(o);
  });
}

function renderCats() {
  el.cats.innerHTML = "";
  CATEGORIES.forEach(c => {
    const b = document.createElement("button");
    b.className = "cat";
    b.setAttribute("aria-selected", c.id === state.category);
    let name = labelForCategory(c, settings.locale);
    if (settings.bilingual && settings.secondaryLocale) {
      const sec = labelForCategory(c, settings.secondaryLocale);
      if (sec !== name) name = `${name} · ${sec}`;
    }
    b.innerHTML = `<span class="dot" style="background:${c.color}"></span>${name}`;
    b.onclick = () => { state.category = c.id; renderCats(); renderBoard(); };
    el.cats.appendChild(b);
  });
}

function wordsForCategory(catId) {
  const builtin = WORDS[catId] || [];
  return mergeCommunityWords(builtin, catId, settings.locale, state.dialect);
}

function renderBoard() {
  el.board.innerHTML = "";
  const color = CATEGORIES.find(c => c.id === state.category).color;
  wordsForCategory(state.category).forEach(w => {
    const key = recKey(w.id, state.dialect);
    const card = document.createElement("button");
    card.className = "word";
    card.style.borderColor = color;
    if (recordedKeys.has(key)) card.classList.add("has-rec");
    if (w.source === "community") card.classList.add("community");
    const badges = [];
    if (recordedKeys.has(key)) badges.push(`<span class="reciic">🎙️</span>`);
    if (w.source === "community") badges.push(`<span class="src-badge" title="${t("sourceCommunity")}">👥</span>`);
    card.innerHTML = `<button class="mic" title="Record your voice">🎤</button>`
      + `<span class="emoji">${w.emoji}</span>${wordLabelHtml(w)}${badges.join("")}`;

    card.onclick = async (e) => {
      if (e.target.closest(".mic")) return;
      await speakWord(w);
      state.sentence.push(w);
      renderStrip();
    };
    card.querySelector(".mic").onclick = (e) => { e.stopPropagation(); toggleRecord(w, card); };
    el.board.appendChild(card);
  });
}

function renderStrip() {
  el.strip.innerHTML = "";
  state.sentence.forEach(w => {
    const c = document.createElement("div");
    c.className = "chip";
    c.innerHTML = `<div class="emoji">${w.emoji}</div><div class="lbl">${chipLabel(w)}</div>`;
    el.strip.appendChild(c);
  });
  const rtl = effectiveDir(settings.locale, settings.secondaryLocale, settings.bilingual) === "rtl";
  el.strip.scrollLeft = rtl ? 0 : el.strip.scrollWidth;
}

function renderPendingQueue() {
  if (!el.pendingList) return;
  const pending = getPendingSubmissions();
  el.pendingList.innerHTML = "";
  if (!pending.length) {
    el.pendingList.innerHTML = `<p class="muted">No pending submissions.</p>`;
    return;
  }
  pending.forEach(item => {
    const row = document.createElement("div");
    row.className = "pending-row";
    row.innerHTML = `
      <span>${item.emoji} <strong>${item.text}</strong>
        <small>(${item.locale}${item.dialect ? ` / ${item.dialect}` : ""} · ${item.category})</small>
      </span>
      <span class="pending-actions">
        <button type="button" class="btn-approve" data-id="${item.id}">${t("approve")}</button>
        <button type="button" class="btn-reject" data-id="${item.id}">${t("reject")}</button>
      </span>`;
    el.pendingList.appendChild(row);
  });
  el.pendingList.querySelectorAll(".btn-approve").forEach(btn => {
    btn.onclick = () => {
      approveSubmission(btn.dataset.id);
      renderPendingQueue();
      renderBoard();
      toast(t("approved"));
    };
  });
  el.pendingList.querySelectorAll(".btn-reject").forEach(btn => {
    btn.onclick = () => {
      rejectSubmission(btn.dataset.id);
      renderPendingQueue();
    };
  });
}

function refreshAll() {
  applyChrome();
  renderLocaleSelect();
  renderDialectSelect();
  renderVoiceSelect();
  renderCats();
  renderBoard();
  renderStrip();
  renderPendingQueue();
}

/* ---------------- Settings panel ---------------- */
function openPanel(panel) {
  panel.hidden = false;
  panel.setAttribute("aria-hidden", "false");
}
function closePanel(panel) {
  panel.hidden = true;
  panel.setAttribute("aria-hidden", "true");
}

document.getElementById("settingsBtn").onclick = () => {
  renderPendingQueue();
  openPanel(el.settingsPanel);
};
document.getElementById("settingsClose").onclick = () => closePanel(el.settingsPanel);
document.getElementById("contributeBtn").onclick = () => openPanel(el.contributePanel);
document.getElementById("contributeClose").onclick = () => closePanel(el.contributePanel);

el.localeSelect.addEventListener("change", e => {
  settings = saveSettings({ locale: e.target.value });
  const loc = getLocale(settings.locale);
  const firstDialect = loc.dialects[0]?.id || "default";
  state.dialect = firstDialect;
  settings = saveSettings({ dialect: firstDialect, voiceURI: null });
  refreshAll();
});

el.dialectSelect.addEventListener("change", e => {
  state.dialect = e.target.value;
  settings = saveSettings({ dialect: state.dialect, voiceURI: null });
  renderVoiceSelect();
  renderBoard();
});

el.voiceSelect.addEventListener("change", e => {
  settings = saveSettings({ voiceURI: e.target.value || null });
});

document.getElementById("previewVoiceBtn").onclick = () => {
  const lang = ttsLangFor(settings.locale, state.dialect);
  previewVoice(lang, null, settings.voiceURI);
};

document.getElementById("bilingualToggle").addEventListener("change", e => {
  settings = saveSettings({ bilingual: e.target.checked });
  refreshAll();
});

document.getElementById("secondaryLocaleSelect").addEventListener("change", e => {
  settings = saveSettings({ secondaryLocale: e.target.value || null });
  refreshAll();
});

/* ---------------- Contribute form ---------------- */
let contribRec = null, contribChunks = [], contribBlob = null;

document.getElementById("contribRecordBtn").onclick = async () => {
  const btn = document.getElementById("contribRecordBtn");
  if (contribRec?.state === "recording") {
    contribRec.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("This device can't record audio."); return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast("Microphone blocked."); return; }
  contribChunks = [];
  contribBlob = null;
  contribRec = new MediaRecorder(stream);
  contribRec.ondataavailable = e => { if (e.data.size > 0) contribChunks.push(e.data); };
  contribRec.onstop = async () => {
    stream.getTracks().forEach(tr => tr.stop());
    contribBlob = new Blob(contribChunks, { type: contribRec.mimeType || "audio/webm" });
    btn.textContent = "✓ Recorded";
    btn.classList.add("recorded");
  };
  btn.textContent = "⏹ Stop";
  btn.classList.add("recording");
  contribRec.start();
};

document.getElementById("contribForm").onsubmit = async e => {
  e.preventDefault();
  const text = document.getElementById("contribText").value.trim();
  const category = document.getElementById("contribCategory").value;
  const emoji = document.getElementById("contribEmoji").value.trim();
  if (!text) return;
  await submitWord({
    text,
    category,
    emoji: emoji || "💬",
    locale: settings.locale,
    dialect: state.dialect,
    audioBlob: contribBlob
  });
  toast(t("communityAdded"));
  document.getElementById("contribForm").reset();
  contribBlob = null;
  const btn = document.getElementById("contribRecordBtn");
  btn.textContent = t("recordHint");
  btn.classList.remove("recording", "recorded");
  closePanel(el.contributePanel);
  renderPendingQueue();
};

/* ---------------- Strip controls ---------------- */
document.getElementById("speakBtn").onclick = async () => {
  if (!state.sentence.length) return;
  for (const w of state.sentence) {
    await speakWord(w);
    await wait(400);
  }
};
document.getElementById("clearBtn").onclick = () => { state.sentence = []; renderStrip(); };
document.getElementById("backBtn").onclick = () => { state.sentence.pop(); renderStrip(); };

const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- Init ---------------- */
function populateContribCategories() {
  const sel = document.getElementById("contribCategory");
  sel.innerHTML = "";
  CATEGORIES.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = labelForCategory(c, settings.locale);
    sel.appendChild(o);
  });
}

function populateSecondaryLocales() {
  const sel = document.getElementById("secondaryLocaleSelect");
  sel.innerHTML = `<option value="">—</option>`;
  LOCALES.forEach(loc => {
    if (loc.code === settings.locale) return;
    const o = document.createElement("option");
    o.value = loc.code;
    o.textContent = loc.nativeName;
    if (loc.code === settings.secondaryLocale) o.selected = true;
    sel.appendChild(o);
  });
  document.getElementById("bilingualToggle").checked = settings.bilingual;
}

(async function init() {
  initTTS();
  try {
    await openDB();
    await initCommunity();
    await loadRecordedKeys();
  } catch {}
  state.dialect = settings.dialect;
  populateContribCategories();
  populateSecondaryLocales();
  refreshAll();
})();

let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  unlockAudio();
}
document.body.addEventListener("touchstart", unlock, { once: true });
document.body.addEventListener("click", unlock, { once: true });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
