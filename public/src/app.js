/* Talk Board — main app logic
   Multi-language/dialect via locale registry + Web Speech API TTS.
   Community words: local queue now, Supabase in Phase 2. */

import { CATEGORIES, WORDS, labelForWord, labelForCategory } from "./data.js";
import {
  LOCALES, loadSettings, saveSettings, getLocale, getDialect,
  uiString, ttsLangFor, effectiveDir
} from "./locales.js";
import { initTTS, say, previewVoice, voicesForLocale, unlockAudio, stopSpeaking } from "./tts.js";
import {
  initCommunity, mergeCommunityWords, submitWord, getPendingSubmissions,
  approveSubmission, rejectSubmission, getCommunityAudio, syncShareQueue,
  fetchOnlinePending, checkIsAdmin, prefetchCommunityAudio, refreshCommunityForLocale
} from "./community.js";
import {
  SUPABASE_READY, getCurrentUser, signInWithEmail, signInWithPassword,
  signUpWithPassword, signOut, onAuthChange, displayUsername, usesTalkboardAccount,
  validateUsername, validatePin, isOnline, DOGGY_USER_ID
} from "./supabase.js";
import {
  initPersonal, mergePersonalWords, getPersonalRecording, savePersonalRecording,
  deletePersonalRecording, loadRecordedKeys, getRecordedKeys, recKey,
  addCustomWord, getAllCustomWords, deleteCustomWord,
  listPersonalRecordings, syncPersonalQueue, prefetchPersonalRecording
} from "./personal.js";
import {
  loadGlobalRecordings, getGlobalRecording, submitGlobalRecording,
  fetchPendingGlobalRecordings,
  syncGlobalQueue, prefetchGlobalRecording
} from "./global.js";
import { onSyncProgress, isSlowNetwork, PRIORITY } from "./audio-loader.js";
import {
  KID_VIEWS, wordsForKidView, cardSizeClass, labelForKidView,
  boardViewKey, resolveHomeMax
} from "./kid-ui.js";
import { HOME_MAX_WORDS } from "./priorities.js";
import {
  recordWordUse, getUniqueWordCount, resetUsageStats,
  setCardOrderForView, pinWord, unpinWord, isWordPinned, bringWordToTop,
  exportBoardLayout, importBoardLayout
} from "./usage.js";
import { moderateWordEntry, logModerationRejection } from "./moderation.js";
import { initNativeShell } from "./native.js";
import { siblingDialectFor } from "./dialect-fallback.js";
import {
  initRecording, attachWordCardLongPress, startRecording,
  bindRecordingOverlayButtons, persistShareWithCommunity, wordPressIgnored
} from "./features/recording.js";
import {
  initAuthUi, openRecordAuthPanel, setupRecordAuth, setupCaregiverAuth,
  setupAccountSwitcher, rememberRecentAccount
} from "./features/auth-ui.js";
import { evictAudioCachesIfNeeded } from "./idb-evict.js";

/* ---------------- Toast ---------------- */
function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    t.setAttribute("aria-atomic", "true");
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = "1";
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = "0"; }, 5000);
}

const COACH_KEY = "talkboard_coach_done";
const VISITS_KEY = "talkboard_visits";
const PINS_PROMPT_KEY = "talkboard_pins_prompted";
const SW_VERSION_KEY = "talkboard_sw_version";
let settingsSessionUnlocked = false;
let moreSearchQuery = "";
let deferredInstallPrompt = null;

function t(key) {
  return uiString(settings.locale, key);
}

function labelForWordId(wordId) {
  for (const list of Object.values(WORDS)) {
    const w = list.find(x => x.id === wordId);
    if (w) return labelForWord(w, settings.locale, state.dialect);
  }
  return wordId;
}

/* ---------------- Audio helpers ---------------- */
let currentAudio = null;
let speakGeneration = 0;
let speakingSentence = false;

function stopAllAudio() {
  speakGeneration++;
  stopSpeaking();
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    try { currentAudio.src = ""; } catch {}
    currentAudio = null;
  }
  document.getElementById("speakBtn")?.classList.remove("loading-audio", "speaking");
  document.querySelectorAll("#strip .chip.speaking").forEach(c => c.classList.remove("speaking"));
  speakingSentence = false;
}

function playBlob(blob) {
  return new Promise(res => {
    const gen = speakGeneration;
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    currentAudio = a;
    const done = () => {
      if (currentAudio === a) currentAudio = null;
      URL.revokeObjectURL(url);
      res();
    };
    a.onended = done;
    a.onerror = done;
    a.play().catch(done);
    // If cancelled mid-play, resolve so sentence loop can exit
    const poll = setInterval(() => {
      if (gen !== speakGeneration) {
        clearInterval(poll);
        try { a.pause(); } catch {}
        done();
      }
    }, 80);
    a.onended = () => { clearInterval(poll); done(); };
    a.onerror = () => { clearInterval(poll); done(); };
  });
}

let authUser = null;
let pendingRecordAfterAuth = null;
let pendingCommunityShareAfterAuth = null;

function canManagePersonalRecordings() {
  return !!authUser;
}

function promptSignInToRecord(word, cardEl) {
  toast(t("signInToSaveVoice"));
  pendingRecordAfterAuth = { word, cardEl: cardEl || null };
  openRecordAuthPanel({ forCommunity: false });
}

