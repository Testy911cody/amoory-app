/* Talk Board — First / Then visual schedule
   A simple two-step picture schedule to help a child prepare for what's next.
   State persists in localStorage so a caregiver's plan survives a reload. */

import { CATEGORIES, labelForWord, labelForCategory } from "./data.js";
import { uiString } from "./locales.js";

const STORE_KEY = "talkboard_schedule";

let ctx = null;
let slots = loadSlots();
let activeSlot = "first";
let pickerCat = CATEGORIES[0].id;

function loadSlots() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { first: null, then: null };
}
function saveSlots() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(slots)); } catch {}
}

const els = {};
function cache() {
  els.panel = document.getElementById("schedulePanel");
  els.first = document.getElementById("schedFirst");
  els.then = document.getElementById("schedThen");
  els.cats = document.getElementById("schedCats");
  els.picker = document.getElementById("schedPicker");
  els.title = document.getElementById("scheduleTitle");
  els.subhint = document.getElementById("scheduleSubhint");
  els.hint = document.getElementById("scheduleHint");
  els.firstLbl = document.getElementById("schedFirstLbl");
  els.thenLbl = document.getElementById("schedThenLbl");
  els.speakLbl = document.getElementById("schedSpeakLbl");
}

function t(key) {
  return uiString(ctx.getSettings().locale, key);
}

function applyText() {
  els.title.textContent = t("schedule");
  if (els.subhint) els.subhint.textContent = t("scheduleSubhint");
  els.hint.textContent = t("scheduleHint");
  els.firstLbl.textContent = t("first");
  els.thenLbl.textContent = t("then");
  els.speakLbl.textContent = t("say");
}

function renderSlot(slotEl, key) {
  const data = slots[key];
  const picEl = slotEl.querySelector(".sched-pic");
  const wordEl = slotEl.querySelector(".sched-word");
  slotEl.classList.toggle("active", activeSlot === key);
  slotEl.classList.toggle("filled", !!data);
  if (data) {
    picEl.textContent = data.emoji;
    wordEl.textContent = data.label;
  } else {
    picEl.textContent = "＋";
    wordEl.textContent = t("tapToChoose");
  }
}

function renderSlots() {
  renderSlot(els.first, "first");
  renderSlot(els.then, "then");
}

function renderCats() {
  els.cats.innerHTML = "";
  const s = ctx.getSettings();
  const locale = s.locale;
  const dialect = (ctx.getDialect && ctx.getDialect()) || s.dialect || null;
  CATEGORIES.forEach(c => {
    const b = document.createElement("button");
    b.className = "cat";
    b.setAttribute("aria-selected", c.id === pickerCat);
    b.innerHTML = `<span class="dot" style="background:${c.color}"></span>${labelForCategory(c, locale, dialect)}`;
    b.onclick = () => { pickerCat = c.id; renderCats(); renderPicker(); };
    els.cats.appendChild(b);
  });
}

function renderPicker() {
  const s = ctx.getSettings();
  const locale = s.locale;
  const dialect = (ctx.getDialect && ctx.getDialect()) || s.dialect || null;
  const color = CATEGORIES.find(c => c.id === pickerCat).color;
  els.picker.innerHTML = "";
  ctx.wordsForCategory(pickerCat).forEach(w => {
    const card = document.createElement("button");
    card.className = "word";
    card.style.borderColor = color;
    card.innerHTML = `<span class="emoji">${w.emoji}</span><span class="lbl">${labelForWord(w, locale, dialect)}</span>`;
    card.onclick = () => {
      slots[activeSlot] = { emoji: w.emoji, label: labelForWord(w, locale, dialect), word: w };
      saveSlots();
      if (activeSlot === "first" && !slots.then) activeSlot = "then";
      renderSlots();
    };
    els.picker.appendChild(card);
  });
}

async function speakPlan() {
  if (slots.first?.word) await ctx.speakWord(slots.first.word);
  await new Promise(r => setTimeout(r, 450));
  if (slots.then?.word) await ctx.speakWord(slots.then.word);
}

export function renderSchedule() {
  if (!ctx) return;
  applyText();
  renderSlots();
  renderCats();
  renderPicker();
}

export function initSchedule(context) {
  ctx = context;
  cache();
  els.first.onclick = () => { activeSlot = "first"; renderSlots(); };
  els.then.onclick = () => { activeSlot = "then"; renderSlots(); };
  document.getElementById("schedSpeak").onclick = speakPlan;
  document.getElementById("schedClear").onclick = () => {
    slots = { first: null, then: null };
    activeSlot = "first";
    saveSlots();
    renderSlots();
  };
  renderSchedule();
}
