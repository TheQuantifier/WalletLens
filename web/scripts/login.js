// scripts/login.js

import { api } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");
  const twoFactorWrap = document.getElementById("twoFactorWrap");
  const twoFactorCode = document.getElementById("twoFactorCode");
  const verifyTwoFactorBtn = document.getElementById("verifyTwoFactorBtn");
  const googleLoginBtn = document.getElementById("googleLoginBtn");

  if (!form) {
    console.error("❌ loginForm not found.");
    return;
  }

  const redirectMsg = sessionStorage.getItem("authRedirectMessage");
  if (redirectMsg && errorEl) {
    errorEl.textContent = redirectMsg;
    sessionStorage.removeItem("authRedirectMessage");
  }

  const googleRedirect = api.auth.consumeGoogleRedirect();
  if (googleRedirect?.token || googleRedirect?.success) {
    window.location.href = "home.html";
    return;
  }
  if (googleRedirect?.error && errorEl) {
    errorEl.textContent = googleRedirect.error;
  }

  const showTwoFactor = (token) => {
    if (!twoFactorWrap) return;
    sessionStorage.setItem("twoFactorToken", token || "");
    twoFactorWrap.classList.remove("is-hidden");
    twoFactorCode?.focus?.();
  };

  const hideTwoFactor = () => {
    if (!twoFactorWrap) return;
    sessionStorage.removeItem("twoFactorToken");
    twoFactorWrap.classList.add("is-hidden");
    if (twoFactorCode) twoFactorCode.value = "";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const identifier = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value.trim();

    if (!identifier || !password) {
      errorEl.textContent = "Please enter your email/username and password.";
      return;
    }

    try {
      // ---- LOGIN THROUGH CENTRALIZED API MODULE ----
      const result = await api.auth.login(identifier, password);

      if (result?.requires2fa) {
        showTwoFactor(result.twoFactorToken);
        errorEl.textContent = "Enter the verification code sent to your email.";
        return;
      }

      // Success → redirect to dashboard
      window.location.href = "home.html";

    } catch (err) {
      console.error("Login error:", err);
      errorEl.textContent = err.message || "Login failed.";
    }
  });

  verifyTwoFactorBtn?.addEventListener("click", async () => {
    if (!twoFactorCode) return;
    errorEl.textContent = "";

    const code = twoFactorCode.value.trim();
    if (!code) {
      errorEl.textContent = "Please enter the 6-digit code.";
      return;
    }

    const token = sessionStorage.getItem("twoFactorToken") || "";
    if (!token) {
      errorEl.textContent = "Verification expired. Please log in again.";
      hideTwoFactor();
      return;
    }

    try {
      const result = await api.auth.verifyTwoFaLogin(code, token);
      if (result?.token) {
        sessionStorage.removeItem("twoFactorToken");
      }
      hideTwoFactor();
      window.location.href = "home.html";
    } catch (err) {
      console.error("2FA verify error:", err);
      errorEl.textContent = err.message || "Verification failed.";
    }
  });

  if (googleLoginBtn) {
    (async () => {
      try {
        const cfg = await api.auth.googleConfig();
        if (!cfg?.enabled) {
          googleLoginBtn.disabled = true;
          googleLoginBtn.title = "Google login is not configured yet.";
          return;
        }
        googleLoginBtn.addEventListener("click", () => {
          api.auth.beginGoogleAuth("login", window.location.href);
        });
      } catch (err) {
        console.error("Google config error:", err);
        googleLoginBtn.disabled = true;
        googleLoginBtn.title = "Google login is unavailable.";
      }
    })();
  }
});
