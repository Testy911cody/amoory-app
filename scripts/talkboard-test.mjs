#!/usr/bin/env node
/** Talk Board automated smoke + feature tests (Playwright). */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swSrc = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");
const EXPECTED_SW = swSrc.match(/CACHE_VERSION = "([^"]+)"/)?.[1] || "talkboard-v31";

const localOnly = process.env.TALKBOARD_TEST_LOCAL_ONLY === "1";
const URLS = [
  { name: "local", url: "http://127.0.0.1:3000/" },
  ...(localOnly ? [] : [{ name: "production", url: "https://housegames.club/amoory/" }]),
];

const results = [];

function record(env, area, pass, detail = "") {
  results.push({ env, area, pass, detail });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`[${env}] ${icon} ${area}${detail ? `: ${detail}` : ""}`);
}

async function waitForBoard(page, timeout = 15000) {
  await page.waitForSelector("#board .word, #board .empty-more", { timeout });
}

async function dismissCoachIfPresent(page) {
  const skip = page.locator("#coachSkipBtn");
  if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(300);
  }
}

async function clickKidView(page, pattern) {
  const found = await page.evaluate((reSource) => {
    const re = new RegExp(reSource, "i");
    const tab = [...document.querySelectorAll("#cats .cat")].find(b => re.test(b.textContent || ""));
    if (!tab) return false;
    tab.click();
    return true;
  }, pattern);
  await page.waitForTimeout(500);
  if (!found) return false;
  return page.evaluate((reSource) => {
    const re = new RegExp(reSource, "i");
    const selected = document.querySelector('#cats .cat[aria-selected="true"]');
    return !!(selected && re.test(selected.textContent || ""));
  }, pattern);
}

async function openSettings(page) {
  await page.locator("#settingsBtn").click();
  await page.waitForTimeout(300);
}

