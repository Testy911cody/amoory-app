/* Talk Board — MediaRecorder, overlay, long-press re-record */

/** Hold duration before card body starts re-record (ms). Short tap still speaks. */
export const WORD_LONG_PRESS_MS = 650;
/** Auto-stop recording after this many ms (~12s). */
export const MAX_RECORDING_MS = 12000;

export const WORD_PRESS_IGNORE = ".mic,.drag-handle,.pin-home,.bring-top,.send-bottom";

/** @type {null | {
 *   t: (k: string) => string,
 *   getSettings: () => object,
 *   getState: () => { dialect: string, category: string },
 *   getAuthUser: () => object | null,
 *   setAuthUser: (u: object | null) => void,
 *   canManagePersonalRecordings: () => boolean,
 *   promptSignInToRecord: (word: object, cardEl?: Element | null) => void,
 *   toast: (msg: string) => void,
 *   openPanel: (panel: Element, opts?: object) => void,
 *   closePanel: (panel: Element) => void,
 *   labelForWord: (w: object, locale: string, dialect: string) => string,
 *   getLocale: (code: string) => object,
 *   getDialect: (locale: string, dialect: string) => object,
 *   savePersonalRecording: Function,
 *   playBlob: (blob: Blob) => Promise<void>,
 *   renderPersonalList: () => void | Promise<void>,
 *   renderPendingQueue: () => void | Promise<void>,
 *   openRecordAuthPanel: (opts?: object) => void,
 *   setPendingCommunityShare: (v: object | null) => void,
 *   shareRecordingWithCommunity: (word: object, blob: Blob) => Promise<object>,
 *   saveSettings: (partial: object) => object,
 *   setSettings: (s: object) => void,
 * }} */
let ctx = null;

let mediaRec = null;
let recChunks = [];
let recStream = null;
let recTimer = null;
let recMaxTimer = null;
let recStart = 0;
let recordingWord = null;
let recordingCard = null;

export function initRecording(deps) {
  ctx = deps;
}

export function wordPressIgnored(target) {
  return target?.closest?.(WORD_PRESS_IGNORE);
}

export function isCurrentlyRecording() {
  return mediaRec?.state === "recording";
}

function readShareWithCommunity() {
  const el = document.getElementById("caregiverShareCommunity")
    || document.getElementById("recordAuthShareCommunity");
  if (el) return el.checked;
  return ctx.getSettings().shareWithCommunity !== false;
}

export function persistShareWithCommunity(checked) {
  const settings = ctx.saveSettings({ shareWithCommunity: !!checked });
  ctx.setSettings(settings);
  const ids = ["caregiverShareCommunity", "recordAuthShareCommunity"];
  ids.forEach(id => {
    const box = document.getElementById(id);
    if (box) box.checked = !!checked;
  });
}

function showRecordingUI(word) {
  const overlay = document.getElementById("recordingOverlay");
  const label = document.getElementById("recordingLabel");
  const langLbl = document.getElementById("recordingLang");
  if (!overlay) return;
  const settings = ctx.getSettings();
  const state = ctx.getState();
  const text = ctx.labelForWord(word, settings.locale, state.dialect);
  const loc = ctx.getLocale(settings.locale);
  const dia = ctx.getDialect(settings.locale, state.dialect);
  label.textContent = `${ctx.t("recordingFor")} "${text}"`;
  langLbl.textContent = `${ctx.t("recordingIn")} ${dia.nativeName || loc.nativeName}`;
  const progress = document.getElementById("recordingProgress");
  if (progress) {
    progress.max = MAX_RECORDING_MS;
    progress.value = 0;
    progress.hidden = false;
  }
  ctx.openPanel(overlay, { focusEl: document.getElementById("recordingStopBtn") });
}

function hideRecordingUI() {
  const overlay = document.getElementById("recordingOverlay");
  if (!overlay) return;
  ctx.closePanel(overlay);
  const timer = document.getElementById("recordingTimer");
  if (timer) timer.textContent = "0:00";
  const progress = document.getElementById("recordingProgress");
  if (progress) {
    progress.value = 0;
    progress.hidden = true;
  }
  clearInterval(recTimer);
  recTimer = null;
  clearTimeout(recMaxTimer);
  recMaxTimer = null;
}

function updateRecTimer() {
  const elTimer = document.getElementById("recordingTimer");
  if (!elTimer) return;
  const elapsed = Date.now() - recStart;
  const sec = Math.floor(elapsed / 1000);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  elTimer.textContent = `${m}:${s}`;
  const progress = document.getElementById("recordingProgress");
  if (progress) progress.value = Math.min(elapsed, MAX_RECORDING_MS);
}

