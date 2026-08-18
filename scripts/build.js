#!/usr/bin/env node
/**
 * Prepare Talk Board (AmooryApp) for static hosting.
 * - Injects Supabase config from .env.local / environment
 * - Expands service-worker CORE_ASSETS to include all public/src modules
 * - Bumps CACHE_VERSION when bumping for releases (see CACHE_VERSION below)
 * - Copies public/ → dist/ for optional standalone deploy
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { injectConfig, loadDotEnvLocal } from "./inject-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** Keep in sync with intentional cache busts — also written into public/sw.js + dist. */
const CACHE_VERSION = "talkboard-v34";

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) rimraf(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function walkJsFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsFiles(full, base));
    else if (entry.name.endsWith(".js")) {
      out.push("./" + path.relative(path.join(base, ".."), full).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

/** Rewrite CORE_ASSETS + CACHE_VERSION in an sw.js file so every src module is precached. */
function expandServiceWorker(swPath, publicRoot) {
  let sw = fs.readFileSync(swPath, "utf8");
  const srcModules = walkJsFiles(path.join(publicRoot, "src"));
  const core = [
    "./index.html",
    "./promo.html",
    "./admin.html",
    "./privacy.html",
    ...srcModules,
    "./src/styles.css",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-512.png",
    "./icons/apple-touch-icon.png",
    "./icons/favicon-16.png",
    "./icons/favicon-32.png",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm"
  ];
  // Deduplicate while preserving order
  const seen = new Set();
  const assets = core.filter(u => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  const assetsLiteral = assets.map(u => `  ${JSON.stringify(u)}`).join(",\n");
  sw = sw.replace(
    /const CACHE_VERSION = "[^"]+";/,
    `const CACHE_VERSION = "${CACHE_VERSION}";`
  );
  sw = sw.replace(
    /const CORE_ASSETS = \[[\s\S]*?\];/,
    `const CORE_ASSETS = [\n${assetsLiteral}\n];`
  );
  fs.writeFileSync(swPath, sw);
  return assets.length;
}

async function bundleNativeShell(dest) {
  const entry = path.join(root, "scripts", "native-shell.js");
  const outfile = path.join(dest, "src", "native.js");
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    logLevel: "silent"
  });
  console.log("✓ bundled native shell → dist/src/native.js");
}

async function main() {
  loadDotEnvLocal(root);
  injectConfig(root);

  const publicRoot = path.join(root, "public");
  const publicSw = path.join(publicRoot, "sw.js");
  const n = expandServiceWorker(publicSw, publicRoot);
  console.log(`✓ SW ${CACHE_VERSION} — ${n} CORE_ASSETS (includes all public/src modules)`);

  const src = publicRoot;
  const dest = path.join(root, "dist");
  rimraf(dest);
  copyDir(src, dest);
  await bundleNativeShell(dest);
  expandServiceWorker(path.join(dest, "sw.js"), dest);
  console.log(`Talk Board build ready → dist/ (${dest})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
