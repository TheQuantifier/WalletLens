// web/scripts/register.js

import { api } from "./api.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const msg = document.getElementById("registerMessage");
  const btn = document.getElementById("registerBtn");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");

  const setPasswordStyle = (input, isValid) => {
    if (!input) return;
    if (isValid) {
      input.style.borderColor = "";
      input.style.color = "";
      input.style.boxShadow = "";
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
    msg.style.color =
      kind === "error" ? "#b91c1c" : kind === "ok" ? "#166534" : "#111827";
  };

  const clearMsg = () => {
    if (!msg) return;
    msg.textContent = "";
    msg.style.display = "none";
    msg.style.color = "";
  };

  if (!form) {
    console.error("❌ registerForm not found on page.");
    return;
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

      // Wait briefly then redirect
      setTimeout(() => {
        window.location.href = "/login.html";
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