async function shareRecordingWithCommunity(word, blob) {
  if (!word || !blob?.size) return { skipped: true };
  const user = authUser || await getCurrentUser();
  if (!user) return { needsAuth: true };
  if (word.source === "builtin" || (!word.source && word.id && !word.communityId)) {
    return submitGlobalRecording({
      wordId: word.id,
      locale: settings.locale,
      dialect: state.dialect,
      audioBlob: blob
    });
  }
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

/* ---------------- Audio playback priority (active dialect D) ----------------
   1. Personal recording for D
   2. Approved global / community recording for D
   3. Shared sd↔juba pool (sibling dialect)
   4. Web Speech API TTS of translated native text */
async function prefetchWordAudio(word, priority = PRIORITY.visible) {
  const locale = settings.locale;
  const dialect = state.dialect;
  const sibling = siblingDialectFor(locale, dialect);
  await prefetchPersonalRecording(word.id, locale, dialect, priority);
  await prefetchGlobalRecording(word.id, locale, dialect, priority);
  if (word.source === "community" && word.communityId) {
    await prefetchCommunityAudio(word.communityId, priority);
  }
  if (sibling) {
    await prefetchPersonalRecording(word.id, locale, sibling, priority);
    await prefetchGlobalRecording(word.id, locale, sibling, priority);
  }
}

async function playWordAudio(word) {
  const locale = settings.locale;
  const dialect = state.dialect;
  const sibling = siblingDialectFor(locale, dialect);
  await prefetchWordAudio(word, PRIORITY.tap);

  const personalD = await getPersonalRecording(word.id, locale, dialect, { directOnly: true });
  if (personalD) { await playBlob(personalD); return; }

  const globalD = await getGlobalRecording(word.id, locale, dialect, { directOnly: true });
  if (globalD) { await playBlob(globalD); return; }

  if (word.source === "community" && word.communityId && !word.dialectFallback) {
    const commD = await getCommunityAudio(word.communityId);
    if (commD) { await playBlob(commD); return; }
  }

  if (sibling) {
    const personalS = await getPersonalRecording(word.id, locale, sibling, { directOnly: true });
    if (personalS) { await playBlob(personalS); return; }

    const globalS = await getGlobalRecording(word.id, locale, sibling, { directOnly: true });
    if (globalS) { await playBlob(globalS); return; }

    if (word.source === "community" && word.communityId && word.dialectFallback) {
      const commS = await getCommunityAudio(word.communityId);
      if (commS) { await playBlob(commS); return; }
    }
  }

  const text = labelForWord(word, settings.locale, state.dialect);
  const lang = ttsLangFor(settings.locale, state.dialect);
  try {
    await say(text, lang, { voiceURI: settings.voiceURI });
  } catch {
    toast(t("noVoice"));
  }
}

async function speakWord(word, cardEl) {
  const setLoading = (on) => cardEl?.classList.toggle("loading-audio", on);
  setLoading(true);
  try {
    await playWordAudio(word);
  } finally {
    setLoading(false);
  }
}

async function speakSentence() {
  if (!state.sentence.length) return;
  if (speakingSentence) {
    stopAllAudio();
    return;
  }
  const btn = document.getElementById("speakBtn");
  const gen = ++speakGeneration;
  speakingSentence = true;
  btn?.classList.add("loading-audio", "speaking");
  const chips = [...document.querySelectorAll("#strip .chip")];
  try {
    for (let i = 0; i < state.sentence.length; i++) {
      if (gen !== speakGeneration) break;
      chips[i]?.classList.add("speaking");
      await playWordAudio(state.sentence[i]);
      chips[i]?.classList.remove("speaking");
    }
  } finally {
    if (gen === speakGeneration) {
      speakingSentence = false;
      btn?.classList.remove("loading-audio", "speaking");
      chips.forEach(c => c.classList.remove("speaking"));
    }
  }
}

function getHomeMax() {
  return resolveHomeMax(settings);
}

/* ---------------- State ---------------- */
let settings = loadSettings();
const state = {
  category: CATEGORIES[0].id,
  kidView: "home",
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
  pendingList: document.getElementById("pendingList"),
  pendingOnlineList: document.getElementById("pendingOnlineList")
};

let settingsTab = "general";

/* ---------------- Render ---------------- */
function applyTheme() {
  const dark = !!settings.darkMode;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.body.classList.toggle("theme-dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#1A2A32" : "#2E8C8C";
}

function applyChrome() {
  if (el.title) el.title.textContent = t("title");
  if (el.sayLbl) el.sayLbl.textContent = t("say");
  document.documentElement.lang = settings.locale;
  document.body.setAttribute("dir", effectiveDir(settings.locale, settings.secondaryLocale, settings.bilingual));
  applyTheme();
  const skip = document.getElementById("skipToBoard");
  if (skip) skip.textContent = t("skipToBoard");
  renderLangIndicator();
  renderAccountBadge();
  updateAccountAuthLabels();
  updateSettingsPanelLabels();
  updateBoardSection();
  updateContribFormLabels();
  updateCaregiverChrome();
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.title = t("settings");
    settingsBtn.setAttribute("aria-label", t("settings"));
  }
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
    pendingGlobalTitle: "pendingGlobalTitle",
    settingsLangLbl: "language",
    settingsDialectLbl: "dialect",
    wordLearningTitle: "wordLearning",
    resetUsageBtn: "resetUsage",
    caregiverModeLbl: "caregiverMode",
    showAllOnHomeLbl: "showAllOnHome",
    boardPresetLbl: "boardPreset",
    darkModeLbl: "darkMode",
    badgeLegendTitle: "badgeLegendTitle",
    badgeLegendBody: "badgeLegendBody",
    exportLayoutBtn: "exportLayout",
    importLayoutBtn: "importLayout",
    voiceLbl: "voice",
    previewVoiceBtn: "preview",
    bilingualLbl: "bilingual",
    secondaryLangLbl: "secondaryLang",
    personalRecTitle: "personalRecordings",
    myWordsTitle: "myWords",
    customWordLabelLbl: "wordLabelCurrent",
    customWordHintLbl: "englishHintLabel",
    customWordEmojiLbl: "emojiLabel",
    customWordCategoryLbl: "categoryLabel",
    customWordRecordLbl: "recordYourVoice",
    customWordSubmitBtn: "addMyWord",
    adminPanelLink: "adminPanel",
    privacyPolicyLink: "privacyPolicy",
    moreSearchLbl: "moreSearchPlaceholder"
  };
  for (const [id, key] of Object.entries(map)) {
    const node = document.getElementById(id);
    if (node) node.textContent = t(key);
  }
  const hints = {
    caregiverModeHint: "caregiverModeHint",
    showAllOnHomeHint: "showAllOnHomeHint"
  };
  for (const [id, key] of Object.entries(hints)) {
    const node = document.getElementById(id);
    if (node) node.textContent = t(key);
  }
  const customLabel = document.getElementById("customWordLabel");
  if (customLabel) customLabel.placeholder = t("wordLabelPlaceholder");
  const customHint = document.getElementById("customWordHint");
  if (customHint) customHint.placeholder = t("englishHintPlaceholder");
  const moreSearch = document.getElementById("moreSearch");
  if (moreSearch) moreSearch.placeholder = t("moreSearchPlaceholder");
  renderBoardPresetSelect();
  const caregiverToggle = document.getElementById("caregiverModeToggle");
  if (caregiverToggle) caregiverToggle.checked = !!settings.caregiverMode;
  const showAllToggle = document.getElementById("showAllOnHomeToggle");
  if (showAllToggle) showAllToggle.checked = !!settings.showAllOnHome;
  const darkToggle = document.getElementById("darkModeToggle");
  if (darkToggle) darkToggle.checked = !!settings.darkMode;
}

function updateBoardSection() {
  const section = document.getElementById("boardSection");
  if (!section) return;
  if (state.kidView === "more") {
    section.hidden = false;
    const title = document.getElementById("boardSectionTitle");
    const hint = document.getElementById("boardSectionHint");
    const searchWrap = document.getElementById("moreSearchWrap");
    if (title) title.textContent = t("viewMore");
    if (hint) hint.textContent = t("moreWordsHint");
    if (searchWrap) searchWrap.hidden = false;
  } else {
    section.hidden = true;
    const searchWrap = document.getElementById("moreSearchWrap");
    if (searchWrap) searchWrap.hidden = true;
    moreSearchQuery = "";
    const searchInput = document.getElementById("moreSearch");
    if (searchInput) searchInput.value = "";
  }
}

function showCaregiverAffordances() {
  return !!settings.caregiverMode || settingsSessionUnlocked || !!authUser;
}

function updateCaregiverChrome() {
  const show = showCaregiverAffordances();
  const contributeBtn = document.getElementById("contributeBtn");
  if (contributeBtn) {
    if (show) contributeBtn.removeAttribute("hidden");
    else contributeBtn.setAttribute("hidden", "");
  }
  const boardContrib = document.getElementById("boardContributeSection");
  if (boardContrib) {
    if (show) boardContrib.removeAttribute("hidden");
    else boardContrib.setAttribute("hidden", "");
  }
  document.body.classList.toggle("caregiver-mode", !!settings.caregiverMode || !!authUser);
  const strip = document.getElementById("strip");
  if (strip) {
    const base = t(canManagePersonalRecordings() ? "kidHintCaregiver" : "kidHintGuest");
    strip.setAttribute("data-hint", show ? `${base} · ${t("chipRemoveHint")}` : base);
  }
}

