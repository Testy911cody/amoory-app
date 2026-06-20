/* Talk Board — autism-informed AAC word priorities
   Tier 0 = regulation/safety/core (always visible, largest).
   Tier 1 = early unlock (feelings, wants, social scripts).
   Tier 2 = progressive (places, activities, food specifics).
   Tier 3 = "More words" layer (full vocabulary). */

/** Stable sort order within each tier (lower = earlier). */
export const PRIORITY_ORDER = {
  // Tier 0 — core pronouns & regulation
  p_i: 1, p_my: 2, so_me: 3,
  n_help: 10, d_stop: 11, n_wait: 12, n_break: 13, n_calm: 14,
  ds_loud: 15, n_quiet: 16,
  f_yes: 20, f_no: 21, n_more: 22, n_done: 23, n_again: 24,
  f_hurt: 30, f_sick: 31, f_tired: 32, n_hungry: 33, n_thirsty: 34,
  n_bathroom: 35, d_toilet: 36,
  p_mom: 40, p_dad: 41, p_teacher: 42,
  fd_water: 50,
  // Tier 1 — feelings
  f_happy: 100, f_sad: 101, f_angry: 102, f_scared: 103, f_okay: 104, f_upset: 105,
  // Tier 1 — wants & actions
  n_want: 110, n_need: 111, d_eat: 112, d_drink: 113, d_go: 114, d_come: 115, d_sit: 116,
  // Tier 1 — social
  n_please: 120, so_thanks: 121, so_hi: 122, so_bye: 123, so_sorry: 124,
  // Tier 2 — places
  pl_home: 200, pl_school: 201, pl_outside: 202, pl_car: 203,
  // Tier 2 — activities
  d_play: 210, d_read: 211, d_look: 212, d_listen: 213, d_walk: 214,
  // Tier 2 — food
  fd_cookie: 220, fd_bread: 221, fd_milk: 222, fd_apple: 223
};

/** Tier assignment per word id. Default 3 for unlisted words. */
export const WORD_TIERS = {
  // Tier 0
  p_i: 0, p_my: 0, so_me: 0,
  n_help: 0, d_stop: 0, n_wait: 0, n_break: 0, n_calm: 0,
  ds_loud: 0, n_quiet: 0,
  f_yes: 0, f_no: 0, n_more: 0, n_done: 0, n_again: 0,
  f_hurt: 0, f_sick: 0, f_tired: 0, n_hungry: 0, n_thirsty: 0,
  n_bathroom: 0, d_toilet: 0,
  p_mom: 0, p_dad: 0, p_teacher: 0,
  fd_water: 0,
  // Tier 1
  f_happy: 1, f_sad: 1, f_angry: 1, f_scared: 1, f_okay: 1, f_upset: 1,
  n_want: 1, n_need: 1, d_eat: 1, d_drink: 1, d_go: 1, d_come: 1, d_sit: 1,
  n_please: 1, so_thanks: 1, so_hi: 1, so_bye: 1, so_sorry: 1,
  // Tier 2
  pl_home: 2, pl_school: 2, pl_outside: 2, pl_car: 2,
  d_play: 2, d_read: 2, d_look: 2, d_listen: 2, d_walk: 2,
  fd_cookie: 2, fd_bread: 2, fd_milk: 2, fd_apple: 2, fd_banana: 2,
  n_wantthis: 2, n_comfort: 2, f_hug: 2, d_sleep: 2
};

/** Regulation / safety words — never shrink below minimum size. */
export const CORE_WORDS = new Set([
  "p_i", "p_my", "so_me",
  "n_help", "d_stop", "n_wait", "n_break", "n_calm", "n_quiet", "ds_loud",
  "f_yes", "f_no", "n_more", "n_done",
  "f_hurt", "f_sick", "n_bathroom", "d_toilet"
]);

/** Kid-facing simplified views (replaces 14 category tabs in kid mode). */
export const KID_VIEWS = [
  { id: "home", labels: { en: "Talk", ar: "كلام", fr: "Parler", es: "Hablar", de: "Sprechen", hi: "बात", sw: "Ongea" }, color: "#2E8C8C", icon: "💬" },
  { id: "need", labels: { en: "Need", ar: "محتاج", fr: "Besoin", es: "Necesito", de: "Brauchen", hi: "चाहिए", sw: "Nahitaji" }, color: "#9C6FB0", icon: "🙏" },
  { id: "feel", labels: { en: "Feel", ar: "حاسس", fr: "Ressentir", es: "Sentir", de: "Fühlen", hi: "महसूस", sw: "Hisia" }, color: "#D9695A", icon: "😊" },
  { id: "more", labels: { en: "More", ar: "كمان", fr: "Plus", es: "Más", de: "Mehr", hi: "और", sw: "Zaidi" }, color: "#5B86C4", icon: "➕" }
];

/** Which source categories feed each kid view (for need/feel/more filters). */
export const VIEW_CATEGORIES = {
  home: null, // tier-based, not category-based
  need: ["need", "do", "food", "people"],
  feel: ["feelings"],
  more: null // tier 2+ unlocked words
};

export function getWordTier(wordId) {
  return WORD_TIERS[wordId] ?? 3;
}

export function getPriorityOrder(wordId) {
  return PRIORITY_ORDER[wordId] ?? 9999;
}

export function isCoreWord(wordId) {
  return CORE_WORDS.has(wordId);
}

/** Milestones for automatic tier unlock (can be overridden by caregiver). */
export const UNLOCK_RULES = {
  1: { uniqueWords: 3, daysUsed: 0 },
  2: { uniqueWords: 8, daysUsed: 2 },
  3: { uniqueWords: 15, daysUsed: 5 }
};

export const PROMOTE_THRESHOLD = 5; // taps before visual size boost
export const HOME_MAX_WORDS = 16;
