import { api } from "./api.js";
import { exportSheets, getPreferredExportFormat } from "./export-utils.js";

/* ----------------------------------------
   DOM ELEMENTS
---------------------------------------- */
// Small helpers to avoid null dereferences
const $ = (id) => document.getElementById(id);
const setText = (el, text) => {
  if (el) el.innerText = text;
};

const formatShortDateTime = (value) => {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatAchievementValue = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace(/\.?0+$/, "");
};

const formatBooleanAchievementValue = (value) => (Boolean(value) ? "true" : "false");

const editBtn = $("editProfileBtn");
const form = $("editForm");
const cancelBtn = $("cancelEditBtn");
const saveBtn = $("saveProfileBtn");
const statusEl = $("profileStatus");

// SUMMARY ELEMENTS
const f = {
  fullName: $("fullName"),
  username: $("username"),
  email: $("email"),
  phoneNumber: $("phoneNumber"),
  location: $("location"),
  role: $("role"),
  createdAt: $("createdAt"),
  bio: $("bio"),
};

// FORM INPUTS
const input = {
  fullName: $("input_fullName"),
  username: $("input_username"),
  email: $("input_email"),
  phoneNumber: $("input_phoneNumber"),
  location: $("input_location"),
  bio: $("input_bio"),
};

// SECURITY STATS
const stats = {
  lastLogin: $("stat_lastLogin"),
  uploads: $("stat_uploads"),
};

const activityBody = $("activityBody");
const achievementGrid = $("achievementGrid");
const achievementStatus = $("achievementStatus");

// Linked accounts + identity placeholders
const linkedAccountsList = $("linkedAccountsList");
const identityEls = {
  address: $("identityAddress"),
  employer: $("identityEmployer"),
  income: $("identityIncome"),
};
const identityDisplay = $("identityDisplay");
const identityForm = $("identityForm");
const identityInput = {
  address: $("input_identityAddress"),
  employer: $("input_identityEmployer"),
  income: $("input_identityIncome"),
};
const currentIdentity = {
  address: "",
  employer: "",
  income: "",
};

const linkAccountBtn = $("linkAccountBtn");
const syncAccountsBtn = $("syncAccountsBtn");
const unlinkAccountModal = $("unlinkAccountModal");
const unlinkAccountText = $("unlinkAccountText");
const closeUnlinkAccountModal = $("closeUnlinkAccountModal");
const cancelUnlinkAccount = $("cancelUnlinkAccount");
const unlinkWithoutExportBtn = $("unlinkWithoutExportBtn");
const exportAndUnlinkBtn = $("exportAndUnlinkBtn");

let plaidAccounts = [];
let plaidConfigured = true;
let plaidHandler = null;
let pendingUnlinkContext = null;
const expandedBankGroups = new Set();
let bankGroupsInitialized = false;

const formatMoney = (value, currency = "USD") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Balance unavailable";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
};

const getAccountLabel = (account) => {
  const base = account?.officialName || account?.name || "Linked account";
  const mask = account?.mask ? ` ••••${account.mask}` : "";
  return `${base}${mask}`;
};

const getAccountDescription = (account) => {
  const pieces = [
    account?.institutionName || "",
    account?.subtype || account?.type || "",
    formatMoney(account?.currentBalance, account?.currency || "USD"),
  ].filter(Boolean);
  return pieces.join(" • ");
};

