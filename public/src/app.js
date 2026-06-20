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
  approveSubmission, rejectSubmission, getCommunityAudio, syncShareQueue
} from "./community.js";
import { initSchedule, renderSchedule } from "./schedule.js";
import {
  SUPABASE_READY, getCurrentUser, signInWithEmail, signInWithPassword,
  signUpWithPassword, signOut, onAuthChange, displayUsername,
  validateUsername, validatePassword
} from "./supabase.js";
import {
  initPersonal, mergePersonalWords, getPersonalRecording, savePersonalRecording,
  deletePersonalRecording, loadRecordedKeys, getRecordedKeys, recKey,
  addCustomWord, getAllCustomWords, deleteCustomWord,
  listPersonalRecordings
} from "./personal.js";
import {
  KID_VIEWS, wordsForKidView, cardSizeClass, labelForKidView, getUnlockedTier
} from "./kid-ui.js";
import {
  recordWordUse, getUniqueWordCount, setManualTier, resetUsageStats, getUsageStore
} from "./usage.js";

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

/* ---------------- Audio helpers ---------------- */
function playBlob(blob) {
  return new Promise(res => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.onended = () => { URL.revokeObjectURL(url); res(); };
    a.onerror = () => res();
    a.play().catch(() => res());
  });
}

let authUser = null;
let mediaRec = null, recChunks = [], recStream = null, recTimer = null, recStart = 0;
let recordingWord = null, recordingCard = null;

function showRecordingUI(word) {
  const overlay = document.getElementById("recordingOverlay");
  const label = document.getElementById("recordingLabel");
  const langLbl = document.getElementById("recordingLang");
  if (!overlay) return;
  const text = labelForWord(word, settings.locale, state.dialect);
  const loc = getLocale(settings.locale);
  const dia = getDialect(settings.locale, state.dialect);
  label.textContent = `${t("recordingFor")} "${text}"`;
  langLbl.textContent = `${t("recordingIn")} ${dia.nativeName || loc.nativeName}`;
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
}

function hideRecordingUI() {
  const overlay = document.getElementById("recordingOverlay");
  if (!overlay) return;
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  const timer = document.getElementById("recordingTimer");
  if (timer) timer.textContent = "0:00";
  clearInterval(recTimer);
  recTimer = null;
}

function updateRecTimer() {
  const elTimer = document.getElementById("recordingTimer");
  if (!elTimer) return;
  const sec = Math.floor((Date.now() - recStart) / 1000);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  elTimer.textContent = `${m}:${s}`;
}

async function startRecording(word, cardEl) {
  if (mediaRec?.state === "recording") { mediaRec.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast(t("micBlocked") || "This device can't record audio."); return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast(t("micBlocked")); return; }

  recordingWord = word;
  recordingCard = cardEl;
  recChunks = [];
  recStream = stream;
  mediaRec = new MediaRecorder(stream);
  mediaRec.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
  mediaRec.onstop = async () => {
    recStream?.getTracks().forEach(tr => tr.stop());
    recStream = null;
    hideRecordingUI();
    const blob = new Blob(recChunks, { type: mediaRec.mimeType || "audio/webm" });
    const card = recordingCard;
    const w = recordingWord;
    recordingCard = null;
    recordingWord = null;
    card?.classList.remove("recording");

    if (blob.size > 0 && w) {
      try {
        await savePersonalRecording(w.id, settings.locale, state.dialect, blob, authUser);
        card?.classList.add("has-rec");
        if (card && !card.querySelector(".reciic")) {
          const tick = document.createElement("span");
          tick.className = "reciic"; tick.textContent = "🎙️"; card.appendChild(tick);
        }
        await playBlob(blob);
        toast(t("savedVoice"));
        renderPersonalList();
      } catch {
        toast(t("uploadFailed"));
      }
    }
    mediaRec = null;
  };

  cardEl?.classList.add("recording");
  showRecordingUI(word);
  recStart = Date.now();
  recTimer = setInterval(updateRecTimer, 500);
  updateRecTimer();
  mediaRec.start();
}

