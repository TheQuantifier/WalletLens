// web/scripts/register.js

import { api } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const year = document.getElementById("year");
  const form = document.getElementById("registerForm");
  const msg = document.getElementById("registerMessage");
  const btn = document.getElementById("registerBtn");
  const googleRegisterBtn = document.getElementById("googleRegisterBtn");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const legalModal = document.getElementById("legalModal");
  const legalModalTitle = document.getElementById("legalModalTitle");
  const legalModalBody = document.getElementById("legalModalBody");
  const termsTemplate = document.getElementById("termsTemplate");
  const privacyTemplate = document.getElementById("privacyTemplate");
  const legalConsentActions = document.getElementById("legalConsentActions");
  const legalDisagreeBtn = document.getElementById("legalDisagreeBtn");
  const legalAgreeBtn = document.getElementById("legalAgreeBtn");
  const agreeCheckbox = document.getElementById("agree");
  const contactModal = document.getElementById("contactModal");
  const contactForm = document.getElementById("authContactForm");
  const contactStatus = document.getElementById("contactStatus");
  const contactSubmitBtn = document.getElementById("contactSubmitBtn");
  const contactSubject = document.getElementById("contactSubject");
  const contactEmail = document.getElementById("contactEmail");
  const contactMessage = document.getElementById("contactMessage");
  const contactOpeners = document.querySelectorAll("[data-contact-open='true']");
  const legalCache = new Map();
  const legalSequence = ["terms", "privacy"];
  const APP_NAME_PLACEHOLDER = "<AppName>";
  let legalFlowActive = false;
  let legalFlowStepIndex = 0;
  let suppressAgreeEvent = false;

  if (year) year.textContent = new Date().getFullYear();

  const googleRedirect = api.auth.consumeGoogleRedirect();
  if (googleRedirect?.token || googleRedirect?.success) {
    window.location.href = "home.html";
    return;
  }

  const setPasswordStyle = (input, isValid) => {
    if (!input) return;
    if (isValid) {
      input.style.borderColor = "#16a34a";
      input.style.color = "#166534";
      if (document.activeElement === input) {
        input.style.boxShadow = "0 0 0 3px rgba(22,163,74,0.2)";
      } else {
        input.style.boxShadow = "none";
      }
      return;
    }
    input.style.borderColor = "#b91c1c";
    input.style.color = "#b91c1c";
    if (document.activeElement === input) {
      input.style.boxShadow = "0 0 0 3px rgba(185,28,28,0.15)";
    } else {
      input.style.boxShadow = "none";
    }
  };

  const isPasswordAcceptable = (value) => value && value.length >= 8;

  const updatePasswordStyles = () => {
    const passwordValue = passwordInput?.value || "";
    const confirmValue = confirmInput?.value || "";

    const passwordOk = isPasswordAcceptable(passwordValue);
    setPasswordStyle(passwordInput, passwordOk);

    const confirmOk = passwordOk && confirmValue === passwordValue;
    setPasswordStyle(confirmInput, confirmOk);
  };

  const showMsg = (text, kind = "info") => {
    if (!msg) return;
    msg.textContent = text;
    msg.style.display = "block";
    msg.classList.remove("is-hidden");
    msg.style.color =
      kind === "error" ? "#b91c1c" : kind === "ok" ? "#166534" : "#111827";
  };

  const clearMsg = () => {
    if (!msg) return;
    msg.textContent = "";
    msg.style.display = "none";
    msg.classList.add("is-hidden");
    msg.style.color = "";
  };

  if (googleRedirect?.error) {
    showMsg(googleRedirect.error, "error");
  }

  const syncModalScrollLock = () => {
    const legalOpen = legalModal && !legalModal.classList.contains("hidden");
    const contactOpen = contactModal && !contactModal.classList.contains("hidden");
    document.body.style.overflow = legalOpen || contactOpen ? "hidden" : "";
  };

  const setLegalModalOpen = (open) => {
    if (!legalModal) return;
    legalModal.classList.toggle("hidden", !open);
    syncModalScrollLock();
  };

  const setContactModalOpen = (open) => {
    if (!contactModal) return;
    contactModal.classList.toggle("hidden", !open);
    syncModalScrollLock();
    if (open) {
      contactSubject?.focus();
    }
  };

  const setContactStatus = (text, kind = "info") => {
    if (!contactStatus) return;
    if (!text) {
      contactStatus.textContent = "";
      contactStatus.classList.add("is-hidden");
      contactStatus.style.color = "";
      return;
    }
    contactStatus.textContent = text;
    contactStatus.classList.remove("is-hidden");
    contactStatus.style.color =
      kind === "error" ? "#b91c1c" : kind === "ok" ? "#166534" : "";
  };

  const showLegalConsentActions = (show) => {
    if (!legalConsentActions) return;
    legalConsentActions.classList.toggle("is-hidden", !show);
  };

  const setAgreeCheckbox = (checked) => {
    if (!agreeCheckbox) return;
    suppressAgreeEvent = true;
    agreeCheckbox.checked = checked;
    suppressAgreeEvent = false;
  };

  const replaceAppNamePlaceholders = (html) => {
    if (!html) return html;
    const hasPlaceholder =
      html.includes(APP_NAME_PLACEHOLDER) || html.includes("&lt;AppName&gt;");
    if (!hasPlaceholder) return html;
    const appName = sessionStorage.getItem("appName");
    if (!appName || appName === APP_NAME_PLACEHOLDER) return html;
    return html
      .split(APP_NAME_PLACEHOLDER)
      .join(appName)
      .split("&lt;AppName&gt;")
      .join(appName);
  };

  const loadLegalContent = async (kind) => {
    const config = {
      terms: { title: "Terms of Service", url: "terms.html" },
      privacy: { title: "Privacy Policy", url: "privacy.html" },
    }[kind];

    if (!config || !legalModalBody || !legalModalTitle) return;

    legalModalTitle.textContent = config.title;
    legalModalBody.innerHTML = `<p class="subtle">Loading...</p>`;

    const template =
      kind === "terms" ? termsTemplate : kind === "privacy" ? privacyTemplate : null;

    if (template?.innerHTML?.trim()) {
      const resolved = replaceAppNamePlaceholders(template.innerHTML);
      legalCache.set(kind, resolved);
      legalModalBody.innerHTML = resolved;
      return;
    }

    if (legalCache.has(kind)) {
      legalModalBody.innerHTML = legalCache.get(kind);
      return;
    }

    try {
      const res = await fetch(config.url, { cache: "force-cache" });
      if (!res.ok) throw new Error("Failed to load legal content");
      const html = await res.text();
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const main =
        parsed.querySelector("main.main--legal") || parsed.querySelector("main");
      const content = main ? main.innerHTML : "<p>Content unavailable.</p>";
      const resolved = replaceAppNamePlaceholders(content);
      legalCache.set(kind, resolved);
      legalModalBody.innerHTML = resolved;
    } catch (err) {
      console.error("Legal modal load failed:", err);
      legalModalBody.innerHTML = "<p>Could not load content. Please try again.</p>";
    }
  };

  const closeLegalFlowAsDisagree = () => {
    legalFlowActive = false;
    legalFlowStepIndex = 0;
    setAgreeCheckbox(false);
    showLegalConsentActions(false);
    setLegalModalOpen(false);
  };

  const loadLegalFlowStep = async () => {
    const kind = legalSequence[legalFlowStepIndex] || legalSequence[0];
    await loadLegalContent(kind);
    if (legalAgreeBtn) {
      legalAgreeBtn.textContent =
        legalFlowStepIndex < legalSequence.length - 1 ? "Agree & Continue" : "Agree";
    }
  };

  const startLegalFlow = async () => {
    legalFlowActive = true;
    legalFlowStepIndex = 0;
    showLegalConsentActions(true);
    setLegalModalOpen(true);
    await loadLegalFlowStep();
  };

  document.querySelectorAll(".legal-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      const kind = link.dataset.legal;
      if (!kind || !legalModal) return;
      e.preventDefault();
      legalFlowActive = false;
      showLegalConsentActions(false);
      setLegalModalOpen(true);
      loadLegalContent(kind);
    });
  });

  legalModal?.addEventListener("click", (e) => {
    if (e.target?.matches("[data-legal-close]")) {
      if (legalFlowActive) {
        closeLegalFlowAsDisagree();
        return;
      }
      setLegalModalOpen(false);
    }
  });

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
    if (e.key === "Escape" && legalModal && !legalModal.classList.contains("hidden")) {
      if (legalFlowActive) {
        closeLegalFlowAsDisagree();
        return;
      }
      setLegalModalOpen(false);
      return;
    }
    if (e.key === "Escape" && contactModal && !contactModal.classList.contains("hidden")) {
      setContactModalOpen(false);
    }
  });

  legalDisagreeBtn?.addEventListener("click", () => {
    closeLegalFlowAsDisagree();
  });

  legalAgreeBtn?.addEventListener("click", async () => {
    if (!legalFlowActive) {
      setLegalModalOpen(false);
      return;
    }

    if (legalFlowStepIndex < legalSequence.length - 1) {
      legalFlowStepIndex += 1;
      await loadLegalFlowStep();
      return;
    }

    legalFlowActive = false;
    legalFlowStepIndex = 0;
    setAgreeCheckbox(true);
    showLegalConsentActions(false);
    setLegalModalOpen(false);
  });

  if (!form) {
    console.error("❌ registerForm not found on page.");
    return;
  }

  agreeCheckbox?.addEventListener("change", async () => {
    if (suppressAgreeEvent) return;
    if (agreeCheckbox.checked) {
      setAgreeCheckbox(false);
      clearMsg();
      await startLegalFlow();
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

  if (googleRegisterBtn) {
    (async () => {
      try {
        const cfg = await api.auth.googleConfig();
        if (!cfg?.enabled) {
          googleRegisterBtn.disabled = true;
          googleRegisterBtn.title = "Google registration is not configured yet.";
          return;
        }
        googleRegisterBtn.addEventListener("click", () => {
          clearMsg();
          api.auth.beginGoogleAuth("register", window.location.href);
        });
      } catch (err) {
        console.error("Google config error:", err);
        googleRegisterBtn.disabled = true;
        googleRegisterBtn.title = "Google registration is unavailable.";
      }
    })();
  }

  updatePasswordStyles();
  passwordInput?.addEventListener("input", updatePasswordStyles);
  confirmInput?.addEventListener("input", updatePasswordStyles);
  passwordInput?.addEventListener("blur", updatePasswordStyles);
  confirmInput?.addEventListener("blur", updatePasswordStyles);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    // --- Get field values ---
    const fullName = document.getElementById("name")?.value.trim();
    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;
    const confirmPassword = document.getElementById("confirmPassword")?.value;
    const agree = document.getElementById("agree")?.checked;

    // --- Validation ---
    if (!fullName || !email || !password || !confirmPassword) {
      showMsg("Please fill in all fields.", "error");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      showMsg("Please enter a valid email.", "error");
      return;
    }

    if (password.length < 8) {
      showMsg("Password must be at least 8 characters long.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMsg("Passwords do not match.", "error");
      return;
    }

    if (!agree) {
      showMsg("Please agree to the Terms and Privacy Policy.", "error");
      return;
    }

    showMsg("Creating your account…");

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Creating…";
    }

    try {
      // ---- CALL BACKEND THROUGH api.js ----
      const result = await api.auth.register(email, password, fullName);

      showMsg("✅ Account created! Redirecting…", "ok");

      // Wait briefly then verify auth before redirect
      setTimeout(async () => {
        try {
          await api.auth.me();
          window.location.href = "home.html";
        } catch {
          sessionStorage.setItem(
            "authRedirectMessage",
            "Session expired. Please log in again."
          );
          window.location.href = "login.html";
        }
      }, 1200);

    } catch (err) {
      console.error("Registration error:", err);
      showMsg(err?.message || "Registration failed.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Create Account";
      }
    }
  });
});