const renderLinkedAccounts = () => {
  if (!linkedAccountsList) return;
  if (!plaidConfigured) {
    linkedAccountsList.innerHTML = `
      <div class="linked-item">
        <div>
          <p class="label">Plaid sandbox is not configured</p>
          <p class="subtle">Add PLAID_CLIENT_ID and PLAID_SECRET on the API before linking accounts.</p>
        </div>
      </div>
    `;
    return;
  }

  if (!plaidAccounts.length) {
    linkedAccountsList.innerHTML = `
      <div class="linked-item">
        <div>
          <p class="label">No accounts linked yet</p>
          <p class="subtle">Connect a Plaid sandbox institution to start importing transactions.</p>
        </div>
      </div>
    `;
    return;
  }

  linkedAccountsList.innerHTML = "";
  const groups = new Map();
  plaidAccounts.forEach((account) => {
    const key =
      String(account?.institutionName || account?.institutionId || "Linked Institution").trim() ||
      "Linked Institution";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(account);
  });

  Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([bankName, accounts], index) => {
      if (!bankGroupsInitialized && index === 0) {
        expandedBankGroups.add(bankName);
      }

      const isExpanded = expandedBankGroups.has(bankName);
      const wrapper = document.createElement("div");
      wrapper.className = "linked-group";

      const header = document.createElement("div");
      header.className = "linked-group__header";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "linked-group__toggle";
      toggle.dataset.toggleBank = bankName;
      toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      toggle.innerHTML = `
        <span class="linked-group__summary">
          <span class="linked-group__caret">${isExpanded ? "v" : ">"}</span>
          <span>
            <span class="label">${bankName}</span>
            <span class="subtle">${accounts.length} connected account${accounts.length === 1 ? "" : "s"}</span>
          </span>
        </span>
      `;
      header.appendChild(toggle);

      const actions = document.createElement("div");
      actions.className = "linked-group__meta";
      const disconnectBtn = document.createElement("button");
      disconnectBtn.type = "button";
      disconnectBtn.className = "btn btn--link";
      disconnectBtn.dataset.removeBank = bankName;
      disconnectBtn.textContent = "Disconnect";
      actions.appendChild(disconnectBtn);
      header.appendChild(actions);

      wrapper.appendChild(header);

      if (isExpanded) {
        const accountsWrap = document.createElement("div");
        accountsWrap.className = "linked-group__accounts";

        accounts.forEach((acc) => {
          const row = document.createElement("div");
          row.className = "linked-account-row";
          row.innerHTML = `
            <div>
              <p class="label">${getAccountLabel(acc)}</p>
              <p class="subtle">${getAccountDescription(acc)}</p>
            </div>
            <div class="linked-account-row__meta">
              <button class="btn btn--link" data-remove="${acc.id}" type="button">Remove</button>
            </div>
          `;
          accountsWrap.appendChild(row);
        });

        wrapper.appendChild(accountsWrap);
      }

      linkedAccountsList.appendChild(wrapper);
    });

  bankGroupsInitialized = true;
};

const closeUnlinkModal = () => {
  pendingUnlinkContext = null;
  unlinkAccountModal?.classList.add("hidden");
};

const openUnlinkModal = (target) => {
  if (!target || !unlinkAccountModal) return;
  pendingUnlinkContext = target;
  if (unlinkAccountText) {
    unlinkAccountText.textContent =
      target.kind === "bank"
        ? `Do you want to export ${target.bankName} history before disconnecting all linked accounts from that bank?`
        : `Do you want to export ${getAccountLabel(target.account)} history before unlinking it?`;
  }
  unlinkAccountModal.classList.remove("hidden");
};

const refreshLinkedAccounts = async () => {
  try {
    const payload = await api.plaid.accounts();
    plaidConfigured = payload?.configured !== false;
    plaidAccounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
  } catch (err) {
    plaidConfigured = err?.status === 503 ? false : plaidConfigured;
    if (err?.status !== 503) {
      showStatus("Failed to load linked accounts.", "error");
      clearStatusSoon(3000);
    }
  }
  renderLinkedAccounts();
};

const syncLinkedAccounts = async ({ silent = false } = {}) => {
  try {
    if (!silent) showStatus("Syncing Plaid transactions...");
    const payload = await api.plaid.sync();
    plaidAccounts = Array.isArray(payload?.accounts) ? payload.accounts : plaidAccounts;
    renderLinkedAccounts();
    if (!silent) {
      const imported = Number(payload?.sync?.imported || 0);
      showStatus(imported ? `Synced ${imported} transaction${imported === 1 ? "" : "s"}.` : "Plaid sync complete.");
      clearStatusSoon(2500);
    }
  } catch (err) {
    if (!silent) {
      showStatus("Plaid sync failed: " + (err?.message || "Unknown error"), "error");
      clearStatusSoon(3500);
    }
  }
};