/* ---------------- Audio playback priority ----------------
   1. Personal recording (local / cloud cache) for exact lang
   2. Approved community audio (lang-matched)
   3. Web Speech API TTS of translated native text */
async function speakWord(word) {
  const personal = await getPersonalRecording(word.id, settings.locale, state.dialect);
  if (personal) { await playBlob(personal); return; }

  if (word.source === "community" && word.communityId) {
    const comm = await getCommunityAudio(word.communityId);
    if (comm) { await playBlob(comm); return; }
  }

  const text = labelForWord(word, settings.locale, state.dialect);
  const lang = ttsLangFor(settings.locale, state.dialect);
  try {
    await say(text, lang, { voiceURI: settings.voiceURI });
  } catch {
    toast(t("noVoice"));
  }
}

async function speakSentence() {
  if (!state.sentence.length) return;
  const parts = state.sentence.map(w => labelForWord(w, settings.locale, state.dialect));
  const text = parts.join(" ");
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
  kidView: "home",
  dialect: settings.dialect,
  sentence: []
};

function isCaregiver() {
  return !!settings.caregiverActive;
}

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
  const hint = isCaregiver() ? t("hint") : t("kidHint");
  el.strip.setAttribute("data-hint", hint);
  document.body.classList.toggle("kid-mode", !isCaregiver());
  document.body.classList.toggle("caregiver-mode", isCaregiver());
  document.documentElement.lang = settings.locale;
  document.body.setAttribute("dir", effectiveDir(settings.locale, settings.secondaryLocale, settings.bilingual));
  applyCaregiverVisibility();
  renderLangIndicator();
  updateCaregiverAuthLabels();
}

function updateCaregiverAuthLabels() {
  const map = {
    caregiverAccountLbl: "account",
    caregiverAuthStatus: "accountHint",
    caregiverUsernameLbl: "accountUsername",
    caregiverPasswordLbl: "accountPassword",
    caregiverSignInBtn: "accountSignIn",
    caregiverSignUpBtn: "accountSignUp",
    caregiverSignOutBtn: "signOut"
  };
  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }
  const userInput = document.getElementById("caregiverUsername");
  if (userInput) userInput.placeholder = t("accountUsernamePlaceholder");
}

function renderLangIndicator() {
  const ind = document.getElementById("langIndicator");
  if (!ind) return;
  const loc = getLocale(settings.locale);
  const d = getDialect(settings.locale, state.dialect);
  const base = loc.nativeName || loc.name;
  const dia = (d && d.nativeName && d.nativeName !== loc.nativeName) ? ` · ${d.nativeName}` : "";
  ind.textContent = `${base}${dia}`;
  ind.title = `Speaking words in ${loc.name}${d && d.name ? " / " + d.name : ""}`;
}

function wordLabelHtml(w) {
  const primary = labelForWord(w, settings.locale, state.dialect);
  if (!settings.bilingual || !settings.secondaryLocale) {
    return `<span class="lbl">${primary}</span>`;
  }
  const secondary = labelForWord(w, settings.secondaryLocale, state.dialect);
  if (secondary === primary) return `<span class="lbl">${primary}</span>`;
  return `<span class="lbl">${primary}</span><span class="lbl sub">${secondary}</span>`;
}

const chipLabel = w => labelForWord(w, settings.locale, state.dialect);

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
  if (isCaregiver() && settings.fullBoard) {
    CATEGORIES.forEach(c => {
      const b = document.createElement("button");
      b.className = "cat";
      b.setAttribute("aria-selected", c.id === state.category);
      let name = labelForCategory(c, settings.locale, state.dialect);
      if (settings.bilingual && settings.secondaryLocale) {
        const sec = labelForCategory(c, settings.secondaryLocale);
        if (sec !== name) name = `${name} · ${sec}`;
      }
      b.innerHTML = `<span class="dot" style="background:${c.color}"></span>${name}`;
      b.onclick = () => { state.category = c.id; renderCats(); renderBoard(); };
      el.cats.appendChild(b);
    });
    return;
  }
  KID_VIEWS.forEach(v => {
    const b = document.createElement("button");
    b.className = "cat kid-cat";
    b.setAttribute("aria-selected", v.id === state.kidView);
    const name = labelForKidView(v, settings.locale);
    b.innerHTML = `<span class="dot" style="background:${v.color}"></span><span class="cat-emoji">${v.icon}</span>${name}`;
    b.onclick = () => { state.kidView = v.id; renderCats(); renderBoard(); };
    el.cats.appendChild(b);
  });
}

