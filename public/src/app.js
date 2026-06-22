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
  approveSubmission, rejectSubmission, getCommunityAudio, syncShareQueue,
  fetchOnlinePending, approveOnlineSubmission, rejectOnlineSubmission
} from "./community.js";
import {
  SUPABASE_READY, getCurrentUser, signInWithEmail, signInWithPassword,
  signUpWithPassword, signOut, onAuthChange, displayUsername,
  validateUsername, validatePin, ensureDoggyPreload
} from "./supabase.js";
import {
  initPersonal, mergePersonalWords, getPersonalRecording, savePersonalRecording,
  deletePersonalRecording, loadRecordedKeys, getRecordedKeys, recKey,
  addCustomWord, getAllCustomWords, deleteCustomWord,
  listPersonalRecordings
} from "./personal.js";
import {
  KID_VIEWS, wordsForKidView, cardSizeClass, labelForKidView, getUnlockedTier,
  boardViewKey, applySavedOrder
} from "./kid-ui.js";
import {
  recordWordUse, getUniqueWordCount, setManualTier, resetUsageStats, getUsageStore,
  setCardOrderForView
} from "./usage.js";
import { moderateWordEntry, logModerationRejection } from "./moderation.js";
import { initNativeShell } from "./native.js";

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
let pendingRecordAfterAuth = null;
let pendingCommunityShareAfterAuth = null;
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

function readShareWithCommunity() {
  const el = document.getElementById("caregiverShareCommunity")
    || document.getElementById("recordAuthShareCommunity");
  if (el) return el.checked;
  return settings.shareWithCommunity !== false;
}

function persistShareWithCommunity(checked) {
  settings = saveSettings({ shareWithCommunity: !!checked });
  const ids = ["caregiverShareCommunity", "recordAuthShareCommunity"];
  ids.forEach(id => {
    const box = document.getElementById(id);
    if (box) box.checked = !!checked;
  });
}