const openPlaidLink = async () => {
  if (!window.Plaid?.create) {
    showStatus("Plaid Link failed to load. Refresh and try again.", "error");
    clearStatusSoon(3500);
    return;
  }

  try {
    showStatus("Preparing Plaid Link...");
    const token = await api.plaid.createLinkToken();
    plaidConfigured = token?.configured !== false;

    plaidHandler = window.Plaid.create({
      token: token.linkToken,
      onSuccess: async (publicToken, metadata) => {
        try {
          showStatus("Importing linked accounts...");
          const exchange = await api.plaid.exchangePublicToken({
            publicToken,
            institution: metadata?.institution || null,
          });
          plaidAccounts = Array.isArray(exchange?.accounts) ? exchange.accounts : plaidAccounts;
          renderLinkedAccounts();
          const imported = Number(exchange?.sync?.imported || 0);
          showStatus(imported ? `Connected account and imported ${imported} transactions.` : "Connected account.");
          clearStatusSoon(3500);
        } catch (err) {
          showStatus("Plaid import failed: " + (err?.message || "Unknown error"), "error");
          clearStatusSoon(3500);
        }
      },
      onExit: (err) => {
        if (err) {
          showStatus("Plaid Link closed: " + (err.display_message || err.error_message || "Try again."), "error");
          clearStatusSoon(3500);
        }
      },
    });

    plaidHandler.open();
  } catch (err) {
    plaidConfigured = err?.status === 503 ? false : plaidConfigured;
    renderLinkedAccounts();
    showStatus("Unable to start Plaid Link: " + (err?.message || "Unknown error"), "error");
    clearStatusSoon(3500);
  }
};

const getLinkedAccountRecords = async (accountId) => {
  const records = await api.records.getAll({ limit: 1000 });
  return (Array.isArray(records) ? records : []).filter((record) => {
    const linkedAccountId = record?.linkedPlaidAccountId ?? record?.linked_plaid_account_id ?? "";
    return linkedAccountId === accountId;
  });
};

const exportLinkedAccountHistory = async (target) => {
  const bundle = await api.settings.exportAllData();
  const selectedAccountIds =
    target.kind === "bank"
      ? new Set((target.accounts || []).map((account) => account.id))
      : new Set([target.account.id]);
  const records = (Array.isArray(bundle?.records) ? bundle.records : []).filter((record) => {
    const linkedAccountId = record?.linkedPlaidAccountId ?? record?.linked_plaid_account_id ?? "";
    return selectedAccountIds.has(linkedAccountId);
  });
  const accountRows = (Array.isArray(bundle?.plaidAccounts) ? bundle.plaidAccounts : []).filter((entry) =>
    selectedAccountIds.has(entry?.id)
  );
  const relatedItemIds = new Set(accountRows.map((entry) => entry?.plaid_item_ref).filter(Boolean));
  const itemRows = (Array.isArray(bundle?.plaidItems) ? bundle.plaidItems : []).filter((item) =>
    relatedItemIds.has(item?.id)
  );
  const netWorthSnapshots = Array.isArray(bundle?.netWorthSnapshots) ? bundle.netWorthSnapshots : [];

  if (!records.length && !accountRows.length && !itemRows.length && !netWorthSnapshots.length) {
    return false;
  }

  const exportLabel =
    target.kind === "bank"
      ? target.bankName || "linked_bank"
      : target.account?.name || "history";
  const filenameBase = `linked_account_${String(exportLabel).toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${new Date()
    .toISOString()
    .slice(0, 10)}`;

  await exportSheets({
    title:
      target.kind === "bank"
        ? `${target.bankName} History`
        : `${getAccountLabel(target.account)} History`,
    filenameBase,
    format: getPreferredExportFormat(),
    sheets: [
      {
        name: "Account",
        rows: accountRows.map((entry) => ({
          Name: entry?.name || "",
          OfficialName: entry?.official_name || "",
          Mask: entry?.mask || "",
          Type: entry?.type || "",
          Subtype: entry?.subtype || "",
          InstitutionName: entry?.institution_name || "",
          CurrentBalance: Number(entry?.current_balance || 0),
          AvailableBalance: Number(entry?.available_balance || 0),
          Currency: entry?.currency || "USD",
          Active: Boolean(entry?.is_active),
        })),
      },
      {
        name: "Linked Item",
        rows: itemRows.map((item) => ({
          PlaidItemId: item?.plaid_item_id || "",
          InstitutionId: item?.institution_id || "",
          InstitutionName: item?.institution_name || "",
          Status: item?.status || "",
          LastSyncedAt: item?.last_synced_at || "",
          CreatedAt: item?.created_at || "",
        })),
      },
      {
        name: "Records",
        rows: records.map((record) => ({
          Date: String(record?.date || "").slice(0, 10),
          Type: record?.type || "",
          Category: record?.category || "",
          Amount: Number(record?.amount ?? 0),
          Currency: record?.currency || "USD",
          Note: record?.note || "",
          Origin: api.getUploadType(record),
        })),
      },
      {
        name: "Net Worth Snapshots",
        rows: netWorthSnapshots.map((snapshot) => ({
          SnapshotDate: snapshot?.snapshot_date || "",
          AssetsTotal: Number(snapshot?.assets_total || 0),
          LiabilitiesTotal: Number(snapshot?.liabilities_total || 0),
          NetWorth: Number(snapshot?.net_worth || 0),
          Currency: snapshot?.currency || "USD",
          Note: "These snapshots may include this linked account and are removed after unlinking.",
        })),
      },
    ].filter((sheet) => Array.isArray(sheet.rows) && sheet.rows.length),
  });

  return true;
};

