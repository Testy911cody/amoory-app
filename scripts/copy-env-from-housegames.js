#!/usr/bin/env node
/**
 * Copy Supabase keys from HouseGames .env.local into AmooryApp .env.local.
 * Never prints secret values. Safe to run after cloning on a new machine.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const amooryRoot = path.resolve(__dirname, "..");
const houseGamesEnv = path.resolve(amooryRoot, "..", "HouseGames", ".env.local");
const outPath = path.join(amooryRoot, ".env.local");

function parseEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const env = parseEnv(houseGamesEnv);
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(`Missing Supabase keys in ${houseGamesEnv}`);
  process.exit(1);
}

const content = `# Auto-generated from HouseGames .env.local — do not commit
VITE_SUPABASE_URL=${url}
VITE_SUPABASE_ANON_KEY=${key}
NEXT_PUBLIC_SUPABASE_URL=${url}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${key}
`;

fs.writeFileSync(outPath, content, "utf8");
console.log(`Wrote ${outPath} (Supabase keys from HouseGames)`);
