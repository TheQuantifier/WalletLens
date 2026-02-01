import { api } from "./api.js";

/* ----------------------------------------
   DOM ELEMENTS
---------------------------------------- */
// Small helpers to avoid null dereferences
const $ = (id) => document.getElementById(id);
const setText = (el, text) => {
  if (el) el.innerText = text;
};

const formatShortDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
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

const editBtn = $("editProfileBtn");
const form = $("editForm");
const cancelBtn = $("cancelEditBtn");
const statusEl = $("profileStatus");
const copyLinkBtn = $("copyProfileLinkBtn");

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
  role: $("input_role"),
  bio: $("input_bio"),
};

// SECURITY STATS
const stats = {
  lastLogin: $("stat_lastLogin"),
  uploads: $("stat_uploads"),
};

// Linked accounts + identity placeholders
const linkedAccountsList = $("linkedAccountsList");
const identityEls = {
  name: $("identityName"),
  address: $("identityAddress"),
  employer: $("identityEmployer"),
  income: $("identityIncome"),
};

const linkAccountBtn = $("linkAccountBtn");
const linkAccountModal = $("linkAccountModal");
const closeLinkAccountModal = $("closeLinkAccountModal");
const cancelLinkAccount = $("cancelLinkAccount");
const confirmLinkAccount = $("confirmLinkAccount");
const bankGrid = $("bankGrid");

const LINKED_ACCOUNTS_KEY = "linked_accounts";
const BANK_OPTIONS = [
  { id: "chase", name: "Chase", desc: "Checking, Savings, Credit Card" },
  { id: "bofa", name: "Bank of America", desc: "Checking, Savings, Credit Card" },
  { id: "wells", name: "Wells Fargo", desc: "Checking, Savings, Mortgage" },
  { id: "citi", name: "Citi", desc: "Checking, Savings, Credit Card" },
  { id: "capital-one", name: "Capital One", desc: "Checking, Savings, Card" },
  { id: "us-bank", name: "U.S. Bank", desc: "Checking, Savings, Credit Card" },
  { id: "pnc", name: "PNC", desc: "Checking, Savings, Auto Loan" },
  { id: "td", name: "TD Bank", desc: "Checking, Savings, Credit Card" },
  { id: "discover", name: "Discover", desc: "Credit Card, Savings" },
];

let selectedBankId = "";

const loadLinkedAccounts = () => {
  const raw = localStorage.getItem(LINKED_ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLinkedAccounts = (accounts) => {
  localStorage.setItem(LINKED_ACCOUNTS_KEY, JSON.stringify(accounts));
};

const renderLinkedAccounts = () => {
  if (!linkedAccountsList) return;
  const accounts = loadLinkedAccounts();
  if (!accounts.length) {
    linkedAccountsList.innerHTML = `
      <div class="linked-item">
        <div>
          <p class="label">No accounts linked yet</p>
          <p class="subtle">Connect a bank or card to sync balances.</p>
        </div>
      </div>
    `;
    return;
  }

  linkedAccountsList.innerHTML = "";
  accounts.forEach((acc) => {
    const row = document.createElement("div");
    row.className = "linked-item";
    row.innerHTML = `
      <div>
        <p class="label">${acc.name}</p>
        <p class="subtle">${acc.desc}</p>
      </div>
      <div class="linked-meta">
        <span class="linked-badge">Pending</span>
        <button class="btn btn--link" data-remove="${acc.id}" type="button">Remove</button>
      </div>
    `;
    linkedAccountsList.appendChild(row);
  });
};

const renderBankOptions = () => {
  if (!bankGrid) return;
  bankGrid.innerHTML = "";
  BANK_OPTIONS.forEach((bank) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bank-option";
    btn.dataset.bankId = bank.id;
    btn.innerHTML = `
      <span class="label">${bank.name}</span>
      <span class="subtle">${bank.desc}</span>
    `;
    btn.addEventListener("click", () => {
      selectedBankId = bank.id;
      const options = bankGrid.querySelectorAll(".bank-option");
      options.forEach((opt) => {
        opt.classList.toggle("is-selected", opt.dataset.bankId === selectedBankId);
        opt.setAttribute("aria-selected", opt.dataset.bankId === selectedBankId ? "true" : "false");
      });
    });
    bankGrid.appendChild(btn);
  });
};

const openLinkAccountModal = () => {
  if (!linkAccountModal) return;
  selectedBankId = "";
  renderBankOptions();
  linkAccountModal.classList.remove("hidden");
};

const closeLinkModal = () => {
  linkAccountModal?.classList.add("hidden");
};

// AVATAR ELEMENTS
const changeAvatarBtn = $("changeAvatarBtn");
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
};