function mergeAllWords(builtin, catId, locale, dialect) {
  const withCommunity = mergeCommunityWords(builtin, catId, locale, dialect);
  return mergePersonalWords(withCommunity, catId, locale, dialect);
}

function wordsForCategory(catId) {
  return mergeAllWords(WORDS[catId] || [], catId, settings.locale, state.dialect);
}

function wordsForBoard() {
  if (isCaregiver() && settings.fullBoard) {
    return wordsForCategory(state.category);
  }
  return wordsForKidView(
    state.kidView,
    mergeAllWords,
    settings.locale,
    state.dialect
  );
}

function renderBoard() {
  el.board.innerHTML = "";
  const list = wordsForBoard();
  const kidMode = !isCaregiver() || !settings.fullBoard;
  const defaultColor = KID_VIEWS.find(v => v.id === state.kidView)?.color
    || CATEGORIES.find(c => c.id === state.category)?.color
    || "var(--accent)";

  list.forEach(w => {
    const key = recKey(w.id, settings.locale, state.dialect);
    const card = document.createElement("button");
    const sizeClass = kidMode ? cardSizeClass(w) : "";
    card.className = `word${sizeClass ? ` ${sizeClass}` : ""}`;
    const catColor = CATEGORIES.find(c => c.id === w.categoryId)?.color || defaultColor;
    card.style.borderColor = catColor;
    if (recordedKeys.has(key)) card.classList.add("has-rec");
    if (w.source === "community") card.classList.add("community");
    if (w.source === "personal") card.classList.add("personal");
    if (w.isCore) card.classList.add("core");

    const badges = [];
    if (recordedKeys.has(key)) badges.push(`<span class="reciic">🎙️</span>`);
    if (w.source === "community") badges.push(`<span class="src-badge" title="${t("sourceCommunity")}">👥</span>`);
    if (w.source === "personal") badges.push(`<span class="src-badge" title="${t("myWords")}">⭐</span>`);

    const micHtml = isCaregiver()
      ? `<button class="mic" title="Record your voice">🎤</button>`
      : "";
    const labelHtml = kidMode && (w.tier === 0 || w.isCore)
      ? `<span class="lbl lbl-min">${labelForWord(w, settings.locale, state.dialect)}</span>`
      : wordLabelHtml(w);

    card.innerHTML = micHtml
      + `<span class="emoji">${w.emoji}</span>${labelHtml}${badges.join("")}`;

    card.onclick = async (e) => {
      if (e.target.closest(".mic")) return;
      recordWordUse(w.id);
      await speakWord(w);
      state.sentence.push(w);
      renderStrip();
      if (kidMode) {
        card.classList.remove("word--xl", "word--lg", "word--md", "word--sm");
        card.classList.add(cardSizeClass(w));
      }
    };
    const mic = card.querySelector(".mic");
    if (mic) mic.onclick = (e) => { e.stopPropagation(); startRecording(w, card); };

    if (isCaregiver()) {
      let pressTimer = null;
      card.addEventListener("pointerdown", () => {
        pressTimer = setTimeout(() => startRecording(w, card), 800);
      });
      const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
      card.addEventListener("pointerup", cancelPress);
      card.addEventListener("pointerleave", cancelPress);
      card.addEventListener("pointercancel", cancelPress);
    }

    el.board.appendChild(card);
  });

  if (!list.length && state.kidView === "more") {
    const msg = document.createElement("p");
    msg.className = "empty-more muted";
    msg.textContent = isCaregiver()
      ? (t("noTierMore") || "No tier 2+ words yet — adjust unlock tier in settings.")
      : (t("moreUnlocking") || "More words unlock as you use the board.");
    el.board.appendChild(msg);
  }
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
  renderSettingsLocaleSelects();
  renderVoiceSelect();
  renderCats();
  renderBoard();
  renderStrip();
  if (isCaregiver()) {
    renderPendingQueue();
    renderPersonalList();
    renderCustomWordsList();
  }
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
  if (!isCaregiver()) {
    toast(t("caregiverHint"));
    return;
  }
  renderPendingQueue();
  renderUsageStats();
  openPanel(el.settingsPanel);
};
document.getElementById("settingsClose").onclick = () => closePanel(el.settingsPanel);
document.getElementById("contributeBtn").onclick = () => openPanel(el.contributePanel);
document.getElementById("contributeClose").onclick = () => closePanel(el.contributePanel);
document.getElementById("scheduleBtn").onclick = () => {
  renderSchedule();
  openPanel(document.getElementById("schedulePanel"));
};
document.getElementById("scheduleClose").onclick = () =>
  closePanel(document.getElementById("schedulePanel"));

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
  renderLangIndicator();
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

