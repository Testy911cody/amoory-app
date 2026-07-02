#!/usr/bin/env node
/** Verify More words count — home vs full vocabulary. */
import { WORDS, CATEGORIES } from "../public/src/data.js";
import { wordsForKidView, computeHomeWords, allWordsFlat } from "../public/src/kid-ui.js";

function mergeAll(builtin) {
  return builtin;
}

const allFlat = allWordsFlat(mergeAll, "en", null);
const home = computeHomeWords(allFlat, []);
const more = wordsForKidView("more", mergeAll, "en", null);

console.log("Builtin words:", Object.values(WORDS).flat().length);
console.log("Categories:", CATEGORIES.length);
console.log("All flat (merged):", allFlat.length);
console.log("Home words:", home.length);
console.log("More words:", more.length);
console.log("Expected more ~= all - home:", allFlat.length - home.length);
