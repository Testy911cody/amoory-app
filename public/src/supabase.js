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

/** True when the browser reports network connectivity. */
export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Storage bucket for contributed dialect recordings (see docs SQL). */
export const AUDIO_BUCKET = "community-audio";

/** Public bucket for approved global baseline recordings. */
export const GLOBAL_AUDIO_BUCKET = "global-audio";

/** Private bucket for caregiver personal recordings. */
export const USER_AUDIO_BUCKET = "user-audio";

let clientPromise = null;

/** Lazy Supabase client — null when keys are not configured. */
export function getSupabase() {
  if (!SUPABASE_READY) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm"
    )
      .then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true }
        })
      )
      .catch((err) => {
        clientPromise = null;
        throw new Error(
          friendlyAuthError(err?.message || "Failed to load account library.")
        );
      });
  }
  return clientPromise;
}

export async function getCurrentUser() {
  const supabase = await getSupabase();
  if (!supabase) return null;
  if (!isOnline()) {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user || null;
  }
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  } catch {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user || null;
  }
}

/** Synthetic email domain for username-only caregiver accounts (must be a valid TLD for Supabase). */
export const USERNAME_EMAIL_DOMAIN = "@talkboard.app";

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

/** Demo/admin account — manual sign-in only (admin panel, seed scripts). */
export const DOGGY_USERNAME = "doggy";
export const DOGGY_USER_ID = "7ee281ce-5ba8-4f2b-bb87-5e4185d12a38";

/** Map 4-digit PIN to Supabase password (min 6 chars). */
export function pinToPassword(pin) {
  return `pin${String(pin || "").trim()}`;
}

export function validatePin(pin) {
  const value = String(pin || "").trim();
  if (!/^\d{4}$/.test(value)) {
    return { ok: false, error: "PIN must be exactly 4 digits." };
  }
  return { ok: true, pin: value };
}

/** @deprecated Use validatePin — kept for any legacy callers. */
export function validatePassword(password) {
  return validatePin(password);
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

/** True for username+PIN accounts (synthetic @talkboard.app email). */
export function usesTalkboardAccount(user) {
  if (!user) return false;
  if (user.user_metadata?.username) return true;
  return (user.email || "").endsWith(USERNAME_EMAIL_DOMAIN);
}

function friendlyAuthError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return "Could not reach the account server. Check your connection and try again.";
  }
  if (m.includes("database error saving new user") || m.includes("unexpected_failure")) {
    return "Could not create the account (server error). Please try again in a few minutes.";
  }
  if (m.includes("invalid login credentials")) return "Wrong username or PIN.";
  if (m.includes("user already registered")) return "That username is already taken.";
  if (m.includes("email not confirmed")) {
    return "Account is not active yet. Ask the administrator to disable email confirmation in Supabase.";
  }
  if (m.includes("email address") && m.includes("invalid")) {
    return "Could not create account — try a different username.";
  }
  if (m.includes("over_email_send_rate_limit") || (m.includes("email") && m.includes("rate limit"))) {
    return "Too many sign-up attempts — wait an hour and try again.";
  }
  if (m.includes("rate limit")) return "Too many attempts — wait a minute and try again.";
  if (m.includes("signup is disabled")) return "Account sign-up is disabled on the server.";
  return message || "Something went wrong.";
}

async function withAuthGuard(fn) {
  try {
    if (!isOnline()) {
      return { ok: false, error: "You appear to be offline. Connect to the internet and try again." };
    }
    return await fn();
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err?.message || String(err)) };
  }
}

/** Resolve an active session user after sign-up or sign-in. */
async function resolveSessionUser(supabase, fallbackUser) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.user) return sessionData.session.user;
  const { data: userData } = await supabase.auth.getUser();
  return userData?.user || fallbackUser || null;
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

/** Username + 4-digit PIN sign-in for caregiver accounts. */
export async function signInWithPassword(username, pin) {
  return withAuthGuard(async () => {
    const supabase = await getSupabase();
    if (!supabase) return { ok: false, error: "Account sign-in is not configured." };
    const userCheck = validateUsername(username);
    if (!userCheck.ok) return userCheck;
    const pinCheck = validatePin(pin);
    if (!pinCheck.ok) return pinCheck;
    const password = pinToPassword(pinCheck.pin);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(userCheck.username),
      password
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    const user = await resolveSessionUser(supabase, data.user);
    if (!user) return { ok: false, error: "Sign-in succeeded but no session — try again." };
    return { ok: true, user };
  });
}

/** Username + 4-digit PIN sign-up for caregiver accounts. */
export async function signUpWithPassword(username, pin) {
  return withAuthGuard(async () => {
    const supabase = await getSupabase();
    if (!supabase) return { ok: false, error: "Account sign-up is not configured." };
    const userCheck = validateUsername(username);
    if (!userCheck.ok) return userCheck;
    const pinCheck = validatePin(pin);
    if (!pinCheck.ok) return pinCheck;
    const password = pinToPassword(pinCheck.pin);
    const email = usernameToEmail(userCheck.username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: userCheck.username, display_name: userCheck.username } }
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };

    let user = data.session?.user || data.user || null;
    if (!data.session) {
      const signIn = await supabase.auth.signInWithPassword({ email, password });
      if (!signIn.error) {
        user = await resolveSessionUser(supabase, signIn.data?.user);
      }
    } else {
      user = await resolveSessionUser(supabase, user);
    }

    if (user) return { ok: true, user, needsConfirm: false };
    return {
      ok: true,
      user: data.user,
      needsConfirm: true,
      error: null
    };
  });
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