function updateAccountAuthLabels() {
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

function updateContribFormLabels() {
  const map = {
    boardContributeTitle: "contribute",
    boardContribWordLbl: "wordText",
    boardContribCategoryLbl: "category",
    boardContribEmojiLbl: "emoji",
    boardContribRecordLbl: "recordHint",
    boardContribSubmitBtn: "submit",
    boardShareOnlineLbl: "shareWithCommunityHint"
  };
  for (const [id, key] of Object.entries(map)) {
    const node = document.getElementById(id);
    if (node) node.textContent = t(key);
  }
  const hint = document.getElementById("boardContributeHint");
  if (hint) hint.textContent = t("contributeHint");
  const note = document.getElementById("boardContribNote");
  if (note) note.textContent = t("contributeNote");
  const shareBox = document.getElementById("boardContribShareOnline");
  if (shareBox && !shareBox.checked) shareBox.checked = false;
  const textInput = document.getElementById("boardContribText");
  if (textInput) {
    textInput.placeholder = settings.locale === "ar"
      ? "اكتب الكلمة بلغتك"
      : "Type the word in your language";
  }
  const recordBtn = document.getElementById("boardContribRecordBtn");
  if (recordBtn && !recordBtn.classList.contains("recording") && !recordBtn.classList.contains("recorded")) {
    recordBtn.textContent = `🎤 ${t("recordHint").replace(/\s*\(.*\)/, "")}`;
  }
  const modalRecordBtn = document.getElementById("contribRecordBtn");
  if (modalRecordBtn && !modalRecordBtn.classList.contains("recording") && !modalRecordBtn.classList.contains("recorded")) {
    modalRecordBtn.textContent = `🎤 ${t("recordHint").replace(/\s*\(.*\)/, "")}`;
  }
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

function updateOfflineBadge() {
  const badge = document.getElementById("offlineBadge");
  if (!badge) return;
  const offline = !isOnline();
  badge.hidden = !offline;
  badge.textContent = offline ? t("offlineMode") : "";
  badge.title = offline ? t("offlineHint") : "";
  document.body.classList.toggle("is-offline", offline);
}

function setupOfflineIndicator() {
  updateOfflineBadge();
  window.addEventListener("online", () => {
    updateOfflineBadge();
    syncWhenOnline();
  });
  window.addEventListener("offline", updateOfflineBadge);
}

let syncBannerDismissed = false;
let recordingPrefetchObserver = null;

function setupSyncBanner() {
  let banner = document.getElementById("syncBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "syncBanner";
    banner.className = "sync-banner";
    banner.hidden = true;
    banner.innerHTML = `<span id="syncBannerText"></span>`;
    document.querySelector(".topbar-end")?.appendChild(banner)
      || document.querySelector(".topbar")?.appendChild(banner);
    banner.addEventListener("click", () => {
      syncBannerDismissed = true;
      banner.hidden = true;
    });
  }
  const textEl = document.getElementById("syncBannerText");
  onSyncProgress(({ active, done, total }) => {
    if (!isSlowNetwork() || syncBannerDismissed || !isOnline()) {
      banner.hidden = true;
      return;
    }
    if (!active || total <= 0 || done >= total) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    if (textEl) {
      textEl.textContent = t("syncingVoices").replace("{done}", String(done)).replace("{total}", String(total));
    }
  });
}

function markWordRecordingCached(wordId) {
  document.querySelectorAll(`.word[data-word-id="${wordId}"]`).forEach(card => {
    card.classList.add("has-rec");
  });
}

function setupRecordingCachedListener() {
  window.addEventListener("talkboard:recording-cached", (e) => {
    const wordId = e.detail?.wordId;
    if (wordId) markWordRecordingCached(wordId);
  });
}

function setupRecordingPrefetch() {
  recordingPrefetchObserver?.disconnect();
  const board = el.board;
  if (!board) return;
  const homePriority = state.kidView === "home" ? PRIORITY.home : PRIORITY.visible;
  recordingPrefetchObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const wordId = entry.target.dataset.wordId;
      if (!wordId) continue;
      const word = wordsForBoard().find(w => w.id === wordId);
      if (word) prefetchWordAudio(word, homePriority);
      recordingPrefetchObserver.unobserve(entry.target);
    }
  }, { root: null, rootMargin: "100px", threshold: 0.05 });
  board.querySelectorAll(".word[data-word-id]").forEach(card => {
    recordingPrefetchObserver.observe(card);
  });
}

async function syncWhenOnline() {
  if (!isOnline()) return;
  try {
    const tasks = [
      syncShareQueue(),
      syncPersonalQueue(),
      syncGlobalQueue()
    ];
    if (authUser) tasks.push(initPersonal(authUser));
    else tasks.push(loadGlobalRecordings(settings.locale, state.dialect));
    const results = await Promise.allSettled(tasks);
    const community = results[0]?.value;
    const personal = results[1]?.value;
    const global = results[2]?.value;
    const uploaded = (community?.uploaded || 0) + (personal?.synced || 0) + (global?.uploaded || 0);
    if (uploaded > 0) toast(t("backOnlineSynced").replace("{n}", String(uploaded)));
    refreshAll();
  } catch (err) {
    console.warn("[Talk Board] syncWhenOnline:", err);
  }
}

function renderAdminLink(isAdmin) {
  const row = document.getElementById("adminLinkRow");
  if (row) row.hidden = !isAdmin;
}

function renderAccountBadge(user = authUser) {
  const badge = document.getElementById("accountBadge");
  if (!badge) return;
  if (user) {
    const name = displayUsername(user);
    rememberRecentAccount(name);
    badge.textContent = name;
    badge.title = `${t("signedInAs")} ${name} — ${t("accountBadgeHint")}`;
    badge.setAttribute("aria-label", badge.title);
    badge.classList.remove("is-guest");
    badge.classList.add("is-clickable");
    badge.hidden = false;
    el.strip?.setAttribute(
      "data-hint",
      t(canManagePersonalRecordings() ? "kidHintCaregiver" : "kidHintGuest")
    );
    return;
  }
  badge.textContent = t("guestAccount");
  badge.title = t("guestAccount");
  badge.setAttribute("aria-label", t("guestAccount"));
  badge.classList.add("is-guest", "is-clickable");
  badge.hidden = false;
  updateCaregiverChrome();
  el.strip?.setAttribute(
    "data-hint",
    t(canManagePersonalRecordings() ? "kidHintCaregiver" : "kidHintGuest")
  );
}