const unlinkLinkedAccount = async ({ exportFirst = false } = {}) => {
  if (!pendingUnlinkContext) {
    closeUnlinkModal();
    return;
  }

  const accountsToRemove =
    pendingUnlinkContext.kind === "bank"
      ? (pendingUnlinkContext.accounts || []).filter(Boolean)
      : [pendingUnlinkContext.account].filter(Boolean);
  if (!accountsToRemove.length) {
    closeUnlinkModal();
    return;
  }

  try {
    if (exportFirst) {
      showStatus("Exporting linked account history...");
      await exportLinkedAccountHistory(pendingUnlinkContext);
    }

    showStatus(
      pendingUnlinkContext.kind === "bank" ? "Disconnecting linked bank..." : "Removing linked account..."
    );
    for (const account of accountsToRemove) {
      // eslint-disable-next-line no-await-in-loop
      await api.plaid.removeAccount(account.id);
    }
    const removedIds = new Set(accountsToRemove.map((account) => account.id));
    plaidAccounts = plaidAccounts.filter((entry) => !removedIds.has(entry.id));
    renderLinkedAccounts();
    closeUnlinkModal();
    showStatus(
      exportFirst
        ? pendingUnlinkContext.kind === "bank"
          ? "History exported and bank disconnected."
          : "History exported and linked account removed."
        : pendingUnlinkContext.kind === "bank"
          ? "Bank disconnected."
          : "Linked account removed."
    );
    clearStatusSoon(3000);
  } catch (err) {
    showStatus(
      `Failed to ${pendingUnlinkContext.kind === "bank" ? "disconnect bank" : "remove linked account"}: ${
        err?.message || "Unknown error"
      }`,
      "error"
    );
    clearStatusSoon(3500);
  }
};

// AVATAR ELEMENTS
const avatarTriggerButtons = document.querySelectorAll("[data-avatar-trigger]");
const topChangeAvatarBtn = $("changeAvatarBtnTop");
const avatarInput = $("avatarInput");
const avatarBlock = document.querySelector(".avatar-block .avatar");
const avatarModal = $("avatarModal");
const avatarChoicesEl = $("avatarChoices");
const saveAvatarBtn = $("saveAvatarBtn");
const cancelAvatarBtn = $("cancelAvatarBtn");
const closeAvatarModalBtn = $("closeAvatarModal");
let currentAvatarUrl = "";
let pendingAvatarUrl = "";
let currentDisplayName = "";
let avatarChoicesRendered = false;

/* ----------------------------------------
   DARK MODE SUPPORT
---------------------------------------- */
const themeToggleBtn = $("toggleDarkMode");

const setTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
};

// Initialize theme
setTheme(localStorage.getItem("theme") || "light");

// Optional toggle button
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "dark" : "light");
  });
}

/* ----------------------------------------
   EDIT PROFILE FORM
---------------------------------------- */
const showForm = () => {
  if (form) form.hidden = false;
  if (editBtn) editBtn.disabled = true;
  const summary = $("profileSummary");
  if (summary) summary.classList.add("is-hidden");
  showIdentityForm();
  if (editBtn) editBtn.classList.add("is-hidden");
  if (cancelBtn) cancelBtn.classList.remove("is-hidden");
  if (saveBtn) saveBtn.classList.remove("is-hidden");
  if (topChangeAvatarBtn) topChangeAvatarBtn.classList.remove("is-hidden");
};

