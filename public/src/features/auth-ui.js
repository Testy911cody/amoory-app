/* Talk Board — caregiver + record-auth panel UI */

/** @type {null | Record<string, Function>} */
let ctx = null;

export function initAuthUi(deps) {
  ctx = deps;
}

export function showAuthError(errorEl, msg) {
  if (!errorEl) return;
  if (msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  } else {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
}

export function setAuthLoading(btn, loading, defaultLabel) {
  if (!btn) return;
  btn.disabled = !!loading;
  btn.textContent = loading ? ctx.t("authLoading") : defaultLabel;
}

export function resetRecordAuthPanel() {
  showAuthError(document.getElementById("recordAuthError"), "");
  const signedIn = document.getElementById("recordAuthSignedIn");
  if (signedIn) signedIn.hidden = true;
  const form = document.getElementById("recordAuthForm");
  if (form) form.hidden = false;
}

export function openRecordAuthPanel({ forCommunity = false } = {}) {
  const panel = document.getElementById("recordAuthPanel");
  if (!panel) return;
  if (!ctx.SUPABASE_READY) {
    ctx.toast(ctx.t("accountNotConfigured"));
    ctx.openPanel(ctx.getSettingsPanel());
    return;
  }
  ctx.closePanel(ctx.getSettingsPanel());
  const contribute = ctx.getContributePanel?.();
  if (contribute) ctx.closePanel(contribute);
  resetRecordAuthPanel();
  document.getElementById("recordAuthHint").textContent = forCommunity
    ? ctx.t("signInForCommunity")
    : ctx.t("recordNeedsAccount");
  document.getElementById("recordAuthTitle").textContent = forCommunity
    ? ctx.t("contribute")
    : ctx.t("account");
  document.getElementById("recordAuthUsernameLbl").textContent = ctx.t("accountUsername");
  document.getElementById("recordAuthPasswordLbl").textContent = ctx.t("accountPassword");
  const passInput = document.getElementById("recordAuthPassword");
  if (passInput) passInput.placeholder = ctx.t("accountPinPlaceholder");
  document.getElementById("recordAuthShareLbl").textContent = ctx.t("shareWithCommunityHint");
  document.getElementById("recordAuthSignInBtn").textContent = ctx.t("accountSignIn");
  document.getElementById("recordAuthSignUpBtn").textContent = ctx.t("accountSignUp");
  const userInput = document.getElementById("recordAuthUsername");
  if (userInput) userInput.placeholder = ctx.t("accountUsernamePlaceholder");
  const shareBox = document.getElementById("recordAuthShareCommunity");
  if (shareBox) shareBox.checked = ctx.getSettings().shareWithCommunity !== false;
  ctx.openPanel(panel, { focusEl: userInput });
}

export function setupRecordAuth() {
  const panel = document.getElementById("recordAuthPanel");
  if (!panel || !ctx.SUPABASE_READY) return;

  const usernameInput = document.getElementById("recordAuthUsername");
  const passInput = document.getElementById("recordAuthPassword");
  const shareBox = document.getElementById("recordAuthShareCommunity");
  const signInBtn = document.getElementById("recordAuthSignInBtn");
  const signUpBtn = document.getElementById("recordAuthSignUpBtn");
  const errorEl = document.getElementById("recordAuthError");
  const signedInEl = document.getElementById("recordAuthSignedIn");
  const formEl = document.getElementById("recordAuthForm");

  shareBox?.addEventListener("change", e => ctx.persistShareWithCommunity(e.target.checked));

  async function onAuthSuccess(user, mode) {
    const sessionUser = await ctx.getCurrentUser();
    ctx.setAuthUser(sessionUser || user);
    ctx.renderAccountBadge(ctx.getAuthUser());
    if (!ctx.getAuthUser()) {
      showAuthError(errorEl, ctx.t("accountConfirmNeeded"));
      return;
    }
    ctx.markManualAuthSession();
    signedInEl.textContent = `${ctx.t("signedInAs")} ${ctx.displayUsername(ctx.getAuthUser())}`;
    signedInEl.hidden = false;
    if (formEl) formEl.hidden = true;
    showAuthError(errorEl, "");
    await ctx.initPersonal(ctx.getAuthUser());
    ctx.checkIsAdmin().then(ctx.renderAdminLink).catch(() => ctx.renderAdminLink(false));
    await ctx.wait(600);
    ctx.closePanel(panel);
    const pending = ctx.takePendingRecordAfterAuth();
    if (pending?.word) {
      ctx.toast(mode === "signup"
        ? ctx.t("signUpSuccess")
        : `${ctx.t("signedInAs")} ${ctx.displayUsername(ctx.getAuthUser())}`);
      await ctx.startRecording(pending.word, pending.cardEl);
      return;
    }
    const pendingShare = ctx.takePendingCommunityShare();
    if (pendingShare?.word) {
      ctx.toast(mode === "signup"
        ? ctx.t("signUpSuccess")
        : `${ctx.t("signedInAs")} ${ctx.displayUsername(ctx.getAuthUser())}`);
      const result = await ctx.shareRecordingWithCommunity(pendingShare.word, pendingShare.blob);
      if (result?.rejected) ctx.toast(ctx.t("communityRejected"));
      else if (result?.entry) {
        ctx.toast(ctx.t("communitySubmitted"));
        await ctx.renderPendingQueue();
      }
    }
  }

  async function tryAuth(mode) {
    showAuthError(errorEl, "");
    const username = usernameInput?.value;
    const password = passInput?.value;
    const userCheck = ctx.validateUsername(username);
    if (!userCheck.ok) {
      showAuthError(errorEl, ctx.t("usernameInvalid"));
      usernameInput?.focus();
      return;
    }
    if (!ctx.validatePin(password).ok) {
      showAuthError(errorEl, ctx.t("passwordTooShort"));
      passInput?.focus();
      return;
    }
    ctx.persistShareWithCommunity(shareBox?.checked !== false);
    const btn = mode === "signin" ? signInBtn : signUpBtn;
    setAuthLoading(signInBtn, true, ctx.t("accountSignIn"));
    setAuthLoading(signUpBtn, true, ctx.t("accountSignUp"));
    const res = mode === "signin"
      ? await ctx.signInWithPassword(username, password)
      : await ctx.signUpWithPassword(username, password);
    setAuthLoading(signInBtn, false, ctx.t("accountSignIn"));
    setAuthLoading(signUpBtn, false, ctx.t("accountSignUp"));
    if (res.ok && res.user && !res.needsConfirm) {
      await onAuthSuccess(res.user, mode);
      return;
    }
    if (res.ok && res.needsConfirm) {
      showAuthError(errorEl, ctx.t("accountConfirmNeeded"));
      return;
    }
    showAuthError(errorEl, res.error || (mode === "signin" ? ctx.t("wrongCredentials") : ctx.t("usernameTaken")));
    btn?.focus();
  }

  signInBtn?.addEventListener("click", () => tryAuth("signin"));
  signUpBtn?.addEventListener("click", () => tryAuth("signup"));
  document.getElementById("recordAuthClose")?.addEventListener("click", () => {
    ctx.clearPendingAuthActions();
    ctx.closePanel(panel);
  });
}

export function setupCaregiverAuth() {
  const box = document.getElementById("caregiverAuth");
  if (!box || !ctx.SUPABASE_READY) return;

  const statusEl = document.getElementById("caregiverAuthStatus");
  const errorEl = document.getElementById("caregiverAuthError");
  const signInForm = document.getElementById("caregiverSignInForm");
  const signedInBox = document.getElementById("caregiverSignedIn");
  const signedInAsEl = document.getElementById("caregiverSignedInAs");
  const usernameInput = document.getElementById("caregiverUsername");
  const passInput = document.getElementById("caregiverPassword");
  const signInBtn = document.getElementById("caregiverSignInBtn");
  const signUpBtn = document.getElementById("caregiverSignUpBtn");
  const signOutBtn = document.getElementById("caregiverSignOutBtn");

  async function reflect(user) {
    ctx.setAuthUser(user || null);
    ctx.renderAccountBadge(ctx.getAuthUser());
    ctx.updateCaregiverChrome();
    showAuthError(errorEl, "");
    if (user) {
      statusEl.textContent = ctx.t("accountHint");
      signedInAsEl.textContent = `${ctx.t("signedInAs")} ${ctx.displayUsername(user)}`;
      signInForm.hidden = true;
      signedInBox.hidden = false;
      const sync = await ctx.initPersonal(user);
      if (sync.recordings || sync.words) {
        ctx.toast(`Synced ${sync.recordings} recording(s), ${sync.words} word(s).`);
      }
      ctx.renderBoard();
      await ctx.renderPersonalList();
      ctx.renderCustomWordsList();
      ctx.renderPendingQueue().catch(() => {});
      ctx.checkIsAdmin().then(ctx.renderAdminLink).catch(() => ctx.renderAdminLink(false));
    } else {
      statusEl.textContent = ctx.t("accountHint");
      signInForm.hidden = false;
      signedInBox.hidden = true;
      ctx.renderAdminLink(false);
      ctx.renderBoard();
      await ctx.renderPersonalList();
      ctx.renderCustomWordsList();
    }
  }

  async function runAuth(mode) {
    showAuthError(errorEl, "");
    const username = usernameInput?.value;
    const password = passInput?.value;
    const userCheck = ctx.validateUsername(username);
    if (!userCheck.ok) {
      showAuthError(errorEl, ctx.t("usernameInvalid"));
      usernameInput?.focus();
      return;
    }
    if (!ctx.validatePin(password).ok) {
      showAuthError(errorEl, ctx.t("passwordTooShort"));
      passInput?.focus();
      return;
    }
    ctx.persistShareWithCommunity(document.getElementById("caregiverShareCommunity")?.checked !== false);
    const btn = mode === "signin" ? signInBtn : signUpBtn;
    setAuthLoading(signInBtn, true, ctx.t("accountSignIn"));
    setAuthLoading(signUpBtn, true, ctx.t("accountSignUp"));
    const res = mode === "signin"
      ? await ctx.signInWithPassword(username, password)
      : await ctx.signUpWithPassword(username, password);
    setAuthLoading(signInBtn, false, ctx.t("accountSignIn"));
    setAuthLoading(signUpBtn, false, ctx.t("accountSignUp"));
    if (res.ok && res.user && !res.needsConfirm) {
      ctx.markManualAuthSession();
      ctx.toast(mode === "signup"
        ? ctx.t("signUpSuccess")
        : `${ctx.t("signedInAs")} ${ctx.displayUsername(res.user)}`);
      await reflect(res.user);
      return;
    }
    if (res.ok && res.needsConfirm) {
      showAuthError(errorEl, ctx.t("accountConfirmNeeded"));
      return;
    }
    showAuthError(errorEl, res.error || (mode === "signin" ? ctx.t("wrongCredentials") : ctx.t("usernameTaken")));
    btn?.focus();
  }

  signInBtn?.addEventListener("click", () => runAuth("signin"));
  signUpBtn?.addEventListener("click", () => runAuth("signup"));

  document.getElementById("caregiverShareCommunity")?.addEventListener("change", e => {
    ctx.persistShareWithCommunity(e.target.checked);
  });

  signOutBtn?.addEventListener("click", async () => {
    await ctx.signOut();
    ctx.setAuthUser(null);
    reflect(null);
  });

  ctx.getCurrentUser().then(reflect).catch(() => reflect(null));
  ctx.onAuthChange(user => reflect(user));
}
