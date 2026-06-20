/* Talk Board — Supabase client (Phase 2+)
   Config comes from ./config.js (injected at build from .env.local).
   Uses ESM CDN so the static PWA needs no bundler. */

import { config } from "./config.js";

export const SUPABASE_URL = config.supabaseUrl;
export const SUPABASE_ANON_KEY = config.supabaseAnonKey;

export const SUPABASE_READY =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("your-project") &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.startsWith("your_") &&
  !SUPABASE_ANON_KEY.startsWith("PASTE_");

let clientPromise = null;

/** Lazy Supabase client — null when keys are not configured. */
export function getSupabase() {
  if (!SUPABASE_READY) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm"
    ).then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  }
  return clientPromise;
}
