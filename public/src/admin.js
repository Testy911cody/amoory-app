/* Talk Board — admin panel (approvals, dialects, global recordings) */

import {
  SUPABASE_READY, getCurrentUser, signInWithPassword, signOut,
  displayUsername, validateUsername, validatePin
} from "./supabase.js";
import { checkIsAdmin, fetchOnlinePending, approveOnlineSubmission, rejectOnlineSubmission } from "./community.js";
import {
  fetchPendingGlobalRecordings, approveGlobalRecording, rejectGlobalRecording,
  fetchGlobalRecordingsOverview
} from "./global.js";
import { recordingBadge } from "./dialect-fallback.js";
import { WORDS } from "./data.js";

const el = {
  auth: document.getElementById("adminAuth"),
  authStatus: document.getElementById("adminAuthStatus"),
  authError: document.getElementById("adminAuthError"),
  signInForm: document.getElementById("adminSignInForm"),
  signedIn: document.getElementById("adminSignedIn"),
  signedInAs: document.getElementById("adminSignedInAs"),
  signOutBtn: document.getElementById("adminSignOutBtn"),
  denied: document.getElementById("adminDenied"),
  main: document.getElementById("adminMain"),
  pendingGlobal: document.getElementById("pendingGlobalAdmin"),
  pendingCommunity: document.getElementById("pendingCommunityAdmin"),
  sdOverview: document.getElementById("sdOverviewList"),
  overviewDialect: document.getElementById("overviewDialect")
};

let activeTab = "pending-global";

function showError(msg) {
  if (!el.authError) return;
  el.authError.textContent = msg || "";
  el.authError.hidden = !msg;
}

function wordLabel(wordId) {
  for (const cat of Object.values(WORDS)) {
    const w = cat.find(x => x.id === wordId);
    if (w) return w.labels?.ar || w.labels?.en || wordId;
  }
  return wordId;
}

function renderRow({ title, meta, audioUrl, actions }) {
  const row = document.createElement("div");
  row.className = "pending-row";
  row.innerHTML = `
    <div>
      <strong>${title}</strong>
      ${meta ? `<br><small class="muted">${meta}</small>` : ""}
      ${audioUrl ? `<br><audio controls preload="none" src="${audioUrl}" style="max-width:100%;margin-top:6px"></audio>` : ""}
    </div>
    <div class="pending-actions">${actions}</div>
  `;
  return row;
}

async function renderPendingGlobal() {
  if (!el.pendingGlobal) return;
  el.pendingGlobal.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const { items, isAdmin } = await fetchPendingGlobalRecordings();
    if (!isAdmin) {
      el.pendingGlobal.innerHTML = `<p class="muted">Admin access required.</p>`;
      return;
    }
    if (!items.length) {
      el.pendingGlobal.innerHTML = `<p class="muted">No pending global recordings.</p>`;
      return;
    }
    el.pendingGlobal.innerHTML = "";
    for (const item of items) {
      const row = renderRow({
        title: wordLabel(item.wordId),
        meta: `${item.locale} / ${item.dialect || "default"} · ${item.lang}${item.dialect === "sd" || item.dialect === "juba" ? " · dialect override" : ""}`,
        audioUrl: item.audioUrl,
        actions: `
          <button type="button" class="btn-primary" data-action="approve-global" data-id="${item.id}">Approve</button>
          <button type="button" class="btn-secondary" data-action="reject-global" data-id="${item.id}">Reject</button>
        `
      });
      el.pendingGlobal.appendChild(row);
    }
  } catch (err) {
    el.pendingGlobal.innerHTML = `<p class="auth-error">${err.message || "Failed to load"}</p>`;
  }
}

async function renderPendingCommunity() {
  if (!el.pendingCommunity) return;
  el.pendingCommunity.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const { items, isAdmin } = await fetchOnlinePending();
    if (!isAdmin) {
      el.pendingCommunity.innerHTML = `<p class="muted">Admin access required.</p>`;
      return;
    }
    if (!items.length) {
      el.pendingCommunity.innerHTML = `<p class="muted">No pending community words.</p>`;
      return;
    }
    el.pendingCommunity.innerHTML = "";
    for (const item of items) {
      const row = renderRow({
        title: `${item.emoji} ${item.text}`,
        meta: `${item.locale} / ${item.dialect || "default"} · ${item.category}`,
        audioUrl: item.audioUrl,
        actions: `
          <button type="button" class="btn-primary" data-action="approve-community" data-id="${item.id}">Approve</button>
          <button type="button" class="btn-secondary" data-action="reject-community" data-id="${item.id}">Reject</button>
        `
      });
      el.pendingCommunity.appendChild(row);
    }
  } catch (err) {
    el.pendingCommunity.innerHTML = `<p class="auth-error">${err.message || "Failed to load"}</p>`;
  }
}

