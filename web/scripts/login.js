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
  const twoFactorPrompt = document.getElementById("twoFactorPrompt");
  const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
  const passwordToggles = document.querySelectorAll(".password-toggle");
  const googleLoginBtn = document.getElementById("googleLoginBtn");
  const contactModal = document.getElementById("contactModal");
  const contactForm = document.getElementById("authContactForm");
  const contactOpeners = document.querySelectorAll("[data-contact-open='true']");
  const contactStatus = document.getElementById("contactStatus");
  const contactSubmitBtn = document.getElementById("contactSubmitBtn");
  const contactSubject = document.getElementById("contactSubject");
  const contactEmail = document.getElementById("contactEmail");
  const contactMessage = document.getElementById("contactMessage");

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

  let verificationMode = "login";

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

  const setVerificationMode = (mode) => {
    verificationMode = mode === "reset" ? "reset" : "login";
    if (twoFactorPrompt) {
      twoFactorPrompt.textContent =
        verificationMode === "reset"
          ? "Enter the password reset code sent to your email. You will be signed in and redirected to change your password."
          : "Enter the code sent to your email.";
    }
  };

  passwordToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const targetId = toggle.getAttribute("data-target");
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      const showing = target.type === "password";
      target.type = showing ? "text" : "password";
      toggle.classList.toggle("is-active", showing);
      toggle.setAttribute("aria-pressed", showing ? "true" : "false");
      toggle.setAttribute("aria-label", showing ? "Hide password" : "Show password");
      target.focus();
    });
  });

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
        setVerificationMode("login");
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

  forgotPasswordBtn?.addEventListener("click", async () => {
    errorEl.textContent = "";
    const identifier = document.getElementById("email")?.value.trim();

    if (!identifier) {
      errorEl.textContent = "Enter your email or username first.";
      return;
    }

    forgotPasswordBtn.disabled = true;
    forgotPasswordBtn.textContent = "Sending code...";

    try {
      const result = await api.auth.requestPasswordResetLogin(identifier);
      setVerificationMode("reset");
      if (result?.twoFactorToken) {
        showTwoFactor(result.twoFactorToken);
      }
      errorEl.textContent =
        result?.message ||
        "If that account exists and supports password login, a verification code has been emailed.";
    } catch (err) {
      console.error("Forgot password error:", err);
      errorEl.textContent = err.message || "Unable to send reset code.";
    } finally {
      forgotPasswordBtn.disabled = false;
      forgotPasswordBtn.textContent = "Forgot password?";
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
      const result =
        verificationMode === "reset"
          ? await api.auth.verifyPasswordResetLogin(code, token)
          : await api.auth.verifyTwoFaLogin(code, token);
      if (result?.token) {
        sessionStorage.removeItem("twoFactorToken");
      }
      hideTwoFactor();
      if (verificationMode === "reset" && result?.passwordResetRequired) {
        sessionStorage.setItem("passwordResetToken", result.passwordResetToken || "");
        sessionStorage.setItem("forcePasswordReset", "true");
        window.location.href = "settings.html?passwordReset=1";
        return;
      }
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

  const setContactModalOpen = (open) => {
    if (!contactModal) return;
    contactModal.classList.toggle("hidden", !open);
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      contactSubject?.focus();
    }
  };

  const setContactStatus = (message, kind = "info") => {
    if (!contactStatus) return;
    if (!message) {
      contactStatus.textContent = "";
      contactStatus.classList.add("is-hidden");
      contactStatus.style.color = "";
      return;
    }
    contactStatus.textContent = message;
    contactStatus.classList.remove("is-hidden");
    contactStatus.style.color =
      kind === "error" ? "#b91c1c" : kind === "ok" ? "#166534" : "";
  };

  contactOpeners.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      setContactStatus("");
      setContactModalOpen(true);
    });
  });

  contactModal?.addEventListener("click", (e) => {
    if (e.target?.matches("[data-contact-close]")) {
      setContactModalOpen(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && contactModal && !contactModal.classList.contains("hidden")) {
      setContactModalOpen(false);
    }
  });

  contactForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const subject = contactSubject?.value?.trim() || "";
    const email = contactEmail?.value?.trim() || "";
    const message = contactMessage?.value?.trim() || "";

    if (!subject || !email || !message) {
      setContactStatus("Please add subject, email, and message.", "error");
      return;
    }

    if (contactSubmitBtn) {
      contactSubmitBtn.disabled = true;
      contactSubmitBtn.textContent = "Sending...";
    }
    setContactStatus("Sending your message...");

    try {
      await api.support.contactPublic({ subject, message, name: "Guest User", email });
      setContactStatus("Thanks! Your message has been sent to support.", "ok");
      contactForm.reset();
    } catch (err) {
      const fallback = "Unable to send message right now.";
      const raw = err?.message || fallback;
      setContactStatus(raw, "error");
    } finally {
      if (contactSubmitBtn) {
        contactSubmitBtn.disabled = false;
        contactSubmitBtn.textContent = "Send Message";
      }
    }
  });
});