function openAccountSettings() {
  document.getElementById("accountSwitcher")?.setAttribute("hidden", "");
  document.getElementById("accountBadge")?.setAttribute("aria-expanded", "false");
  switchSettingsTab("general");
  openPanel(el.settingsPanel);
  document.getElementById("caregiverAuth")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setupAccountBadge() {
  setupAccountSwitcher();
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
  auto.textContent = t("voiceAuto");
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
  if (!el.cats) return;
  el.cats.innerHTML = "";
  el.cats.setAttribute("role", "tablist");
  el.cats.setAttribute("aria-label", t("boardTabsLabel"));
  if (el.board) {
    el.board.setAttribute("role", "tabpanel");
    el.board.setAttribute("id", "board");
    el.board.setAttribute("aria-labelledby", `cat-tab-${state.kidView}`);
  }
  KID_VIEWS.forEach(v => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat kid-cat";
    b.id = `cat-tab-${v.id}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", v.id === state.kidView ? "true" : "false");
    b.setAttribute("aria-controls", "board");
    b.tabIndex = v.id === state.kidView ? 0 : -1;
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
  return boardViewKey(settings.locale, { kidView: state.kidView });
}

function wordsForBoard() {
  let list = wordsForKidView(
    state.kidView,
    mergeAllWords,
    settings.locale,
    state.dialect,
    { homeMax: getHomeMax() }
  );
  if (state.kidView === "more" && moreSearchQuery.trim()) {
    const q = moreSearchQuery.trim().toLowerCase();
    list = list.filter(w => {
      const primary = labelForWord(w, settings.locale, state.dialect).toLowerCase();
      const secondary = settings.bilingual && settings.secondaryLocale
        ? labelForWord(w, settings.secondaryLocale, state.dialect).toLowerCase()
        : "";
      return primary.includes(q) || (secondary && secondary.includes(q));
    });
  }
  return list;
}

function renderBoardPresetSelect() {
  const sel = document.getElementById("boardPresetSelect");
  if (!sel) return;
  const current = settings.boardPreset || "default";
  const options = [
    { value: "default", label: t("boardPresetDefault") },
    { value: "simple24", label: t("boardPresetSimple") },
    { value: "full", label: t("boardPresetFull") }
  ];
  sel.innerHTML = "";
  options.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === current) o.selected = true;
    sel.appendChild(o);
  });
}

function maybePromptRecommendedPins() {
  if (localStorage.getItem(PINS_PROMPT_KEY)) return;
  if (getUniqueWordCount() < 10) return;
  localStorage.setItem(PINS_PROMPT_KEY, "1");
  toast(`${t("recommendedPinsTitle")} — ${t("recommendedPinsHint")}`);
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

/** Touch-friendly pointer reorder for Talk (home) — whole card is the drag handle. */
function setupHomePointerReorder(board, viewKey) {
  let active = null;

  const clearDragUi = () => {
    board.querySelectorAll(".word.dragging, .word.drag-over").forEach(c => {
      c.classList.remove("dragging", "drag-over");
    });
  };

  board.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    const card = e.target.closest(".word");
    if (!card || wordPressIgnored(e.target)) return;
    active = {
      id: card.dataset.wordId,
      el: card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    };
    card.setPointerCapture(e.pointerId);
  });

  board.addEventListener("pointermove", e => {
    if (!active || e.pointerId !== active.pointerId) return;
    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;
    if (!active.moved && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      active.moved = true;
      active.el.classList.add("dragging");
    }
    if (!active.moved) return;
    e.preventDefault();
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest(".word");
    board.querySelectorAll(".word.drag-over").forEach(c => c.classList.remove("drag-over"));
    if (under && under !== active.el && board.contains(under)) {
      under.classList.add("drag-over");
    }
  });

  const finish = (e) => {
    if (!active || e.pointerId !== active.pointerId) return;
    const { el, id, moved } = active;
    active = null;
    try { el.releasePointerCapture(e.pointerId); } catch {}
    if (moved) {
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest(".word");
      clearDragUi();
      if (under && under.dataset.wordId !== id) {
        reorderBoardCards(board, id, under.dataset.wordId, viewKey);
      }
      el._skipClick = true;
      setTimeout(() => { el._skipClick = false; }, 0);
    } else {
      clearDragUi();
    }
  };

  board.addEventListener("pointerup", finish);
  board.addEventListener("pointercancel", finish);
}

function renderBoard() {
  el.board.innerHTML = "";
  const list = wordsForBoard();
  const recordedKeys = getRecordedKeys();
  const isHomeView = state.kidView === "home";
  el.board.classList.toggle("board--home", isHomeView);
  const viewKey = getBoardViewKey();
  const defaultColor = KID_VIEWS.find(v => v.id === state.kidView)?.color
    || "var(--accent)";
  const dragLabel = t("dragToReorder");

  list.forEach((w, index) => {
    const key = recKey(w.id, settings.locale, state.dialect);
    const sizeClass = isHomeView ? "word--home" : cardSizeClass(w);
    const card = document.createElement("div");
    const wordLabel = labelForWord(w, settings.locale, state.dialect);
    card.className = `word${sizeClass ? ` ${sizeClass}` : ""}`;
    card.dataset.wordId = w.id;
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", wordLabel);
    card.tabIndex = 0;
    const catColor = CATEGORIES.find(c => c.id === w.categoryId)?.color || defaultColor;
    card.style.borderColor = catColor;
    if (recordedKeys.has(key)) card.classList.add("has-rec");
    if (w.source === "community") card.classList.add("community");
    if (w.source === "personal") card.classList.add("personal");
    if (w.isCore) card.classList.add("core");
    const pinned = isWordPinned(w.id);
    if (pinned && w.tier !== 0) card.classList.add("home-pinned");
    if (canManagePersonalRecordings()) card.title = t("holdToReRecord");

    const badges = [];
    if (recordedKeys.has(key)) badges.push(`<span class="reciic">🎙️</span>`);
    if (w.source === "community") badges.push(`<span class="src-badge" title="${t("sourceCommunity")}">👥</span>`);
    if (w.source === "personal") badges.push(`<span class="src-badge" title="${t("myWords")}">⭐</span>`);

    const micHtml = canManagePersonalRecordings()
      ? `<button class="mic" title="${t("recordHint")}">🎤</button>`
      : "";
    const dragHtml = `<span class="drag-handle" draggable="${!isHomeView}" title="${dragLabel}" aria-label="${dragLabel}">⠿</span>`;
    const showPinBtn = state.kidView === "more";
    const showUnpinBtn = state.kidView === "home" && pinned && w.tier !== 0;
    const pinHtml = showPinBtn
      ? `<button type="button" class="pin-home" title="${t("pinToHome")}" aria-label="${t("pinToHome")}">⭐</button>`
      : showUnpinBtn
        ? `<button type="button" class="pin-home is-pinned" title="${t("unpinFromHome")}" aria-label="${t("unpinFromHome")}">★</button>`
        : "";
    const bringTopHtml = index > 0
      ? `<button type="button" class="bring-top" title="${t("bringToTop")}" aria-label="${t("bringToTop")}">⬆</button>`
      : "";
    const labelHtml = isHomeView
      ? `<span class="lbl lbl-min">${labelForWord(w, settings.locale, state.dialect)}</span>`
      : (w.tier === 0 || w.isCore)
        ? `<span class="lbl lbl-min">${labelForWord(w, settings.locale, state.dialect)}</span>`
        : wordLabelHtml(w);

    card.innerHTML = dragHtml + micHtml + pinHtml + bringTopHtml
      + `<span class="emoji">${w.emoji}</span>${labelHtml}${badges.join("")}`;

    attachWordCardLongPress(card, w, async () => {
      if (card._skipClick) return;
      recordWordUse(w.id);
      maybePromptRecommendedPins();
      await speakWord(w, card);
      state.sentence.push(w);
      renderStrip();
      if (!isHomeView) {
        card.classList.remove("word--xl", "word--lg", "word--md", "word--sm");
        card.classList.add(cardSizeClass(w));
      }
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!wordPressIgnored(e.target)) card.click();
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
    const pinBtn = card.querySelector(".pin-home");
    if (pinBtn) {
      pinBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
      pinBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (showUnpinBtn) {
          unpinWord(w.id);
          toast(t("unpinnedFromHome"));
          // Incremental: drop card from home without rebuilding the whole grid
          card.remove();
          if (!el.board.querySelector(".word") && state.kidView === "home") renderBoard();
        } else {
          const visible = wordsForKidView("home", mergeAllWords, settings.locale, state.dialect, { homeMax: getHomeMax() });
          const wasFull = visible.length >= getHomeMax();
          pinWord(w.id);
          toast(wasFull ? t("pinnedToHomeFull") : t("pinnedToHome"));
          // Pin can reshuffle home composition — full render
          renderBoard();
        }
        if (state.kidView === "more" || state.kidView === "home") updateBoardSection();
      });
    }
    const bringBtn = card.querySelector(".bring-top");
    if (bringBtn) {
      bringBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
      bringBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        bringWordToTop(viewKey, w.id, list.map(item => item.id));
        toast(t("broughtToTop"));
        renderBoard();
      });
    }

    el.board.appendChild(card);
  });

  if (isHomeView) {
    setupHomePointerReorder(el.board, viewKey);
  } else {
    setupBoardDragDrop(el.board, viewKey);
  }

  if (!list.length && state.kidView === "more") {
    const msg = document.createElement("p");
    msg.className = "empty-more muted";
    msg.textContent = moreSearchQuery.trim() ? t("moreSearchEmpty") : t("noTierMore");
    el.board.appendChild(msg);
  }
  setupRecordingPrefetch();
}

function chipLabelHtml(w) {
  const primary = labelForWord(w, settings.locale, state.dialect);
  if (!settings.bilingual || !settings.secondaryLocale) {
    return `<div class="lbl">${primary}</div>`;
  }
  const secondary = labelForWord(w, settings.secondaryLocale, state.dialect);
  if (secondary === primary) return `<div class="lbl">${primary}</div>`;
  return `<div class="lbl">${primary}</div><div class="lbl sub">${secondary}</div>`;
}

function renderStrip() {
  const stripCards = document.getElementById("strip");
  if (!stripCards) return;
  stripCards.innerHTML = "";
  state.sentence.forEach((w, index) => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "chip";
    c.setAttribute("aria-label", `${chipLabel(w)} — ${t("chipRemoveHint")}`);
    c.innerHTML = `<div class="emoji">${w.emoji}</div>${chipLabelHtml(w)}`;
    c.addEventListener("click", () => {
      state.sentence.splice(index, 1);
      renderStrip();
    });
    stripCards.appendChild(c);
  });
  const rtl = effectiveDir(settings.locale, settings.secondaryLocale, settings.bilingual) === "rtl";
  stripCards.scrollLeft = rtl ? 0 : stripCards.scrollWidth;
  updateCaregiverChrome();
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

function renderPendingRow(item, { online = false, globalRec = false } = {}) {
  const row = document.createElement("div");
  row.className = "pending-row";
  const label = globalRec && item.wordId ? labelForWordId(item.wordId) : item.text;
  const actions = (!online && !globalRec)
    ? `<span class="pending-actions">
        <button type="button" class="btn-approve" data-id="${item.id}">${t("approve")}</button>
        <button type="button" class="btn-reject" data-id="${item.id}">${t("reject")}</button>
      </span>`
    : `<span class="muted">${t("pendingNote")}</span>`;
  row.innerHTML = `
    <span>${globalRec ? "🎙️" : (item.emoji || "💬")} <strong>${label}</strong>
      <small>(${item.locale}${item.dialect ? ` / ${item.dialect}` : ""}${globalRec ? " · recording" : ` · ${item.category || ""}`})</small>
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
  let globalCount = 0;
  const onlineSection = document.getElementById("pendingOnlineSection");
  const onlineHint = document.getElementById("pendingOnlineHint");
  const globalList = document.getElementById("pendingGlobalList");
  const globalHint = document.getElementById("pendingGlobalHint");
  if (SUPABASE_READY && authUser && el.pendingOnlineList) {
    try {
      const [{ items }, globalPending] = await Promise.all([
        fetchOnlinePending(),
        fetchPendingGlobalRecordings()
      ]);
      onlineCount = items.length;
      globalCount = globalPending.items.length;
      const showOnline = items.length > 0 || globalPending.items.length > 0;
      if (showOnline) {
        onlineSection.hidden = false;
        onlineHint.textContent = t("pendingOnlineOwnHint");
        el.pendingOnlineList.innerHTML = "";
        if (items.length) {
          items.forEach(item => {
            el.pendingOnlineList.appendChild(renderPendingRow(item, { online: true }));
          });
        } else {
          el.pendingOnlineList.innerHTML = `<p class="muted">${t("noPendingWords")}</p>`;
        }
        if (globalList) {
          globalHint.textContent = t("pendingGlobalOwnHint");
          globalList.innerHTML = "";
          if (globalPending.items.length) {
            globalPending.items.forEach(item => {
              globalList.appendChild(renderPendingRow(item, { online: true, globalRec: true }));
            });
          } else {
            globalList.innerHTML = `<p class="muted">${t("noPendingWords")}</p>`;
          }
        }
      } else {
        onlineSection.hidden = true;
        el.pendingOnlineList.innerHTML = "";
        if (globalList) globalList.innerHTML = "";
      }
    } catch {
      onlineSection.hidden = true;
    }
  } else if (onlineSection) {
    onlineSection.hidden = true;
  }

  updatePendingBadge(pending.length + onlineCount + globalCount);

  const bindActions = (root) => {
    root.querySelectorAll(".btn-approve").forEach(btn => {
      btn.onclick = async () => {
        approveSubmission(btn.dataset.id);
        renderBoard();
        toast(t("wordApproved"));
        renderPendingQueue();
      };
    });
    root.querySelectorAll(".btn-reject").forEach(btn => {
      btn.onclick = async () => {
        rejectSubmission(btn.dataset.id);
        toast(t("wordRejected"));
        renderPendingQueue();
      };
    });
  };
  bindActions(el.pendingList);
}

function refreshAll() {
  applyChrome();
  populateContribCategories();
  renderLocaleSelect();
  renderDialectSelect();
  renderSettingsLocaleSelects();
  renderVoiceSelect();
  renderCats();
  renderBoard();
  renderStrip();
  renderPendingQueue();
  renderPersonalList();
  renderCustomWordsList();
}

/* ---------------- Settings panel ---------------- */
const openModals = new Set();
let modalFocusReturn = null;

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(el => !el.closest("[hidden]") && el.offsetParent !== null);
}

function syncMainInert() {
  const anyOpen = openModals.size > 0;
  document.body.querySelectorAll(":scope > *").forEach(child => {
    const isOpenModal = openModals.has(child.id);
    if (anyOpen && !isOpenModal) {
      child.inert = true;
      if (!child.hasAttribute("data-modal-aria-hidden")) {
        child.setAttribute("data-modal-aria-hidden", child.getAttribute("aria-hidden") ?? "");
      }
      child.setAttribute("aria-hidden", "true");
    } else {
      child.inert = false;
      if (child.hasAttribute("data-modal-aria-hidden")) {
        const prev = child.getAttribute("data-modal-aria-hidden");
        if (prev) child.setAttribute("aria-hidden", prev);
        else child.removeAttribute("aria-hidden");
        child.removeAttribute("data-modal-aria-hidden");
      } else if (!isOpenModal && child.hidden) {
        child.setAttribute("aria-hidden", "true");
      } else if (!isOpenModal && !child.hidden && child.matches(".panel, .recording-overlay")) {
        child.setAttribute("aria-hidden", "true");
      } else if (!isOpenModal && !child.hidden && !child.matches(".panel, .recording-overlay")) {
        child.removeAttribute("aria-hidden");
      }
    }
  });
}

function trapPanelFocus(e, panel) {
  if (e.key !== "Tab") return;
  const focusable = getFocusableElements(panel);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function closeTopModal() {
  const order = ["recordingOverlay", "recordAuthPanel", "settingsPanel"];
  for (const id of order) {
    if (!openModals.has(id)) continue;
    if (id === "recordingOverlay") {
      document.getElementById("recordingCancelBtn")?.click();
      return;
    }
    closePanel(document.getElementById(id));
    return;
  }
}

function openPanel(panel, { focusEl } = {}) {
  if (!panel || !panel.hidden) return;
  if (openModals.size === 0) modalFocusReturn = document.activeElement;
  panel.hidden = false;
  panel.setAttribute("aria-hidden", "false");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  openModals.add(panel.id);
  syncMainInert();

  const onBackdrop = (e) => {
    if (e.target === panel) closePanel(panel);
  };
  panel._modalBackdrop = onBackdrop;
  panel.addEventListener("click", onBackdrop);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeTopModal();
      return;
    }
    trapPanelFocus(e, panel);
  };
  panel._modalKeyDown = onKeyDown;
  panel.addEventListener("keydown", onKeyDown);

  requestAnimationFrame(() => {
    const target = focusEl || getFocusableElements(panel)[0];
    if (target) target.focus();
    else {
      panel.tabIndex = -1;
      panel.focus();
    }
  });
}