/* ---------------- Caregiver mode (long-press ⚙️) ---------------- */
function applyCaregiverVisibility() {
  const on = isCaregiver();
  document.querySelectorAll(".caregiver-only").forEach(el => {
    el.hidden = !on;
  });
  const banner = document.getElementById("caregiverBanner");
  if (banner) banner.hidden = !on;
  document.getElementById("localebar")?.toggleAttribute("hidden", !on);
  document.getElementById("contributeBtn")?.toggleAttribute("hidden", !on);
}

function enterCaregiverMode() {
  settings = saveSettings({ caregiverActive: true });
  applyChrome();
  refreshAll();
  renderUsageStats();
  openPanel(el.settingsPanel);
  toast(t("caregiverMode"));
}

function exitCaregiverMode() {
  settings = saveSettings({ caregiverActive: false });
  closePanel(el.settingsPanel);
  applyChrome();
  refreshAll();
}

function renderUsageStats() {
  const elStats = document.getElementById("usageStats");
  if (!elStats) return;
  const unique = getUniqueWordCount();
  const tier = getUnlockedTier();
  elStats.textContent = `${unique} ${t("uniqueWords")} · ${t("tierLabel")} ${tier}`;
  const sel = document.getElementById("unlockTierSelect");
  if (sel) {
    const manual = getUsageStore().manualTier;
    sel.value = manual == null ? "" : String(manual);
  }
  document.getElementById("fullBoardToggle").checked = settings.fullBoard;
  document.getElementById("caregiverPinInput").value = settings.caregiverPin || "";
}