/** Long-press on card body → re-record; tap → onTap (speak). Ignores mic / drag / pin. */
export function attachWordCardLongPress(card, word, onTap) {
  let pressTimer = null;
  let longPressFired = false;

  card.addEventListener("pointerdown", (e) => {
    if (wordPressIgnored(e.target)) return;
    if (e.button > 0) return;
    longPressFired = false;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      longPressFired = true;
      if (!ctx.canManagePersonalRecordings()) {
        ctx.promptSignInToRecord(word, card);
        return;
      }
      card.classList.add("long-press-active");
      navigator.vibrate?.(35);
      ctx.toast(ctx.t("reRecording"));
      startRecording(word, card);
    }, WORD_LONG_PRESS_MS);
  });

  const cancelPress = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    card.classList.remove("long-press-active");
  };
  card.addEventListener("pointerup", cancelPress);
  card.addEventListener("pointerleave", cancelPress);
  card.addEventListener("pointercancel", cancelPress);

  card.addEventListener("click", async (e) => {
    if (wordPressIgnored(e.target)) return;
    if (longPressFired) {
      longPressFired = false;
      return;
    }
    await onTap();
  });
}

export async function finishRecordingSave(w, blob, card) {
  const settings = ctx.getSettings();
  const state = ctx.getState();
  const shareWithCommunity = readShareWithCommunity();
  await ctx.savePersonalRecording(w.id, settings.locale, state.dialect, blob, ctx.getAuthUser(), { shareWithCommunity });

  card?.classList.add("has-rec");
  if (card && !card.querySelector(".reciic")) {
    const tick = document.createElement("span");
    tick.className = "reciic"; tick.textContent = "🎙️"; card.appendChild(tick);
  }
  await ctx.playBlob(blob);
  await ctx.renderPersonalList();

  if (!shareWithCommunity) {
    ctx.toast(ctx.t("savedVoice"));
    return;
  }

  const { getCurrentUser } = await import("../supabase.js");
  const user = ctx.getAuthUser() || await getCurrentUser();
  if (!user) {
    ctx.setPendingCommunityShare({ word: w, blob });
    ctx.openRecordAuthPanel({ forCommunity: true });
    ctx.toast(ctx.t("savedLocalOnly"));
    return;
  }

  ctx.setAuthUser(user);
  const result = await ctx.shareRecordingWithCommunity(w, blob);
  if (result?.rejected) {
    ctx.toast(ctx.t("communityRejected"));
    return;
  }
  if (result?.ok || result?.entry) {
    ctx.toast(ctx.t("communitySubmitted"));
    await ctx.renderPendingQueue();
  }
}

export async function startRecording(word, cardEl) {
  if (!ctx.canManagePersonalRecordings()) {
    ctx.promptSignInToRecord(word, cardEl);
    return;
  }
  if (mediaRec?.state === "recording") { mediaRec.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    ctx.toast(ctx.t("micBlocked") || "This device can't record audio."); return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { ctx.toast(ctx.t("micBlocked")); return; }

  recordingWord = word;
  recordingCard = cardEl;
  recChunks = [];
  recStream = stream;
  mediaRec = new MediaRecorder(stream);
  mediaRec.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
  mediaRec.onstop = async () => {
    clearTimeout(recMaxTimer);
    recMaxTimer = null;
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
        if (err?.message === "auth-required") {
          ctx.toast(ctx.t("signInToSaveVoice"));
          ctx.promptSignInToRecord(w, card);
        } else {
          ctx.toast(ctx.t("uploadFailed"));
        }
      }
    }
    mediaRec = null;
  };

  cardEl?.classList.add("recording");
  showRecordingUI(word);
  recStart = Date.now();
  recTimer = setInterval(updateRecTimer, 200);
  updateRecTimer();
  mediaRec.start();
  recMaxTimer = setTimeout(() => {
    if (mediaRec?.state === "recording") {
      ctx.toast(ctx.t("recordingMaxReached"));
      mediaRec.stop();
    }
  }, MAX_RECORDING_MS);
}

export function stopActiveRecording() {
  if (mediaRec?.state === "recording") mediaRec.stop();
}

export function cancelActiveRecording() {
  if (mediaRec?.state === "recording") {
    recordingWord = null;
    recordingCard?.classList.remove("recording");
    recordingCard = null;
    mediaRec.onstop = () => {
      clearTimeout(recMaxTimer);
      recMaxTimer = null;
      recStream?.getTracks().forEach(tr => tr.stop());
      recStream = null;
      hideRecordingUI();
      mediaRec = null;
    };
    mediaRec.stop();
  } else {
    hideRecordingUI();
  }
}

export function bindRecordingOverlayButtons() {
  document.getElementById("recordingStopBtn")?.addEventListener("click", () => {
    stopActiveRecording();
  });
  document.getElementById("recordingCancelBtn")?.addEventListener("click", () => {
    cancelActiveRecording();
  });
}
