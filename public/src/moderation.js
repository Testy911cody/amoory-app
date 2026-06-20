/* Talk Board — client-side community word moderation (EN + AR)
   Fast, offline-first filter before words enter the approval queue. */

const REJECT_LOG_KEY = "talkboard_moderation_rejects";
const REJECT_LOG_MAX = 50;

/** English profanity / slurs / sexual / violence / hate (lowercase, no diacritics). */
const EN_BLOCKLIST = new Set([
  "ass", "asshole", "bastard", "bitch", "bloody", "bollocks", "bullshit", "cock",
  "crap", "cunt", "damn", "dick", "dyke", "fag", "faggot", "fuck", "fucker", "fucking",
  "goddamn", "hell", "homo", "jerk", "kill", "kike", "murder", "nazi", "nigger", "nigga",
  "penis", "piss", "porn", "pussy", "rape", "retard", "retarded", "shit", "slut",
  "spastic", "suicide", "terrorist", "tits", "twat", "vagina", "whore", "wtf",
  "sex", "sexy", "nude", "naked", "boob", "boobs", "dildo", "orgasm", "hentai",
  "pedo", "pedophile", "molest", "abuse", "hitler", "isis", "jihadist"
]);

/** Arabic blocklist (MSA + common dialect vulgar terms; Sudanese where distinct). */
const AR_BLOCKLIST = new Set([
  "خرا", "خره", "كلب", "حمار", "زبال", "زبالة", "شرموط", "شرموطة", "عرص", "عرصة",
  "منيك", "متناك", "متناكة", "نيك", "كس", "طيز", "زب", "قحب", "قحبة", "لعن",
  "لعنة", "ابن كلب", "ابن حمار", "يلعن", "وسخ", "قذر", "حرامي", "حرام",
  "زنديق", "كافر", "ملعون", "احا", "احاا", "كس ام", "كس اخت", "طيزك",
  "يا كلب", "يا حمار", "يا ابن", "يا بنت", "يا شرمو", "يا عرص"
]);

/** Phrase patterns (regex on normalized text). */
const PHRASE_PATTERNS = [
  /\bf+\s*u+\s*c+\s*k+/i,
  /\bs+\s*h+\s+i+\s+t+/i,
  /\bn+\s*i+\s+g+\s+g+/i,
  /\bkill\s+(you|him|her|them|myself)\b/i,
  /\b(i\s+)?(want\s+to\s+)?(die|kill\s+myself)\b/i,
  /\b(sex|porn|nude|naked)\s+(with|video|pic)/i,
  /(كس|نيك|شرمو|عرص|خر[ae]?)/,
  /(ابن\s*كلب|ابن\s*حمار|كس\s*ام)/,
  /\b(stupid|idiot|moron|dumb)\s+(kid|child|baby)\b/i
];

const LEET_MAP = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"
};

function stripArabicDiacritics(s) {
  return s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
}

function normalizeArabic(s) {
  return stripArabicDiacritics(s)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/[ة]/g, "ه")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeLatin(s) {
  let out = s.toLowerCase();
  for (const [from, to] of Object.entries(LEET_MAP)) {
    out = out.split(from).join(to);
  }
  return out
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  const ar = normalizeArabic(text);
  const en = normalizeLatin(text);
  const tokens = new Set();
  for (const part of [ar, en, text.toLowerCase()]) {
    part.split(/\s+/).filter(Boolean).forEach(t => tokens.add(t));
  }
  return { ar, en, combined: `${ar} ${en}`, tokens: [...tokens] };
}

function matchesBlocklist(tokens, blocklist, normalized) {
  for (const token of tokens) {
    if (blocklist.has(token)) return true;
  }
  /* Multi-word phrases only — avoid substring false positives (e.g. "hello" vs "hell"). */
  for (const word of blocklist) {
    if (word.includes(" ") && normalized.includes(word)) return true;
  }
  return false;
}

function matchesPatterns(text) {
  const sample = `${normalizeLatin(text)} ${normalizeArabic(text)}`;
  return PHRASE_PATTERNS.some(re => re.test(sample));
}

/**
 * Check whether text is acceptable for the community library.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function moderateForCommunity(text, locale = "en") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > 120) return { ok: false, reason: "too-long" };

  const { ar, en, combined, tokens } = tokenize(trimmed);

  if (matchesPatterns(trimmed)) return { ok: false, reason: "pattern" };
  if (matchesBlocklist(tokens, EN_BLOCKLIST, en)) return { ok: false, reason: "en-blocklist" };
  if (matchesBlocklist(tokens, AR_BLOCKLIST, ar)) return { ok: false, reason: "ar-blocklist" };

  /* Extra pass: Arabic locale text may be Latin transliteration */
  if (locale === "ar" && matchesBlocklist(tokens, EN_BLOCKLIST, en)) {
    return { ok: false, reason: "en-blocklist" };
  }

  return { ok: true };
}

/** Check primary label + optional English hint (custom words). */
export function moderateWordEntry(label, englishHint, locale) {
  const primary = moderateForCommunity(label, locale);
  if (!primary.ok) return primary;
  if (englishHint?.trim()) {
    const hint = moderateForCommunity(englishHint, "en");
    if (!hint.ok) return { ...hint, reason: "hint-" + hint.reason };
  }
  return { ok: true };
}

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Log rejected moderation attempts locally (no raw text — hash + length only). */
export function logModerationRejection(text, locale, reason) {
  try {
    const raw = localStorage.getItem(REJECT_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({
      at: new Date().toISOString(),
      locale: locale || "?",
      reason: reason || "unknown",
      len: String(text || "").length,
      hash: simpleHash(String(text || "").toLowerCase())
    });
    localStorage.setItem(REJECT_LOG_KEY, JSON.stringify(log.slice(0, REJECT_LOG_MAX)));
  } catch {
    /* ignore quota errors */
  }
}

export function getModerationRejectLog() {
  try {
    const raw = localStorage.getItem(REJECT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