function closePanel(panel) {
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  panel.setAttribute("aria-hidden", "true");
  openModals.delete(panel.id);
  if (panel._modalKeyDown) {
    panel.removeEventListener("keydown", panel._modalKeyDown);
    panel._modalKeyDown = null;
  }
  if (panel._modalBackdrop) {
    panel.removeEventListener("click", panel._modalBackdrop);
    panel._modalBackdrop = null;
  }
  syncMainInert();
  if (openModals.size === 0 && modalFocusReturn?.focus) {
    modalFocusReturn.focus();
    modalFocusReturn = null;
  }
}

document.getElementById("settingsClose")?.addEventListener("click", () => closePanel(el.settingsPanel));

function expandBoardContribute({ focus = true } = {}) {
  closePanel(el.settingsPanel);
  const section = document.getElementById("boardContributeSection");
  const body = document.getElementById("boardContributeBody");
  const toggle = document.getElementById("boardContributeToggle");
  if (!section || !body || !toggle) return;
  body.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  section.classList.add("is-open");
  section.scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (focus) document.getElementById("boardContribText")?.focus();
}

function collapseBoardContribute() {
  const body = document.getElementById("boardContributeBody");
  const toggle = document.getElementById("boardContributeToggle");
  const section = document.getElementById("boardContributeSection");
  if (!body || !toggle) return;
  body.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  section?.classList.remove("is-open");
}