const hideForm = () => {
  if (form) form.hidden = true;
  if (editBtn) editBtn.disabled = false;
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

const applyHeaderAvatar = (avatarUrl) => {
  window.dispatchEvent(new CustomEvent("avatar:updated", { detail: { avatarUrl } }));
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

    setText(f.fullName, displayName || "—");
    setText(f.username, "@" + (user?.username || "—"));
    setText(f.email, user?.email || "—");
    setText(f.phoneNumber, user?.phoneNumber || user?.phone_number || "—");
    setText(f.location, user?.location || "—");
    setText(f.role, user?.role || "—");
    setText(f.createdAt, createdAt ? new Date(createdAt).toLocaleDateString() : "—");
    setText(f.bio, user?.bio || "—");

    setText(stats.lastLogin, lastLogin);
    setText(stats.uploads, totalUploads);
    setText(identityEls.name, displayName || "—");
    setText(identityEls.address, "—");
    setText(identityEls.employer, "—");
    setText(identityEls.income, "—");

    Object.keys(input).forEach((k) => {
      if (input[k]) input[k].value = user[k] || "";
    });

    currentAvatarUrl = avatarUrl || "";
    pendingAvatarUrl = currentAvatarUrl;
    applyAvatarPreview(currentAvatarUrl, displayName);
    applyHeaderAvatar(currentAvatarUrl);

    if (linkedAccountsList) {
      renderLinkedAccounts();
    }
  } catch (err) {
    showStatus("Please log in to view your profile.", "error");
    window.location.href = "login.html";
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
    if(input[key]) updates[key] = input[key].value.trim();
  }

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

changeAvatarBtn?.addEventListener("click", openAvatarModal);
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
    applyHeaderAvatar(currentAvatarUrl);
    closeAvatarModal();
    showStatus("Avatar updated.");
    clearStatusSoon(2500);
  } catch (err) {
    showStatus("Avatar update failed: " + (err?.message || "Unknown error"), "error");
    clearStatusSoon(3500);
  }
});

/* ----------------------------------------
   COPY PROFILE LINK
---------------------------------------- */
copyLinkBtn?.addEventListener("click", async () => {
  const text = location.href;
  try {
    await navigator.clipboard.writeText(text);
    showStatus("Profile link copied.");
    clearStatusSoon(2000);
  } catch {
    // Fallback for some browsers / insecure contexts
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showStatus("Profile link copied.");
      clearStatusSoon(2000);
    } catch {
      showStatus("Could not copy link. Please copy from the address bar.", "error");
      clearStatusSoon(3000);
    }
  }
});

// Close avatar modal on ESC
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (avatarModal && !avatarModal.classList.contains("hidden")) {
    avatarModal.classList.add("hidden");
  }
  if (linkAccountModal && !linkAccountModal.classList.contains("hidden")) {
    linkAccountModal.classList.add("hidden");
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

linkAccountBtn?.addEventListener("click", openLinkAccountModal);
closeLinkAccountModal?.addEventListener("click", closeLinkModal);
cancelLinkAccount?.addEventListener("click", closeLinkModal);
linkAccountModal?.addEventListener("click", (e) => {
  if (e.target === linkAccountModal || e.target?.dataset?.close === "link-account") {
    closeLinkModal();
  }
});

confirmLinkAccount?.addEventListener("click", () => {
  if (!selectedBankId) {
    showStatus("Select a bank to continue.", "error");
    clearStatusSoon(2000);
    return;
  }

  const bank = BANK_OPTIONS.find((b) => b.id === selectedBankId);
  if (!bank) return;

  const accounts = loadLinkedAccounts();
  if (!accounts.find((a) => a.id === bank.id)) {
    accounts.push({ ...bank });
    saveLinkedAccounts(accounts);
    renderLinkedAccounts();
  }

  closeLinkModal();
  showStatus("Link request saved. Backend connection coming soon.");
  clearStatusSoon(2500);
});

linkedAccountsList?.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const removeId = target.getAttribute("data-remove");
  if (!removeId) return;

  const accounts = loadLinkedAccounts().filter((a) => a.id !== removeId);
  saveLinkedAccounts(accounts);
  renderLinkedAccounts();
});