function showAuthError(errorEl, msg) {
  if (!errorEl) return;
  if (msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  } else {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
}

function setAuthLoading(btn, loading, defaultLabel) {
  if (!btn) return;
  btn.disabled = !!loading;
  btn.textContent = loading ? t("authLoading") : defaultLabel;
}

function resetRecordAuthPanel() {
  showAuthError(document.getElementById("recordAuthError"), "");
  const signedIn = document.getElementById("recordAuthSignedIn");
  if (signedIn) signedIn.hidden = true;
  const form = document.getElementById("recordAuthForm");
  if (form) form.hidden = false;
}

function openRecordAuthPanel({ forCommunity = false } = {}) {
  const panel = document.getElementById("recordAuthPanel");
  if (!panel) return;
  if (!SUPABASE_READY) {
    toast(t("accountNotConfigured"));
    openPanel(el.settingsPanel);
    return;
  }
  closePanel(el.settingsPanel);
  closePanel(el.contributePanel);
  resetRecordAuthPanel();
  document.getElementById("recordAuthHint").textContent = forCommunity
    ? t("signInForCommunity")
    : t("recordNeedsAccount");
  document.getElementById("recordAuthTitle").textContent = forCommunity ? t("contribute") : t("account");
  document.getElementById("recordAuthUsernameLbl").textContent = t("accountUsername");
  document.getElementById("recordAuthPasswordLbl").textContent = t("accountPassword");
  const passInput = document.getElementById("recordAuthPassword");
  if (passInput) passInput.placeholder = t("accountPinPlaceholder");
  document.getElementById("recordAuthShareLbl").textContent = t("shareWithCommunityHint");
  document.getElementById("recordAuthSignInBtn").textContent = t("accountSignIn");
  document.getElementById("recordAuthSignUpBtn").textContent = t("accountSignUp");
  const userInput = document.getElementById("recordAuthUsername");
  if (userInput) userInput.placeholder = t("accountUsernamePlaceholder");
  const shareBox = document.getElementById("recordAuthShareCommunity");
  if (shareBox) shareBox.checked = settings.shareWithCommunity !== false;
  openPanel(panel);
  userInput?.focus();
}

async function shareRecordingWithCommunity(word, blob) {
  if (!word || !blob?.size) return { skipped: true };
  const user = authUser || await getCurrentUser();
  if (!user) return { needsAuth: true };
  return submitWord({
    text: labelForWord(word, settings.locale, state.dialect),
    category: word.categoryId || state.category,
    emoji: word.emoji || "💬",
    locale: settings.locale,
    dialect: state.dialect,
    audioBlob: blob,
    shareOnline: true
  });
}

async function finishRecordingSave(w, blob, card) {
  const shareWithCommunity = readShareWithCommunity();
  await savePersonalRecording(w.id, settings.locale, state.dialect, blob, authUser, { shareWithCommunity });

  card?.classList.add("has-rec");
  if (card && !card.querySelector(".reciic")) {
    const tick = document.createElement("span");
    tick.className = "reciic"; tick.textContent = "🎙️"; card.appendChild(tick);
  }
  await playBlob(blob);
  renderPersonalList();

  if (!shareWithCommunity) {
    toast(t("savedVoice"));
    return;
  }

  const user = authUser || await getCurrentUser();
  if (!user) {
    pendingCommunityShareAfterAuth = { word: w, blob };
    openRecordAuthPanel({ forCommunity: true });
    toast(t("savedLocalOnly"));
    return;
  }

  authUser = user;
  const result = await shareRecordingWithCommunity(w, blob);
  if (result?.rejected) {
    toast(t("communityRejected"));
    return;
  }
  if (result?.entry) {
    toast(t("communitySubmitted"));
    renderPendingQueue();
  }
}

async function submitCommunityWord(payload) {
  const { text, englishHint, locale, shareOnline, ...rest } = payload;
  const mod = moderateWordEntry(text, englishHint, locale || settings.locale);
  if (!mod.ok) {
    logModerationRejection(text, locale, mod.reason);
    return { rejected: true };
  }
  const user = authUser || await getCurrentUser();
  if (!user) return { needsAuth: true };
  authUser = user;
  return submitWord({
    text,
    locale: locale || settings.locale,
    shareOnline: !!shareOnline,
    ...rest
  });
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
        await finishRecordingSave(w, blob, card);
      } catch (err) {
        console.warn("savePersonalRecording failed:", err);
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
  pendingList: document.getElementById("pendingList"),
  pendingOnlineList: document.getElementById("pendingOnlineList")
};

let settingsTab = "general";

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
  updateSettingsPanelLabels();
  updateBoardSection();
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) settingsBtn.title = t("settings");
}

function updateSettingsPanelLabels() {
  const map = {
    settingsPanelTitle: "settings",
    settingsTabGeneralBtn: "settingsTabGeneral",
    settingsTabPendingLbl: "settingsTabPending",
    pendingWordsTitle: "pendingWordsTitle",
    pendingWordsHint: "pendingWordsHint",
    pendingLocalTitle: "pendingLocalTitle",
    pendingOnlineTitle: "pendingOnlineTitle",
    caregiverModeLbl: "caregiverMode",
    exitCaregiverBtn: "exitCaregiver"
  };
  for (const [id, key] of Object.entries(map)) {
    const node = document.getElementById(id);
    if (node) node.textContent = t(key);
  }
  const exitBtn = document.getElementById("exitCaregiverBtn");
  if (exitBtn) exitBtn.textContent = t("exitCaregiver");
  const hint = document.getElementById("caregiverHint");
  if (hint) hint.textContent = t("caregiverHint");
}

function updateBoardSection() {
  const section = document.getElementById("boardSection");
  if (!section) return;
  const kidBoard = !isCaregiver() || !settings.fullBoard;
  if (kidBoard && state.kidView === "more") {
    section.hidden = false;
    const title = document.getElementById("boardSectionTitle");
    const hint = document.getElementById("boardSectionHint");
    if (title) title.textContent = t("viewMore");
    if (hint) hint.textContent = t("moreWordsHint");
  } else {
    section.hidden = true;
  }
}

