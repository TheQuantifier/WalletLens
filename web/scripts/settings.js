// scripts/settings.js
import { api } from "./api.js";

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  // ===============================
  // ELEMENTS
  // ===============================
  const els = {
    toggleTheme: $("#toggleDarkMode"),

    currency: $("#currencySelect"),
    numberFormat: $("#numberFormatSelect"),
    timezone: $("#timezoneSelect"),
    dashboardView: $("#dashboardViewSelect"),
    language: $("#languageSelect"),

    notifEmail: $("#notif_email"),
    notifSms: $("#notif_sms"),

    save: $("#saveSettingsBtn"),
    status: $("#settingsStatus"),

    deleteBtn: $("#deleteAccountBtn"),
    deleteModal: $("#deleteAccountModal"),
    deleteConfirm: $("#deleteConfirmInput"),
    deleteConfirmBtn: $("#confirmDeleteAccountBtn"),
    deleteCancelBtn: $("#cancelDeleteAccountBtn"),
    deleteStatus: $("#deleteAccountStatus"),

    sessionsList: $("#sessionsList"),
    signOutAllBtn: $("#signOutAllBtn"),
    signOutAllModal: $("#signOutAllModal"),
    signOutAllPassword: $("#signOutAllPassword"),
    signOutAllConfirmBtn: $("#confirmSignOutAllBtn"),
    signOutAllCancelBtn: $("#cancelSignOutAllBtn"),
    signOutAllStatus: $("#signOutAllStatus"),

    twoFaStatus: $("#twoFaStatus"),
    enableTwoFaBtn: $("#enableTwoFaBtn"),
    disableTwoFaBtn: $("#disableTwoFaBtn"),
    enableTwoFaModal: $("#enableTwoFaModal"),
    disableTwoFaModal: $("#disableTwoFaModal"),
    twoFaCodeInput: $("#twoFaCodeInput"),
    confirmEnableTwoFaBtn: $("#confirmEnableTwoFaBtn"),
    cancelEnableTwoFaBtn: $("#cancelEnableTwoFaBtn"),
    enableTwoFaStatus: $("#enableTwoFaStatus"),
    twoFaDisablePassword: $("#twoFaDisablePassword"),
    confirmDisableTwoFaBtn: $("#confirmDisableTwoFaBtn"),
    cancelDisableTwoFaBtn: $("#cancelDisableTwoFaBtn"),
    disableTwoFaStatus: $("#disableTwoFaStatus"),

    changePasswordBtn: $("#changePasswordBtn"),
    passwordModal: $("#passwordModal"),
    passwordForm: $("#passwordForm"),
    closePasswordModal: $("#closePasswordModal"),
    passwordStatus: $("#passwordStatus"),
    currentPassword: $("#currentPassword"),
    newPassword: $("#newPassword"),
    confirmPassword: $("#confirmPassword"),
    passwordTwoFaRow: $("#passwordTwoFaRow"),
    passwordTwoFaCode: $("#passwordTwoFaCode"),

    googleConnectRow: $("#googleConnectRow"),
    googleConnectStatus: $("#googleConnectStatus"),
    connectGoogleBtn: $("#connectGoogleBtn"),
  };

  const state = {
    twoFaEnabled: false,
    googleEnabled: false,
  };

  // ===============================
  // STATUS HELPERS
  // ===============================
  const showStatus = (el, msg, kind = "ok") => {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("is-hidden");
    el.style.display = "block";
    el.classList.toggle("is-ok", kind === "ok");
    el.classList.toggle("is-error", kind === "error");
  };

  const clearStatusSoon = (el, ms = 2200) => {
    if (!el) return;
    window.setTimeout(() => {
      el.style.display = "none";
      el.textContent = "";
      el.classList.add("is-hidden");
      el.classList.remove("is-ok", "is-error");
    }, ms);
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  };

  // ===============================
  // THEME
  // ===============================
  const currentTheme = () => document.documentElement.getAttribute("data-theme") || "light";

  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  };

  const updateThemeButtonLabel = () => {
    if (!els.toggleTheme) return;
    els.toggleTheme.textContent = currentTheme() === "dark" ? "Switch to Light" : "Switch to Dark";
  };

  const initTheme = () => {
    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);
    updateThemeButtonLabel();
  };

  // ===============================
  // DEVICE DEFAULTS (first run)
  // ===============================
  const detectDeviceCurrency = () => {
    try {
      const c = Intl.NumberFormat().resolvedOptions().currency;
      return c || "USD";
    } catch {
      return "USD";
    }
  };

  const detectNumberFormat = () => {
    try {
      const formatted = Intl.NumberFormat().format(1234.56);
      return formatted.includes(",") && formatted.includes(".") ? "US" : "EU";
    } catch {
      return "US";
    }
  };

  const detectDeviceTimezone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  };

  const detectDeviceLocale = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
    } catch {
      return "en-US";
    }
  };

  // ===============================
  // LOAD / SAVE SETTINGS
  // ===============================
  const buildCurrencyLabel = (code) => {
    const upper = String(code || "").toUpperCase();
    if (!upper) return "";
    try {
      const locale = detectDeviceLocale();
      const dn = new Intl.DisplayNames([locale], { type: "currency" });
      const name = dn.of(upper);
      return name ? `${upper} - ${name}` : upper;
    } catch {
      return upper;
    }
  };

  const populateCurrencyOptions = (codes) => {
    if (!els.currency) return;
    const saved = localStorage.getItem("settings_currency") || "";
    const current = els.currency.value || saved;

    els.currency.innerHTML = "";
    codes.forEach((code) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = buildCurrencyLabel(code);
      els.currency.appendChild(opt);
    });

    if (current && codes.includes(current)) {
      els.currency.value = current;
    }
  };

  const loadCurrencyOptions = async () => {
    if (!api?.fxRates?.get || !els.currency) return;
    try {
      const data = await api.fxRates.get("USD");
      const rates = data?.rates || {};
      const base = String(data?.base || "USD").toUpperCase();
      const codes = Object.keys(rates);
      if (!codes.length) return;
      if (!codes.includes(base)) codes.push(base);
      codes.sort();
      populateCurrencyOptions(codes);
    } catch (err) {
      console.warn("Failed to load currency options:", err);
    }
  };

  const ensureFirstRunDefaults = () => {
    // If userSettings exists (legacy), migrate minimally
    const legacy = localStorage.getItem("userSettings");

    const hasAnyNewKey =
      localStorage.getItem("settings_currency") ||
      localStorage.getItem("settings_number_format") ||
      localStorage.getItem("settings_timezone") ||
      localStorage.getItem("settings_language") ||
      localStorage.getItem("settings_dashboard_view");

    if (!hasAnyNewKey) {
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (parsed?.currency) localStorage.setItem("settings_currency", parsed.currency);
          if (parsed?.numberFormat) localStorage.setItem("settings_number_format", parsed.numberFormat);
          if (parsed?.timezone) localStorage.setItem("settings_timezone", parsed.timezone);
          if (parsed?.language) localStorage.setItem("settings_language", parsed.language);
          if (parsed?.dashboardView) localStorage.setItem("settings_dashboard_view", parsed.dashboardView);
          if (typeof parsed?.notifEmail === "boolean") localStorage.setItem("settings_notif_email", String(parsed.notifEmail));
          if (typeof parsed?.notifSMS === "boolean") localStorage.setItem("settings_notif_sms", String(parsed.notifSMS));
          if (!parsed?.numberFormat && !localStorage.getItem("settings_number_format")) {
            localStorage.setItem("settings_number_format", "US");
          }
          if (!parsed?.timezone && !localStorage.getItem("settings_timezone")) {
            localStorage.setItem("settings_timezone", "America/New_York");
          }
        } catch {
          // ignore
        }
      } else {
        // First run defaults
        localStorage.setItem("settings_currency", detectDeviceCurrency());
        localStorage.setItem("settings_number_format", "US");
        localStorage.setItem("settings_timezone", "America/New_York");
        localStorage.setItem("settings_language", "English");
        localStorage.setItem("settings_dashboard_view", "All Time");
        localStorage.setItem("settings_notif_email", "false");
        localStorage.setItem("settings_notif_sms", "false");
        // optional helpful keys
        localStorage.setItem("settings_locale", detectDeviceLocale());
      }
    }

    if (!localStorage.getItem("settings_timezone")) {
      localStorage.setItem("settings_timezone", "America/New_York");
    }
    if (!localStorage.getItem("settings_dashboard_view")) {
      localStorage.setItem("settings_dashboard_view", "All Time");
    }
  };

  const loadSettingsIntoUI = () => {
    const savedCurrency = localStorage.getItem("settings_currency");
    const savedNumFmt = localStorage.getItem("settings_number_format");
    const savedTz = localStorage.getItem("settings_timezone");
    const savedLang = localStorage.getItem("settings_language");
    const savedDash = localStorage.getItem("settings_dashboard_view");

    if (els.currency && savedCurrency) els.currency.value = savedCurrency;
    if (els.numberFormat && savedNumFmt) els.numberFormat.value = savedNumFmt;
    if (els.timezone && savedTz) els.timezone.value = savedTz;
    if (els.language && savedLang) els.language.value = savedLang;
    if (els.dashboardView && savedDash) els.dashboardView.value = savedDash;

    if (els.notifEmail) els.notifEmail.checked = localStorage.getItem("settings_notif_email") === "true";
    if (els.notifSms) els.notifSms.checked = localStorage.getItem("settings_notif_sms") === "true";

    updateThemeButtonLabel();
  };

  const saveSettings = async () => {
    if (els.save) {
      els.save.disabled = true;
      els.save.textContent = "Saving…";
    }

    showStatus(els.status, "Saving settings…");

    try {
      if (els.currency) localStorage.setItem("settings_currency", els.currency.value);
      if (els.numberFormat) localStorage.setItem("settings_number_format", els.numberFormat.value);
      if (els.timezone) localStorage.setItem("settings_timezone", els.timezone.value);
      if (els.language) localStorage.setItem("settings_language", els.language.value);
      if (els.dashboardView) localStorage.setItem("settings_dashboard_view", els.dashboardView.value);

      if (els.notifEmail) localStorage.setItem("settings_notif_email", String(els.notifEmail.checked));
      if (els.notifSms) localStorage.setItem("settings_notif_sms", String(els.notifSms.checked));

      // legacy convenience key used elsewhere
      if (els.dashboardView) localStorage.setItem("defaultDashboardView", els.dashboardView.value);

      // Optional backend persistence if your API supports it (guarded)
      const payload = {
        currency: els.currency?.value,
        numberFormat: els.numberFormat?.value,
        timezone: els.timezone?.value,
        language: els.language?.value,
        dashboardView: els.dashboardView?.value,
        notifications: {
          email: els.notifEmail?.checked,
          sms: els.notifSms?.checked,
        },
      };

      if (api?.settings?.save) {
        await api.settings.save(payload);
      }

      showStatus(els.status, "Settings saved.", "ok");
      clearStatusSoon(els.status, 2000);
    } catch (err) {
      console.error(err);
      showStatus(els.status, "Failed to save settings: " + (err?.message || "Unknown error"), "error");
    } finally {
      if (els.save) {
        els.save.disabled = false;
        els.save.textContent = "Save Settings";
      }
    }
  };

  // ===============================
  // DELETE ACCOUNT MODAL
  // ===============================
  const showModal = (modal) => modal?.classList.remove("hidden");
  const hideModal = (modal) => modal?.classList.add("hidden");

  const openDeleteModal = () => {
    if (!els.deleteModal) return;
    if (els.deleteConfirm) els.deleteConfirm.value = "";
    if (els.deleteStatus) {
      els.deleteStatus.style.display = "none";
      els.deleteStatus.textContent = "";
      els.deleteStatus.classList.remove("is-ok", "is-error");
    }
    showModal(els.deleteModal);
    els.deleteConfirm?.focus?.();
  };

  const closeDeleteModal = () => hideModal(els.deleteModal);

  const performDeleteAccount = async () => {
    const text = (els.deleteConfirm?.value || "").trim();
    if (text !== "DELETE") {
      showStatus(els.deleteStatus, "Please type DELETE to confirm.", "error");
      clearStatusSoon(els.deleteStatus, 3000);
      return;
    }

    if (els.deleteConfirmBtn) {
      els.deleteConfirmBtn.disabled = true;
      els.deleteConfirmBtn.textContent = "Deleting…";
    }

    showStatus(els.deleteStatus, "Deleting account…");

    try {
      // Guarded backend call(s)
      if (api?.auth?.deleteAccount) {
        await api.auth.deleteAccount();
      } else if (api?.users?.deleteMe) {
        await api.users.deleteMe();
      } else if (api?.account?.delete) {
        await api.account.delete();
      } else {
        throw new Error("Delete endpoint not available yet.");
      }

      showStatus(els.deleteStatus, "Account deleted. Redirecting…", "ok");

      // Clear any legacy client-side auth artifacts (new system uses cookies)
      localStorage.removeItem("token");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("jwt");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      window.setTimeout(() => {
      window.location.href = "login.html";
      }, 900);
    } catch (err) {
      console.error(err);
      showStatus(els.deleteStatus, "Delete failed: " + (err?.message || "Unknown error"), "error");
    } finally {
      if (els.deleteConfirmBtn) {
        els.deleteConfirmBtn.disabled = false;
        els.deleteConfirmBtn.textContent = "Delete Account";
      }
    }
  };

  // ===============================
  // TWO-FACTOR AUTH
  // ===============================
  const updateTwoFaUI = async () => {
    if (!els.twoFaStatus) return null;
    try {
      const { user } = await api.auth.me();
      const enabled = !!user?.two_fa_enabled || !!user?.twoFaEnabled;
      state.twoFaEnabled = enabled;
      els.twoFaStatus.textContent = enabled ? "Enabled" : "Disabled";
      els.enableTwoFaBtn?.classList.toggle("is-hidden", enabled);
      els.disableTwoFaBtn?.classList.toggle("is-hidden", !enabled);
      return user || null;
    } catch {
      state.twoFaEnabled = false;
      els.twoFaStatus.textContent = "Unavailable";
      els.enableTwoFaBtn?.classList.add("is-hidden");
      els.disableTwoFaBtn?.classList.add("is-hidden");
      return null;
    }
  };

  const updateGoogleConnectUI = (user) => {
    const hasPassword = !!(user?.has_password || user?.hasPassword);
    const hasGoogle = !!(user?.google_id || user?.googleId);

    if (!hasPassword) {
      els.googleConnectRow?.classList.add("is-hidden");
      return;
    }

    els.googleConnectRow?.classList.remove("is-hidden");

    if (!els.googleConnectStatus || !els.connectGoogleBtn) return;

    if (hasGoogle) {
      els.googleConnectStatus.textContent = "Connected";
      els.connectGoogleBtn.disabled = true;
      els.connectGoogleBtn.textContent = "Connected";
      return;
    }

    els.googleConnectStatus.textContent = state.googleEnabled ? "Not connected" : "Unavailable";
    els.connectGoogleBtn.disabled = !state.googleEnabled;
    els.connectGoogleBtn.textContent = "Connect Google";
  };

  const loadGoogleAvailability = async () => {
    try {
      const cfg = await api.auth.googleConfig();
      state.googleEnabled = !!cfg?.enabled;
    } catch {
      state.googleEnabled = false;
    }
  };

  const connectGoogleAccount = () => {
    if (!state.googleEnabled) {
      showStatus(els.status, "Google login is not configured.", "error");
      clearStatusSoon(els.status, 2200);
      return;
    }
    api.auth.beginGoogleAuth("login", window.location.href);
  };

  const openEnableTwoFaModal = () => {
    if (!els.enableTwoFaModal) return;
    if (els.enableTwoFaStatus) {
      els.enableTwoFaStatus.classList.add("is-hidden");
      els.enableTwoFaStatus.textContent = "";
      els.enableTwoFaStatus.classList.remove("is-ok", "is-error");
    }
    if (els.twoFaCodeInput) els.twoFaCodeInput.value = "";
    showModal(els.enableTwoFaModal);
    els.twoFaCodeInput?.focus?.();
  };

  const closeEnableTwoFaModal = () => hideModal(els.enableTwoFaModal);

  const openDisableTwoFaModal = () => {
    if (!els.disableTwoFaModal) return;
    if (els.disableTwoFaStatus) {
      els.disableTwoFaStatus.classList.add("is-hidden");
      els.disableTwoFaStatus.textContent = "";
      els.disableTwoFaStatus.classList.remove("is-ok", "is-error");
    }
    if (els.twoFaDisablePassword) els.twoFaDisablePassword.value = "";
    showModal(els.disableTwoFaModal);
    els.twoFaDisablePassword?.focus?.();
  };

  const closeDisableTwoFaModal = () => hideModal(els.disableTwoFaModal);

  const requestEnableTwoFa = async () => {
    try {
      await api.auth.requestTwoFaEnable();
      openEnableTwoFaModal();
    } catch (err) {
      console.error(err);
      if (els.twoFaStatus) {
        els.twoFaStatus.textContent = err?.message || "Failed to send code";
      }
    }
  };

  const confirmEnableTwoFa = async () => {
    const code = (els.twoFaCodeInput?.value || "").trim();
    if (!code) {
      showStatus(els.enableTwoFaStatus, "Enter the code from your email.", "error");
      return;
    }

    if (els.confirmEnableTwoFaBtn) {
      els.confirmEnableTwoFaBtn.disabled = true;
      els.confirmEnableTwoFaBtn.textContent = "Verifying…";
    }

    try {
      await api.auth.confirmTwoFaEnable(code);
      showStatus(els.enableTwoFaStatus, "Two-factor authentication enabled.", "ok");
      await updateTwoFaUI();
      window.setTimeout(() => closeEnableTwoFaModal(), 800);
    } catch (err) {
      console.error(err);
      showStatus(
        els.enableTwoFaStatus,
        err?.message || "Verification failed.",
        "error"
      );
    } finally {
      if (els.confirmEnableTwoFaBtn) {
        els.confirmEnableTwoFaBtn.disabled = false;
        els.confirmEnableTwoFaBtn.textContent = "Verify & Enable";
      }
    }
  };

  const confirmDisableTwoFa = async () => {
    const password = (els.twoFaDisablePassword?.value || "").trim();
    if (!password) {
      showStatus(els.disableTwoFaStatus, "Enter your password.", "error");
      return;
    }

    if (els.confirmDisableTwoFaBtn) {
      els.confirmDisableTwoFaBtn.disabled = true;
      els.confirmDisableTwoFaBtn.textContent = "Disabling…";
    }

    try {
      await api.auth.disableTwoFa(password);
      showStatus(els.disableTwoFaStatus, "Two-factor authentication disabled.", "ok");
      await updateTwoFaUI();
      window.setTimeout(() => closeDisableTwoFaModal(), 800);
    } catch (err) {
      console.error(err);
      showStatus(
        els.disableTwoFaStatus,
        err?.message || "Disable failed.",
        "error"
      );
    } finally {
      if (els.confirmDisableTwoFaBtn) {
        els.confirmDisableTwoFaBtn.disabled = false;
        els.confirmDisableTwoFaBtn.textContent = "Disable 2FA";
      }
    }
  };

  // ===============================
  // SESSIONS
  // ===============================
  const renderSessions = (sessions = [], currentSessionId = "") => {
    if (!els.sessionsList) return;

    if (!sessions.length) {
      els.sessionsList.innerHTML = `<p class="subtle">No active sessions found.</p>`;
      return;
    }

    const frag = document.createDocumentFragment();
    sessions.forEach((s) => {
      const item = document.createElement("div");
      item.className = "session-item";

      const title = document.createElement("div");
      const isCurrent = s.id === currentSessionId;
      title.textContent = isCurrent ? "Current device" : "Active device";
      title.style.fontWeight = "600";

      const meta = document.createElement("div");
      meta.className = "session-meta";
      const ua = s.userAgent || "Unknown device";
      const ip = s.ipAddress ? ` • ${s.ipAddress}` : "";
      const lastSeen = s.lastSeenAt ? ` • Last seen ${formatDateTime(s.lastSeenAt)}` : "";
      meta.textContent = `${ua}${ip}${lastSeen}`;

      item.appendChild(title);
      item.appendChild(meta);
      frag.appendChild(item);
    });

    els.sessionsList.innerHTML = "";
    els.sessionsList.appendChild(frag);
  };

  const loadSessions = async () => {
    if (!els.sessionsList) return;
    els.sessionsList.innerHTML = `<p class="subtle">Loading sessions…</p>`;

    try {
      const data = await api.auth.sessions();
      renderSessions(data?.sessions || [], data?.currentSessionId || "");
    } catch (err) {
      console.error(err);
      els.sessionsList.innerHTML = `<p class="subtle">Failed to load sessions.</p>`;
    }
  };

  // ===============================
  // SIGN OUT ALL MODAL
  // ===============================
  const openSignOutAllModal = () => {
    if (!els.signOutAllModal) return;
    if (els.signOutAllPassword) els.signOutAllPassword.value = "";
    if (els.signOutAllStatus) {
      els.signOutAllStatus.style.display = "none";
      els.signOutAllStatus.textContent = "";
      els.signOutAllStatus.classList.remove("is-ok", "is-error");
    }
    showModal(els.signOutAllModal);
    els.signOutAllPassword?.focus?.();
  };

  const closeSignOutAllModal = () => hideModal(els.signOutAllModal);

  const performSignOutAll = async () => {
    const password = (els.signOutAllPassword?.value || "").trim();
    if (!password) {
      showStatus(els.signOutAllStatus, "Please enter your password.", "error");
      clearStatusSoon(els.signOutAllStatus, 3000);
      return;
    }

    if (els.signOutAllConfirmBtn) {
      els.signOutAllConfirmBtn.disabled = true;
      els.signOutAllConfirmBtn.textContent = "Signing out…";
    }

    showStatus(els.signOutAllStatus, "Signing out all sessions…");

    try {
      await api.auth.signOutAll(password);

      showStatus(els.signOutAllStatus, "All sessions signed out. Redirecting…", "ok");

      localStorage.removeItem("token");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("jwt");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      window.setTimeout(() => {
      window.location.href = "login.html";
      }, 900);
    } catch (err) {
      console.error(err);
      showStatus(
        els.signOutAllStatus,
        "Sign out failed: " + (err?.message || "Unknown error"),
        "error"
      );
    } finally {
      if (els.signOutAllConfirmBtn) {
        els.signOutAllConfirmBtn.disabled = false;
        els.signOutAllConfirmBtn.textContent = "Sign Out All";
      }
    }
  };

  // ===============================
  // CHANGE PASSWORD
  // ===============================
  const openPasswordModal = async () => {
    if (!els.passwordModal) return;
    if (els.passwordStatus) {
      els.passwordStatus.style.display = "none";
      els.passwordStatus.textContent = "";
      els.passwordStatus.classList.remove("is-ok", "is-error");
    }
    if (els.currentPassword) els.currentPassword.value = "";
    if (els.newPassword) els.newPassword.value = "";
    if (els.confirmPassword) els.confirmPassword.value = "";
    if (els.passwordTwoFaCode) els.passwordTwoFaCode.value = "";

    if (els.passwordTwoFaRow) {
      els.passwordTwoFaRow.classList.toggle("is-hidden", !state.twoFaEnabled);
    }

    if (state.twoFaEnabled) {
      try {
        await api.auth.requestTwoFaPasswordChange();
        showStatus(els.passwordStatus, "2FA code sent to your email.");
      } catch (err) {
        showStatus(
          els.passwordStatus,
          err?.message || "Unable to send 2FA code.",
          "error"
        );
      }
    }
    showModal(els.passwordModal);
    els.currentPassword?.focus?.();
  };

  const closePasswordModal = () => hideModal(els.passwordModal);

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    const currentPassword = (els.currentPassword?.value || "").trim();
    const newPassword = (els.newPassword?.value || "").trim();
    const confirmPassword = (els.confirmPassword?.value || "").trim();
    const twoFaCode = (els.passwordTwoFaCode?.value || "").trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showStatus(els.passwordStatus, "Fill out all fields.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showStatus(els.passwordStatus, "New passwords do not match.", "error");
      return;
    }

    if (state.twoFaEnabled && !twoFaCode) {
      showStatus(els.passwordStatus, "Enter the 2FA code from your email.", "error");
      return;
    }

    if (els.passwordStatus) {
      showStatus(els.passwordStatus, "Updating password…");
    }

    try {
      await api.auth.changePassword(currentPassword, newPassword, twoFaCode);
      showStatus(els.passwordStatus, "Password updated.", "ok");
      clearStatusSoon(els.passwordStatus, 1500);
      window.setTimeout(() => closePasswordModal(), 700);
    } catch (err) {
      showStatus(
        els.passwordStatus,
        "Password update failed: " + (err?.message || "Unknown error"),
        "error"
      );
    }
  };

  // ===============================
  // WIRE EVENTS
  // ===============================
  const wire = () => {
    els.toggleTheme?.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      updateThemeButtonLabel();
    });

    els.save?.addEventListener("click", saveSettings);

    // Delete account flow
    els.deleteBtn?.addEventListener("click", openDeleteModal);
    els.deleteCancelBtn?.addEventListener("click", closeDeleteModal);
    els.deleteConfirmBtn?.addEventListener("click", performDeleteAccount);

    els.deleteModal?.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) closeDeleteModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.deleteModal && !els.deleteModal.classList.contains("hidden")) {
        closeDeleteModal();
      }
    });

    // Sign out all flow
    els.signOutAllBtn?.addEventListener("click", openSignOutAllModal);
    els.signOutAllCancelBtn?.addEventListener("click", closeSignOutAllModal);
    els.signOutAllConfirmBtn?.addEventListener("click", performSignOutAll);

    els.signOutAllModal?.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) closeSignOutAllModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.signOutAllModal && !els.signOutAllModal.classList.contains("hidden")) {
        closeSignOutAllModal();
      }
    });

    // 2FA enable/disable
    els.enableTwoFaBtn?.addEventListener("click", requestEnableTwoFa);
    els.disableTwoFaBtn?.addEventListener("click", openDisableTwoFaModal);
    els.cancelEnableTwoFaBtn?.addEventListener("click", closeEnableTwoFaModal);
    els.confirmEnableTwoFaBtn?.addEventListener("click", confirmEnableTwoFa);
    els.cancelDisableTwoFaBtn?.addEventListener("click", closeDisableTwoFaModal);
    els.confirmDisableTwoFaBtn?.addEventListener("click", confirmDisableTwoFa);

    els.enableTwoFaModal?.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) closeEnableTwoFaModal();
    });

    els.disableTwoFaModal?.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) closeDisableTwoFaModal();
    });

    // Change password flow
    els.changePasswordBtn?.addEventListener("click", openPasswordModal);
    els.closePasswordModal?.addEventListener("click", closePasswordModal);
    els.passwordForm?.addEventListener("submit", submitPasswordChange);

    // Connect Google account
    els.connectGoogleBtn?.addEventListener("click", connectGoogleAccount);

    els.passwordModal?.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) closePasswordModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.enableTwoFaModal && !els.enableTwoFaModal.classList.contains("hidden")) {
        closeEnableTwoFaModal();
      }
      if (e.key === "Escape" && els.disableTwoFaModal && !els.disableTwoFaModal.classList.contains("hidden")) {
        closeDisableTwoFaModal();
      }
      if (e.key === "Escape" && els.passwordModal && !els.passwordModal.classList.contains("hidden")) {
        closePasswordModal();
      }
    });
  };

  // ===============================
  // INIT
  // ===============================
  document.addEventListener("DOMContentLoaded", async () => {
    const redirectResult = api.auth.consumeGoogleRedirect();
    ensureFirstRunDefaults();
    initTheme();
    await loadCurrencyOptions();
    loadSettingsIntoUI();
    await loadGoogleAvailability();
    const user = await updateTwoFaUI();
    updateGoogleConnectUI(user);
    loadSessions();
    wire();

    if (redirectResult?.token || redirectResult?.success) {
      showStatus(els.status, "Google account connected.", "ok");
      clearStatusSoon(els.status, 2200);
      const refreshed = await updateTwoFaUI();
      updateGoogleConnectUI(refreshed);
    } else if (redirectResult?.error) {
      showStatus(els.status, redirectResult.error, "error");
      clearStatusSoon(els.status, 3200);
    }
  });
})();
