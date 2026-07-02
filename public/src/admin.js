/* Talk Board — full admin dashboard (admin.html only) */

import {
  SUPABASE_READY, getCurrentUser, signInWithPassword, signOut,
  displayUsername, validateUsername, validatePin
} from "./supabase.js";
import { checkIsAdmin, fetchOnlinePending, approveOnlineSubmission, rejectOnlineSubmission } from "./community.js";
import {
  fetchPendingGlobalRecordings, approveGlobalRecording, rejectGlobalRecording
} from "./global.js";
import { recordingBadge } from "./dialect-fallback.js";
import { WORDS } from "./data.js";
import {
  fetchDashboardStats, fetchAdminUsers, setUserAdmin,
  fetchCommunityWordsAdmin, fetchGlobalRecordingsAdmin,
  fetchUserRecordingsAdmin, fetchApprovedGlobalIndex
} from "./admin-api.js";

const DIALECT_LABELS = { sd: "Sudanese", juba: "Juba", eg: "Egyptian", msa: "MSA", default: "default" };
const TAB_TITLES = {
  dashboard: "Dashboard",
  moderation: "Moderation queue",
  users: "Users",
  community: "Community words",
  global: "Global recordings",
  "user-rec": "User recordings",
  words: "Words overview"
};

let activeTab = "dashboard";
let userRecOffset = 0;
let usersCache = [];
let pendingCounts = { words: 0, recordings: 0 };

const el = {
  gate: document.getElementById("adminGate"),
  authStatus: document.getElementById("adminAuthStatus"),
  authError: document.getElementById("adminAuthError"),
  signInForm: document.getElementById("adminSignInForm"),
  signedIn: document.getElementById("adminSignedIn"),
  signedInAs: document.getElementById("adminSignedInAs"),
  signOutBtn: document.getElementById("adminSignOutBtn"),
  denied: document.getElementById("adminDenied"),
  shell: document.getElementById("adminShell"),
  sidebarUser: document.getElementById("adminSidebarUser"),
  shellSignOut: document.getElementById("adminShellSignOut"),
  pageTitle: document.getElementById("adminPageTitle"),
  refreshBtn: document.getElementById("adminRefreshBtn"),
  navModCount: document.getElementById("navModCount"),
  dashboardStats: document.getElementById("dashboardStats"),
  moderationQueue: document.getElementById("moderationQueue"),
  usersTableBody: document.getElementById("usersTableBody"),
  userSearch: document.getElementById("userSearch"),
  communityWordsList: document.getElementById("communityWordsList"),
  communityStatusFilter: document.getElementById("communityStatusFilter"),
  communityDialectFilter: document.getElementById("communityDialectFilter"),
  globalRecordingsList: document.getElementById("globalRecordingsList"),
  globalStatusFilter: document.getElementById("globalStatusFilter"),
  globalLocaleFilter: document.getElementById("globalLocaleFilter"),
  globalDialectFilter: document.getElementById("globalDialectFilter"),
  userRecordingsList: document.getElementById("userRecordingsList"),
  userRecLoadMore: document.getElementById("userRecLoadMore"),
  wordsOverviewGrid: document.getElementById("wordsOverviewGrid"),
  wordsCoverageFilter: document.getElementById("wordsCoverageFilter"),
  mobileNav: document.getElementById("adminMobileNav")
};

function dialectBadgeHtml(locale, dialect) {
  if (!dialect && !locale) return "";
  const d = dialect || "default";
  const label = DIALECT_LABELS[d] || d;
  const shared = locale === "ar" && (d === "sd" || d === "juba");
  const cls = shared ? "shared" : "native";
  return `<span class="admin-badge ${cls}">${label}</span>`;
}

function statusBadge(status) {
  return `<span class="admin-badge ${status}">${status}</span>`;
}

function wordLabel(wordId) {
  for (const cat of Object.values(WORDS)) {
    const w = cat.find(x => x.id === wordId);
    if (w) return w.labels?.ar || w.labels?.en || wordId;
  }
  return wordId;
}