const hideForm = () => {
  if (form) form.hidden = true;
  if (editBtn) editBtn.disabled = false;
  const summary = $("profileSummary");
  if (summary) summary.classList.remove("is-hidden");
  hideIdentityForm();
  if (editBtn) editBtn.classList.remove("is-hidden");
  if (cancelBtn) cancelBtn.classList.add("is-hidden");
  if (saveBtn) saveBtn.classList.add("is-hidden");
  if (topChangeAvatarBtn) topChangeAvatarBtn.classList.add("is-hidden");
};

const showStatus = (msg, kind = "ok") => {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.classList.remove("is-hidden");
  statusEl.style.display = "block";
  statusEl.classList.toggle("is-ok", kind === "ok");
  statusEl.classList.toggle("is-error", kind === "error");
};

const clearStatusSoon = (ms = 2000) => {
  if (!statusEl) return;
  window.setTimeout(() => {
    statusEl.style.display = "none";
    statusEl.textContent = "";
    statusEl.classList.add("is-hidden");
    statusEl.classList.remove("is-ok", "is-error");
  }, ms);
};

const renderAchievements = (payload) => {
  if (!achievementGrid) return;
  const list = Array.isArray(payload?.achievements) ? payload.achievements : [];
  const summary = payload?.summary || {};

  if (achievementStatus) {
    achievementStatus.textContent = list.length
      ? `${summary.unlockedCount || 0} of ${summary.totalCount || list.length} unlocked`
      : "No achievements configured yet.";
  }

  if (!list.length) {
    achievementGrid.innerHTML = "";
    return;
  }

  achievementGrid.innerHTML = "";
  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "achievement-card";
    if (!item.unlocked) card.classList.add("achievement-card--locked");

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = item.icon || "🏆";

    const body = document.createElement("div");
    const title = document.createElement("p");
    title.className = "label";
    title.textContent = item.title || "Achievement";
    const subtitle = document.createElement("p");
    subtitle.className = "subtle";
    const isBooleanMetric =
      item.metric === "two_fa_enabled" ||
      item.metric === "google_signin_enabled" ||
      item.metric === "avatar_selected";
    subtitle.textContent = item.unlocked
      ? `Unlocked${item.unlockedAt ? ` on ${new Date(item.unlockedAt).toLocaleDateString()}` : ""}`
      : isBooleanMetric
      ? `Current ${formatBooleanAchievementValue(item.progress)} / target ${formatBooleanAchievementValue(
          item.target
        )}`
      : `${formatAchievementValue(
          Math.min(Number(item.progress || 0), Number(item.target || 0))
        )} / ${formatAchievementValue(Number(item.target || 0))}`;
    body.appendChild(title);
    body.appendChild(subtitle);

    card.appendChild(badge);
    card.appendChild(body);

    const description = String(item.description || "").trim();
    if (description) {
      const hint = document.createElement("span");
      hint.className = "achievement-hint";
      hint.textContent = description;
      card.appendChild(hint);
    }

    achievementGrid.appendChild(card);
  });
};

async function loadAchievements() {
  if (achievementStatus) achievementStatus.textContent = "Loading achievements...";
  try {
    const payload = await api.achievements.getAll();
    renderAchievements(payload);
  } catch (err) {
    if (achievementStatus) {
      achievementStatus.textContent = "Failed to load achievements.";
    }
    if (achievementGrid) achievementGrid.innerHTML = "";
  }
}


/* ----------------------------------------
   AVATAR PRESETS
---------------------------------------- */
const AVATAR_OPTIONS = Array.from({ length: 15 }, (_, index) => {
  const num = String(index + 1).padStart(2, "0");
  return {
    id: `avatar-${num}`,
    label: `Avatar ${num}`,
    url: `images/avatars/avatar-${num}.png`,
  };
});

const applyAvatarPreview = (avatarUrl, fallbackName = "") => {
  if (!avatarBlock) return;
  if (avatarUrl) {
    avatarBlock.style.backgroundImage = `url(${avatarUrl})`;
    avatarBlock.textContent = "";
    return;
  }

  avatarBlock.style.backgroundImage = "";
  avatarBlock.textContent = getInitials(fallbackName);
};

