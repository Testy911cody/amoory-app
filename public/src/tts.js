/* Talk Board — Web Speech API (free, built-in TTS)
   Receives translated text (not English) + BCP-47 lang. Falls back to any ar voice for ar-SD etc.
   Personal/community audio (per lang) take precedence. */

let voices = [];
let warnedLocales = new Set();

export function initTTS() {
  if (!("speechSynthesis" in window)) return;
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
  setTimeout(loadVoices, 250);
  setTimeout(loadVoices, 1000);
}

export function loadVoices() {
  voices = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  return voices;
}

export function getVoices() {
  if (!voices.length) loadVoices();
  return voices;
}

function langPrefix(tag) {
  return (tag || "").toLowerCase().replace("_", "-").split("-")[0];
}

function langMatches(voiceLang, targetLang) {
  const v = (voiceLang || "").toLowerCase().replace("_", "-");
  const t = (targetLang || "").toLowerCase().replace("_", "-");
  if (!v || !t) return false;
  if (v === t) return true;
  if (v.startsWith(t + "-") || t.startsWith(v + "-")) return true;
  return langPrefix(v) === langPrefix(t);
}

/** Pick the best voice for a BCP-47 language tag, optionally pinned by voiceURI. */
export function voiceFor(ttsLang, voiceURI = null) {
  if (!voices.length) loadVoices();
  if (voiceURI) {
    const pinned = voices.find(v => v.voiceURI === voiceURI);
    if (pinned) return pinned;
  }
  if (!ttsLang) return voices[0] || null;

  const exact = voices.find(v => langMatches(v.lang, ttsLang));
  if (exact) return exact;

  const prefix = langPrefix(ttsLang);
  const byPrefix = voices.find(v => langPrefix(v.lang) === prefix);
  if (byPrefix) return byPrefix;

  // Arabic dialects (e.g. ar-SD) often lack a dedicated voice — try common Arabic tags
  if (prefix === "ar") {
    const fallbacks = ["ar-SA", "ar-EG", "ar-AE", "ar"];
    for (const tag of fallbacks) {
      const v = voices.find(vo => langMatches(vo.lang, tag));
      if (v) return v;
    }
  }

  return null;
}

/** Voices available for a locale (for picker UI). */
export function voicesForLocale(ttsLang) {
  if (!voices.length) loadVoices();
  const prefix = langPrefix(ttsLang);
  const matched = voices.filter(v => langPrefix(v.lang) === prefix);
  if (matched.length) return matched;
  return voices.filter(v => langMatches(v.lang, ttsLang));
}

export function say(text, ttsLang, opts = {}) {
  if (!("speechSynthesis" in window)) {
    return Promise.reject(new Error("no-speech"));
  }
  if (!text || !String(text).trim()) return Promise.resolve();
  if (!voices.length) loadVoices();

  const v = voiceFor(ttsLang, opts.voiceURI);
  if (!v && !warnedLocales.has(ttsLang)) {
    warnedLocales.add(ttsLang);
    console.warn(`[TTS] No dedicated voice for ${ttsLang}. Will attempt synthesis using lang tag (text will still be spoken in target language if synth supports it).`);
  }

  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).trim());
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else {
    // For Sudanese Arabic (ar-SD) browsers often lack exact, fall back to 'ar' for better synth support while using Arabic text
    let utterLang = ttsLang || "en-US";
    if (ttsLang === "ar-SD" || ttsLang === "ar-sd") utterLang = "ar";
    u.lang = utterLang;
  }
  u.rate = opts.rate ?? 0.82;
  u.pitch = opts.pitch ?? 1.05;

  return new Promise(resolve => {
    u.onend = resolve;
    u.onerror = resolve;
    setTimeout(() => speechSynthesis.speak(u), 30);
  });
}

export function previewVoice(ttsLang, sampleText, voiceURI = null) {
  const sample = sampleText || previewSampleFor(ttsLang);
  return say(sample, ttsLang, { voiceURI });
}

function previewSampleFor(ttsLang) {
  const p = langPrefix(ttsLang);
  const samples = {
    en: "Hello, this is how I sound.",
    ar: "مرحباً، هكذا أبدو.",
    fr: "Bonjour, voici ma voix.",
    es: "Hola, así sueno.",
    de: "Hallo, so klinge ich.",
    hi: "नमस्ते, मैं ऐसी आवाज़ करता हूँ।",
    sw: "Habari, hivi ndivyo ninavyosikika.",
    pt: "Olá, é assim que eu soo.",
    ur: "سلام، میری آواز یوں ہے۔",
    tr: "Merhaba, sesim böyle."
  };
  return samples[p] || samples.en;
}

export function unlockAudio() {
  if (!("speechSynthesis" in window)) return;
  loadVoices();
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}