function allBuiltinWords() {
  const list = [];
  for (const [category, words] of Object.entries(WORDS)) {
    for (const w of words) list.push({ ...w, category });
  }
  return list;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function showError(msg) {
  if (!el.authError) return;
  el.authError.textContent = msg || "";
  el.authError.hidden = !msg;
}

function renderRow({ title, meta, audioUrl, actions, badges = "" }) {
  const row = document.createElement("div");
  row.className = "pending-row";
  row.innerHTML = `
    <div>
      <strong>${title}</strong> ${badges}
      ${meta ? `<br><small class="muted">${meta}</small>` : ""}
      ${audioUrl ? `<br><audio controls preload="none" src="${audioUrl}" style="max-width:100%;margin-top:6px"></audio>` : ""}
    </div>
    ${actions ? `<div class="pending-actions">${actions}</div>` : ""}
  `;
  return row;
}

function updateModCount() {
  const total = pendingCounts.words + pendingCounts.recordings;
  if (el.navModCount) {
    el.navModCount.textContent = String(total);
    el.navModCount.hidden = total === 0;
  }
}

async function refreshPendingCounts() {
  try {
    const [{ items: words }, { items: recs }] = await Promise.all([
      fetchOnlinePending(),
      fetchPendingGlobalRecordings()
    ]);
    pendingCounts = { words: words.length, recordings: recs.length };
    updateModCount();
  } catch { /* ignore */ }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

async function renderDashboard() {
  if (!el.dashboardStats) return;
  el.dashboardStats.innerHTML = `<p class="muted">Loading…</p>`;
  const { ok, stats, reason } = await fetchDashboardStats();
  if (!ok) {
    el.dashboardStats.innerHTML = `<p class="auth-error">${reason || "Failed to load stats"}</p>`;
    return;
  }
  const cards = [
    { num: stats.users, lbl: "Users" },
    { num: stats.pending_words, lbl: "Pending words" },
    { num: stats.pending_recordings, lbl: "Pending recordings" },
    { num: stats.approved_global, lbl: "Approved global" },
    { num: stats.user_recordings, lbl: "User recordings" }
  ];
  el.dashboardStats.innerHTML = cards.map(c => `
    <div class="admin-stat"><div class="num">${c.num ?? 0}</div><div class="lbl">${c.lbl}</div></div>
  `).join("");
  pendingCounts = {
    words: stats.pending_words ?? 0,
    recordings: stats.pending_recordings ?? 0
  };
  updateModCount();
}

// ─── Moderation queue ──────────────────────────────────────────────────────

async function renderModeration() {
  if (!el.moderationQueue) return;
  el.moderationQueue.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const [{ items: words }, { items: recs }] = await Promise.all([
      fetchOnlinePending(),
      fetchPendingGlobalRecordings()
    ]);
    pendingCounts = { words: words.length, recordings: recs.length };
    updateModCount();
    if (!words.length && !recs.length) {
      el.moderationQueue.innerHTML = `<p class="muted">Queue empty — nothing pending.</p>`;
      return;
    }
    el.moderationQueue.innerHTML = "";
    if (words.length) {
      const h = document.createElement("h3");
      h.textContent = `Community words (${words.length})`;
      el.moderationQueue.appendChild(h);
      for (const item of words) {
        el.moderationQueue.appendChild(renderRow({
          title: `${item.emoji} ${item.text}`,
          meta: `${item.locale} / ${item.dialect || "default"} · ${item.category} · ${formatDate(item.submittedAt)}`,
          badges: dialectBadgeHtml(item.locale, item.dialect),
          audioUrl: item.audioUrl,
          actions: `
            <button type="button" class="btn-primary" data-action="approve-community" data-id="${item.id}">Approve</button>
            <button type="button" class="btn-secondary" data-action="reject-community" data-id="${item.id}">Reject</button>
          `
        }));
      }
    }
    if (recs.length) {
      const h = document.createElement("h3");
      h.textContent = `Global recordings (${recs.length})`;
      h.style.marginTop = "20px";
      el.moderationQueue.appendChild(h);
      for (const item of recs) {
        el.moderationQueue.appendChild(renderRow({
          title: wordLabel(item.wordId),
          meta: `${item.locale} / ${item.dialect || "default"} · ${item.lang} · ${formatDate(item.submittedAt)}`,
          badges: dialectBadgeHtml(item.locale, item.dialect),
          audioUrl: item.audioUrl,
          actions: `
            <button type="button" class="btn-primary" data-action="approve-global" data-id="${item.id}">Approve</button>
            <button type="button" class="btn-secondary" data-action="reject-global" data-id="${item.id}">Reject</button>
          `
        }));
      }
    }
  } catch (err) {
    el.moderationQueue.innerHTML = `<p class="auth-error">${err.message}</p>`;
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

function renderUsersTable(filter = "") {
  if (!el.usersTableBody) return;
  const q = filter.trim().toLowerCase();
  const rows = usersCache.filter(u => {
    if (!q) return true;
    return (u.username || "").toLowerCase().includes(q)
      || (u.email || "").toLowerCase().includes(q);
  });
  if (!rows.length) {
    el.usersTableBody.innerHTML = `<tr><td colspan="4" class="muted">No users found.</td></tr>`;
    return;
  }
  el.usersTableBody.innerHTML = rows.map(u => `
    <tr>
      <td>
        <strong>@${u.username || "—"}</strong>
        ${u.is_admin ? '<span class="admin-badge admin-user">admin</span>' : ""}
        <br><small class="muted">${u.email || ""}</small>
      </td>
      <td>
        <label class="admin-toggle">
          <input type="checkbox" data-action="toggle-admin" data-id="${u.id}" ${u.is_admin ? "checked" : ""}>
          Admin
        </label>
      </td>
      <td>${formatDate(u.created_at)}</td>
      <td>${formatDate(u.last_sign_in_at)}</td>
    </tr>
  `).join("");
}

async function renderUsers() {
  if (!el.usersTableBody) return;
  el.usersTableBody.innerHTML = `<tr><td colspan="4" class="muted">Loading…</td></tr>`;
  const { ok, users, reason } = await fetchAdminUsers();
  if (!ok) {
    el.usersTableBody.innerHTML = `<tr><td colspan="4" class="auth-error">${reason}</td></tr>`;
    return;
  }
  usersCache = users;
  renderUsersTable(el.userSearch?.value || "");
}

// ─── Community words ─────────────────────────────────────────────────────────

async function renderCommunity() {
  if (!el.communityWordsList) return;
  const status = el.communityStatusFilter?.value || "pending";
  const dialect = el.communityDialectFilter?.value || null;
  el.communityWordsList.innerHTML = `<p class="muted">Loading…</p>`;
  const { ok, items, reason } = await fetchCommunityWordsAdmin({ status, dialect: dialect || null });
  if (!ok) {
    el.communityWordsList.innerHTML = `<p class="auth-error">${reason}</p>`;
    return;
  }
  if (!items.length) {
    el.communityWordsList.innerHTML = `<p class="muted">No community words for this filter.</p>`;
    return;
  }
  el.communityWordsList.innerHTML = "";
  for (const item of items) {
    const actions = item.status === "pending"
      ? `<button type="button" class="btn-primary" data-action="approve-community" data-id="${item.id}">Approve</button>
         <button type="button" class="btn-secondary" data-action="reject-community" data-id="${item.id}">Reject</button>`
      : "";
    el.communityWordsList.appendChild(renderRow({
      title: `${item.emoji} ${item.text}`,
      meta: `${item.locale} / ${item.dialect || "default"} · ${item.category} · ${formatDate(item.submittedAt)}`,
      badges: `${statusBadge(item.status)} ${dialectBadgeHtml(item.locale, item.dialect)}`,
      audioUrl: item.audioUrl,
      actions
    }));
  }
}

// ─── Global recordings ───────────────────────────────────────────────────────

async function renderGlobal() {
  if (!el.globalRecordingsList) return;
  const status = el.globalStatusFilter?.value || "pending";
  const locale = el.globalLocaleFilter?.value || null;
  const dialect = el.globalDialectFilter?.value || null;
  el.globalRecordingsList.innerHTML = `<p class="muted">Loading…</p>`;
  const { ok, items, reason } = await fetchGlobalRecordingsAdmin({
    status,
    locale: locale || null,
    dialect: dialect || null
  });
  if (!ok) {
    el.globalRecordingsList.innerHTML = `<p class="auth-error">${reason}</p>`;
    return;
  }
  if (!items.length) {
    el.globalRecordingsList.innerHTML = `<p class="muted">No recordings for this filter.</p>`;
    return;
  }
  el.globalRecordingsList.innerHTML = "";
  const viewingDialect = dialect || "sd";
  for (const item of items) {
    const fb = item.status === "approved"
      ? recordingBadge(viewingDialect, { dialect: item.dialect, fallbackFrom: item.fallbackFrom })
      : null;
    const fbHtml = fb ? `<span class="admin-badge ${fb.class}">${fb.label}</span>` : "";
    const actions = item.status === "pending"
      ? `<button type="button" class="btn-primary" data-action="approve-global" data-id="${item.id}">Approve</button>
         <button type="button" class="btn-secondary" data-action="reject-global" data-id="${item.id}">Reject</button>`
      : "";
    el.globalRecordingsList.appendChild(renderRow({
      title: wordLabel(item.wordId),
      meta: `${item.wordId} · ${item.locale} / ${item.dialect || "default"} · ${item.lang} · ${formatDate(item.submittedAt)}`,
      badges: `${statusBadge(item.status)} ${fbHtml} ${dialectBadgeHtml(item.locale, item.dialect)}`,
      audioUrl: item.audioUrl,
      actions
    }));
  }
}

// ─── User recordings ─────────────────────────────────────────────────────────

async function renderUserRecordings(append = false) {
  if (!el.userRecordingsList) return;
  if (!append) {
    userRecOffset = 0;
    el.userRecordingsList.innerHTML = `<p class="muted">Loading…</p>`;
    if (!usersCache.length) {
      const { ok, users } = await fetchAdminUsers();
      if (ok) usersCache = users;
    }
  }
  const { ok, items, reason } = await fetchUserRecordingsAdmin({ offset: userRecOffset, limit: 50 });
  if (!ok) {
    el.userRecordingsList.innerHTML = `<p class="auth-error">${reason}</p>`;
    return;
  }
  if (!append) el.userRecordingsList.innerHTML = "";
  if (!items.length && !append) {
    el.userRecordingsList.innerHTML = `<p class="muted">No user recordings yet.</p>`;
    if (el.userRecLoadMore) el.userRecLoadMore.hidden = true;
    return;
  }
  const userMap = new Map(usersCache.map(u => [u.id, u.username]));
  for (const item of items) {
    const uname = userMap.get(item.userId) || item.userId?.slice(0, 8);
    el.userRecordingsList.appendChild(renderRow({
      title: wordLabel(item.wordKey) || item.wordKey,
      meta: `@${uname} · ${item.lang} · ${formatDate(item.updatedAt)}`,
      audioUrl: item.audioUrl
    }));
  }
  userRecOffset += items.length;
  if (el.userRecLoadMore) el.userRecLoadMore.hidden = items.length < 50;
}

// ─── Words overview ──────────────────────────────────────────────────────────

async function renderWordsOverview() {
  if (!el.wordsOverviewGrid) return;
  el.wordsOverviewGrid.innerHTML = `<p class="muted">Loading…</p>`;
  const { ok, index, reason } = await fetchApprovedGlobalIndex();
  if (!ok) {
    el.wordsOverviewGrid.innerHTML = `<p class="auth-error">${reason}</p>`;
    return;
  }
  const filter = el.wordsCoverageFilter?.value || "all";
  const words = allBuiltinWords();
  el.wordsOverviewGrid.innerHTML = "";
  for (const w of words) {
    const cov = index.get(w.id) || { sd: false, juba: false };
    const hasSd = cov.sd;
    const hasJuba = cov.juba;
    let cls = "has-both";
    if (!hasSd && !hasJuba) cls = "missing-both";
    else if (!hasSd) cls = "missing-sd";
    else if (!hasJuba) cls = "missing-juba";
    if (filter === "missing-sd" && hasSd) continue;
    if (filter === "missing-juba" && hasJuba) continue;
    if (filter === "missing-both" && (hasSd || hasJuba)) continue;
    const chip = document.createElement("div");
    chip.className = `admin-word-chip ${cls}`;
    chip.innerHTML = `
      <span>${w.emoji}</span>
      <span>${w.labels?.en || w.id}</span>
      <span class="admin-badge ${hasSd ? "approved" : "pending"}" title="Sudanese">sd</span>
      <span class="admin-badge ${hasJuba ? "approved" : "pending"}" title="Juba">juba</span>
    `;
    el.wordsOverviewGrid.appendChild(chip);
  }
  if (!el.wordsOverviewGrid.children.length) {
    el.wordsOverviewGrid.innerHTML = `<p class="muted">No words match this filter.</p>`;
  }
}

// ─── Tab routing ─────────────────────────────────────────────────────────────

async function renderActiveTab() {
  switch (activeTab) {
    case "dashboard": await renderDashboard(); break;
    case "moderation": await renderModeration(); break;
    case "users": await renderUsers(); break;
    case "community": await renderCommunity(); break;
    case "global": await renderGlobal(); break;
    case "user-rec": await renderUserRecordings(false); break;
    case "words": await renderWordsOverview(); break;
  }
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".admin-nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".admin-section-panel").forEach(panel => {
    const id = panel.id.replace("panel-", "");
    panel.hidden = id !== tab;
  });
  document.querySelectorAll("#adminMobileNav button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  if (el.pageTitle) el.pageTitle.textContent = TAB_TITLES[tab] || tab;
  renderActiveTab();
}

function initMobileNav() {
  if (!el.mobileNav) return;
  el.mobileNav.innerHTML = Object.entries(TAB_TITLES).map(([tab, label]) =>
    `<button type="button" data-tab="${tab}">${label}</button>`
  ).join("");
  el.mobileNav.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

// ─── Actions ─────────────────────────────────────────────────────────────────

async function handleAction(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  if (btn.dataset.action === "toggle-admin") {
    const userId = btn.dataset.id;
    const isAdmin = btn.checked;
    btn.disabled = true;
    const res = await setUserAdmin(userId, isAdmin);
    if (!res.ok) {
      showError(res.reason || "Failed to update admin flag");
      btn.checked = !isAdmin;
    } else {
      const u = usersCache.find(x => x.id === userId);
      if (u) u.is_admin = isAdmin;
    }
    btn.disabled = false;
    return;
  }

  const id = btn.dataset.id;
  const action = btn.dataset.action;
  btn.disabled = true;
  try {
    let res;
    if (action === "approve-global") res = await approveGlobalRecording(id);
    else if (action === "reject-global") res = await rejectGlobalRecording(id);
    else if (action === "approve-community") res = await approveOnlineSubmission(id);
    else if (action === "reject-community") res = await rejectOnlineSubmission(id);
    if (res && !res.ok) throw new Error(res.reason || "Action failed");
    await refreshPendingCounts();
    await renderActiveTab();
    if (activeTab === "dashboard") await renderDashboard();
  } catch (err) {
    showError(err.message || "Action failed");
  } finally {
    btn.disabled = false;
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function reflectAuth(user) {
  showError("");
  if (!SUPABASE_READY) {
    el.authStatus.textContent = "Supabase is not configured for this build.";
    return;
  }
  if (!user) {
    el.gate.hidden = false;
    el.signInForm.hidden = false;
    el.signedIn.hidden = true;
    el.denied.hidden = true;
    el.shell.hidden = true;
    el.authStatus.textContent = "Sign in with an admin account.";
    return;
  }
  el.signInForm.hidden = true;
  el.signedIn.hidden = false;
  el.signedInAs.textContent = `Signed in as ${displayUsername(user)}`;
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    el.gate.hidden = true;
    el.shell.hidden = true;
    el.denied.hidden = false;
    return;
  }
  el.gate.hidden = true;
  el.denied.hidden = true;
  el.shell.hidden = false;
  if (el.sidebarUser) el.sidebarUser.textContent = displayUsername(user);
  await refreshPendingCounts();
  switchTab(activeTab);
}

async function doSignOut() {
  await signOut();
  await reflectAuth(null);
}

// ─── Init ────────────────────────────────────────────────────────────────────

document.querySelectorAll(".admin-nav-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

el.signInForm?.addEventListener("submit", async e => {
  e.preventDefault();
  showError("");
  const username = document.getElementById("adminUsername")?.value;
  const password = document.getElementById("adminPassword")?.value;
  if (!validateUsername(username).ok) {
    showError("Username must be 3+ letters, numbers, or underscores.");
    return;
  }
  if (!validatePin(password).ok) {
    showError("PIN must be 4 digits.");
    return;
  }
  const res = await signInWithPassword(username, password);
  if (!res.ok) {
    showError(res.error || "Sign-in failed.");
    return;
  }
  await reflectAuth(await getCurrentUser());
});

el.signOutBtn?.addEventListener("click", doSignOut);
el.shellSignOut?.addEventListener("click", doSignOut);
el.refreshBtn?.addEventListener("click", () => renderActiveTab());
el.userRecLoadMore?.addEventListener("click", () => renderUserRecordings(true));

el.userSearch?.addEventListener("input", () => renderUsersTable(el.userSearch.value));
el.communityStatusFilter?.addEventListener("change", () => renderCommunity());
el.communityDialectFilter?.addEventListener("change", () => renderCommunity());
el.globalStatusFilter?.addEventListener("change", () => renderGlobal());
el.globalLocaleFilter?.addEventListener("change", () => renderGlobal());
el.globalDialectFilter?.addEventListener("change", () => renderGlobal());
el.wordsCoverageFilter?.addEventListener("change", () => renderWordsOverview());

document.getElementById("adminContent")?.addEventListener("click", handleAction);
document.getElementById("adminContent")?.addEventListener("change", handleAction);

document.querySelectorAll("[data-goto]").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.goto));
});

initMobileNav();

(async function init() {
  if (!SUPABASE_READY) {
    el.authStatus.textContent = "Supabase is not configured. Run build with env keys.";
    return;
  }
  const user = await getCurrentUser();
  await reflectAuth(user);
})();
