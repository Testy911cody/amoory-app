/* Talk Board — locale & dialect registry
   Any language can be added here; words fall back to English labels until
   community contributors add translations. TTS uses Web Speech API voices. */

export const LOCALES = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    dir: "ltr",
    ttsLang: "en-US",
    dialects: [
      { id: "us", name: "US", nativeName: "US", ttsLang: "en-US" },
      { id: "gb", name: "British", nativeName: "British", ttsLang: "en-GB" },
      { id: "au", name: "Australian", nativeName: "Australian", ttsLang: "en-AU" }
    ]
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    dir: "rtl",
    ttsLang: "ar-EG",
    dialects: [
      { id: "sd", name: "Sudanese", nativeName: "سوداني", ttsLang: "ar-SD" },
      { id: "juba", name: "Juba Arabic", nativeName: "عربي جوبا", ttsLang: "ar" },
      { id: "eg", name: "Egyptian", nativeName: "مصري", ttsLang: "ar-EG" },
      { id: "msa", name: "Standard Arabic", nativeName: "فصحى", ttsLang: "ar" },
      { id: "lev", name: "Levantine", nativeName: "شامي", ttsLang: "ar-LB" },
      { id: "mag", name: "Maghrebi", nativeName: "مغاربي", ttsLang: "ar-MA" }
    ]
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    dir: "ltr",
    ttsLang: "fr-FR",
    dialects: [
      { id: "fr", name: "France", nativeName: "France", ttsLang: "fr-FR" },
      { id: "ca", name: "Canadian", nativeName: "Canadien", ttsLang: "fr-CA" }
    ]
  },
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    dir: "ltr",
    ttsLang: "es-ES",
    dialects: [
      { id: "es", name: "Spain", nativeName: "España", ttsLang: "es-ES" },
      { id: "mx", name: "Mexican", nativeName: "México", ttsLang: "es-MX" },
      { id: "ar", name: "Argentine", nativeName: "Argentina", ttsLang: "es-AR" }
    ]
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    dir: "ltr",
    ttsLang: "de-DE",
    dialects: []
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    dir: "ltr",
    ttsLang: "hi-IN",
    dialects: []
  },
  {
    code: "sw",
    name: "Swahili",
    nativeName: "Kiswahili",
    dir: "ltr",
    ttsLang: "sw-KE",
    dialects: []
  },
  {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    dir: "ltr",
    ttsLang: "pt-BR",
    dialects: [
      { id: "br", name: "Brazilian", nativeName: "Brasil", ttsLang: "pt-BR" },
      { id: "pt", name: "European", nativeName: "Portugal", ttsLang: "pt-PT" }
    ]
  },
  {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
    dir: "rtl",
    ttsLang: "ur-PK",
    dialects: []
  },
  {
    code: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
    dir: "ltr",
    ttsLang: "tr-TR",
    dialects: []
  }
];

export const UI_STRINGS = {
  en: {
    title: "Talk Board",
    say: "Say",
    hint: "Tap pictures to build a sentence",
    dialect: "Dialect",
    language: "Language",
    voice: "Voice",
    preview: "Preview",
    settings: "Settings",
    contribute: "Suggest word",
    bilingual: "Show second language",
    secondaryLang: "Second language",
    submit: "Submit",
    cancel: "Cancel",
    wordText: "Word",
    category: "Category",
    emoji: "Emoji (optional)",
    recordHint: "Record audio (optional)",
    pendingNote: "Submitted — waiting for approval",
    approved: "Approved",
    reject: "Reject",
    approve: "Approve",
    pendingQueue: "Pending submissions",
    noVoice: "No voice found for this language. Install one in device settings.",
    savedVoice: "Saved your voice for this word.",
    communityAdded: "Word submitted for review.",
    sourceTts: "computer voice",
    sourceCommunity: "community",
    sourceBuiltin: "built-in",
    close: "Close"
  },
  ar: {
    title: "لوحة الكلام",
    say: "قول",
    hint: "دوس على الصور عشان تكوّن جملة",
    dialect: "اللهجة",
    language: "اللغة",
    voice: "الصوت",
    preview: "جرّب",
    settings: "الإعدادات",
    contribute: "اقترح كلمة",
    bilingual: "عرض لغة ثانية",
    secondaryLang: "اللغة الثانية",
    submit: "إرسال",
    cancel: "إلغاء",
    wordText: "الكلمة",
    category: "الفئة",
    emoji: "رمز (اختياري)",
    recordHint: "سجّل صوت (اختياري)",
    pendingNote: "تم الإرسال — بانتظار الموافقة",
    approved: "موافق عليه",
    reject: "رفض",
    approve: "موافقة",
    pendingQueue: "اقتراحات بانتظار المراجعة",
    noVoice: "ما في صوت لهذه اللغة. ثبّت صوت من إعدادات الجهاز.",
    savedVoice: "تم حفظ صوتك لهذه الكلمة.",
    communityAdded: "تم إرسال الكلمة للمراجعة.",
    sourceTts: "صوت الجهاز",
    sourceCommunity: "المجتمع",
    sourceBuiltin: "مدمج",
    close: "إغلاق"
  }
};

const SETTINGS_KEY = "talkboard_settings";

export function getLocale(code) {
  return LOCALES.find(l => l.code === code) || LOCALES[0];
}

export function getDialect(localeCode, dialectId) {
  const loc = getLocale(localeCode);
  const list = loc.dialects.length ? loc.dialects : [{ id: "default", name: loc.name, nativeName: loc.nativeName, ttsLang: loc.ttsLang }];
  return list.find(d => d.id === dialectId) || list[0];
}

export function uiString(localeCode, key) {
  const pack = UI_STRINGS[localeCode] || UI_STRINGS.en;
  return pack[key] || UI_STRINGS.en[key] || key;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {}
  return defaultSettings();
}

export function saveSettings(partial) {
  const next = { ...loadSettings(), ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function defaultSettings() {
  return {
    locale: "en",
    dialect: "us",
    secondaryLocale: null,
    bilingual: false,
    voiceURI: null
  };
}

export function ttsLangFor(localeCode, dialectId) {
  const d = getDialect(localeCode, dialectId);
  return d.ttsLang || getLocale(localeCode).ttsLang;
}

export function effectiveDir(localeCode, secondaryLocale, bilingual) {
  if (!bilingual || !secondaryLocale) return getLocale(localeCode).dir;
  const a = getLocale(localeCode).dir;
  const b = getLocale(secondaryLocale).dir;
  return a === "rtl" || b === "rtl" ? "rtl" : "ltr";
}