const applyHeaderAvatar = (avatarUrl, fallbackName = "") => {
  window.dispatchEvent(new CustomEvent("avatar:updated", { detail: { avatarUrl, fallbackName } }));
};

const loadIdentity = () => {
  const sanitize = (value) => {
    if (!value) return "—";
    const cleaned = String(value).replace(/â€”/g, "—").trim();
    return cleaned || "—";
  };

  setText(identityEls.address, sanitize(currentIdentity.address));
  setText(identityEls.employer, sanitize(currentIdentity.employer));
  setText(identityEls.income, sanitize(currentIdentity.income));

  if (identityInput.address) identityInput.address.value = currentIdentity.address || "";
  if (identityInput.employer) identityInput.employer.value = currentIdentity.employer || "";
  if (identityInput.income) {
    const options = Array.from(identityInput.income.options || []);
    const match = options.find((opt) => opt.value === currentIdentity.income);
    identityInput.income.value = match ? currentIdentity.income : "";
  }
};

const showIdentityForm = () => {
  if (identityForm) identityForm.hidden = false;
  if (identityDisplay) identityDisplay.classList.add("is-hidden");
};

const hideIdentityForm = () => {
  if (identityForm) identityForm.hidden = true;
  if (identityDisplay) identityDisplay.classList.remove("is-hidden");
};

const persistIdentityFromInputs = () => {
  currentIdentity.address = identityInput.address?.value.trim() || "";
  currentIdentity.employer = identityInput.employer?.value.trim() || "";
  currentIdentity.income = identityInput.income?.value.trim() || "";
};

/* ----------------------------------------
   LOAD USER PROFILE
---------------------------------------- */
async function loadUserProfile() {
  try {
    const { user } = await api.auth.me();
    let lastLogin = "Not available";
    let totalUploads = "Not available";
    try {
      const sessionData = await api.auth.sessions();
      const sessions = sessionData?.sessions || [];
      const latest = sessions
        .map((s) => s.lastSeenAt)
        .filter(Boolean)
        .sort()
        .slice(-1)[0];
      if (latest) lastLogin = formatShortDateTime(latest);
    } catch {
      // fall back to default
    }
    try {
      const stats = await api.records.stats();
      if (Number.isFinite(stats?.totalRecords)) {
        totalUploads = String(stats.totalRecords);
      }
    } catch {
      // fall back to default
    }

    const createdAt = user?.createdAt || user?.created_at;
    const avatarUrl = user?.avatarUrl || user?.avatar_url;
    const displayName = user?.fullName || user?.full_name || user?.username || "";
    currentDisplayName = displayName;

    setText(f.fullName, displayName || "\u2014");
    setText(f.username, "@" + (user?.username || "\u2014"));
    setText(f.email, user?.email || "\u2014");
    setText(f.phoneNumber, user?.phoneNumber || user?.phone_number || "\u2014");
    setText(f.location, user?.location || "\u2014");
    setText(f.role, user?.role || "\u2014");
    setText(f.createdAt, createdAt ? new Date(createdAt).toLocaleDateString() : "\u2014");
    setText(f.bio, user?.bio || "\u2014");

    setText(stats.lastLogin, lastLogin);
    setText(stats.uploads, totalUploads);
    currentIdentity.address = user?.address || "";
    currentIdentity.employer = user?.employer || "";
    currentIdentity.income = user?.incomeRange || user?.income_range || "";
    loadIdentity();

    Object.keys(input).forEach((k) => {
      if (!input[k]) return;
      if (k === "fullName") {
        input[k].value = user?.fullName || user?.full_name || user?.name || "";
        return;
      }
      if (k === "phoneNumber") {
        input[k].value = user?.phoneNumber || user?.phone_number || "";
        return;
      }
      input[k].value = user?.[k] || "";
    });

    currentAvatarUrl = avatarUrl || "";
    pendingAvatarUrl = currentAvatarUrl;
    applyAvatarPreview(currentAvatarUrl, displayName);
    applyHeaderAvatar(currentAvatarUrl, displayName);

    await Promise.all([refreshLinkedAccounts(), loadRecentActivity(), loadAchievements()]);
  } catch (err) {
    showStatus("Please log in to view your profile.", "error");
    window.location.href = "login.html";
  }
}

