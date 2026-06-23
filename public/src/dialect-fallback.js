/* Talk Board — Sudanese (sd) and Juba Arabic (juba) share one recording pool
   until a dialect-specific clip is submitted and approved for that dialect. */

export const AR_SD_JUBA_DIALECTS = new Set(["sd", "juba"]);

/** True when locale/dialect participates in the sd↔juba shared pool. */
export function isSdJubaDialect(locale, dialect) {
  return locale === "ar" && AR_SD_JUBA_DIALECTS.has(dialect);
}

/** Sibling dialect in the shared pool (sd↔juba), or null. */
export function siblingDialectFor(locale, dialect) {
  if (locale !== "ar" || !dialect) return null;
  if (dialect === "sd") return "juba";
  if (dialect === "juba") return "sd";
  return null;
}

/** @deprecated Use siblingDialectFor — kept for existing imports. */
export function fallbackDialectFor(locale, dialect) {
  return siblingDialectFor(locale, dialect);
}

/** Dialect ids to load/cache for playback (active + sibling when shared). */
export function dialectsToLoad(locale, dialect) {
  const sibling = siblingDialectFor(locale, dialect);
  return sibling ? [dialect, sibling] : dialect ? [dialect] : [];
}

/** Admin badge for an approved global recording row. */
export function recordingBadge(viewingDialect, { dialect, fallbackFrom }) {
  if (fallbackFrom) {
    return { class: "legacy", label: `Legacy DB mirror (${fallbackFrom})` };
  }
  const d = dialect || "default";
  if (!viewingDialect || viewingDialect === dialect) {
    return { class: "native", label: `Dialect-specific (${d})` };
  }
  if (siblingDialectFor("ar", viewingDialect) === dialect) {
    return { class: "shared", label: `Shared pool (${d})` };
  }
  return { class: "native", label: `Dialect-specific (${d})` };
}

/** @deprecated Use recordingBadge */
export function fallbackLabel(fromDialect) {
  if (fromDialect === "juba") return "Juba fallback";
  return fromDialect ? `${fromDialect} fallback` : "";
}
