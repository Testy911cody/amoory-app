#!/usr/bin/env node
/**
 * Write public/src/config.js from environment variables.
 * Used by `npm run build` and HouseGames `sync-amoory-export.js`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const result = injectConfig(root);
  console.log(`Wrote ${result.outPath}`);
}
