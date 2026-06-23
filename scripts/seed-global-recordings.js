#!/usr/bin/env node
/**
 * Seed approved global_word_recordings for ar+juba from doggy's user_recordings.
 * Copies audio from private user-audio to public global-audio/baseline/.
 *
 * Usage: npm run env:from-housegames && npm run seed:global
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const DOGGY_USER_ID = "7ee281ce-5ba8-4f2b-bb87-5e4185d12a38";
const LOCALE = "ar";
const DIALECT = "juba";
const LANG = "ar";

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.local — run: npm run env:from-housegames");
    process.exit(1);
  }
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function pinToPassword(pin) {
  return `pin${pin}`;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Supabase URL/key missing in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: "doggy@talkboard.app",
    password: pinToPassword("1234")
  });
  if (signErr) {
    console.error("Doggy sign-in failed:", signErr.message);
    process.exit(1);
  }

  const { data: rows, error } = await supabase
    .from("user_recordings")
    .select("word_key,lang,audio_path")
    .eq("user_id", DOGGY_USER_ID);
  if (error) {
    console.error("Fetch user_recordings failed:", error.message);
    process.exit(1);
  }

  const byWord = new Map();
  for (const row of rows || []) {
    const prev = byWord.get(row.word_key);
    if (!prev || (row.lang === LANG && prev.lang !== LANG)) {
      byWord.set(row.word_key, row);
    }
  }

  let seeded = 0;
  let skipped = 0;

  for (const [wordKey, row] of byWord) {
    const storagePath = `baseline/${LOCALE}/${DIALECT}/${wordKey}/${LANG}.webm`;

    const { data: signed, error: signUrlErr } = await supabase.storage
      .from("user-audio")
      .createSignedUrl(row.audio_path, 300);
    if (signUrlErr || !signed?.signedUrl) {
      console.warn(`Skip ${wordKey}: signed URL failed`);
      skipped++;
      continue;
    }

    const audioRes = await fetch(signed.signedUrl);
    if (!audioRes.ok) {
      console.warn(`Skip ${wordKey}: download failed`);
      skipped++;
      continue;
    }
    const blob = await audioRes.blob();

    const { error: upErr } = await supabase.storage
      .from("global-audio")
      .upload(storagePath, blob, {
        contentType: blob.type || "audio/webm",
        upsert: true
      });
    if (upErr) {
      console.warn(`Skip ${wordKey}: upload failed —`, upErr.message);
      skipped++;
      continue;
    }

    const audioUrl = supabase.storage.from("global-audio").getPublicUrl(storagePath).data.publicUrl;

    const { data: existing } = await supabase
      .from("global_word_recordings")
      .select("id")
      .eq("word_key", wordKey)
      .eq("locale", LOCALE)
      .eq("dialect", DIALECT)
      .eq("status", "approved")
      .maybeSingle();

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("global_word_recordings")
        .update({
          lang: LANG,
          audio_url: audioUrl,
          reviewed_by: DOGGY_USER_ID,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      if (updErr) {
        console.warn(`Skip ${wordKey}: update failed —`, updErr.message);
        skipped++;
        continue;
      }
    } else {
      const { error: insErr } = await supabase.from("global_word_recordings").insert({
        word_key: wordKey,
        locale: LOCALE,
        dialect: DIALECT,
        lang: LANG,
        audio_url: audioUrl,
        status: "approved",
        submitted_by: DOGGY_USER_ID,
        reviewed_by: DOGGY_USER_ID,
        reviewed_at: new Date().toISOString()
      });
      if (insErr) {
        console.warn(`Skip ${wordKey}: insert failed —`, insErr.message);
        skipped++;
        continue;
      }
    }
    seeded++;
    console.log(`Seeded ${wordKey}`);
  }

  console.log(`Done: ${seeded} approved global recordings for ${LOCALE}/${DIALECT}, ${skipped} skipped.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