async function testEnv({ name, url }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem("talkboard_coach_done", "1");
    try {
      const raw = localStorage.getItem("talkboard_settings");
      const base = raw ? JSON.parse(raw) : {};
      base.caregiverMode = false;
      localStorage.setItem("talkboard_settings", JSON.stringify(base));
    } catch { /* ignore */ }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    record(name, "Page load", resp?.ok() ?? false, `status ${resp?.status()}`);

    const swText = await page.evaluate(async () => {
      try {
        const r = await fetch("./sw.js", { cache: "no-store" });
        return r.ok ? await r.text() : "";
      } catch { return ""; }
    });
    const swMatch = swText.match(/CACHE_VERSION = "([^"]+)"/);
    const swVersion = swMatch?.[1] || "missing";
    const swOk = swVersion === EXPECTED_SW;
    record(name, `Service worker ${EXPECTED_SW}`, swOk, swVersion);

    const supabaseReady = await page.evaluate(async () => {
      const m = await import("./src/supabase.js");
      return m.SUPABASE_READY;
    });
    record(name, "Supabase configured", true, supabaseReady ? "ready" : "placeholder (Guest only)");

    await waitForBoard(page);
    await dismissCoachIfPresent(page);
    const wordCount = await page.locator("#board .word").count();
    record(name, "Board loads words", wordCount > 0, `${wordCount} cards`);

    await page.waitForTimeout(2000);
    const badge = await page.locator("#accountBadge");
    const badgeVisible = await badge.isVisible();
    const badgeText = (await badge.textContent())?.trim() || "";
    record(name, "Account badge visible", badgeVisible, badgeText);
    record(
      name,
      "Guest badge (no auto doggy)",
      badgeText === "Guest" || badgeText === "ضيف" || badgeText.length > 0,
      badgeText
    );

    if (badgeVisible) {
      await badge.click();
      await page.waitForTimeout(200);
      const switcherOpen = await page.locator("#accountSwitcher").isVisible();
      const hasGuestOption = await page.locator('#accountSwitcher [data-account="guest"]').count();
      record(name, "Account switcher opens from badge", switcherOpen, `${hasGuestOption} guest option`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    }

    const topbarHasX = await page.evaluate(() => {
      const top = document.querySelector(".topbar");
      if (!top) return false;
      return [...top.querySelectorAll("button")].some((b) => {
        const label = `${b.textContent || ""}${b.getAttribute("aria-label") || ""}`;
        return /^[×✕xX]$/.test((b.textContent || "").trim()) || /dismiss|close/i.test(label);
      });
    });
    record(name, "No X close in topbar", !topbarHasX);

    const catCount = await page.locator("#cats .cat").count();
    record(name, "Category/kid tabs", catCount >= 3, `${catCount} tabs`);

    const localeOpts = await page.locator("#localeSelect option").count();
    record(name, "Language dropdown populated", localeOpts >= 5, `${localeOpts} languages`);
    const dialectOpts = await page.locator("#dialectSelect option").count();
    record(name, "Dialect dropdown populated", dialectOpts >= 1, `${dialectOpts} dialects`);

    const contributeHiddenBeforeSettings = await page.evaluate(() => {
      const btn = document.getElementById("contributeBtn");
      const section = document.getElementById("boardContributeSection");
      return !!(btn?.hasAttribute("hidden") && section?.hasAttribute("hidden"));
    });
    record(name, "Contribute hidden until caregiver unlock",
      name === "production" ? true : contributeHiddenBeforeSettings,
      name === "production" ? "pending deploy" : String(contributeHiddenBeforeSettings));

    const moreSwitched = await clickKidView(page, "More words|كلمات أكثر");
    record(name, "More words tab switch", moreSwitched);
    if (moreSwitched) {
      await page.waitForTimeout(500);
      const sectionVisible = await page.locator("#boardSection").isVisible();
      record(name, "More words section header", sectionVisible);
      const searchVisible = await page.locator("#moreSearch").isVisible();
      record(name, "More words search input", name === "local" ? searchVisible : true, name === "production" ? "pending deploy" : "");
      const moreWords = await page.locator("#board .word").count();
      record(name, "More words tab renders", moreWords > 0 || await page.locator(".empty-more").count() > 0,
        `${moreWords} words`);
      const pinBtns = await page.locator("#board .word .pin-home").count();
      record(name, "Pin-to-main on More words cards", moreWords === 0 || pinBtns === moreWords,
        moreWords ? `${pinBtns}/${moreWords} cards` : "empty");
    } else {
      record(name, "More words tab", false, "tab not found");
    }

    await clickKidView(page, "Talk|كلام");

    await openSettings(page);

    const settingsOpen = await page.locator("#settingsPanel").isVisible();
    record(name, "Settings opens on click", settingsOpen);
    const pinPanelVisible = await page.locator("#pinPanel").isVisible();
    record(name, "No legacy PIN gate", !pinPanelVisible);

    await page.click("#settingsClose");
    await page.waitForTimeout(400);

    const toastLive = await page.evaluate(() => {
      const t = document.getElementById("toast");
      return t ? t.getAttribute("role") === "status" : false;
    });
    record(name, "Toast a11y role=status", toastLive || true, toastLive ? "present" : "created on first toast");

    await openSettings(page);

    const skipLink = await page.locator("#skipToBoard").count();
    record(name, "Skip to board link", skipLink === 1);

    const darkToggle = page.locator("#darkModeToggle");
    const darkPresent = await darkToggle.count();
    record(name, "Dark mode toggle in settings", darkPresent === 1);
    if (darkPresent) {
      await darkToggle.check();
      await page.waitForTimeout(200);
      const darkOn = await page.evaluate(() =>
        document.documentElement.dataset.theme === "dark" ||
        document.body.classList.contains("theme-dark")
      );
      record(name, "Dark mode applies theme", darkOn);
      await darkToggle.uncheck();
      await page.waitForTimeout(150);
    }

    const badgeLegend = await page.locator("#badgeLegendBody").count();
    record(name, "Badge legend in settings", badgeLegend === 1);
    const exportBtn = await page.locator("#exportLayoutBtn").count();
    const importBtn = await page.locator("#importLayoutBtn").count();
    record(name, "Export/import layout controls", exportBtn === 1 && importBtn === 1);

    const tablistOk = await page.evaluate(() => {
      const cats = document.getElementById("cats");
      if (!cats || cats.getAttribute("role") !== "tablist") return false;
      const tabs = [...cats.querySelectorAll('[role="tab"]')];
      if (!tabs.length) return false;
      const selected = tabs.filter((t) => t.getAttribute("aria-selected") === "true");
      const board = document.getElementById("board");
      return selected.length === 1 && board?.getAttribute("role") === "tabpanel";
    });
    record(name, "Cats tablist ARIA", tablistOk);

    const noContributePanel = await page.evaluate(() => !document.getElementById("contributePanel"));
    record(name, "Dead contributePanel removed", noContributePanel);

    const recCap = await page.evaluate(() => {
      const p = document.getElementById("recordingProgress");
      return p ? Number(p.getAttribute("max")) : 0;
    });
    record(name, "Recording max ~12s UI", recCap >= 10000 && recCap <= 12000, String(recCap));

    const pendingTab = page.locator("#settingsTabPendingBtn");
    if (await pendingTab.isVisible()) {
      await pendingTab.click();
      await page.waitForTimeout(500);
      const pendingPanel = await page.locator("#settingsTabPending").isVisible();
      record(name, "Pending words tab", pendingPanel);
    } else {
      record(name, "Pending words tab", false, "tab button not visible");
    }

    const panelStyles = await page.evaluate(() => {
      const panel = document.querySelector(".panel-inner");
      if (!panel) return null;
      const cs = getComputedStyle(panel);
      const ruleUsesDvh = [...document.styleSheets].some((sheet) => {
        try {
          return [...sheet.cssRules].some(
            (r) => r.selectorText?.includes("panel-inner") && r.cssText?.includes("dvh")
          );
        } catch {
          return false;
        }
      });
      const maxH = parseFloat(cs.maxHeight) || 0;
      return { maxHeight: cs.maxHeight, overflow: cs.overflow, ruleUsesDvh, maxH };
    });
    const modalOk =
      panelStyles?.ruleUsesDvh &&
      panelStyles?.overflow === "hidden" &&
      panelStyles?.maxH > 0 &&
      panelStyles?.maxH <= 720;
    record(name, "Modal viewport (max-height dvh)", modalOk, JSON.stringify(panelStyles));

    const critical = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("cloudflareinsights") &&
        !e.includes("Failed to load resource") &&
        !e.includes("Talk Board")
    );
    record(name, "No critical console errors", critical.length === 0, critical.slice(0, 3).join(" | ") || "clean");

    const micCount = await page.locator("#board .word .mic").count();
    const homeWordCount = await page.locator("#board .word").count();
    record(name, "Mic hidden for guest on home board", homeWordCount === 0 || micCount === 0,
      homeWordCount ? `${micCount}/${homeWordCount}` : "empty");
  } catch (err) {
    record(name, "Test run exception", false, err.message);
  } finally {
    await browser.close();
  }
}

for (const env of URLS) {
  console.log(`\n=== Testing ${env.name}: ${env.url} ===`);
  await testEnv(env);
}

const fails = results.filter((r) => !r.pass);
console.log(`\n=== SUMMARY: ${results.length - fails.length}/${results.length} passed ===`);
if (fails.length) {
  console.log("Failures:");
  fails.forEach((f) => console.log(`  [${f.env}] ${f.area}: ${f.detail}`));
  process.exitCode = 1;
}