const ACTION_LABELS = {
  login: "Logged in",
  logout: "Logged out",
  logout_all: "Signed out all sessions",
  profile_update: "Updated profile",
  password_change: "Changed password",
  account_delete: "Deleted account",
  record_create: "Created record",
  record_update: "Updated record",
  record_delete: "Deleted record",
  receipt_upload_start: "Started receipt upload",
  receipt_upload_confirm: "Uploaded receipt",
  receipt_scan: "Scanned receipt",
  receipt_ocr_edit: "Edited OCR text",
  receipt_delete: "Deleted receipt",
  budget_sheet_create: "Created budget",
  budget_sheet_update: "Updated budget",
  plaid_link: "Linked Plaid account",
  plaid_sync: "Synced Plaid transactions",
  plaid_unlink: "Removed Plaid account",
};

const formatActivityDate = (value) => {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString();
};

async function loadRecentActivity() {
  if (!activityBody) return;
  activityBody.innerHTML = `<tr><td colspan="4" class="subtle">Loading…</td></tr>`;

  try {
    const rows = await api.activity.getRecent(5);
    if (!rows?.length) {
      activityBody.innerHTML = `<tr><td colspan="4" class="subtle">No activity yet</td></tr>`;
      return;
    }

    activityBody.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      const dateBadge = document.createElement("span");
      dateBadge.className = "activity-date";
      dateBadge.textContent = formatActivityDate(row.created_at);
      tdDate.className = "date-col";
      tdDate.appendChild(dateBadge);

      const tdAction = document.createElement("td");
      tdAction.className = "activity-col";
      tdAction.textContent = ACTION_LABELS[row.action] || row.action || "Activity";

      const tdIp = document.createElement("td");
      tdIp.className = "ip-col";
      tdIp.textContent = row.ip_address || "\u2014";

      const tdResult = document.createElement("td");
      tdResult.className = "result-col";
      tdResult.textContent = row.entity_type || "\u2014";

      tr.appendChild(tdDate);
      tr.appendChild(tdAction);
      tr.appendChild(tdIp);
      tr.appendChild(tdResult);
      activityBody.appendChild(tr);
    });
  } catch (err) {
    console.warn("Failed to load activity:", err);
    activityBody.innerHTML = `<tr><td colspan="4" class="subtle">Failed to load activity</td></tr>`;
  }
}

/* ----------------------------------------
   SAVE PROFILE
---------------------------------------- */
async function saveProfile(e) {
  e.preventDefault();
  showStatus("Saving…");
  const updates = {};
  for (const key in input) {
    if (key === "role") continue;
    if(input[key]) updates[key] = input[key].value.trim();
  }
  persistIdentityFromInputs();
  updates.address = currentIdentity.address;
  updates.employer = currentIdentity.employer;
  updates.incomeRange = currentIdentity.income;

  try {
    await api.auth.updateProfile(updates);

    hideForm();
    await loadUserProfile();
    showStatus("Profile updated.");
    clearStatusSoon(2500);
  } catch (err) {
    showStatus("Update failed: " + (err?.message || "Unknown error"), "error");
  }
}

/* ----------------------------------------
   SAVE IDENTITY (LOCAL ONLY)
---------------------------------------- */
/* ----------------------------------------
   CHANGE AVATAR
---------------------------------------- */
const renderAvatarChoices = () => {
  if (!avatarChoicesEl || avatarChoicesRendered) return;
  avatarChoicesEl.innerHTML = "";
  AVATAR_OPTIONS.forEach((choice) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-choice";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-label", choice.label);
    btn.dataset.avatarUrl = choice.url;
    btn.style.backgroundImage = `url(${choice.url})`;
    btn.addEventListener("click", () => {
      pendingAvatarUrl = choice.url;
      updateAvatarSelection();
    });
    avatarChoicesEl.appendChild(btn);
  });
  avatarChoicesRendered = true;
};

const updateAvatarSelection = () => {
  if (!avatarChoicesEl) return;
  const buttons = avatarChoicesEl.querySelectorAll(".avatar-choice");
  buttons.forEach((btn) => {
    const isSelected = btn.dataset.avatarUrl === pendingAvatarUrl;
    btn.classList.toggle("is-selected", isSelected);
    btn.setAttribute("aria-selected", isSelected ? "true" : "false");
  });
};