function updateCaregiverAuthLabels() {
  const map = {
    caregiverAccountLbl: "account",
    caregiverAuthStatus: "accountHint",
    caregiverUsernameLbl: "accountUsername",
    caregiverPasswordLbl: "accountPassword",
    caregiverSignInBtn: "accountSignIn",
    caregiverSignUpBtn: "accountSignUp",
    caregiverSignOutBtn: "signOut",
    caregiverShareLbl: "shareWithCommunityHint"
  };
  for (const [id, key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }
  const userInput = document.getElementById("caregiverUsername");
  if (userInput) userInput.placeholder = t("accountUsernamePlaceholder");
  const pinInput = document.getElementById("caregiverPassword");
  if (pinInput) pinInput.placeholder = t("accountPinPlaceholder");
  const shareBox = document.getElementById("caregiverShareCommunity");
  if (shareBox) shareBox.checked = settings.shareWithCommunity !== false;
  const shareOnlineLbl = document.getElementById("shareOnlineLbl");
  if (shareOnlineLbl) shareOnlineLbl.textContent = t("shareWithCommunityHint");
  const customWordShareLbl = document.getElementById("customWordShareLbl");
  if (customWordShareLbl) customWordShareLbl.textContent = t("shareWithCommunityHint");
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
    b.onclick = () => { state.kidView = v.id; renderCats(); updateBoardSection(); renderBoard(); };
    el.cats.appendChild(b);
  });
}

function mergeAllWords(builtin, catId, locale, dialect) {
  const withCommunity = mergeCommunityWords(builtin, catId, locale, dialect);
  return mergePersonalWords(withCommunity, catId, locale, dialect);
}

function getBoardViewKey() {
  return boardViewKey(settings.locale, {
    fullBoard: isCaregiver() && settings.fullBoard,
    kidView: state.kidView,
    category: state.category
  });
}

