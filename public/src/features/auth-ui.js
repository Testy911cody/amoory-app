/* Talk Board — caregiver + record-auth panel UI */

/** @type {null | Record<string, Function>} */
let ctx = null;

const RECENT_ACCOUNTS_KEY = "talkboard_recent_accounts";
const MAX_RECENT_ACCOUNTS = 8;

export function initAuthUi(deps) {
  ctx = deps;
}

function normalizeStoredUsername(raw) {
  return String(raw || "").trim().toLowerCase().replace(/^@/, "");
}

export function loadRecentAccounts() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_ACCOUNTS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const item of raw) {
      const name = normalizeStoredUsername(item);
      if (!/^[a-z0-9_]{3,}$/.test(name) || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
      if (out.length >= MAX_RECENT_ACCOUNTS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function rememberRecentAccount(username) {
  const name = normalizeStoredUsername(username);
  if (!/^[a-z0-9_]{3,}$/.test(name)) return;
  const next = [name, ...loadRecentAccounts().filter(u => u !== name)].slice(0, MAX_RECENT_ACCOUNTS);
  try {
    localStorage.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify(next));
  } catch { /* quota / private mode */ }
}

function currentStoredUsername() {
  const user = ctx?.getAuthUser?.();
  if (!user) return null;
  const name = normalizeStoredUsername(ctx.displayUsername(user));
  return name || null;
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
    rememberRecentAccount(ctx.displayUsername(ctx.getAuthUser()));
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
    if (user) rememberRecentAccount(ctx.displayUsername(user));
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
      rememberRecentAccount(ctx.displayUsername(res.user));
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

export function setupAccountSwitcher() {
  const badge = document.getElementById("accountBadge");
  const menu = document.getElementById("accountSwitcher");
  const wrap = document.getElementById("accountSwitcherWrap");
  if (!badge || !menu || !wrap) return;

  let pinFor = null;
  let signingIn = false;

  function isOpen() {
    return !menu.hidden;
  }

  function closeSwitcher() {
    menu.hidden = true;
    menu.innerHTML = "";
    pinFor = null;
    signingIn = false;
    badge.setAttribute("aria-expanded", "false");
  }

  function formatName(username) {
    return `@${username}`;
  }

  function renderMenu() {
    const current = currentStoredUsername();
    const recent = loadRecentAccounts().filter(u => u !== current);
    menu.innerHTML = "";

    const title = document.createElement("div");
    title.className = "account-switcher-title";
    title.id = "accountSwitcherTitle";
    title.textContent = ctx.t("switchAccount");
    menu.appendChild(title);
    menu.setAttribute("aria-labelledby", "accountSwitcherTitle");

    const list = document.createElement("div");
    list.className = "account-switcher-list";
    list.setAttribute("role", "none");

    function addItem({ id, label, current = false, guest = false, onClick }) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "account-switcher-item";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", current ? "true" : "false");
      btn.dataset.account = id;
      if (current) btn.classList.add("is-current");
      if (guest) btn.classList.add("is-guest");
      btn.textContent = label;
      btn.addEventListener("click", onClick);
      list.appendChild(btn);
    }

    if (current) {
      addItem({
        id: current,
        label: formatName(current),
        current: true,
        onClick: () => closeSwitcher()
      });
    }

    for (const name of recent) {
      addItem({
        id: name,
        label: formatName(name),
        onClick: () => showPinFor(name)
      });
    }

    addItem({
      id: "guest",
      label: ctx.t("guestAccount"),
      current: !current,
      guest: true,
      onClick: () => {
        if (!current) {
          closeSwitcher();
          return;
        }
        switchToGuest();
      }
    });

    addItem({
      id: "add",
      label: ctx.t("switchAddAccount"),
      onClick: () => {
        closeSwitcher();
        ctx.openAccountSettings?.();
      }
    });

    menu.appendChild(list);

    if (pinFor) {
      const pinBox = document.createElement("div");
      pinBox.className = "account-switcher-pin";
      const lbl = document.createElement("label");
      lbl.className = "account-switcher-pin-lbl";
      lbl.setAttribute("for", "accountSwitcherPinInput");
      lbl.textContent = ctx.t("switchAccountPin").replace("{name}", formatName(pinFor));
      const row = document.createElement("div");
      row.className = "account-switcher-pin-row";
      const input = document.createElement("input");
      input.id = "accountSwitcherPinInput";
      input.type = "password";
      input.inputMode = "numeric";
      input.maxLength = 4;
      input.autocomplete = "off";
      input.pattern = "[0-9]*";
      input.placeholder = "••••";
      input.setAttribute("aria-label", lbl.textContent);
      const submit = document.createElement("button");
      submit.type = "button";
      submit.className = "btn-primary";
      submit.textContent = ctx.t("accountSignIn");
      submit.addEventListener("click", () => trySwitchTo(pinFor, input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          trySwitchTo(pinFor, input.value);
        }
      });
      input.addEventListener("input", () => {
        const digits = input.value.replace(/\D/g, "").slice(0, 4);
        if (input.value !== digits) input.value = digits;
        if (digits.length === 4) trySwitchTo(pinFor, digits);
      });
      row.append(input, submit);
      pinBox.append(lbl, row);
      const err = document.createElement("p");
      err.className = "account-switcher-error";
      err.id = "accountSwitcherError";
      err.hidden = true;
      err.setAttribute("role", "alert");
      pinBox.appendChild(err);
      menu.appendChild(pinBox);
      requestAnimationFrame(() => input.focus());
    }
  }

  function showPinFor(username) {
    pinFor = username;
    renderMenu();
  }

  function setSwitcherError(msg) {
    const err = document.getElementById("accountSwitcherError");
    if (!err) return;
    if (msg) {
      err.textContent = msg;
      err.hidden = false;
    } else {
      err.textContent = "";
      err.hidden = true;
    }
  }

  async function trySwitchTo(username, pin) {
    if (signingIn) return;
    const pinCheck = ctx.validatePin(pin);
    if (!pinCheck.ok) {
      setSwitcherError(ctx.t("passwordTooShort"));
      return;
    }
    signingIn = true;
    setSwitcherError("");
    const submit = menu.querySelector(".account-switcher-pin .btn-primary");
    const input = document.getElementById("accountSwitcherPinInput");
    if (submit) {
      submit.disabled = true;
      submit.textContent = ctx.t("switchingAccount");
    }
    if (input) input.disabled = true;
    const res = await ctx.signInWithPassword(username, pinCheck.pin);
    if (!res.ok || !res.user || res.needsConfirm) {
      signingIn = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = ctx.t("accountSignIn");
      }
      if (input) {
        input.disabled = false;
        input.value = "";
        input.focus();
      }
      setSwitcherError(res.error || ctx.t("wrongCredentials"));
      return;
    }
    ctx.markManualAuthSession();
    rememberRecentAccount(username);
    ctx.setAuthUser(res.user);
    ctx.renderAccountBadge(res.user);
    ctx.toast(`${ctx.t("signedInAs")} ${ctx.displayUsername(res.user)}`);
    closeSwitcher();
  }

  async function switchToGuest() {
    if (signingIn) return;
    signingIn = true;
    await ctx.signOut();
    ctx.setAuthUser(null);
    ctx.renderAccountBadge(null);
    ctx.updateCaregiverChrome?.();
    ctx.toast(ctx.t("switchedToGuest"));
    closeSwitcher();
  }

  function openSwitcher() {
    pinFor = null;
    menu.hidden = false;
    badge.setAttribute("aria-expanded", "true");
    renderMenu();
  }

  badge.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen()) closeSwitcher();
    else openSwitcher();
  });

  document.addEventListener("click", (e) => {
    if (!isOpen()) return;
    if (wrap.contains(e.target)) return;
    closeSwitcher();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      e.preventDefault();
      closeSwitcher();
      badge.focus();
    }
  });
}

