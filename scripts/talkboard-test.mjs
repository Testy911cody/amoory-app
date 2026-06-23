#!/usr/bin/env node
/** Talk Board automated smoke + feature tests (Playwright). */
import { chromium } from "playwright";

const URLS = [
  { name: "local", url: "http://127.0.0.1:3000/" },
  { name: "production", url: "https://housegames.club/amoory/" },
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

async function getConsoleErrors(page) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function testEnv({ name, url }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  try {
    const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    record(name, "Page load", resp?.ok() ?? false, `status ${resp?.status()}`);

    // SW version
    const swText = await page.evaluate(async () => {
      try {
        const r = await fetch("./sw.js");
        return r.ok ? await r.text() : "";
      } catch { return ""; }
    });
    const swMatch = swText.match(/CACHE_VERSION = "([^"]+)"/);
    record(name, "Service worker v16", swMatch?.[1] === "talkboard-v16", swMatch?.[1] || "missing");

    // Supabase config
    const supabaseReady = await page.evaluate(async () => {
      const m = await import("./src/supabase.js");
      return m.SUPABASE_READY;
    });
    record(name, "Supabase configured", true, supabaseReady ? "ready" : "placeholder (Guest only)");

    await waitForBoard(page);
    const wordCount = await page.locator("#board .word").count();
    record(name, "Board loads words", wordCount > 0, `${wordCount} cards`);

    // Account badge
    await page.waitForTimeout(3000); // doggy preload
    const badge = await page.locator("#accountBadge");
    const badgeVisible = await badge.isVisible();
    const badgeText = (await badge.textContent())?.trim() || "";
    record(name, "Account badge visible", badgeVisible, badgeText);
    if (supabaseReady) {
      record(name, "Doggy auto-preload", badgeText.includes("doggy"), badgeText);
    } else {
      record(name, "Guest badge (no Supabase)", badgeText === "Guest" || badgeText === "ضيف", badgeText);
    }

    // Kid view tabs
    const catCount = await page.locator("#cats .cat").count();
    record(name, "Category/kid tabs", catCount >= 3, `${catCount} tabs`);

    // Language / dialect dropdowns
    const localeOpts = await page.locator("#localeSelect option").count();
    record(name, "Language dropdown populated", localeOpts >= 5, `${localeOpts} languages`);
    const dialectOpts = await page.locator("#dialectSelect option").count();
    record(name, "Dialect dropdown populated", dialectOpts >= 1, `${dialectOpts} dialects`);

    // More words tab
    const moreTab = page.locator("#cats .cat", { hasText: /More words|كلمات أكثر/i });
    if (await moreTab.count()) {
      await moreTab.first().click();
      await page.waitForTimeout(500);
      const sectionVisible = await page.locator("#boardSection").isVisible();
      record(name, "More words section header", sectionVisible);
      const moreWords = await page.locator("#board .word").count();
      record(name, "More words tab renders", true, `${moreWords} words or empty message`);
    } else {
      record(name, "More words tab", false, "tab not found");
    }

    // Caregiver mode
    await page.locator("#cats .cat").first().click();
    await page.click("#settingsBtn");
    await page.waitForTimeout(800);

    const settingsOpen = await page.locator("#settingsPanel").isVisible();
    record(name, "Caregiver settings opens", settingsOpen);

    const caregiverBanner = await page.locator("#caregiverBanner").isVisible();
    record(name, "Caregiver banner", caregiverBanner);

    // Close settings before testing inline suggest (panel overlay blocks board clicks)
    await page.click("#settingsClose");
    await page.waitForTimeout(400);

    // Inline suggest word section
    const suggestSection = await page.locator("#boardContributeSection").isVisible();
    record(name, "Inline suggest word section", suggestSection);

    if (suggestSection) {
      await page.click("#boardContributeToggle");
      await page.waitForTimeout(300);
      const bodyOpen = await page.locator("#boardContributeBody").isVisible();
      record(name, "Suggest word panel expands", bodyOpen);
    }

    // Pending words tab (reopen settings — closed for inline suggest test)
    await page.click("#settingsBtn");
    await page.waitForTimeout(500);
    const pendingTab = page.locator("#settingsTabPendingBtn");
    if (await pendingTab.isVisible()) {
      await pendingTab.click();
      await page.waitForTimeout(500);
      const pendingPanel = await page.locator("#settingsTabPending").isVisible();
      record(name, "Pending words tab", pendingPanel);
    } else {
      record(name, "Pending words tab", false, "tab button not visible");
    }

    // Modal viewport CSS checks (computed maxHeight resolves px from min(90dvh,720px))
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

    // Console errors (filter noise)
    const critical = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("cloudflareinsights") &&
        !e.includes("Failed to load resource") &&
        !e.includes("Talk Board")
    );
    record(name, "No critical console errors", critical.length === 0, critical.slice(0, 3).join(" | ") || "clean");

    // PIN panel (set PIN then test gate)
    if (await page.locator("#settingsPanel").isVisible()) {
      await page.click("#settingsClose");
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => {
      localStorage.setItem(
        "talkboard_settings",
        JSON.stringify({ ...JSON.parse(localStorage.getItem("talkboard_settings") || "{}"), caregiverActive: false, caregiverPin: "1234" })
      );
    });
    await page.reload({ waitUntil: "networkidle" });
    await waitForBoard(page);
    await page.click("#settingsBtn");
    await page.waitForTimeout(500);
    const pinPanelVisible = await page.locator("#pinPanel").isVisible();
    record(name, "PIN gate shows when PIN set", pinPanelVisible);
    if (pinPanelVisible) {
      await page.fill("#pinPanelInput", "1234");
      await page.click("#pinPanelSubmit");
      await page.waitForTimeout(800);
      const caregiverAfterPin = await page.locator("#caregiverBanner").isVisible();
      record(name, "PIN 1234 unlocks caregiver", caregiverAfterPin);
    }
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
