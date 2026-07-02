/* Talk Board — admin-only Supabase helpers (loaded only from admin.html) */

import {
  getSupabase, SUPABASE_READY, getCurrentUser, USER_AUDIO_BUCKET, isOnline
} from "./supabase.js";
import { checkIsAdmin } from "./community.js";

async function requireAdmin() {
  if (!SUPABASE_READY || !isOnline()) return { ok: false, reason: "offline" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth" };
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) return { ok: false, reason: "not-admin" };
  const supabase = await getSupabase();
  return { ok: true, supabase };
}

export async function fetchDashboardStats() {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, stats: null, reason: gate.reason };
  const { data, error } = await gate.supabase.rpc("admin_dashboard_stats");
  if (error) return { ok: false, stats: null, reason: error.message };
  return { ok: true, stats: data };
}

export async function fetchAdminUsers() {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, users: [], reason: gate.reason };
  const { data, error } = await gate.supabase.rpc("admin_list_users");
  if (error) return { ok: false, users: [], reason: error.message };
  return { ok: true, users: data || [] };
}

export async function setUserAdmin(userId, isAdmin) {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const { error } = await gate.supabase
    .from("profiles")
    .update({ is_admin: !!isAdmin })
    .eq("id", userId);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function fetchCommunityWordsAdmin({ status = "pending", dialect = null, limit = 200 } = {}) {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, items: [], reason: gate.reason };
  let query = gate.supabase
    .from("community_words")
    .select("id,text,category,emoji,locale,dialect,audio_url,status,submitted_by,reviewed_by,reviewed_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status && status !== "all") query = query.eq("status", status);
  if (dialect) query = query.eq("dialect", dialect);
  const { data, error } = await query;
  if (error) return { ok: false, items: [], reason: error.message };
  return {
    ok: true,
    items: (data || []).map(row => ({
      id: row.id,
      text: row.text,
      category: row.category,
      emoji: row.emoji || "💬",
      locale: row.locale,
      dialect: row.dialect || null,
      audioUrl: row.audio_url || null,
      status: row.status,
      submittedBy: row.submitted_by,
      reviewedAt: row.reviewed_at,
      submittedAt: row.created_at
    }))
  };
}

export async function fetchGlobalRecordingsAdmin({
  status = "pending",
  locale = null,
  dialect = null,
  limit = 300
} = {}) {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, items: [], reason: gate.reason };
  let query = gate.supabase
    .from("global_word_recordings")
    .select("id,word_key,locale,dialect,lang,audio_url,status,fallback_from_dialect,submitted_by,reviewed_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status && status !== "all") query = query.eq("status", status);
  if (locale) query = query.eq("locale", locale);
  if (dialect === "sd" || dialect === "juba") {
    query = query.in("dialect", ["sd", "juba"]);
  } else if (dialect) {
    query = query.eq("dialect", dialect);
  }
  const { data, error } = await query;
  if (error) return { ok: false, items: [], reason: error.message };
  return {
    ok: true,
    items: (data || []).map(row => ({
      id: row.id,
      wordId: row.word_key,
      locale: row.locale,
      dialect: row.dialect || null,
      lang: row.lang,
      audioUrl: row.audio_url,
      status: row.status,
      fallbackFrom: row.fallback_from_dialect || null,
      submittedBy: row.submitted_by,
      reviewedAt: row.reviewed_at,
      submittedAt: row.created_at
    }))
  };
}

export async function fetchUserRecordingsAdmin({ limit = 100, offset = 0 } = {}) {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, items: [], reason: gate.reason };
  const { data, error } = await gate.supabase
    .from("user_recordings")
    .select("id,user_id,word_key,lang,audio_path,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return { ok: false, items: [], reason: error.message };

  const items = [];
  for (const row of data || []) {
    let audioUrl = null;
    if (row.audio_path) {
      const { data: signed } = await gate.supabase.storage
        .from(USER_AUDIO_BUCKET)
        .createSignedUrl(row.audio_path, 3600);
      audioUrl = signed?.signedUrl || null;
    }
    items.push({
      id: row.id,
      userId: row.user_id,
      wordKey: row.word_key,
      lang: row.lang,
      audioPath: row.audio_path,
      audioUrl,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
  return { ok: true, items };
}

/** Map word_key → { sd, juba, other } approved recording flags */
export async function fetchApprovedGlobalIndex() {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, index: new Map(), reason: gate.reason };
  const { data, error } = await gate.supabase
    .from("global_word_recordings")
    .select("word_key,dialect,locale,status,fallback_from_dialect")
    .eq("status", "approved");
  if (error) return { ok: false, index: new Map(), reason: error.message };

  const index = new Map();
  for (const row of data || []) {
    const key = row.word_key;
    if (!index.has(key)) index.set(key, { sd: false, juba: false, other: [], fallback: [] });
    const entry = index.get(key);
    const d = row.dialect || "default";
    if (d === "sd") entry.sd = true;
    else if (d === "juba") entry.juba = true;
    else entry.other.push(d);
    if (row.fallback_from_dialect) entry.fallback.push(row.fallback_from_dialect);
  }
  return { ok: true, index };
}