const openAvatarModal = () => {
  renderAvatarChoices();
  pendingAvatarUrl = currentAvatarUrl;
  updateAvatarSelection();
  avatarModal?.classList.remove("hidden");
};

const closeAvatarModal = () => {
  avatarModal?.classList.add("hidden");
};

avatarTriggerButtons.forEach((btn) => {
  btn.addEventListener("click", openAvatarModal);
});
closeAvatarModalBtn?.addEventListener("click", closeAvatarModal);
cancelAvatarBtn?.addEventListener("click", closeAvatarModal);
avatarModal?.addEventListener("click", (e) => {
  if (e.target === avatarModal || e.target?.dataset?.close === "avatar") {
    closeAvatarModal();
  }
});

saveAvatarBtn?.addEventListener("click", async () => {
  if (!pendingAvatarUrl) {
    showStatus("Please select an avatar.", "error");
    clearStatusSoon(2500);
    return;
  }
  if (pendingAvatarUrl === currentAvatarUrl) {
    closeAvatarModal();
    return;
  }

  try {
    showStatus("Updating avatar...");
    await api.auth.updateProfile({ avatarUrl: pendingAvatarUrl });
    currentAvatarUrl = pendingAvatarUrl;
    applyAvatarPreview(currentAvatarUrl, currentDisplayName);
    applyHeaderAvatar(currentAvatarUrl, currentDisplayName);
    closeAvatarModal();
    showStatus("Avatar updated.");
    clearStatusSoon(2500);
  } catch (err) {
    showStatus("Avatar update failed: " + (err?.message || "Unknown error"), "error");
    clearStatusSoon(3500);
  }
});

// Close avatar modal on ESC
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (avatarModal && !avatarModal.classList.contains("hidden")) {
    avatarModal.classList.add("hidden");
  }
  if (unlinkAccountModal && !unlinkAccountModal.classList.contains("hidden")) {
    closeUnlinkModal();
  }
});

/* ----------------------------------------
   INIT
---------------------------------------- */
document.addEventListener("DOMContentLoaded", loadUserProfile);
form?.addEventListener("submit", saveProfile);
editBtn?.addEventListener("click", showForm);
cancelBtn?.addEventListener("click", () => {
  hideForm();
  if (statusEl) {
    statusEl.style.display = "none";
    statusEl.textContent = "";
    statusEl.classList.remove("is-ok", "is-error");
  }
});

linkAccountBtn?.addEventListener("click", openPlaidLink);
syncAccountsBtn?.addEventListener("click", () => syncLinkedAccounts());
closeUnlinkAccountModal?.addEventListener("click", closeUnlinkModal);
cancelUnlinkAccount?.addEventListener("click", closeUnlinkModal);
unlinkAccountModal?.addEventListener("click", (e) => {
  if (e.target === unlinkAccountModal || e.target?.dataset?.close === "unlink-account") {
    closeUnlinkModal();
  }
});
unlinkWithoutExportBtn?.addEventListener("click", () => unlinkLinkedAccount({ exportFirst: false }));
exportAndUnlinkBtn?.addEventListener("click", () => unlinkLinkedAccount({ exportFirst: true }));

linkedAccountsList?.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const toggleBtn = target.closest("[data-toggle-bank]");
  if (toggleBtn instanceof HTMLElement) {
    const bankName = toggleBtn.getAttribute("data-toggle-bank");
    if (!bankName) return;
    if (expandedBankGroups.has(bankName)) {
      expandedBankGroups.delete(bankName);
    } else {
      expandedBankGroups.add(bankName);
    }
    renderLinkedAccounts();
    return;
  }
  const removeBank = target.getAttribute("data-remove-bank");
  if (removeBank) {
    const accounts = plaidAccounts.filter(
      (entry) =>
        (String(entry?.institutionName || entry?.institutionId || "Linked Institution").trim() ||
          "Linked Institution") === removeBank
    );
    if (!accounts.length) return;
    openUnlinkModal({ kind: "bank", bankName: removeBank, accounts });
    return;
  }
  const removeId = target.getAttribute("data-remove");
  if (!removeId) return;
  const account = plaidAccounts.find((entry) => entry.id === removeId);
  if (!account) return;
  openUnlinkModal({ kind: "account", account });
});