async function renderSdOverview() {
  if (!el.sdOverview) return;
  const viewingDialect = el.overviewDialect?.value ?? "sd";
  el.sdOverview.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const { items, isAdmin } = await fetchGlobalRecordingsOverview({
      locale: "ar",
      dialect: viewingDialect || null
    });
    if (!isAdmin) {
      el.sdOverview.innerHTML = `<p class="muted">Admin access required.</p>`;
      return;
    }
    if (!items.length) {
      el.sdOverview.innerHTML = `<p class="muted">No approved recordings for this filter.</p>`;
      return;
    }
    el.sdOverview.innerHTML = "";
    const sorted = [...items].sort((a, b) => {
      const labelA = wordLabel(a.wordId);
      const labelB = wordLabel(b.wordId);
      return labelA.localeCompare(labelB) || (a.dialect || "").localeCompare(b.dialect || "");
    });
    for (const item of sorted) {
      const badge = recordingBadge(viewingDialect || item.dialect, {
        dialect: item.dialect,
        fallbackFrom: item.fallbackFrom
      });
      const row = document.createElement("div");
      row.className = "pending-row";
      row.innerHTML = `
        <div>
          <strong>${wordLabel(item.wordId)}</strong>
          <span class="admin-badge ${badge.class}">${badge.label}</span>
          <br><small class="muted">${item.wordId} · ${item.lang}</small>
          ${item.audioUrl ? `<br><audio controls preload="none" src="${item.audioUrl}" style="max-width:100%;margin-top:6px"></audio>` : ""}
        </div>
      `;
      el.sdOverview.appendChild(row);
    }
  } catch (err) {
    el.sdOverview.innerHTML = `<p class="auth-error">${err.message || "Failed to load"}</p>`;
  }
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".admin-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.getElementById("tab-pending-global").hidden = tab !== "pending-global";
  document.getElementById("tab-pending-community").hidden = tab !== "pending-community";
  document.getElementById("tab-sd-recordings").hidden = tab !== "sd-recordings";
  if (tab === "pending-global") renderPendingGlobal();
  else if (tab === "pending-community") renderPendingCommunity();
  else if (tab === "sd-recordings") renderSdOverview();
}

async function handleAction(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
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
    if (activeTab === "pending-global") await renderPendingGlobal();
    else if (activeTab === "pending-community") await renderPendingCommunity();
    else await renderSdOverview();
  } catch (err) {
    showError(err.message || "Action failed");
  } finally {
    btn.disabled = false;
  }
}

async function reflectAuth(user) {
  showError("");
  if (!SUPABASE_READY) {
    el.authStatus.textContent = "Supabase is not configured for this build.";
    return;
  }
  if (!user) {
    el.signInForm.hidden = false;
    el.signedIn.hidden = true;
    el.main.hidden = true;
    el.denied.hidden = true;
    el.authStatus.textContent = "Sign in with an admin account.";
    return;
  }
  el.signInForm.hidden = true;
  el.signedIn.hidden = false;
  el.signedInAs.textContent = `Signed in as ${displayUsername(user)}`;
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    el.main.hidden = true;
    el.denied.hidden = false;
    return;
  }
  el.denied.hidden = true;
  el.main.hidden = false;
  switchTab(activeTab);
}

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

el.signOutBtn?.addEventListener("click", async () => {
  await signOut();
  await reflectAuth(null);
});

document.querySelectorAll(".admin-tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

el.overviewDialect?.addEventListener("change", () => renderSdOverview());

document.getElementById("adminMain")?.addEventListener("click", handleAction);

(async function init() {
  if (!SUPABASE_READY) {
    el.authStatus.textContent = "Supabase is not configured. Run build with env keys.";
    return;
  }
  const user = await getCurrentUser();
  await reflectAuth(user);
})();