document.getElementById("contributeBtn")?.addEventListener("click", () => {
  expandBoardContribute();
});
document.getElementById("boardContributeToggle")?.addEventListener("click", () => {
  const body = document.getElementById("boardContributeBody");
  const toggle = document.getElementById("boardContributeToggle");
  const section = document.getElementById("boardContributeSection");
  if (!body || !toggle) return;
  const open = body.hidden;
  body.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  section?.classList.toggle("is-open", open);
  if (open) document.getElementById("boardContribText")?.focus();
});

el.localeSelect?.addEventListener("change", e => {
  settings = saveSettings({ locale: e.target.value });
  const loc = getLocale(settings.locale);
  const firstDialect = loc.dialects[0]?.id || "default";
  state.dialect = firstDialect;
  settings = saveSettings({ dialect: firstDialect, voiceURI: null });
  refreshCommunityForLocale(settings.locale).then(() => refreshAll()).catch(() => refreshAll());
});

el.dialectSelect?.addEventListener("change", e => {
  state.dialect = e.target.value;
  settings = saveSettings({ dialect: state.dialect, voiceURI: null });
  renderVoiceSelect();
  renderBoard();
  renderLangIndicator();
  loadGlobalRecordings(settings.locale, state.dialect).catch(() => {});
});

el.voiceSelect?.addEventListener("change", e => {
  settings = saveSettings({ voiceURI: e.target.value || null });
});

document.getElementById("previewVoiceBtn")?.addEventListener("click", () => {
  const lang = ttsLangFor(settings.locale, state.dialect);
  previewVoice(lang, null, settings.voiceURI);
});

document.getElementById("bilingualToggle")?.addEventListener("change", e => {
  settings = saveSettings({ bilingual: e.target.checked });
  refreshAll();
});

document.getElementById("secondaryLocaleSelect")?.addEventListener("change", e => {
  settings = saveSettings({ secondaryLocale: e.target.value || null });
  refreshAll();
});

document.getElementById("caregiverModeToggle")?.addEventListener("change", e => {
  settings = saveSettings({ caregiverMode: e.target.checked });
  updateCaregiverChrome();
  renderBoard();
});

document.getElementById("showAllOnHomeToggle")?.addEventListener("change", e => {
  settings = saveSettings({ showAllOnHome: e.target.checked });
  renderBoard();
  updateBoardSection();
});

document.getElementById("boardPresetSelect")?.addEventListener("change", e => {
  const value = e.target.value;
  const patch = { boardPreset: value };
  if (value === "full") patch.showAllOnHome = true;
  settings = saveSettings(patch);
  const showAllToggle = document.getElementById("showAllOnHomeToggle");
  if (showAllToggle && value === "full") showAllToggle.checked = true;
  renderBoard();
  updateBoardSection();
});

/* ---------------- Settings panel ---------------- */
function openSettings() {
  document.getElementById("accountSwitcher")?.setAttribute("hidden", "");
  document.getElementById("accountBadge")?.setAttribute("aria-expanded", "false");
  settingsSessionUnlocked = true;
  updateCaregiverChrome();
  renderUsageStats();
  switchSettingsTab(settingsTab || "general");
  openPanel(el.settingsPanel);
}

function setupSettings() {
  const settingsBtn = document.getElementById("settingsBtn");
  if (!settingsBtn) return;

  settingsBtn.addEventListener("click", () => openSettings());

  document.getElementById("resetUsageBtn")?.addEventListener("click", () => {
    if (!confirm(t("resetUsageConfirm"))) return;
    resetUsageStats();
    renderUsageStats();
    renderBoard();
    toast(t("usageReset"));
  });

  document.querySelectorAll(".settings-tab").forEach(btn => {
    btn.addEventListener("click", () => switchSettingsTab(btn.dataset.tab));
  });
}

function renderUsageStats() {
  const elStats = document.getElementById("usageStats");
  if (!elStats) return;
  const unique = getUniqueWordCount();
  elStats.textContent = `${unique} ${t("uniqueWords")}`;
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
  refreshCommunityForLocale(settings.locale).then(() => refreshAll()).catch(() => refreshAll());
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
function populateCategorySelect(sel) {
  if (!sel) return;
  sel.innerHTML = "";
  CATEGORIES.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = labelForCategory(c, settings.locale, state.dialect);
    sel.appendChild(o);
  });
}

function populateContribCategories() {
  populateCategorySelect(document.getElementById("contribCategory"));
  populateCategorySelect(document.getElementById("boardContribCategory"));
}

function resetContribRecordBtn(btn) {
  if (!btn) return;
  btn.textContent = `🎤 ${t("recordHint").replace(/\s*\(.*\)/, "")}`;
  btn.classList.remove("recording", "recorded");
}

