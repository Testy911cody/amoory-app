#!/usr/bin/env node
/**
 * Generate all PWA + app-store icons (and Capacitor source assets)
 * from a single full-bleed source image (assets/icon-source.png).
 *
 *   node scripts/generate-icons.js
 *
 * The source is a teal, full-bleed artwork with the logo centered. We
 * center-crop it to a square, then derive every size from that.
 *
 * Outputs:
 *   public/icons/*           — PWA + favicon + apple-touch
 *   assets/icon.png          — square 1024 master for @capacitor/assets
 *   assets/splash.png        — 2732 splash (light) for @capacitor/assets
 *   assets/splash-dark.png   — 2732 splash (dark)  for @capacitor/assets
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SRC = path.join(root, "assets", "icon-source.png");
const ICONS_DIR = path.join(root, "public", "icons");
const ASSETS_DIR = path.join(root, "assets");

const TEAL = { r: 46, g: 140, b: 140 }; // #2E8C8C — brand background
const INK = { r: 30, g: 58, b: 69 };    // #1E3A45 — dark splash

/** Full-bleed square icon: center-crop the source to a square of `size`px. */
async function fullBleed(size, outPath) {
  await sharp(SRC)
    .resize(size, size, { fit: "cover", position: "center" })
    .png()
    .toFile(outPath);
  console.log("✓", path.relative(root, outPath));
}

/** Maskable icon: square logo shrunk into the safe zone on a teal canvas. */
async function maskable(size, outPath) {
  const inner = Math.round(size * 0.72);
  const art = await sharp(SRC).resize(inner, inner, { fit: "cover", position: "center" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { ...TEAL, alpha: 1 } } })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toFile(outPath);
  console.log("✓", path.relative(root, outPath));
}

/** Splash: small centered logo on a flat background. */
async function splash(size, outPath, background) {
  const inner = Math.round(size * 0.34);
  const art = await sharp(SRC).resize(inner, inner, { fit: "cover", position: "center" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toFile(outPath);
  console.log("✓", path.relative(root, outPath));
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing source image: ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  await fullBleed(192, path.join(ICONS_DIR, "icon-192.png"));
  await fullBleed(512, path.join(ICONS_DIR, "icon-512.png"));
  await maskable(512, path.join(ICONS_DIR, "icon-maskable-512.png"));
  await fullBleed(180, path.join(ICONS_DIR, "apple-touch-icon.png"));
  await fullBleed(32, path.join(ICONS_DIR, "favicon-32.png"));
  await fullBleed(16, path.join(ICONS_DIR, "favicon-16.png"));

  // Capacitor master assets (used by `npx @capacitor/assets generate`)
  await fullBleed(1024, path.join(ASSETS_DIR, "icon.png"));
  await splash(2732, path.join(ASSETS_DIR, "splash.png"), { ...TEAL, alpha: 1 });
  await splash(2732, path.join(ASSETS_DIR, "splash-dark.png"), { ...INK, alpha: 1 });

  console.log("\nAll icons generated.");
}

main().catch((e) => { console.error(e); process.exit(1); });
