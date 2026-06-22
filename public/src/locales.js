/* Talk Board — locale & dialect registry
   Dialects use dialect-specific translations (e.g. ar-SD) when present, else base lang text.
   TTS receives the *translated text* + correct lang code (not English with accent). */

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
    close: "Close",
    schedule: "First / Then schedule",
    scheduleSubhint: "Visual routine: first do one activity, then the next step or reward.",
    first: "First",
    then: "Then",
    scheduleHint: "Pick a picture for First and for Then.",
    scheduleBtnTitle: "First / Then schedule",
    tapToChoose: "Tap to choose",
    allDone: "All done!",
    signIn: "Sign in",
    signOut: "Sign out",
    contributor: "Contributor",
    shareOnline: "Share with the community online",
    kidHint: "Tap a picture to talk",
    viewHome: "Talk",
    viewNeed: "Need",
    viewFeel: "Feel",
    viewMore: "More words",
    moreWordsHint: "Extra words beyond the home screen. Tap a card to speak.",
    moreUnlocking: "More words unlock as you use the board.",
    noTierMore: "No extra words yet — a caregiver can unlock more in settings.",
    caregiverMode: "Caregiver mode",
    exitCaregiver: "Back to kid view",
    caregiverHint: "Tap ⚙️ to open caregiver settings",
    enterPin: "Enter PIN",
    setPin: "Set caregiver PIN (optional)",
    resetUsage: "Reset word usage stats",
    unlockTier: "Unlock word tier early",
    tierLabel: "Words unlocked up to tier",
    fullBoard: "Show all categories",
    uniqueWords: "unique words used",
    account: "Your account",
    accountHint: "Sign in to sync recordings to the cloud and contribute free words to the community library. Recordings save on this device without an account.",
    accountUsername: "Username",
    accountUsernamePlaceholder: "your_name",
    accountPassword: "PIN",
    accountPinPlaceholder: "••••",
    accountSignIn: "Sign in",
    accountSignUp: "Create account",
    signedInAs: "Signed in as",
    signUpSuccess: "Account created.",
    usernameInvalid: "Use at least 3 letters, numbers, or underscores.",
    passwordTooShort: "PIN must be exactly 4 digits.",
    wrongCredentials: "Wrong username or PIN.",
    usernameTaken: "That username is already taken.",
    recordingFor: "Recording your voice for",
    recordingIn: "in",
    recordingStop: "Stop recording",
    recordingCancel: "Cancel",
    deleteRecording: "Delete my recording",
    myWords: "My words",
    addMyWord: "Add my word",
    wordLabel: "Word label",
    englishHint: "English hint (optional)",
    personalRecordings: "Your personal recordings",
    noPersonalRecordings: "No personal recordings yet for this language.",
    uploadFailed: "Could not upload — saved on this device only.",
    micBlocked: "Microphone blocked. Allow access in browser settings.",
    wrongPin: "Wrong PIN",
    recordNeedsAccount: "Create an account to save your voice recordings.",
    shareWithCommunity: "Share with community",
    shareWithCommunityHint: "Contribute free words to the community dialect library",
    communityRejected: "This word can't be shared with the community.",
    communitySubmitted: "Submitted for review.",
    savedLocalOnly: "Saved on this device.",
    signInForCommunity: "Sign in to contribute to the community library.",
    accountNotConfigured: "Account sign-up is not set up yet. Contact the app administrator.",
    accountConfirmNeeded: "Account created but not active. The administrator must disable email confirmation in Supabase (Auth → Providers → Email).",
    authLoading: "Please wait…",
    authErrorTitle: "Could not sign in",
    settingsTabGeneral: "Settings",
    settingsTabPending: "Pending words",
    settingsTabAllCards: "All cards",
    pendingWordsTitle: "Approve new words",
    pendingWordsHint: "Tap Approve to add a word to the board on this device. Reject to discard it.",
    pendingLocalTitle: "On this device",
    pendingOnlineTitle: "Community library",
    pendingOnlineHint: "Words shared online. Admins can approve them for everyone.",
    pendingOnlineOwnHint: "Your submissions waiting for a moderator.",
    noPendingWords: "No words waiting for approval.",
    allCardsTitle: "All word cards",
    allCardsHint: "Every word available on the board for the current language and dialect. Kids can browse them under More words on the main board.",
    allCardsCount: "{n} words across {c} categories",
    wordApproved: "Word approved!",
    wordRejected: "Word rejected."
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
    close: "إغلاق",
    schedule: "جدول: الأول / بعدين",
    scheduleSubhint: "روتين بصري: أولاً نشاط واحد، ثم الخطوة التالية أو المكافأة.",
    first: "الأول",
    then: "بعدين",
    scheduleHint: "اختار صورة لـ«الأول» وصورة لـ«بعدين».",
    scheduleBtnTitle: "جدول الأول / بعدين",
    tapToChoose: "دوس عشان تختار",
    allDone: "خلصنا!",
    signIn: "تسجيل الدخول",
    signOut: "تسجيل الخروج",
    contributor: "مساهم",
    shareOnline: "شارك مع المجتمع أونلاين",
    kidHint: "دوس على الصورة عشان تتكلم",
    viewHome: "كلام",
    viewNeed: "محتاج",
    viewFeel: "حاسس",
    viewMore: "كلمات أكثر",
    moreWordsHint: "كلمات إضافية غير الشاشة الرئيسية. دوس على البطاقة عشان تتكلم.",
    moreUnlocking: "كلمات أكثر تفتح كل ما تستخدم اللوحة.",
    noTierMore: "ما في كلمات إضافية بعد — مقدّم الرعاية يقدر يفتح أكثر من الإعدادات.",
    caregiverMode: "وضع مقدّم الرعاية",
    exitCaregiver: "رجوع لوضع الطفل",
    caregiverHint: "دوس على ⚙️ لفتح إعدادات مقدّم الرعاية",
    enterPin: "أدخل الرمز",
    wrongPin: "الرمز خاطئ",
    setPin: "رمز مقدّم الرعاية (اختياري)",
    resetUsage: "مسح إحصائيات الاستخدام",
    unlockTier: "فتح مستوى كلمات مبكراً",
    tierLabel: "الكلمات المفتوحة حتى المستوى",
    fullBoard: "عرض كل الفئات",
    uniqueWords: "كلمات مختلفة مستخدمة",
    account: "حسابك",
    accountHint: "سجّل دخولك لمزامنة التسجيلات في السحابة والمساهمة بكلمات مجانية لمكتبة المجتمع. التسجيلات تُحفظ على الجهاز بدون حساب.",
    accountUsername: "اسم المستخدم",
    accountUsernamePlaceholder: "اسمك",
    accountPassword: "رمز PIN",
    accountPinPlaceholder: "••••",
    accountSignIn: "دخول",
    accountSignUp: "إنشاء حساب",
    signedInAs: "مسجّل كـ",
    signUpSuccess: "تم إنشاء الحساب.",
    usernameInvalid: "استخدم 3 أحرف على الأقل (حروف أو أرقام أو _).",
    passwordTooShort: "رمز PIN من 4 أرقام بالضبط.",
    wrongCredentials: "اسم المستخدم أو رمز PIN غير صحيح.",
    usernameTaken: "اسم المستخدم مستخدم بالفعل.",
    recordingFor: "بتسجّل صوتك لـ",
    recordingIn: "بـ",
    recordingStop: "وقف التسجيل",
    recordingCancel: "إلغاء",
    deleteRecording: "امسح تسجيلي",
    myWords: "كلماتي",
    addMyWord: "أضف كلمة",
    wordLabel: "نص الكلمة",
    englishHint: "تلميح إنجليزي (اختياري)",
    personalRecordings: "تسجيلاتك الشخصية",
    noPersonalRecordings: "ما في تسجيلات شخصية لهذه اللغة بعد.",
    uploadFailed: "ما اترفع — اتحفظ على الجهاز بس.",
    micBlocked: "الميكروفون مقفول. اسمح بالوصول من إعدادات المتصفح.",
    recordNeedsAccount: "أنشئ حساباً عشان تحفظ تسجيلات صوتك.",
    shareWithCommunity: "شارك مع المجتمع",
    shareWithCommunityHint: "ساهم بكلمات مجانية لمكتبة لهجة المجتمع",
    communityRejected: "ما تقدر تشارك هذه الكلمة مع المجتمع.",
    communitySubmitted: "تم الإرسال للمراجعة.",
    savedLocalOnly: "اتحفظ على هذا الجهاز.",
    signInForCommunity: "سجّل دخولك عشان تساهم في مكتبة المجتمع.",
    accountNotConfigured: "إنشاء الحساب غير متاح حالياً.",
    accountConfirmNeeded: "تم إنشاء الحساب لكنه غير مفعّل. يجب على المسؤول تعطيل تأكيد البريد في Supabase (Auth → Providers → Email).",
    authLoading: "انتظر…",
    authErrorTitle: "تعذّر تسجيل الدخول",
    settingsTabGeneral: "الإعدادات",
    settingsTabPending: "كلمات للموافقة",
    settingsTabAllCards: "كل البطاقات",
    pendingWordsTitle: "وافق على كلمات جديدة",
    pendingWordsHint: "اضغط «موافقة» لإضافة الكلمة للوحة على هذا الجهاز. «رفض» لحذفها.",
    pendingLocalTitle: "على هذا الجهاز",
    pendingOnlineTitle: "مكتبة المجتمع",
    pendingOnlineHint: "كلمات مشتركة أونلاين. المسؤول يوافق عليها للجميع.",
    pendingOnlineOwnHint: "مساهماتك بانتظار مراجعة المسؤول.",
    noPendingWords: "ما في كلمات بانتظار الموافقة.",
    allCardsTitle: "كل بطاقات الكلمات",
    allCardsHint: "كل الكلمات المتاحة على اللوحة للغة واللهجة الحالية. الطفل يقدر يتصفّحها من «كلمات أكثر» على اللوحة.",
    allCardsCount: "{n} كلمة في {c} فئات",
    wordApproved: "تمت الموافقة!",
    wordRejected: "تم الرفض."
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

function normalizeSettings(s) {
  const defaults = defaultSettings();
  const loc = LOCALES.find(l => l.code === s.locale);
  if (!loc) {
    s.locale = defaults.locale;
    s.dialect = defaults.dialect;
    return s;
  }
  const dialects = loc.dialects.length
    ? loc.dialects
    : [{ id: "default", name: loc.name, nativeName: loc.nativeName }];
  if (!dialects.some(d => d.id === s.dialect)) {
    s.dialect = dialects[0]?.id || defaults.dialect;
  }
  return s;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return normalizeSettings({ ...defaultSettings(), ...JSON.parse(raw) });
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
    locale: "ar",
    dialect: "sd",
    secondaryLocale: null,
    bilingual: false,
    voiceURI: null,
    caregiverPin: null,
    caregiverActive: false,
    fullBoard: false,
    shareWithCommunity: true
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