function setupContribForm(prefix, { onSuccess } = {}) {
  const form = document.getElementById(`${prefix}Form`);
  const recordBtn = document.getElementById(`${prefix}RecordBtn`);
  const shareCheckboxId = prefix === "contrib" ? "contribShareOnline" : "boardContribShareOnline";
  if (!form) return;

  let rec = null;
  let chunks = [];
  let blob = null;

  recordBtn?.addEventListener("click", async () => {
    if (rec?.state === "recording") {
      rec.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast(t("micBlocked") || "This device can't record audio.");
      return;
    }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { toast(t("micBlocked") || "Microphone blocked."); return; }
    chunks = [];
    blob = null;
    rec = new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach(tr => tr.stop());
      blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      recordBtn.textContent = "✓ Recorded";
      recordBtn.classList.add("recorded");
    };
    recordBtn.textContent = "⏹ Stop";
    recordBtn.classList.add("recording");
    rec.start();
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const text = document.getElementById(`${prefix}Text`)?.value.trim();
    const category = document.getElementById(`${prefix}Category`)?.value;
    const emoji = document.getElementById(`${prefix}Emoji`)?.value.trim();
    if (!text) return;
    const shareOnline = document.getElementById(shareCheckboxId)?.checked === true;
    if (shareOnline) {
      const result = await submitCommunityWord({
        text,
        category,
        emoji: emoji || "💬",
        locale: settings.locale,
        dialect: state.dialect,
        audioBlob: blob,
        shareOnline: true
      });
      if (result?.needsAuth) {
        toast(t("signInForCommunity"));
        openPanel(el.settingsPanel);
        document.getElementById("caregiverUsername")?.focus();
        return;
      }
      if (result?.rejected) {
        toast(t("communityRejected"));
        return;
      }
      toast(t("communitySubmitted"));
    } else {
      const mod = moderateWordEntry(text, null, settings.locale);
      if (!mod.ok) {
        logModerationRejection(text, settings.locale, mod.reason);
        toast(t("communityRejected"));
        return;
      }
      await submitWord({
        text,
        category,
        emoji: emoji || "💬",
        locale: settings.locale,
        dialect: state.dialect,
        audioBlob: blob,
        shareOnline: false
      });
      toast(t("wordSavedLocal"));
    }
    form.reset();
    const shareEl = document.getElementById(shareCheckboxId);
    if (shareEl) shareEl.checked = false;
    blob = null;
    resetContribRecordBtn(recordBtn);
    renderPendingQueue();
    onSuccess?.();
  });
}

/* ---------------- Strip controls ---------------- */
document.getElementById("speakBtn")?.addEventListener("click", () => speakSentence());
document.getElementById("clearBtn")?.addEventListener("click", () => { state.sentence = []; renderStrip(); });
document.getElementById("backBtn")?.addEventListener("click", () => { state.sentence.pop(); renderStrip(); });

const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- Feature module wiring ---------------- */
function wireRecordingAndAuth() {
  initRecording({
    t,
    getSettings: () => settings,
    setSettings: (next) => { settings = next; },
    getState: () => state,
    getAuthUser: () => authUser,
    setAuthUser: (u) => { authUser = u; },
    canManagePersonalRecordings,
    promptSignInToRecord,
    toast,
    openPanel,
    closePanel,
    labelForWord,
    getLocale,
    getDialect,
    savePersonalRecording,
    playBlob,
    renderPersonalList: () => renderPersonalList(),
    renderPendingQueue: () => renderPendingQueue(),
    openRecordAuthPanel,
    setPendingCommunityShare: (v) => { pendingCommunityShareAfterAuth = v; },
    shareRecordingWithCommunity,
    saveSettings
  });
  bindRecordingOverlayButtons();

  initAuthUi({
    t,
    SUPABASE_READY,
    toast,
    openPanel,
    closePanel,
    getSettings: () => settings,
    getSettingsPanel: () => el.settingsPanel,
    getContributePanel: () => null,
    persistShareWithCommunity,
    getCurrentUser,
    setAuthUser: (u) => { authUser = u; },
    getAuthUser: () => authUser,
    renderAccountBadge,
    markManualAuthSession,
    displayUsername,
    initPersonal,
    checkIsAdmin,
    renderAdminLink,
    wait: (ms) => new Promise(r => setTimeout(r, ms)),
    takePendingRecordAfterAuth: () => {
      const p = pendingRecordAfterAuth;
      pendingRecordAfterAuth = null;
      return p;
    },
    takePendingCommunityShare: () => {
      const p = pendingCommunityShareAfterAuth;
      pendingCommunityShareAfterAuth = null;
      return p;
    },
    clearPendingAuthActions: () => {
      pendingRecordAfterAuth = null;
      pendingCommunityShareAfterAuth = null;
    },
    startRecording,
    shareRecordingWithCommunity,
    renderPendingQueue: () => renderPendingQueue(),
    validateUsername,
    validatePin,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    onAuthChange,
    updateCaregiverChrome,
    renderBoard,
    renderPersonalList: () => renderPersonalList(),
    renderCustomWordsList,
    openRecordAuthPanel,
    openAccountSettings
  });
}

function setupDarkModeToggle() {
  document.getElementById("darkModeToggle")?.addEventListener("change", (e) => {
    settings = saveSettings({ darkMode: !!e.target.checked });
    applyTheme();
  });
}

function setupLayoutExportImport() {
  document.getElementById("exportLayoutBtn")?.addEventListener("click", () => {
    const data = exportBoardLayout();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talkboard-layout-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(t("exportLayoutDone"));
  });
  document.getElementById("importLayoutBtn")?.addEventListener("click", () => {
    document.getElementById("importLayoutFile")?.click();
  });
  document.getElementById("importLayoutFile")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = importBoardLayout(data);
      if (!result.ok) {
        toast(t("importLayoutFailed"));
        return;
      }
      renderBoard();
      toast(t("importLayoutDone"));
    } catch {
      toast(t("importLayoutFailed"));
    }
  });
}

/* ---------------- Init ---------------- */
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
    const deleteHtml = canManagePersonalRecordings()
      ? `<button type="button" class="btn-reject btn-del-rec" data-id="${rec.wordId}">${t("deleteRecording")}</button>`
      : "";
    row.innerHTML = `
      <span>🎙️ <strong>${label}</strong> <small>(${rec.lang})</small></span>
      ${deleteHtml}`;
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
    const deleteHtml = canManagePersonalRecordings()
      ? `<button type="button" class="btn-reject btn-del-word" data-id="${w.id}">✕</button>`
      : "";
    row.innerHTML = `
      <span>${w.emoji} <strong>${labelForWord(w, settings.locale, state.dialect)}</strong></span>
      ${deleteHtml}`;
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
    if (!canManagePersonalRecordings()) {
      toast(t("signInToSaveVoice"));
      openAccountSettings();
      return;
    }
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
    if (!canManagePersonalRecordings()) {
      toast(t("signInToSaveVoice"));
      openAccountSettings();
      return;
    }
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

function setupContributorAuth() {
  const boardShareField = document.getElementById("boardShareOnlineField");
  if (!SUPABASE_READY) return;

  if (boardShareField) boardShareField.hidden = false;

  onAuthChange(async (user) => {
    if (user) {
      const r = await syncShareQueue();
      if (r.uploaded) toast(`Shared ${r.uploaded} contribution(s) online.`);
    }
  });
}

