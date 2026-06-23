#!/usr/bin/env node
/**
 * Write public/src/config.js from environment variables.
 * Used by `npm run build` and HouseGames `sync-amoory-export.js`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load `.env.local` from project root (same keys as build.js). */
export function loadDotEnvLocal(root = path.resolve(__dirname, "..")) {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

export function resolveSupabaseEnv(env = process.env) {
  return {
    supabaseUrl:
      env.VITE_SUPABASE_URL ||
      env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://your-project.supabase.co",
    supabaseAnonKey:
      env.VITE_SUPABASE_ANON_KEY ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "your_anon_key_here",
  };
}

export function configJsContent({ supabaseUrl, supabaseAnonKey }) {
  return `/** Auto-generated — do not edit. Run \`npm run build\` or HouseGames \`npm run sync:amoory\`. */
export const config = {
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
};
`;
}

export function injectConfig(targetRoot, env = process.env) {
  const outPath = path.join(targetRoot, "public", "src", "config.js");
  const values = resolveSupabaseEnv(env);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, configJsContent(values), "utf8");
  return { outPath, ...values };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(__dirname, "..");
  loadDotEnvLocal(root);
  const result = injectConfig(root);
  console.log(`Wrote ${result.outPath}`);
}
