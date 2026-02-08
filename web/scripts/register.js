// web/scripts/register.js

import { api } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const msg = document.getElementById("registerMessage");
  const btn = document.getElementById("registerBtn");
  const googleRegisterBtn = document.getElementById("googleRegisterBtn");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const legalModal = document.getElementById("legalModal");
  const legalModalTitle = document.getElementById("legalModalTitle");
  const legalModalBody = document.getElementById("legalModalBody");
  const legalConsentActions = document.getElementById("legalConsentActions");
  const legalDisagreeBtn = document.getElementById("legalDisagreeBtn");
  const legalAgreeBtn = document.getElementById("legalAgreeBtn");
  const agreeCheckbox = document.getElementById("agree");
  const legalCache = new Map();
  const legalSequence = ["terms", "privacy"];
  let legalFlowActive = false;
  let legalFlowStepIndex = 0;
  let suppressAgreeEvent = false;

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

  const setLegalModalOpen = (open) => {
    if (!legalModal) return;
    legalModal.classList.toggle("hidden", !open);
    document.body.style.overflow = open ? "hidden" : "";
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

  const loadLegalContent = async (kind) => {
    const config = {
      terms: { title: "Terms of Service", url: "terms.html" },
      privacy: { title: "Privacy Policy", url: "privacy.html" },
    }[kind];

    if (!config || !legalModalBody || !legalModalTitle) return;

    legalModalTitle.textContent = config.title;
    legalModalBody.innerHTML = `<p class="subtle">Loadingâ€¦</p>`;

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
      legalCache.set(kind, content);
      legalModalBody.innerHTML = content;
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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && legalModal && !legalModal.classList.contains("hidden")) {
      if (legalFlowActive) {
        closeLegalFlowAsDisagree();
        return;
      }
      setLegalModalOpen(false);
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