function populateSecondaryLocales() {
  const sel = document.getElementById("secondaryLocaleSelect");
  if (!sel) return;
  sel.innerHTML = `<option value="">—</option>`;
  LOCALES.forEach(loc => {
    if (loc.code === settings.locale) return;
    const o = document.createElement("option");
    o.value = loc.code;
    o.textContent = loc.nativeName;
    if (loc.code === settings.secondaryLocale) o.selected = true;
    sel.appendChild(o);
  });
  const bilingualToggle = document.getElementById("bilingualToggle");
  if (bilingualToggle) bilingualToggle.checked = settings.bilingual;
}

const COACH_STEPS = ["coachStep1", "coachStep2", "coachStep3"];

function setupCoach() {
  if (localStorage.getItem(COACH_KEY)) return;
  const overlay = document.getElementById("coachOverlay");
  const textEl = document.getElementById("coachText");
  const dotsEl = document.getElementById("coachDots");
  const nextBtn = document.getElementById("coachNextBtn");
  const skipBtn = document.getElementById("coachSkipBtn");
  if (!overlay || !textEl || !nextBtn || !skipBtn) return;

  let step = 0;

  const renderStep = () => {
    textEl.textContent = t(COACH_STEPS[step]);
    nextBtn.textContent = step >= COACH_STEPS.length - 1 ? t("coachDone") : t("coachNext");
    skipBtn.textContent = t("coachSkip");
    if (dotsEl) {
      dotsEl.innerHTML = COACH_STEPS.map((_, i) =>
        `<span class="${i === step ? "active" : ""}"></span>`
      ).join("");
    }
  };

  const finish = () => {
    localStorage.setItem(COACH_KEY, "1");
    overlay.hidden = true;
    openModals.delete("coachOverlay");
    syncMainInert();
    maybeShowInstallBanner();
  };

  const show = () => {
    renderStep();
    overlay.hidden = false;
    openModals.add("coachOverlay");
    syncMainInert();
    nextBtn.focus();
  };

  skipBtn.addEventListener("click", finish);
  nextBtn.addEventListener("click", () => {
    if (step >= COACH_STEPS.length - 1) finish();
    else { step++; renderStep(); }
  });

  requestAnimationFrame(() => {
    setTimeout(show, 600);
  });
}

function bumpVisitCount() {
  const n = parseInt(localStorage.getItem(VISITS_KEY) || "0", 10) + 1;
  localStorage.setItem(VISITS_KEY, String(n));
  return n;
}

function maybeShowInstallBanner() {
  const banner = document.getElementById("installBanner");
  if (!banner || deferredInstallPrompt) { /* wait for beforeinstallprompt */ }
  if (!banner || banner.hidden === false) return;
  if (window.matchMedia("(display-mode: standalone)").matches) return;
  if (localStorage.getItem("talkboard_install_dismissed")) return;
  const visits = parseInt(localStorage.getItem(VISITS_KEY) || "0", 10);
  const coachDone = !!localStorage.getItem(COACH_KEY);
  if (visits < 2 && !coachDone) return;
  if (!deferredInstallPrompt) return;
  document.getElementById("installBannerText").textContent = t("installAppHint");
  document.getElementById("installBannerBtn").textContent = t("installApp");
  document.getElementById("installBannerDismiss").textContent = t("installDismiss");
  banner.hidden = false;
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    maybeShowInstallBanner();
  });
  document.getElementById("installBannerBtn")?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => {});
    deferredInstallPrompt = null;
    document.getElementById("installBanner").hidden = true;
  });
  document.getElementById("installBannerDismiss")?.addEventListener("click", () => {
    localStorage.setItem("talkboard_install_dismissed", "1");
    document.getElementById("installBanner").hidden = true;
  });
}

function setupMoreSearch() {
  document.getElementById("moreSearch")?.addEventListener("input", (e) => {
    moreSearchQuery = e.target.value;
    renderBoard();
  });
}

async function checkServiceWorkerUpdate() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const res = await fetch("./sw.js", { cache: "no-store" });
    if (!res.ok) return;
    const text = await res.text();
    const match = text.match(/CACHE_VERSION = "([^"]+)"/);
    const version = match?.[1];
    if (!version) return;
    const prev = localStorage.getItem(SW_VERSION_KEY);
    if (prev && prev !== version) toast(t("swUpdated"));
    localStorage.setItem(SW_VERSION_KEY, version);
  } catch { /* offline */ }
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    toast(t("swUpdated"));
  });
}

function bootUI() {
  state.dialect = settings.dialect;
  bumpVisitCount();
  wireRecordingAndAuth();
  populateContribCategories();
  populateSecondaryLocales();
  setupContributorAuth();
  setupAccountBadge();
  setupContribForm("boardContrib", { onSuccess: () => collapseBoardContribute() });
  setupCaregiverAuth();
  setupRecordAuth();
  setupDarkModeToggle();
  setupLayoutExportImport();
  setupCustomWordForm();
  setupSettings();
  setupCoach();
  setupInstallPrompt();
  setupMoreSearch();
  checkServiceWorkerUpdate();
  evictAudioCachesIfNeeded().catch(() => {});
  refreshAll();
}

function safeBootUI() {
  try {
    bootUI();
  } catch (err) {
    console.error("[Talk Board] bootUI failed:", err);
    try {
      renderLocaleSelect();
      renderDialectSelect();
      renderCats();
      renderBoard();
    } catch (fallbackErr) {
      console.error("[Talk Board] fallback render failed:", fallbackErr);
    }
  }
}

function ensureBoardRendered() {
  requestAnimationFrame(() => {
    const hasCards = el.board?.querySelector(".word");
    const hasEmptyMsg = el.board?.querySelector(".empty-more");
    if (!hasCards && !hasEmptyMsg) {
      console.warn("[Talk Board] board empty after boot — re-rendering bundled words");
      refreshAll();
    }
  });
}

const LEGACY_AUTO_DOGGY_CLEARED = "talkboard_legacy_auto_doggy_cleared";

/** Marks an intentional sign-in so legacy auto-doggy cleanup does not sign the user out. */
function markManualAuthSession() {
  localStorage.setItem(LEGACY_AUTO_DOGGY_CLEARED, "1");
}

/** One-time sign-out for sessions left by the old auto doggy preload. */
async function clearLegacyAutoDoggySession(user) {
  if (!user || user.id !== DOGGY_USER_ID) return user;
  if (localStorage.getItem(LEGACY_AUTO_DOGGY_CLEARED)) return user;
  await signOut();
  return null;
}

async function preloadAuthAndData() {
  try {
    await loadRecordedKeys();
    const globalSync = loadGlobalRecordings(settings.locale, state.dialect);
    authUser = await clearLegacyAutoDoggySession(await getCurrentUser());
    renderAccountBadge(authUser);
    const tasks = [globalSync, initCommunity(settings.locale), loadRecordedKeys()];
    if (authUser && isOnline()) tasks.push(initPersonal(authUser));
    await Promise.allSettled(tasks);
    if (authUser) {
      checkIsAdmin().then(renderAdminLink).catch(() => renderAdminLink(false));
    } else {
      renderAdminLink(false);
    }
    refreshAll();
    if (isOnline()) {
      onAuthChange(user => {
        authUser = user || null;
        renderAccountBadge(authUser);
        renderBoard();
        renderPersonalList();
        renderCustomWordsList();
      });
    }
  } catch (err) {
    console.warn("[Talk Board] preloadAuthAndData:", err);
  }
}

(async function init() {
  initTTS();
  initNativeShell().catch(() => {});
  setupOfflineIndicator();
  setupSyncBanner();
  setupRecordingCachedListener();
  safeBootUI();
  ensureBoardRendered();
  preloadAuthAndData();
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
