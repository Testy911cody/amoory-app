#!/usr/bin/env node
/**
 * Prepare Talk Board (AmooryApp) for static hosting.
 * - Injects Supabase config from .env.local / environment
 * - Copies public/ → dist/ for optional standalone deploy
 *   (includes static marketing pages: promo.html, privacy.html)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { injectConfig, loadDotEnvLocal } from "./inject-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

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
  const src = path.join(root, "public");
  const dest = path.join(root, "dist");
  rimraf(dest);
  copyDir(src, dest);
  await bundleNativeShell(dest);
  console.log(`Talk Board build ready → dist/ (${dest})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
