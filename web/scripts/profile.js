import { api } from "./api.js";

if (!api.auth.signOutAll) {
  api.auth.signOutAll = async () => ({
    status: false,
    message: "Sign-out-from-all-devices is not implemented yet.",
  });
}

/* ----------------------------------------
   DOM ELEMENTS
---------------------------------------- */
// Small helpers to avoid null dereferences
const $ = (id) => document.getElementById(id);
const setText = (el, text) => {
  if (el) el.innerText = text;
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
  twoFA: $("stat_2FA"),
  uploads: $("stat_uploads"),
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

const applyAvatarPreview = (avatarUrl) => {
  if (!avatarBlock) return;
  avatarBlock.style.backgroundImage = avatarUrl ? `url(${avatarUrl})` : "";
  avatarBlock.textContent = "";
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

    const createdAt = user?.createdAt || user?.created_at;
    const avatarUrl = user?.avatarUrl || user?.avatar_url;

    setText(f.fullName, user?.fullName || user?.full_name || user?.username || "—");
    setText(f.username, "@" + (user?.username || "—"));
    setText(f.email, user?.email || "—");
    setText(f.phoneNumber, user?.phoneNumber || user?.phone_number || "—");
    setText(f.location, user?.location || "—");
    setText(f.role, user?.role || "—");
    setText(f.createdAt, createdAt ? new Date(createdAt).toLocaleDateString() : "—");
    setText(f.bio, user?.bio || "—");

    setText(stats.lastLogin, "Not available");
    setText(stats.twoFA, user?.two_fa_enabled ? "Enabled" : "Disabled");
    setText(stats.uploads, "Not available");

    Object.keys(input).forEach((k) => {
      if (input[k]) input[k].value = user[k] || "";
    });

    currentAvatarUrl = avatarUrl || "";
    pendingAvatarUrl = currentAvatarUrl;
    applyAvatarPreview(currentAvatarUrl);
    applyHeaderAvatar(currentAvatarUrl);
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
    applyAvatarPreview(currentAvatarUrl);
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

/* ----------------------------------------
   CHANGE PASSWORD
---------------------------------------- */
const passwordModal = $("passwordModal");
const passwordForm = $("passwordForm");
const closePasswordModal = $("closePasswordModal");
const changePasswordBtn = $("changePasswordBtn");

changePasswordBtn?.addEventListener("click", () => {
  passwordModal?.classList.remove("hidden");
});

closePasswordModal?.addEventListener("click", () => {
  passwordModal?.classList.add("hidden");
});

passwordModal?.addEventListener("click", (e) => {
  if (e.target === passwordModal) passwordModal.classList.add("hidden");
});

// Close password modal on ESC
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (passwordModal && !passwordModal.classList.contains("hidden")) {
    passwordModal.classList.add("hidden");
  }
  if (avatarModal && !avatarModal.classList.contains("hidden")) {
    avatarModal.classList.add("hidden");
  }
});

passwordForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const currentPassword = $("currentPassword")?.value?.trim() || "";
  const newPassword = $("newPassword")?.value?.trim() || "";
  const confirmPassword = $("confirmPassword")?.value?.trim() || "";

  if (newPassword !== confirmPassword) {
    showStatus("New passwords do not match.", "error");
    clearStatusSoon(3000);
    return;
  }

  try {
    await api.auth.changePassword(currentPassword, newPassword);
    showStatus("Password updated.");
    clearStatusSoon(2500);
    passwordModal?.classList.add("hidden");
    passwordForm.reset();
  } catch (err) {
    showStatus("Password update failed: " + (err?.message || "Unknown error"), "error");
    clearStatusSoon(3500);
  }
});

/* ----------------------------------------
   TWO-FACTOR AUTH
----------------------------------------- */
$("toggle2FA")?.addEventListener("click", () => {
  window.location.href = "settings.html";
});

/* ----------------------------------------
   SIGN OUT ALL SESSIONS (STUB)
---------------------------------------- */
$("signOutAllBtn")?.addEventListener("click", async () => {
  if (!confirm("Sign out all devices?")) return;
  try {
    const result = await api.auth.signOutAll();
    showStatus(result.message, "error");
    clearStatusSoon(3500);
  } catch (err) {
    showStatus("Failed to sign out all sessions.", "error");
    clearStatusSoon(3500);
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
