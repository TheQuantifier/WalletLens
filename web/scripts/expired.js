import { api } from "./api.js";
import { exportAllUserData, getPreferredExportFormat } from "./export-utils.js";

(() => {
  const els = {
    accountStatus: document.getElementById("expiredAccountStatus"),
    accountMeta: document.getElementById("expiredAccountMeta"),
    supportMeta: document.getElementById("expiredSupportMeta"),
    requestMessage: document.getElementById("expiredRequestMessage"),
    exportBtn: document.getElementById("expiredExportBtn"),
    requestBtn: document.getElementById("expiredRequestBtn"),
    deleteBtn: document.getElementById("expiredDeleteBtn"),
    logoutLink: document.getElementById("expiredLogoutLink"),
    status: document.getElementById("expiredStatus"),
  };

  let currentUser = null;
  let supportEmail = "";

  const setStatus = (message, kind = "info") => {
    if (!els.status) return;
    if (!message) {
      els.status.textContent = "";
      els.status.classList.add("is-hidden");
      els.status.classList.remove("is-ok", "is-error");
      return;
    }
    els.status.textContent = message;
    els.status.classList.remove("is-hidden");
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-error", kind === "error");
  };

  const setBusy = (button, busyText, busy) => {
    if (!button) return;
    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent || "";
    }
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.defaultText;
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString();
  };

  const renderAccountState = (user) => {
    currentUser = user || null;
    const accountStatus = String(user?.account_status || user?.accountStatus || "active")
      .trim()
      .toLowerCase();
    const expiresAt = user?.access_expires_at || user?.accessExpiresAt || "";
    const trialStartedAt = user?.trial_started_at || user?.trialStartedAt || "";

    if (accountStatus !== "expired") {
      window.location.href = "home.html";
      return;
    }

    if (els.accountStatus) {
      els.accountStatus.textContent = "Expired";
    }
    if (els.accountMeta) {
      const parts = [];
      if (trialStartedAt) parts.push(`Trial started ${formatDateTime(trialStartedAt)}`);
      if (expiresAt) parts.push(`expired ${formatDateTime(expiresAt)}`);
      els.accountMeta.textContent = parts.join(" • ");
    }
  };

  async function loadContext() {
    try {
      const [{ user }, publicSettings] = await Promise.all([
        api.auth.me(),
        api.appSettings.getPublic().catch(() => ({})),
      ]);
      supportEmail = String(publicSettings?.supportEmail || "").trim();
      renderAccountState(user);
      if (els.supportMeta) {
        els.supportMeta.textContent = supportEmail
          ? `Access requests will be emailed to ${supportEmail}.`
          : "Access requests will be emailed to support.";
      }
    } catch {
      window.location.href = "login.html";
    }
  }

  async function exportData() {
    setBusy(els.exportBtn, "Preparing Export...", true);
    setStatus("Preparing your full account export...");
    try {
      await exportAllUserData({
        format: getPreferredExportFormat(),
        localSettings: {
          currency: localStorage.getItem("settings_currency") || "",
          numberFormat: localStorage.getItem("settings_number_format") || "",
          timezone: localStorage.getItem("settings_timezone") || "",
          language: localStorage.getItem("settings_language") || "",
          dashboardView: localStorage.getItem("settings_dashboard_view") || "",
          exportFormat: getPreferredExportFormat(),
        },
      });
      setStatus("Your export has started.", "ok");
    } catch (err) {
      setStatus(err?.message || "Export failed.", "error");
    } finally {
      setBusy(els.exportBtn, "", false);
    }
  }

  async function requestAccess() {
    setBusy(els.requestBtn, "Sending Request...", true);
    setStatus("Sending your access request...");
    try {
      const expiresAt = currentUser?.access_expires_at || currentUser?.accessExpiresAt || "";
      const message = [
        "Please review and restore access for my account.",
        currentUser?.email ? `Account email: ${currentUser.email}` : "",
        expiresAt ? `Expired at: ${formatDateTime(expiresAt)}` : "",
        String(els.requestMessage?.value || "").trim(),
      ]
        .filter(Boolean)
        .join("\n");

      await api.support.contact({
        subject: "Access request",
        message,
      });
      if (els.requestMessage) {
        els.requestMessage.value = "";
      }
      setStatus("Your request was sent to support.", "ok");
    } catch (err) {
      setStatus(err?.message || "Unable to send the access request.", "error");
    } finally {
      setBusy(els.requestBtn, "", false);
    }
  }

  async function deleteAccount() {
    const confirmed = window.confirm(
      "This will permanently delete your account and data. Continue?"
    );
    if (!confirmed) return;

    setBusy(els.deleteBtn, "Deleting Account...", true);
    setStatus("Deleting your account...");
    try {
      await api.auth.deleteAccount();
      setStatus("Account deleted. Redirecting to login...", "ok");
      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    } catch (err) {
      setStatus(err?.message || "Delete failed.", "error");
    } finally {
      setBusy(els.deleteBtn, "", false);
    }
  }

  async function logout(event) {
    event.preventDefault();
    try {
      await api.auth.logout();
    } catch {
      // ignore
    } finally {
      window.location.href = "login.html";
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await loadContext();
    els.exportBtn?.addEventListener("click", exportData);
    els.requestBtn?.addEventListener("click", requestAccess);
    els.deleteBtn?.addEventListener("click", deleteAccount);
    els.logoutLink?.addEventListener("click", logout);
  });
})();
