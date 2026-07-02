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
    contributeHint: "Add a new word to the board. It stays pending until you approve it in settings.",
    contributeNote: "Submissions stay pending until approved. Sign in under ⚙️ settings to share with the community online.",
    bilingual: "Show second language",
    secondaryLang: "Second language",
    submit: "Submit",
    cancel: "Cancel",
    pinContinue: "Continue",
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
    signIn: "Sign in",
    signOut: "Sign out",
    contributor: "Contributor",
    shareOnline: "Share with the community online",
    kidHintGuest: "Tap a picture to talk",
    kidHintCaregiver: "Tap a picture to talk · hold to re-record",
    settingsHoldHint: "Settings (hold 2 seconds)",
    holdToReRecord: "Hold to re-record",
    reRecording: "Recording…",
    viewHome: "Talk",
    viewNeed: "Need",
    viewFeel: "Feel",
    viewMore: "More words",
    moreWordsHint: "Extra words beyond the home screen. Tap a card to speak. Tap ⭐ Add to main to pin a word on Talk.",
    noTierMore: "Every word is on the home screen — pin favorites from More words to keep them handy.",
    pinToHome: "Add to main",
    unpinFromHome: "Remove from main",
    pinnedToHome: "Added to main board",
    pinnedToHomeFull: "Pinned on Talk — least-used auto words moved to More",
    unpinnedFromHome: "Removed from main board",
    dragToReorder: "Drag to reorder",
    bringToTop: "Bring to top",
    broughtToTop: "Moved to top",
    resetUsage: "Reset word usage stats",
    uniqueWords: "unique words used",
    usageReset: "Usage stats reset.",
    account: "Your account",
    accountHint: "Sign in to sync recordings to the cloud and contribute free words to the community library. Recordings save on this device without an account.",
    accountUsername: "Username",
    accountUsernamePlaceholder: "your_name",
    accountPassword: "PIN",
    accountPinPlaceholder: "••••",
    accountSignIn: "Sign in",
    accountSignUp: "Create account",
    signedInAs: "Signed in as",
    accountBadgeHint: "tap for account & sign out",
    guestAccount: "Guest",
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
    recordNeedsAccount: "Create an account to save your voice recordings.",
    signInToSaveVoice: "Sign in to save your voice.",
    shareWithCommunity: "Share with community",
    shareWithCommunityHint: "Contribute free words to the community dialect library",
    communityRejected: "This word can't be shared with the community.",
    communitySubmitted: "Submitted for review.",
    savedLocalOnly: "Saved on this device.",
    offlineMode: "Offline",
    offlineHint: "Using saved words and recordings. Changes sync when you're back online.",
    backOnlineSynced: "Back online — synced {n} item(s).",
    syncingVoices: "Syncing voices… {done}/{total}",
    syncingVoicesDismiss: "Dismiss",
    signInForCommunity: "Sign in to contribute to the community library.",
    accountNotConfigured: "Account sign-up is not set up yet. Contact the app administrator.",
    accountConfirmNeeded: "We couldn't activate your account yet. Try again in a few minutes or contact support.",
    authLoading: "Please wait…",
    authErrorTitle: "Could not sign in",
    settingsTabGeneral: "Settings",
    settingsTabPending: "Pending words",
    pendingWordsTitle: "Approve new words",
    pendingWordsHint: "Tap Approve to add a word to the board on this device. Reject to discard it.",
    pendingLocalTitle: "On this device",
    pendingOnlineTitle: "Community library",
    pendingOnlineHint: "Words shared online. Admins can approve them for everyone.",
    pendingOnlineOwnHint: "Your submissions waiting for a moderator.",
    pendingGlobalTitle: "Global recordings",
    pendingGlobalHint: "Voice recordings awaiting approval to become the global baseline for this dialect.",
    pendingGlobalOwnHint: "Your recordings waiting for admin approval.",
    noPendingWords: "No words waiting for approval.",
    wordApproved: "Word approved!",
    wordRejected: "Word rejected.",
    coachStep1: "Tap a picture to hear the word and add it to your sentence.",
    coachStep2: "Tap more pictures to build a sentence in the strip above.",
    coachStep3: "Press Say to speak the whole sentence out loud.",
    coachNext: "Next",
    coachDone: "Got it",
    coachSkip: "Skip tour",
    wordLearning: "Word learning",
    personalRecordings: "Your personal recordings",
    myWords: "My words",
    wordLabelCurrent: "Word label (current language)",
    wordLabelPlaceholder: "Type the word",
    englishHintLabel: "English hint (optional)",
    englishHintPlaceholder: "e.g. water",
    emojiLabel: "Emoji",
    emojiPlaceholder: "💬",
    categoryLabel: "Category",
    recordYourVoice: "Record your voice",
    shareWithCommunityShort: "Share with community",
    privacyPolicy: "Privacy policy",
    adminPanel: "Admin panel",
    resetUsageConfirm: "Reset all word usage stats? Home board order will change.",
    moreSearchPlaceholder: "Search words…",
    moreSearchEmpty: "No words match your search.",
    chipRemoveHint: "Tap a chip to remove it",
    speakingNow: "Speaking…",
    installApp: "Install Talk Board",
    installAppHint: "Add to your home screen for quick access offline.",
    installDismiss: "Not now",
    showAllOnHome: "Show all words on Talk tab",
    showAllOnHomeHint: "Shows up to 100 words on the home board (default is a smaller starter set).",
    caregiverMode: "Caregiver mode",
    caregiverModeHint: "Shows recording, suggest-word, and reorder controls.",
    boardPreset: "Home board size",
    boardPresetDefault: "Starter (~42 words)",
    boardPresetSimple: "Simple (24 words)",
    boardPresetFull: "Full (up to 100 words)",
    recommendedPinsTitle: "Pin favorites on Talk",
    recommendedPinsHint: "You've used 10+ words — open More words and tap ⭐ to pin favorites on the home board.",
    swUpdated: "Update ready — refresh to get the latest version.",
    voiceAuto: "Auto",
    wordSavedLocal: "Word saved on this device.",
    localOnlyNote: "Saved locally — approve in Pending words. Sign in to share online.",
    pendingOnlineHintAdmin: "Words shared online. Admins can approve them for everyone."
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
    contributeHint: "أضف كلمة جديدة للوحة. تبقى بانتظار الموافقة من الإعدادات.",
    contributeNote: "المساهمات تبقى بانتظار الموافقة. سجّل دخولك من ⚙️ الإعدادات للمشاركة مع المجتمع أونلاين.",
    bilingual: "عرض لغة ثانية",
    secondaryLang: "اللغة الثانية",
    submit: "إرسال",
    cancel: "إلغاء",
    pinContinue: "متابعة",
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
    signIn: "تسجيل الدخول",
    signOut: "تسجيل الخروج",
    contributor: "مساهم",
    shareOnline: "شارك مع المجتمع أونلاين",
    kidHintGuest: "دوس على الصورة عشان تتكلم",
    kidHintCaregiver: "دوس على الصورة عشان تتكلم · اضغط مطوّلاً لإعادة التسجيل",
    settingsHoldHint: "الإعدادات (اضغط مطولاً ثانيتين)",
    holdToReRecord: "اضغط مطوّلاً لإعادة التسجيل",
    reRecording: "جاري التسجيل…",
    viewHome: "كلام",
    viewNeed: "محتاج",
    viewFeel: "حاسس",
    viewMore: "كلمات أكثر",
    moreWordsHint: "كلمات إضافية غير الشاشة الرئيسية. دوس على البطاقة عشان تتكلم. دوس ⭐ أضف للرئيسية لتثبيت الكلمة في كلام.",
    noTierMore: "كل الكلمات على الشاشة الرئيسية — ثبّت المفضلة من كلمات أكثر.",
    pinToHome: "أضف للرئيسية",
    unpinFromHome: "أزل من الرئيسية",
    pinnedToHome: "تمت الإضافة للوحة الرئيسية",
    pinnedToHomeFull: "ثُبّتت في كلام — الكلمات الأقل استخداماً انتقلت لكلمات أكثر",
    unpinnedFromHome: "تمت الإزالة من اللوحة الرئيسية",
    dragToReorder: "اسحب لإعادة الترتيب",
    bringToTop: "انقل للأول",
    broughtToTop: "تم النقل للأول",
    resetUsage: "مسح إحصائيات الاستخدام",
    uniqueWords: "كلمات مختلفة مستخدمة",
    usageReset: "تم إعادة ضبط إحصائيات الاستخدام.",
    account: "حسابك",
    accountHint: "سجّل دخولك لمزامنة التسجيلات في السحابة والمساهمة بكلمات مجانية لمكتبة المجتمع. التسجيلات تُحفظ على الجهاز بدون حساب.",
    accountUsername: "اسم المستخدم",
    accountUsernamePlaceholder: "اسمك",
    accountPassword: "رمز PIN",
    accountPinPlaceholder: "••••",
    accountSignIn: "دخول",
    accountSignUp: "إنشاء حساب",
    signedInAs: "مسجّل كـ",
    accountBadgeHint: "اضغط للحساب وتسجيل الخروج",
    guestAccount: "ضيف",
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
    signInToSaveVoice: "سجّل دخولك عشان تحفظ صوتك.",
    shareWithCommunity: "شارك مع المجتمع",
    shareWithCommunityHint: "ساهم بكلمات مجانية لمكتبة لهجة المجتمع",
    communityRejected: "ما تقدر تشارك هذه الكلمة مع المجتمع.",
    communitySubmitted: "تم الإرسال للمراجعة.",
    savedLocalOnly: "اتحفظ على هذا الجهاز.",
    offlineMode: "بدون إنترنت",
    offlineHint: "بتستخدم الكلمات والتسجيلات المحفوظة. التغييرات تتزامن لما يرجع الإنترنت.",
    backOnlineSynced: "رجع الإنترنت — اتزامن {n} عنصر.",
    syncingVoices: "بتتزامن الأصوات… {done}/{total}",
    syncingVoicesDismiss: "إغلاق",
    signInForCommunity: "سجّل دخولك عشان تساهم في مكتبة المجتمع.",
    accountNotConfigured: "إنشاء الحساب غير متاح حالياً.",
    accountConfirmNeeded: "ما قدرنا نفعّل حسابك للحين. جرّب بعد شوي أو تواصل مع الدعم.",
    authLoading: "انتظر…",
    authErrorTitle: "تعذّر تسجيل الدخول",
    settingsTabGeneral: "الإعدادات",
    settingsTabPending: "كلمات للموافقة",
    pendingWordsTitle: "وافق على كلمات جديدة",
    pendingWordsHint: "اضغط «موافقة» لإضافة الكلمة للوحة على هذا الجهاز. «رفض» لحذفها.",
    pendingLocalTitle: "على هذا الجهاز",
    pendingOnlineTitle: "مكتبة المجتمع",
    pendingOnlineHint: "كلمات مشتركة أونلاين. المسؤول يوافق عليها للجميع.",
    pendingOnlineOwnHint: "مساهماتك بانتظار مراجعة المسؤول.",
    pendingGlobalTitle: "تسجيلات عامة",
    pendingGlobalHint: "تسجيلات صوت بانتظار الموافقة لتصبح الصوت الافتراضي لهذه اللهجة.",
    pendingGlobalOwnHint: "تسجيلاتك بانتظار موافقة المسؤول.",
    noPendingWords: "ما في كلمات بانتظار الموافقة.",
    wordApproved: "تمت الموافقة!",
    wordRejected: "تم الرفض.",
    coachStep1: "دوس على الصورة عشان تسمع الكلمة وتضيفها لجملتك.",
    coachStep2: "دوس على صور أكثر عشان تكوّن جملة في الشريط فوق.",
    coachStep3: "اضغط «قول» عشان تتكلم الجملة كلها بصوت عالي.",
    coachNext: "التالي",
    coachDone: "فهمت",
    coachSkip: "تخطّي الجولة",
    wordLearning: "تعلّم الكلمات",
    personalRecordings: "تسجيلاتك الشخصية",
    myWords: "كلماتي",
    wordLabelCurrent: "نص الكلمة (اللغة الحالية)",
    wordLabelPlaceholder: "اكتب الكلمة",
    englishHintLabel: "تلميح إنجليزي (اختياري)",
    englishHintPlaceholder: "مثال: water",
    emojiLabel: "رمز",
    emojiPlaceholder: "💬",
    categoryLabel: "الفئة",
    recordYourVoice: "سجّل صوتك",
    shareWithCommunityShort: "شارك مع المجتمع",
    privacyPolicy: "سياسة الخصوصية",
    adminPanel: "لوحة المسؤول",
    resetUsageConfirm: "تمسح إحصائيات استخدام كل الكلمات؟ ترتيب لوحة كلام راح يتغيّر.",
    moreSearchPlaceholder: "ابحث عن كلمة…",
    moreSearchEmpty: "ما في كلمات تطابق البحث.",
    chipRemoveHint: "دوس على الشريحة عشان تشيلها",
    speakingNow: "بيحكي…",
    installApp: "ثبّت لوحة الكلام",
    installAppHint: "أضفها لشاشة البداية للوصول السريع بدون إنترنت.",
    installDismiss: "ليس الآن",
    showAllOnHome: "اعرض كل الكلمات في تبويب كلام",
    showAllOnHomeHint: "يعرض حتى 100 كلمة على اللوحة الرئيسية (الافتراضي مجموعة أصغر للبداية).",
    caregiverMode: "وضع مقدّم الرعاية",
    caregiverModeHint: "يعرض التسجيل واقتراح الكلمات وإعادة الترتيب.",
    boardPreset: "حجم لوحة كلام",
    boardPresetDefault: "بداية (~42 كلمة)",
    boardPresetSimple: "بسيط (24 كلمة)",
    boardPresetFull: "كامل (حتى 100 كلمة)",
    recommendedPinsTitle: "ثبّت المفضلة في كلام",
    recommendedPinsHint: "استخدمت 10+ كلمات — افتح كلمات أكثر ودوس ⭐ لتثبيت المفضلة على اللوحة الرئيسية.",
    swUpdated: "تحديث جاهز — حدّث الصفحة للحصول على أحدث نسخة.",
    voiceAuto: "تلقائي",
    wordSavedLocal: "اتحفظت الكلمة على هذا الجهاز.",
    localOnlyNote: "اتحفظت محلياً — وافق من كلمات للموافقة. سجّل دخولك للمشاركة أونلاين.",
    pendingOnlineHintAdmin: "كلمات مشتركة أونلاين. المسؤول يوافق عليها للجميع."
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
    dialect: "juba",
    secondaryLocale: null,
    bilingual: false,
    voiceURI: null,
    shareWithCommunity: true,
    showAllOnHome: false,
    caregiverMode: false,
    boardPreset: "default"
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