function setupCaregiverGate() {
  const btn = document.getElementById("settingsBtn");
  let timer = null;
  const start = () => {
    timer = setTimeout(() => {
      timer = null;
      if (settings.caregiverPin) {
        const pin = prompt(t("enterPin"));
        if (pin === settings.caregiverPin) enterCaregiverMode();
        else if (pin != null) toast(t("wrongPin") || "Wrong PIN");
      } else {
        enterCaregiverMode();
      }
    }, 2000);
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", cancel);
  btn.addEventListener("pointerleave", cancel);
  btn.addEventListener("pointercancel", cancel);

  document.getElementById("exitCaregiverBtn").onclick = exitCaregiverMode;
  document.getElementById("resetUsageBtn").onclick = () => {
    resetUsageStats();
    renderUsageStats();
    renderBoard();
    toast("Usage stats reset.");
  };
  document.getElementById("unlockTierSelect").onchange = e => {
    const v = e.target.value;
    setManualTier(v === "" ? null : Number(v));
    renderBoard();
    renderUsageStats();
  };
  document.getElementById("fullBoardToggle").onchange = e => {
    settings = saveSettings({ fullBoard: e.target.checked });
    renderCats();
    renderBoard();
  };
  document.getElementById("caregiverPinInput").onchange = e => {
    const pin = e.target.value.trim();
    settings = saveSettings({ caregiverPin: pin.length === 4 ? pin : null });
  };
}

function renderSettingsLocaleSelects() {
  const locSel = document.getElementById("settingsLocaleSelect");
  const diaSel = document.getElementById("settingsDialectSelect");
  if (!locSel || !diaSel) return;
  locSel.innerHTML = "";
  LOCALES.forEach(loc => {
    const o = document.createElement("option");
    o.value = loc.code;
    o.textContent = `${loc.nativeName} (${loc.name})`;
    if (loc.code === settings.locale) o.selected = true;
    locSel.appendChild(o);
  });
  diaSel.innerHTML = "";
  const loc = getLocale(settings.locale);
  const dialects = loc.dialects.length
    ? loc.dialects
    : [{ id: "default", name: loc.name, nativeName: loc.nativeName }];
  dialects.forEach(d => {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = d.nativeName || d.name;
    if (d.id === state.dialect) o.selected = true;
    diaSel.appendChild(o);
  });
}

document.getElementById("settingsLocaleSelect")?.addEventListener("change", e => {
  settings = saveSettings({ locale: e.target.value });
  el.localeSelect.value = e.target.value;
  const loc = getLocale(settings.locale);
  state.dialect = loc.dialects[0]?.id || "default";
  settings = saveSettings({ dialect: state.dialect, voiceURI: null });
  refreshAll();
});

document.getElementById("settingsDialectSelect")?.addEventListener("change", e => {
  state.dialect = e.target.value;
  settings = saveSettings({ dialect: state.dialect, voiceURI: null });
  el.dialectSelect.value = state.dialect;
  renderVoiceSelect();
  renderBoard();
  renderLangIndicator();
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
    toast(t("micBlocked") || "This device can't record audio."); return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast(t("micBlocked") || "Microphone blocked."); return; }
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
  const shareOnline = document.getElementById("contribShareOnline")?.checked || false;
  await submitWord({
    text,
    category,
    emoji: emoji || "💬",
    locale: settings.locale,
    dialect: state.dialect,
    audioBlob: contribBlob,
    shareOnline
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
document.getElementById("speakBtn").onclick = () => speakSentence();
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
    o.textContent = labelForCategory(c, settings.locale, state.dialect);
    sel.appendChild(o);
  });
}

/* ---------------- Caregiver account (personal recordings cloud sync) ---------------- */
function setupCaregiverAuth() {
  const box = document.getElementById("caregiverAuth");
  if (!box || !SUPABASE_READY) return;

  const statusEl = document.getElementById("caregiverAuthStatus");
  const signInForm = document.getElementById("caregiverSignInForm");
  const signedInBox = document.getElementById("caregiverSignedIn");
  const usernameInput = document.getElementById("caregiverUsername");
  const passInput = document.getElementById("caregiverPassword");
  const signInBtn = document.getElementById("caregiverSignInBtn");
  const signUpBtn = document.getElementById("caregiverSignUpBtn");
  const signOutBtn = document.getElementById("caregiverSignOutBtn");

  async function reflect(user) {
    authUser = user || null;
    if (user) {
      statusEl.textContent = `${t("signedInAs")} ${displayUsername(user)}`;
      signInForm.hidden = true;
      signedInBox.hidden = false;
      const sync = await initPersonal(user);
      if (sync.recordings || sync.words) {
        toast(`Synced ${sync.recordings} recording(s), ${sync.words} word(s).`);
      }
      renderBoard();
      renderPersonalList();
      renderCustomWordsList();
    } else {
      statusEl.textContent = t("accountHint");
      signInForm.hidden = false;
      signedInBox.hidden = true;
    }
  }

  signInBtn?.addEventListener("click", async () => {
    const username = usernameInput?.value;
    const password = passInput?.value;
    const userCheck = validateUsername(username);
    if (!userCheck.ok) {
      toast(t("usernameInvalid"));
      return;
    }
    if (!validatePassword(password).ok) {
      toast(t("passwordTooShort"));
      return;
    }
    signInBtn.disabled = true;
    const res = await signInWithPassword(username, password);
    signInBtn.disabled = false;
    toast(res.ok ? `${t("signedInAs")} ${displayUsername(res.user)}` : (res.error || t("wrongCredentials")));
    if (res.ok) reflect(res.user);
  });

  signUpBtn?.addEventListener("click", async () => {
    const username = usernameInput?.value;
    const password = passInput?.value;
    const userCheck = validateUsername(username);
    if (!userCheck.ok) {
      toast(t("usernameInvalid"));
      return;
    }
    if (!validatePassword(password).ok) {
      toast(t("passwordTooShort"));
      return;
    }
    signUpBtn.disabled = true;
    const res = await signUpWithPassword(username, password);
    signUpBtn.disabled = false;
    if (res.ok) {
      toast(res.needsConfirm ? t("accountHint") : t("signUpSuccess"));
      if (res.user && !res.needsConfirm) reflect(res.user);
    } else {
      toast(res.error || t("usernameTaken"));
    }
  });

  signOutBtn?.addEventListener("click", async () => {
    await signOut();
    authUser = null;
    reflect(null);
  });

  getCurrentUser().then(reflect).catch(() => reflect(null));
  onAuthChange(user => reflect(user));
}

async function renderPersonalList() {
  const list = document.getElementById("personalRecList");
  if (!list) return;
  const recs = await listPersonalRecordings(settings.locale, state.dialect);
  list.innerHTML = "";
  if (!recs.length) {
    list.innerHTML = `<p class="muted">${t("noPersonalRecordings")}</p>`;
    return;
  }
  const allWords = wordsForBoard();
  for (const rec of recs) {
    const word = allWords.find(w => w.id === rec.wordId)
      || getAllCustomWords().find(w => w.id === rec.wordId);
    const label = word
      ? labelForWord(word, settings.locale, state.dialect)
      : rec.wordId;
    const row = document.createElement("div");
    row.className = "pending-row";
    row.innerHTML = `
      <span>🎙️ <strong>${label}</strong> <small>(${rec.lang})</small></span>
      <button type="button" class="btn-reject btn-del-rec" data-id="${rec.wordId}">${t("deleteRecording")}</button>`;
    list.appendChild(row);
  }
  list.querySelectorAll(".btn-del-rec").forEach(btn => {
    btn.onclick = async () => {
      await deletePersonalRecording(btn.dataset.id, settings.locale, state.dialect, authUser);
      await loadRecordedKeys();
      renderBoard();
      renderPersonalList();
      toast(t("deleteRecording"));
    };
  });
}

function renderCustomWordsList() {
  const list = document.getElementById("customWordsList");
  if (!list) return;
  const words = getAllCustomWords().filter(w =>
    w.locale === settings.locale &&
    (w.dialect === state.dialect || !w.dialect)
  );
  list.innerHTML = "";
  if (!words.length) return;
  words.forEach(w => {
    const row = document.createElement("div");
    row.className = "pending-row";
    row.innerHTML = `
      <span>${w.emoji} <strong>${labelForWord(w, settings.locale, state.dialect)}</strong></span>
      <button type="button" class="btn-reject btn-del-word" data-id="${w.id}">✕</button>`;
    list.appendChild(row);
  });
  list.querySelectorAll(".btn-del-word").forEach(btn => {
    btn.onclick = async () => {
      await deleteCustomWord(btn.dataset.id, authUser);
      renderBoard();
      renderCustomWordsList();
    };
  });
}

let customRec = null, customChunks = [], customBlob = null;

function setupCustomWordForm() {
  const form = document.getElementById("customWordForm");
  const recBtn = document.getElementById("customWordRecordBtn");
  if (!form) return;

  recBtn?.addEventListener("click", async () => {
    if (customRec?.state === "recording") { customRec.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { toast(t("micBlocked")); return; }
    customChunks = [];
    customBlob = null;
    customRec = new MediaRecorder(stream);
    customRec.ondataavailable = e => { if (e.data.size > 0) customChunks.push(e.data); };
    customRec.onstop = () => {
      stream.getTracks().forEach(tr => tr.stop());
      customBlob = new Blob(customChunks, { type: customRec.mimeType || "audio/webm" });
      recBtn.textContent = "✓ Recorded";
      recBtn.classList.add("recorded");
    };
    recBtn.textContent = "⏹ Stop";
    recBtn.classList.add("recording");
    customRec.start();
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const label = document.getElementById("customWordLabel")?.value.trim();
    const hint = document.getElementById("customWordHint")?.value.trim();
    const emoji = document.getElementById("customWordEmoji")?.value.trim();
    const category = document.getElementById("customWordCategory")?.value || "social";
    if (!label) return;
    await addCustomWord({
      label,
      englishHint: hint || null,
      emoji: emoji || "💬",
      category,
      locale: settings.locale,
      dialect: state.dialect,
      audioBlob: customBlob
    }, authUser);
    form.reset();
    customBlob = null;
    if (recBtn) {
      recBtn.textContent = t("recordHint");
      recBtn.classList.remove("recording", "recorded");
    }
    renderBoard();
    renderCustomWordsList();
    toast(t("savedVoice"));
  });

  const catSel = document.getElementById("customWordCategory");
  if (catSel) {
    catSel.innerHTML = "";
    CATEGORIES.forEach(c => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = labelForCategory(c, settings.locale, state.dialect);
      catSel.appendChild(o);
    });
  }
}

document.getElementById("recordingStopBtn")?.addEventListener("click", () => {
  if (mediaRec?.state === "recording") mediaRec.stop();
});
document.getElementById("recordingCancelBtn")?.addEventListener("click", () => {
  if (mediaRec?.state === "recording") {
    recordingWord = null;
    recordingCard?.classList.remove("recording");
    recordingCard = null;
    mediaRec.onstop = () => {
      recStream?.getTracks().forEach(tr => tr.stop());
      recStream = null;
      hideRecordingUI();
      mediaRec = null;
    };
    mediaRec.stop();
  } else {
    hideRecordingUI();
  }
});

function setupContributorAuth() {
  const shareField = document.getElementById("shareOnlineField");
  const authBox = document.getElementById("contribAuth");
  if (!SUPABASE_READY) return; // graceful degradation: stays hidden, fully local

  shareField.hidden = false;
  authBox.hidden = false;

  const statusEl = document.getElementById("authStatus");
  const signInRow = document.getElementById("signInRow");
  const signOutBtn = document.getElementById("signOutBtn");
  const emailInput = document.getElementById("contribEmail");
  const signInBtn = document.getElementById("signInBtn");

  function reflect(user) {
    if (user) {
      statusEl.textContent = `${t("contributor")}: ${user.email || "signed in"}`;
      signInRow.hidden = true;
      signOutBtn.hidden = false;
    } else {
      statusEl.textContent = t("signIn") + " — " + t("shareOnline");
      signInRow.hidden = false;
      signOutBtn.hidden = true;
    }
  }

  signInBtn.onclick = async () => {
    const email = emailInput.value.trim();
    if (!email) return;
    signInBtn.disabled = true;
    const res = await signInWithEmail(email);
    signInBtn.disabled = false;
    toast(res.ok ? "Check your email for the sign-in link." : (res.error || "Sign-in failed."));
  };
  signOutBtn.onclick = async () => { await signOut(); };

  getCurrentUser().then(reflect).catch(() => reflect(null));
  onAuthChange(async (user) => {
    reflect(user);
    if (user) {
      const r = await syncShareQueue();
      if (r.uploaded) toast(`Shared ${r.uploaded} contribution(s) online.`);
    }
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
    authUser = await getCurrentUser();
    await initCommunity();
    await initPersonal(authUser);
  } catch {}
  state.dialect = settings.dialect;
  populateContribCategories();
  populateSecondaryLocales();
  setupContributorAuth();
  setupCaregiverAuth();
  setupCustomWordForm();
  setupCaregiverGate();
  initSchedule({
    getSettings: () => settings,
    getDialect: () => state.dialect,
    speakWord,
    wordsForCategory
  });
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
