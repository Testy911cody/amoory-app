/* Talk Board — vocabulary data
   Word shape: { id, emoji, labels: { localeCode: text }, source?, status? }
   - id is stable for recordings (never change once set).
   - labels may only cover some locales; UI/TTS fall back to English.
   - Community-approved words are merged at runtime (see community.js).
   - Phase 4: emoji becomes img (URL). */

export const CATEGORIES = [
  { id: "people",   labels: { en: "People",   ar: "ناس",   fr: "Personnes", es: "Personas" }, color: "var(--c-people)" },
  { id: "feelings", labels: { en: "Feelings", ar: "إحساس", fr: "Sentiments", es: "Sentimientos" }, color: "var(--c-feelings)" },
  { id: "food",     labels: { en: "Food",     ar: "أكل",   fr: "Nourriture", es: "Comida" }, color: "var(--c-food)" },
  { id: "do",       labels: { en: "Actions",  ar: "أفعال", fr: "Actions",    es: "Acciones" }, color: "var(--c-do)" },
  { id: "need",     labels: { en: "I want",   ar: "عايز",  fr: "Je veux",    es: "Quiero" }, color: "var(--c-need)" },
  { id: "place",    labels: { en: "Places",   ar: "أماكن", fr: "Lieux",      es: "Lugares" }, color: "var(--c-place)" }
];

function w(id, emoji, en, ar, extra = {}) {
  return { id, emoji, labels: { en, ar, ...extra.labels }, source: "builtin", ...extra };
}

export const WORDS = {
  people: [
    w("p_i", "👦", "I", "أنا"),
    w("p_you", "🧑", "you", "إنت"),
    w("p_mom", "👩", "mom", "ماما"),
    w("p_dad", "👨", "dad", "بابا"),
    w("p_grandma", "👵", "grandma", "تيتة"),
    w("p_grandpa", "👴", "grandpa", "جدو"),
    w("p_teacher", "🧑‍🏫", "teacher", "مدرّس"),
    w("p_baby", "👶", "baby", "بيبي"),
    w("p_friend", "🧑‍🤝‍🧑", "friend", "صاحب"),
    w("p_dog", "🐕", "dog", "كلب"),
    w("p_cat", "🐈", "cat", "قطة")
  ],
  feelings: [
    w("f_happy", "😊", "happy", "مبسوط"),
    w("f_sad", "😢", "sad", "زعلان"),
    w("f_angry", "😠", "angry", "غضبان"),
    w("f_scared", "😨", "scared", "خايف"),
    w("f_tired", "😴", "tired", "تعبان"),
    w("f_hurt", "🤕", "hurt", "بوجعني"),
    w("f_upset", "😖", "upset", "متضايق"),
    w("f_love", "😍", "love", "بحب"),
    w("f_okay", "😐", "okay", "تمام"),
    w("f_hug", "🤗", "hug", "حضن"),
    w("f_yes", "👍", "yes", "أيوة"),
    w("f_no", "👎", "no", "لأ")
  ],
  food: [
    w("fd_apple", "🍎", "apple", "تفاحة"),
    w("fd_banana", "🍌", "banana", "موزة"),
    w("fd_strawberry", "🍓", "strawberry", "فراولة"),
    w("fd_milk", "🥛", "milk", "لبن"),
    w("fd_water", "💧", "water", "ميّة"),
    w("fd_cookie", "🍪", "cookie", "بسكوت"),
    w("fd_bread", "🍞", "bread", "عيش"),
    w("fd_cheese", "🧀", "cheese", "جبنة"),
    w("fd_pizza", "🍕", "pizza", "بيتزا"),
    w("fd_pasta", "🍝", "pasta", "مكرونة"),
    w("fd_carrot", "🥕", "carrot", "جزر"),
    w("fd_icecream", "🍦", "ice cream", "آيس كريم"),
    w("fd_juice", "🧃", "juice", "عصير"),
    w("fd_sandwich", "🥪", "sandwich", "ساندويتش")
  ],
  do: [
    w("d_eat", "🍽️", "eat", "آكل"),
    w("d_drink", "🥤", "drink", "أشرب"),
    w("d_sleep", "😴", "sleep", "أنام"),
    w("d_play", "▶️", "play", "ألعب"),
    w("d_walk", "🚶", "walk", "أمشي"),
    w("d_run", "🏃", "run", "أجري"),
    w("d_read", "📖", "read", "أقرا"),
    w("d_music", "🎵", "music", "موسيقى"),
    w("d_bath", "🛁", "bath", "حمّام"),
    w("d_toilet", "🚽", "toilet", "تواليت"),
    w("d_stop", "✋", "stop", "قف"),
    w("d_go", "👋", "go", "يلا"),
    w("d_look", "👀", "look", "بُص"),
    w("d_listen", "👂", "listen", "اسمع"),
    w("d_draw", "✏️", "draw", "أرسم"),
    w("d_wash", "🧼", "wash", "أغسل")
  ],
  need: [
    w("n_please", "🙏", "please", "لو سمحت"),
    w("n_help", "🤲", "help", "ساعدني"),
    w("n_more", "➕", "more", "كمان"),
    w("n_done", "✅", "all done", "خلصت"),
    w("n_bathroom", "🚻", "bathroom", "الحمّام"),
    w("n_notwell", "🤒", "not well", "تعبان"),
    w("n_again", "🔁", "again", "تاني"),
    w("n_break", "⏸️", "break", "راحة"),
    w("n_comfort", "🫂", "comfort", "طمّني"),
    w("n_quiet", "🤐", "quiet", "هدوء"),
    w("n_wantthis", "🎁", "want this", "عايز ده")
  ],
  place: [
    w("pl_home", "🏠", "home", "البيت"),
    w("pl_school", "🏫", "school", "المدرسة"),
    w("pl_park", "🏞️", "park", "الجنينة"),
    w("pl_store", "🛒", "store", "السوبر ماركت"),
    w("pl_bedroom", "🛏️", "bedroom", "أوضة النوم"),
    w("pl_car", "🚗", "car", "العربية"),
    w("pl_doctor", "🏥", "doctor", "الدكتور"),
    w("pl_kitchen", "🍴", "kitchen", "المطبخ"),
    w("pl_outside", "🏖️", "outside", "بَرّه"),
    w("pl_playground", "🛝", "playground", "الملعب")
  ]
};

/** Label for a locale with fallback: locale → en → first available. */
export function labelForWord(word, localeCode) {
  if (!word?.labels) return "";
  return word.labels[localeCode] || word.labels.en || Object.values(word.labels)[0] || "";
}

export function labelForCategory(cat, localeCode) {
  return cat.labels[localeCode] || cat.labels.en || cat.id;
}

/** Back-compat exports used by older code paths */
export const DIALECTS = [
  { id: "sd", name: "Sudanese", ar: "سوداني" },
  { id: "juba", name: "Juba Arabic", ar: "عربي جوبا" },
  { id: "eg", name: "Egyptian", ar: "مصري" },
  { id: "msa", name: "Standard Arabic", ar: "فصحى" }
];

export const UI = {
  en:   { title: "Talk Board", say: "Say", hint: "Tap pictures to build a sentence" },
  ar:   { title: "لوحة الكلام", say: "قول", hint: "دوس على الصور عشان تكوّن جملة" },
  both: { title: "Talk Board · لوحة الكلام", say: "Say", hint: "Tap pictures · دوس على الصور" }
};
