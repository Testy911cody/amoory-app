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

/** Storage bucket for contributed dialect recordings (see docs SQL). */
export const AUDIO_BUCKET = "community-audio";

/** Private bucket for caregiver personal recordings. */
export const USER_AUDIO_BUCKET = "user-audio";

let clientPromise = null;

/** Lazy Supabase client — null when keys are not configured. */
export function getSupabase() {
  if (!SUPABASE_READY) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm"
    ).then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      })
    );
  }
  return clientPromise;
}

export async function getCurrentUser() {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

/** Synthetic email domain for username-only caregiver accounts. */
export const USERNAME_EMAIL_DOMAIN = "@talkboard.local";

export function normalizeUsername(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function validateUsername(raw) {
  const username = normalizeUsername(raw);
  if (username.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters." };
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { ok: false, error: "Use letters, numbers, and underscores only." };
  }
  return { ok: true, username };
}

export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  return { ok: true };
}

export function usernameToEmail(username) {
  return `${normalizeUsername(username)}${USERNAME_EMAIL_DOMAIN}`;
}

/** Display name for signed-in caregiver (never shows synthetic email). */
export function displayUsername(user) {
  if (!user) return "";
  const meta = user.user_metadata?.username;
  if (meta) return `@${meta}`;
  const email = user.email || "";
  if (email.endsWith(USERNAME_EMAIL_DOMAIN)) {
    return `@${email.slice(0, -USERNAME_EMAIL_DOMAIN.length)}`;
  }
  return email;
}

function friendlyAuthError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong username or password.";
  if (m.includes("user already registered")) return "That username is already taken.";
  if (m.includes("email not confirmed")) return "Account needs confirmation — try signing in again.";
  return message || "Something went wrong.";
}

/** Send a magic-link / OTP email. Returns { ok, error }. */
export async function signInWithEmail(email) {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, error: "Online sharing is not configured." };
  const emailRedirectTo = `${location.origin}${location.pathname}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo }
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Username + password sign-in for caregiver accounts. */
export async function signInWithPassword(username, password) {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, error: "Account sign-in is not configured." };
  const userCheck = validateUsername(username);
  if (!userCheck.ok) return userCheck;
  const passCheck = validatePassword(password);
  if (!passCheck.ok) return passCheck;
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(userCheck.username),
    password
  });
  return error
    ? { ok: false, error: friendlyAuthError(error.message) }
    : { ok: true, user: data.user };
}

/** Username + password sign-up for caregiver accounts. */
export async function signUpWithPassword(username, password) {
  const supabase = await getSupabase();
  if (!supabase) return { ok: false, error: "Account sign-up is not configured." };
  const userCheck = validateUsername(username);
  if (!userCheck.ok) return userCheck;
  const passCheck = validatePassword(password);
  if (!passCheck.ok) return passCheck;
  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(userCheck.username),
    password,
    options: { data: { username: userCheck.username } }
  });
  return error
    ? { ok: false, error: friendlyAuthError(error.message) }
    : { ok: true, user: data.user, needsConfirm: !data.session };
}

export async function signOut() {
  const supabase = await getSupabase();
  if (supabase) await supabase.auth.signOut();
}

/** Subscribe to auth changes; returns an unsubscribe function. */
export async function onAuthChange(cb) {
  const supabase = await getSupabase();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user || null);
  });
  return () => data?.subscription?.unsubscribe?.();
}