function wordsForCategory(catId) {
  const list = mergeAllWords(WORDS[catId] || [], catId, settings.locale, state.dialect);
  return applySavedOrder(list, boardViewKey(settings.locale, { fullBoard: true, category: catId }));
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

function reorderBoardCards(board, fromId, toId, viewKey) {
  const cards = [...board.querySelectorAll(".word")];
  const from = cards.find(c => c.dataset.wordId === fromId);
  const to = cards.find(c => c.dataset.wordId === toId);
  if (!from || !to || from === to) return;
  if (cards.indexOf(from) < cards.indexOf(to)) to.after(from);
  else to.before(from);
  const ids = [...board.querySelectorAll(".word")].map(c => c.dataset.wordId);
  setCardOrderForView(viewKey, ids);
}

function setupBoardDragDrop(board, viewKey) {
  if (!isCaregiver()) return;
  let dragId = null;

  board.addEventListener("dragstart", e => {
    const handle = e.target.closest(".drag-handle");
    if (!handle) {
      e.preventDefault();
      return;
    }
    const card = handle.closest(".word");
    if (!card) return;
    dragId = card.dataset.wordId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
    card.classList.add("dragging");
  });

  board.addEventListener("dragend", () => {
    board.querySelectorAll(".word.dragging, .word.drag-over").forEach(c => {
      c.classList.remove("dragging", "drag-over");
    });
    dragId = null;
  });

  board.querySelectorAll(".word").forEach(card => {
    card.addEventListener("dragover", e => {
      if (!dragId || card.dataset.wordId === dragId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      board.querySelectorAll(".word.drag-over").forEach(c => c.classList.remove("drag-over"));
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", e => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        card.classList.remove("drag-over");
      }
    });
    card.addEventListener("drop", e => {
      e.preventDefault();
      card.classList.remove("drag-over");
      const fromId = e.dataTransfer.getData("text/plain");
      if (!fromId || fromId === card.dataset.wordId) return;
      reorderBoardCards(board, fromId, card.dataset.wordId, viewKey);
    });
  });
}

function renderBoard() {
  el.board.innerHTML = "";
  const list = wordsForBoard();
  const recordedKeys = getRecordedKeys();
  const kidMode = !isCaregiver() || !settings.fullBoard;
  const viewKey = getBoardViewKey();
  const defaultColor = KID_VIEWS.find(v => v.id === state.kidView)?.color
    || CATEGORIES.find(c => c.id === state.category)?.color
    || "var(--accent)";

  list.forEach(w => {
    const key = recKey(w.id, settings.locale, state.dialect);
    const sizeClass = kidMode ? cardSizeClass(w) : "";
    const card = document.createElement("div");
    card.className = `word${sizeClass ? ` ${sizeClass}` : ""}`;
    card.dataset.wordId = w.id;
    card.setAttribute("role", "button");
    card.tabIndex = 0;
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
    const dragHtml = isCaregiver()
      ? `<span class="drag-handle" draggable="true" title="Drag to reorder" aria-hidden="true">⠿</span>`
      : "";
    const labelHtml = kidMode && (w.tier === 0 || w.isCore)
      ? `<span class="lbl lbl-min">${labelForWord(w, settings.locale, state.dialect)}</span>`
      : wordLabelHtml(w);

    card.innerHTML = dragHtml + micHtml
      + `<span class="emoji">${w.emoji}</span>${labelHtml}${badges.join("")}`;

    card.onclick = async (e) => {
      if (e.target.closest(".mic") || e.target.closest(".drag-handle")) return;
      recordWordUse(w.id);
      await speakWord(w);
      state.sentence.push(w);
      renderStrip();
      if (kidMode) {
        card.classList.remove("word--xl", "word--lg", "word--md", "word--sm");
        card.classList.add(cardSizeClass(w));
      }
    };
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!e.target.closest(".mic")) card.click();
      }
    });
    const mic = card.querySelector(".mic");
    if (mic) {
      mic.addEventListener("pointerdown", (e) => e.stopPropagation());
      mic.addEventListener("click", (e) => {
        e.stopPropagation();
        startRecording(w, card);
      });
    }
    const handle = card.querySelector(".drag-handle");
    if (handle) {
      handle.addEventListener("pointerdown", (e) => e.stopPropagation());
      handle.addEventListener("click", (e) => e.stopPropagation());
    }

    if (isCaregiver()) {
      let pressTimer = null;
      card.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".mic") || e.target.closest(".drag-handle")) return;
        pressTimer = setTimeout(() => startRecording(w, card), 800);
      });
      const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
      card.addEventListener("pointerup", cancelPress);
      card.addEventListener("pointerleave", cancelPress);
      card.addEventListener("pointercancel", cancelPress);
    }

    el.board.appendChild(card);
  });

  setupBoardDragDrop(el.board, viewKey);

  if (!list.length && state.kidView === "more") {
    const msg = document.createElement("p");
    msg.className = "empty-more muted";
    msg.textContent = isCaregiver()
      ? t("noTierMore")
      : t("moreUnlocking");
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

function switchSettingsTab(tab) {
  settingsTab = tab;
  ["general", "pending"].forEach(name => {
    const panel = document.getElementById(`settingsTab${name === "general" ? "General" : "Pending"}`);
    if (panel) panel.hidden = tab !== name;
  });
  document.querySelectorAll(".settings-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  const title = document.getElementById("settingsPanelTitle");
  if (title) {
    const titles = { general: "settings", pending: "settingsTabPending" };
    title.textContent = t(titles[tab] || "settings");
  }
  if (tab === "pending") renderPendingQueue();
}

function updatePendingBadge(count) {
  const badge = document.getElementById("pendingBadge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = String(count);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

function renderPendingRow(item, { online = false, canModerate = true } = {}) {
  const row = document.createElement("div");
  row.className = "pending-row";
  const actions = canModerate
    ? `<span class="pending-actions">
        <button type="button" class="btn-approve" data-id="${item.id}" data-online="${online ? "1" : ""}">${t("approve")}</button>
        <button type="button" class="btn-reject" data-id="${item.id}" data-online="${online ? "1" : ""}">${t("reject")}</button>
      </span>`
    : `<span class="muted">${t("pendingNote")}</span>`;
  row.innerHTML = `
    <span>${item.emoji} <strong>${item.text}</strong>
      <small>(${item.locale}${item.dialect ? ` / ${item.dialect}` : ""} · ${item.category})</small>
    </span>
    ${actions}`;
  return row;
}

async function renderPendingQueue() {
  if (!el.pendingList) return;
  const pending = getPendingSubmissions();
  el.pendingList.innerHTML = "";
  if (!pending.length) {
    el.pendingList.innerHTML = `<p class="muted">${t("noPendingWords")}</p>`;
  } else {
    pending.forEach(item => el.pendingList.appendChild(renderPendingRow(item)));
  }

  let onlineCount = 0;
  const onlineSection = document.getElementById("pendingOnlineSection");
  const onlineHint = document.getElementById("pendingOnlineHint");
  if (SUPABASE_READY && authUser && el.pendingOnlineList) {
    try {
      const { items, isAdmin } = await fetchOnlinePending();
      onlineCount = items.length;
      if (items.length) {
        onlineSection.hidden = false;
        onlineHint.textContent = isAdmin ? t("pendingOnlineHint") : t("pendingOnlineOwnHint");
        el.pendingOnlineList.innerHTML = "";
        items.forEach(item => {
          el.pendingOnlineList.appendChild(renderPendingRow(item, { online: true, canModerate: isAdmin }));
        });
      } else {
        onlineSection.hidden = true;
        el.pendingOnlineList.innerHTML = "";
      }
    } catch {
      onlineSection.hidden = true;
    }
  } else if (onlineSection) {
    onlineSection.hidden = true;
  }

  updatePendingBadge(pending.length + onlineCount);

  const bindActions = (root) => {
    root.querySelectorAll(".btn-approve").forEach(btn => {
      btn.onclick = async () => {
        if (btn.dataset.online) {
          const res = await approveOnlineSubmission(btn.dataset.id);
          if (!res.ok) { toast(res.reason || t("uploadFailed")); return; }
        } else {
          approveSubmission(btn.dataset.id);
          renderBoard();
        }
        toast(t("wordApproved"));
        renderPendingQueue();
      };
    });
    root.querySelectorAll(".btn-reject").forEach(btn => {
      btn.onclick = async () => {
        if (btn.dataset.online) {
          await rejectOnlineSubmission(btn.dataset.id);
        } else {
          rejectSubmission(btn.dataset.id);
        }
        toast(t("wordRejected"));
        renderPendingQueue();
      };
    });
  };
  bindActions(el.pendingList);
  if (el.pendingOnlineList) bindActions(el.pendingOnlineList);
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

document.getElementById("settingsClose").onclick = () => closePanel(el.settingsPanel);
document.getElementById("contributeBtn").onclick = () => {
  const share = document.getElementById("contribShareOnline");
  if (share) share.checked = true;
  openPanel(el.contributePanel);
};
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

/* ---------------- Caregiver mode (tap ⚙️) ---------------- */
function openCaregiverSettings() {
  renderUsageStats();
  switchSettingsTab(settingsTab || "general");
  openPanel(el.settingsPanel);
}

function requestCaregiverAccess() {
  if (isCaregiver()) {
    openCaregiverSettings();
    return;
  }
  if (settings.caregiverPin) {
    openPinPanel(enterCaregiverMode);
    return;
  }
  enterCaregiverMode();
}

let pinPanelCallback = null;

function openPinPanel(onSuccess) {
  const panel = document.getElementById("pinPanel");
  const input = document.getElementById("pinPanelInput");
  const errorEl = document.getElementById("pinPanelError");
  if (!panel || !input) {
    const pin = prompt(t("enterPin"));
    if (pin === settings.caregiverPin) onSuccess();
    else if (pin != null) toast(t("wrongPin"));
    return;
  }
  pinPanelCallback = onSuccess;
  document.getElementById("pinPanelTitle").textContent = t("enterPin");
  document.getElementById("pinPanelHint").textContent = t("pinPanelHint");
  document.getElementById("pinPanelLbl").textContent = t("accountPassword");
  document.getElementById("pinPanelCancel").textContent = t("cancel");
  input.placeholder = t("accountPinPlaceholder");
  input.value = "";
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
  openPanel(panel);
  input.focus();
}

function closePinPanel() {
  pinPanelCallback = null;
  closePanel(document.getElementById("pinPanel"));
}

function submitPinPanel() {
  const input = document.getElementById("pinPanelInput");
  const errorEl = document.getElementById("pinPanelError");
  const pin = input?.value.trim() || "";
  if (pin === settings.caregiverPin) {
    const cb = pinPanelCallback;
    closePinPanel();
    cb?.();
    return;
  }
  if (errorEl) {
    errorEl.textContent = t("wrongPin");
    errorEl.hidden = false;
  } else {
    toast(t("wrongPin"));
  }
  input?.focus();
}

function setupPinPanel() {
  document.getElementById("pinPanelSubmit")?.addEventListener("click", submitPinPanel);
  document.getElementById("pinPanelCancel")?.addEventListener("click", closePinPanel);
  document.getElementById("pinPanelClose")?.addEventListener("click", closePinPanel);
  document.getElementById("pinPanelInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter") submitPinPanel();
  });
}
function applyCaregiverVisibility() {
  const on = isCaregiver();
  document.querySelectorAll(".caregiver-only").forEach(el => {
    el.hidden = !on;
  });
  const banner = document.getElementById("caregiverBanner");
  if (banner) banner.hidden = !on;
  document.getElementById("localebar")?.toggleAttribute("hidden", !on);
  document.getElementById("contributeBtn")?.toggleAttribute("hidden", !on);
  const tabs = document.getElementById("settingsTabs");
  if (tabs) tabs.hidden = !on;
  if (on) {
    renderPendingQueue().catch(() => {});
  } else {
    settingsTab = "general";
    document.getElementById("settingsTabGeneral")?.removeAttribute("hidden");
    document.getElementById("settingsTabPending")?.setAttribute("hidden", "");
  }
}

function enterCaregiverMode() {
  settings = saveSettings({ caregiverActive: true });
  applyChrome();
  refreshAll();
  renderUsageStats();
  const pendingCount = getPendingSubmissions().length;
  switchSettingsTab(pendingCount > 0 ? "pending" : "general");
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
  btn?.addEventListener("click", e => {
    e.preventDefault();
    requestCaregiverAccess();
  });

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
    updateBoardSection();
    renderBoard();
  };
  document.getElementById("caregiverPinInput").onchange = e => {
    const pin = e.target.value.trim();
    settings = saveSettings({ caregiverPin: pin.length === 4 ? pin : null });
  };

  document.querySelectorAll(".settings-tab").forEach(btn => {
    btn.addEventListener("click", () => switchSettingsTab(btn.dataset.tab));
  });
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
  const shareOnline = document.getElementById("contribShareOnline")?.checked !== false;
  if (!shareOnline) {
    toast(t("shareWithCommunityHint"));
    return;
  }
  const result = await submitCommunityWord({
    text,
    category,
    emoji: emoji || "💬",
    locale: settings.locale,
    dialect: state.dialect,
    audioBlob: contribBlob,
    shareOnline: true
  });
  if (result?.needsAuth) {
    toast(t("signInForCommunity"));
    document.getElementById("contribEmail")?.focus();
    return;
  }
  if (result?.rejected) {
    toast(t("communityRejected"));
    return;
  }
  toast(t("communitySubmitted"));
  document.getElementById("contribForm").reset();
  const contribShare = document.getElementById("contribShareOnline");
  if (contribShare) contribShare.checked = true;
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
function setupRecordAuth() {
  const panel = document.getElementById("recordAuthPanel");
  if (!panel || !SUPABASE_READY) return;

  const usernameInput = document.getElementById("recordAuthUsername");
  const passInput = document.getElementById("recordAuthPassword");
  const shareBox = document.getElementById("recordAuthShareCommunity");
  const signInBtn = document.getElementById("recordAuthSignInBtn");
  const signUpBtn = document.getElementById("recordAuthSignUpBtn");
  const errorEl = document.getElementById("recordAuthError");
  const signedInEl = document.getElementById("recordAuthSignedIn");
  const formEl = document.getElementById("recordAuthForm");

  shareBox?.addEventListener("change", e => persistShareWithCommunity(e.target.checked));

  async function onAuthSuccess(user, mode) {
    const sessionUser = await getCurrentUser();
    authUser = sessionUser || user;
    if (!authUser) {
      showAuthError(errorEl, t("accountConfirmNeeded"));
      return;
    }
    signedInEl.textContent = `${t("signedInAs")} ${displayUsername(authUser)}`;
    signedInEl.hidden = false;
    if (formEl) formEl.hidden = true;
    showAuthError(errorEl, "");
    await initPersonal(authUser);
    await wait(600);
    closePanel(panel);
    const pending = pendingRecordAfterAuth;
    pendingRecordAfterAuth = null;
    if (pending?.word) {
      toast(mode === "signup" ? t("signUpSuccess") : `${t("signedInAs")} ${displayUsername(authUser)}`);
      await startRecording(pending.word, pending.cardEl);
      return;
    }
    const pendingShare = pendingCommunityShareAfterAuth;
    pendingCommunityShareAfterAuth = null;
    if (pendingShare?.word) {
      toast(mode === "signup" ? t("signUpSuccess") : `${t("signedInAs")} ${displayUsername(authUser)}`);
      const result = await shareRecordingWithCommunity(pendingShare.word, pendingShare.blob);
      if (result?.rejected) toast(t("communityRejected"));
      else if (result?.entry) {
        toast(t("communitySubmitted"));
        renderPendingQueue();
      }
    }
  }

  async function tryAuth(mode) {
    showAuthError(errorEl, "");
    const username = usernameInput?.value;
    const password = passInput?.value;
    const userCheck = validateUsername(username);
    if (!userCheck.ok) {
      showAuthError(errorEl, t("usernameInvalid"));
      usernameInput?.focus();
      return;
    }
    if (!validatePin(password).ok) {
      showAuthError(errorEl, t("passwordTooShort"));
      passInput?.focus();
      return;
    }
    persistShareWithCommunity(shareBox?.checked !== false);
    const btn = mode === "signin" ? signInBtn : signUpBtn;
    const defaultLabel = t(mode === "signin" ? "accountSignIn" : "accountSignUp");
    setAuthLoading(signInBtn, true, t("accountSignIn"));
    setAuthLoading(signUpBtn, true, t("accountSignUp"));
    const res = mode === "signin"
      ? await signInWithPassword(username, password)
      : await signUpWithPassword(username, password);
    setAuthLoading(signInBtn, false, t("accountSignIn"));
    setAuthLoading(signUpBtn, false, t("accountSignUp"));
    if (res.ok && res.user && !res.needsConfirm) {
      await onAuthSuccess(res.user, mode);
      return;
    }
    if (res.ok && res.needsConfirm) {
      showAuthError(errorEl, t("accountConfirmNeeded"));
      return;
    }
    showAuthError(errorEl, res.error || (mode === "signin" ? t("wrongCredentials") : t("usernameTaken")));
    btn?.focus();
  }

  signInBtn?.addEventListener("click", () => tryAuth("signin"));
  signUpBtn?.addEventListener("click", () => tryAuth("signup"));
  document.getElementById("recordAuthClose")?.addEventListener("click", () => {
    pendingRecordAfterAuth = null;
    pendingCommunityShareAfterAuth = null;
    closePanel(panel);
  });
}

function setupCaregiverAuth() {
  const box = document.getElementById("caregiverAuth");
  if (!box || !SUPABASE_READY) return;

  const statusEl = document.getElementById("caregiverAuthStatus");
  const errorEl = document.getElementById("caregiverAuthError");
  const signInForm = document.getElementById("caregiverSignInForm");
  const signedInBox = document.getElementById("caregiverSignedIn");
  const signedInAsEl = document.getElementById("caregiverSignedInAs");
  const usernameInput = document.getElementById("caregiverUsername");
  const passInput = document.getElementById("caregiverPassword");
  const signInBtn = document.getElementById("caregiverSignInBtn");
  const signUpBtn = document.getElementById("caregiverSignUpBtn");
  const signOutBtn = document.getElementById("caregiverSignOutBtn");

  async function reflect(user) {
    authUser = user || null;
    showAuthError(errorEl, "");
    if (user) {
      statusEl.textContent = t("accountHint");
      signedInAsEl.textContent = `${t("signedInAs")} ${displayUsername(user)}`;
      signInForm.hidden = true;
      signedInBox.hidden = false;
      const sync = await initPersonal(user);
      if (sync.recordings || sync.words) {
        toast(`Synced ${sync.recordings} recording(s), ${sync.words} word(s).`);
      }
      renderBoard();
      renderPersonalList();
      renderCustomWordsList();
      renderPendingQueue().catch(() => {});
    } else {
      statusEl.textContent = t("accountHint");
      signInForm.hidden = false;
      signedInBox.hidden = true;
    }
  }

  async function runAuth(mode) {
    showAuthError(errorEl, "");
    const username = usernameInput?.value;
    const password = passInput?.value;
    const userCheck = validateUsername(username);
    if (!userCheck.ok) {
      showAuthError(errorEl, t("usernameInvalid"));
      usernameInput?.focus();
      return;
    }
    if (!validatePin(password).ok) {
      showAuthError(errorEl, t("passwordTooShort"));
      passInput?.focus();
      return;
    }
    persistShareWithCommunity(document.getElementById("caregiverShareCommunity")?.checked !== false);
    const btn = mode === "signin" ? signInBtn : signUpBtn;
    setAuthLoading(signInBtn, true, t("accountSignIn"));
    setAuthLoading(signUpBtn, true, t("accountSignUp"));
    const res = mode === "signin"
      ? await signInWithPassword(username, password)
      : await signUpWithPassword(username, password);
    setAuthLoading(signInBtn, false, t("accountSignIn"));
    setAuthLoading(signUpBtn, false, t("accountSignUp"));
    if (res.ok && res.user && !res.needsConfirm) {
      toast(mode === "signup" ? t("signUpSuccess") : `${t("signedInAs")} ${displayUsername(res.user)}`);
      await reflect(res.user);
      return;
    }
    if (res.ok && res.needsConfirm) {
      showAuthError(errorEl, t("accountConfirmNeeded"));
      return;
    }
    showAuthError(errorEl, res.error || (mode === "signin" ? t("wrongCredentials") : t("usernameTaken")));
    btn?.focus();
  }

  signInBtn?.addEventListener("click", () => runAuth("signin"));
  signUpBtn?.addEventListener("click", () => runAuth("signup"));

  document.getElementById("caregiverShareCommunity")?.addEventListener("change", e => {
    persistShareWithCommunity(e.target.checked);
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
    const shareCommunity = document.getElementById("customWordShareCommunity")?.checked !== false;
    if (!label) return;

    const mod = moderateWordEntry(label, hint, settings.locale);
    if (shareCommunity && !mod.ok) {
      logModerationRejection(label, settings.locale, mod.reason);
      toast(t("communityRejected"));
      return;
    }

    await addCustomWord({
      label,
      englishHint: hint || null,
      emoji: emoji || "💬",
      category,
      locale: settings.locale,
      dialect: state.dialect,
      audioBlob: customBlob
    }, authUser);

    if (shareCommunity) {
      const user = authUser || await getCurrentUser();
      if (!user) {
        toast(t("savedLocalOnly"));
        toast(t("signInForCommunity"));
        openPanel(el.settingsPanel);
        return;
      }
      authUser = user;
      const result = await submitWord({
        text: label,
        category,
        emoji: emoji || "💬",
        locale: settings.locale,
        dialect: state.dialect,
        audioBlob: customBlob,
        shareOnline: true
      });
      if (result?.rejected) toast(t("communityRejected"));
      else if (result?.entry) {
        toast(t("communitySubmitted"));
        renderPendingQueue();
      }
    } else {
      toast(t("savedVoice"));
    }

    form.reset();
    customBlob = null;
    const shareBox = document.getElementById("customWordShareCommunity");
    if (shareBox) shareBox.checked = true;
    if (recBtn) {
      recBtn.textContent = t("recordHint");
      recBtn.classList.remove("recording", "recorded");
    }
    renderBoard();
    renderCustomWordsList();
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

function bootUI() {
  state.dialect = settings.dialect;
  populateContribCategories();
  populateSecondaryLocales();
  setupContributorAuth();
  setupCaregiverAuth();
  setupRecordAuth();
  setupCustomWordForm();
  setupPinPanel();
  setupCaregiverGate();
  refreshAll();
}

(async function init() {
  initTTS();
  initNativeShell().catch(() => {});
  bootUI();
  try {
    authUser = await getCurrentUser();
    if (!authUser && SUPABASE_READY) {
      authUser = await ensureDoggyPreload();
    }
    await Promise.allSettled([initCommunity(), initPersonal(authUser)]);
    refreshAll();
  } catch {
    /* board already rendered from bootUI */
  }
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
