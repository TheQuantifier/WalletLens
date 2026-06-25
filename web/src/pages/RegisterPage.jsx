import { useEffect } from "react";
import { api } from "../../scripts/api.js";

function postAuthDestination(user) {
  const accountStatus = String(user?.account_status || user?.accountStatus || "active").trim().toLowerCase();
  return accountStatus === "expired" ? "/expired" : "/home";
}

function navigateTo(path) {
  if (window.__walletlensNavigate) window.__walletlensNavigate(path);
  else window.location.href = path;
}

export default function RegisterPage() {
  useEffect(() => {
    const year = document.getElementById("year");
    const form = document.getElementById("registerForm");
    const msg = document.getElementById("registerMessage");
    const btn = document.getElementById("registerBtn");
    const googleRegisterBtn = document.getElementById("googleRegisterBtn");
    const passwordInput = document.getElementById("password");
    const confirmInput = document.getElementById("confirmPassword");
    const agreeCheckbox = document.getElementById("agree");
    const legalModal = document.getElementById("legalModal");
    const legalModalTitle = document.getElementById("legalModalTitle");
    const legalModalBody = document.getElementById("legalModalBody");
    const legalConsentActions = document.getElementById("legalConsentActions");
    const legalDisagreeBtn = document.getElementById("legalDisagreeBtn");
    const legalAgreeBtn = document.getElementById("legalAgreeBtn");
    const contactModal = document.getElementById("contactModal");
    const contactForm = document.getElementById("authContactForm");
    const contactStatus = document.getElementById("contactStatus");
    const contactSubmitBtn = document.getElementById("contactSubmitBtn");

    if (year) year.textContent = new Date().getFullYear();

    let legalFlowActive = false;
    let legalFlowStepIndex = 0;
    let suppressAgreeEvent = false;
    const legalSequence = ["terms", "privacy"];

    const googleRedirect = api.auth.consumeGoogleRedirect();
    if (googleRedirect?.token || googleRedirect?.success) {
      api.auth.me()
        .then(({ user }) => {
          navigateTo(postAuthDestination(user));
        })
        .catch(() => {
          navigateTo("/home");
        });
      return undefined;
    }

    const showMsg = (text, kind = "info") => {
      if (!msg) return;
      msg.textContent = text;
      msg.style.display = "block";
      msg.classList.remove("is-hidden");
      msg.style.color = kind === "error" ? "#b91c1c" : kind === "ok" ? "#166534" : "#111827";
    };

    const clearMsg = () => {
      if (!msg) return;
      msg.textContent = "";
      msg.style.display = "none";
      msg.classList.add("is-hidden");
      msg.style.color = "";
    };

    if (googleRedirect?.error) showMsg(googleRedirect.error, "error");

    const setPasswordStyle = (input, isValid) => {
      if (!input) return;
      input.style.borderColor = isValid ? "#16a34a" : "#b91c1c";
      input.style.color = isValid ? "#166534" : "#b91c1c";
      input.style.boxShadow = document.activeElement === input
        ? isValid
          ? "0 0 0 3px rgba(22,163,74,0.2)"
          : "0 0 0 3px rgba(185,28,28,0.15)"
        : "none";
    };

    const updatePasswordStyles = () => {
      const passwordValue = passwordInput?.value || "";
      const confirmValue = confirmInput?.value || "";
      const passwordOk = passwordValue.length >= 8;
      setPasswordStyle(passwordInput, passwordOk);
      setPasswordStyle(confirmInput, passwordOk && confirmValue === passwordValue);
    };

    const passwordToggleHandler = (event) => {
      const toggle = event.currentTarget;
      const targetId = toggle.getAttribute("data-target");
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      const showing = target.type === "password";
      target.type = showing ? "text" : "password";
      toggle.classList.toggle("is-active", showing);
      toggle.setAttribute("aria-pressed", showing ? "true" : "false");
      toggle.setAttribute("aria-label", showing ? "Hide password" : "Show password");
      target.focus();
      updatePasswordStyles();
    };

    document.querySelectorAll(".password-toggle").forEach((toggle) => {
      toggle.addEventListener("click", passwordToggleHandler);
    });

    const syncScrollLock = () => {
      const legalOpen = legalModal && !legalModal.classList.contains("hidden");
      const contactOpen = contactModal && !contactModal.classList.contains("hidden");
      document.body.style.overflow = legalOpen || contactOpen ? "hidden" : "";
    };

    const setModalOpen = (modal, open) => {
      modal?.classList.toggle("hidden", !open);
      syncScrollLock();
    };

    const setAgree = (checked) => {
      if (!agreeCheckbox) return;
      suppressAgreeEvent = true;
      agreeCheckbox.checked = checked;
      suppressAgreeEvent = false;
    };

    const loadLegal = async (kind) => {
      const config = {
        terms: { title: "Terms of Service", url: "/terms" },
        privacy: { title: "Privacy Policy", url: "/privacy" },
      }[kind];
      if (!config || !legalModalTitle || !legalModalBody) return;
      legalModalTitle.textContent = config.title;
      legalModalBody.innerHTML = `<p class="subtle">Loading...</p>`;
      const template = document.getElementById(kind === "terms" ? "termsTemplate" : "privacyTemplate");
      if (template?.innerHTML?.trim()) {
        legalModalBody.innerHTML = template.innerHTML;
        return;
      }
      try {
        const res = await fetch(config.url, { cache: "force-cache" });
        const html = await res.text();
        const parsed = new DOMParser().parseFromString(html, "text/html");
        legalModalBody.innerHTML = (parsed.querySelector("main.main--legal") || parsed.querySelector("main"))?.innerHTML || "<p>Content unavailable.</p>";
      } catch {
        legalModalBody.innerHTML = "<p>Could not load content. Please try again.</p>";
      }
    };

    const closeLegalFlow = () => {
      legalFlowActive = false;
      legalFlowStepIndex = 0;
      legalConsentActions?.classList.add("is-hidden");
      setAgree(false);
      setModalOpen(legalModal, false);
    };

    const loadLegalFlowStep = async () => {
      await loadLegal(legalSequence[legalFlowStepIndex] || "terms");
      if (legalAgreeBtn) {
        legalAgreeBtn.textContent = legalFlowStepIndex < legalSequence.length - 1 ? "Agree & Continue" : "Agree";
      }
    };

    const startLegalFlow = async () => {
      legalFlowActive = true;
      legalFlowStepIndex = 0;
      legalConsentActions?.classList.remove("is-hidden");
      setModalOpen(legalModal, true);
      await loadLegalFlowStep();
    };

    const legalLinkHandler = (event) => {
      const kind = event.currentTarget.getAttribute("data-legal");
      if (!kind) return;
      event.preventDefault();
      legalFlowActive = false;
      legalConsentActions?.classList.add("is-hidden");
      setModalOpen(legalModal, true);
      loadLegal(kind);
    };

    document.querySelectorAll(".legal-link").forEach((link) => {
      link.addEventListener("click", legalLinkHandler);
    });

    const legalModalClick = (event) => {
      if (!event.target?.matches("[data-legal-close]")) return;
      if (legalFlowActive) closeLegalFlow();
      else setModalOpen(legalModal, false);
    };
    legalModal?.addEventListener("click", legalModalClick);

    const agreeChange = async () => {
      if (suppressAgreeEvent || !agreeCheckbox?.checked) return;
      setAgree(false);
      clearMsg();
      await startLegalFlow();
    };
    agreeCheckbox?.addEventListener("change", agreeChange);

    const disagreeClick = () => closeLegalFlow();
    legalDisagreeBtn?.addEventListener("click", disagreeClick);

    const agreeClick = async () => {
      if (!legalFlowActive) {
        setModalOpen(legalModal, false);
        return;
      }
      if (legalFlowStepIndex < legalSequence.length - 1) {
        legalFlowStepIndex += 1;
        await loadLegalFlowStep();
        return;
      }
      legalFlowActive = false;
      legalFlowStepIndex = 0;
      legalConsentActions?.classList.add("is-hidden");
      setAgree(true);
      setModalOpen(legalModal, false);
    };
    legalAgreeBtn?.addEventListener("click", agreeClick);

    const contactOpenHandler = () => {
      if (contactStatus) {
        contactStatus.textContent = "";
        contactStatus.classList.add("is-hidden");
      }
      setModalOpen(contactModal, true);
      document.getElementById("contactSubject")?.focus();
    };
    document.querySelectorAll("[data-contact-open='true']").forEach((trigger) => {
      trigger.addEventListener("click", contactOpenHandler);
    });

    const contactModalClick = (event) => {
      if (event.target?.matches("[data-contact-close]")) setModalOpen(contactModal, false);
    };
    contactModal?.addEventListener("click", contactModalClick);

    const contactSubmit = async (event) => {
      event.preventDefault();
      const subject = document.getElementById("contactSubject")?.value?.trim() || "";
      const email = document.getElementById("contactEmail")?.value?.trim() || "";
      const message = document.getElementById("contactMessage")?.value?.trim() || "";
      if (!subject || !email || !message) {
        if (contactStatus) {
          contactStatus.textContent = "Please add subject, email, and message.";
          contactStatus.classList.remove("is-hidden");
          contactStatus.style.color = "#b91c1c";
        }
        return;
      }
      if (contactSubmitBtn) {
        contactSubmitBtn.disabled = true;
        contactSubmitBtn.textContent = "Sending...";
      }
      try {
        await api.support.contactPublic({ subject, email, message, name: "Guest User" });
        if (contactStatus) {
          contactStatus.textContent = "Thanks! Your message has been sent to support.";
          contactStatus.classList.remove("is-hidden");
          contactStatus.style.color = "#166534";
        }
        contactForm?.reset();
      } catch (err) {
        if (contactStatus) {
          contactStatus.textContent = err?.message || "Unable to send message right now.";
          contactStatus.classList.remove("is-hidden");
          contactStatus.style.color = "#b91c1c";
        }
      } finally {
        if (contactSubmitBtn) {
          contactSubmitBtn.disabled = false;
          contactSubmitBtn.textContent = "Send Message";
        }
      }
    };
    contactForm?.addEventListener("submit", contactSubmit);

    api.auth.googleConfig()
      .then((cfg) => {
        if (!cfg?.enabled && googleRegisterBtn) {
          googleRegisterBtn.disabled = true;
          googleRegisterBtn.title = "Google registration is not configured yet.";
        }
      })
      .catch(() => {
        if (googleRegisterBtn) {
          googleRegisterBtn.disabled = true;
          googleRegisterBtn.title = "Google registration is unavailable.";
        }
      });

    const googleClick = () => {
      clearMsg();
      api.auth.beginGoogleAuth("register", window.location.href);
    };
    googleRegisterBtn?.addEventListener("click", googleClick);

    const submit = async (event) => {
      event.preventDefault();
      clearMsg();
      const fullName = document.getElementById("name")?.value.trim();
      const email = document.getElementById("email")?.value.trim();
      const password = passwordInput?.value || "";
      const confirmPassword = confirmInput?.value || "";
      const agree = agreeCheckbox?.checked;

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

      showMsg("Creating your account...");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Creating...";
      }
      try {
        await api.auth.register(email, password, fullName);
        showMsg("Account created! Redirecting...", "ok");
        const { user } = await api.auth.me();
        navigateTo(postAuthDestination(user));
      } catch (err) {
        showMsg(err?.message || "Registration failed.", "error");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Create Account";
        }
      }
    };

    form?.addEventListener("submit", submit);
    passwordInput?.addEventListener("input", updatePasswordStyles);
    confirmInput?.addEventListener("input", updatePasswordStyles);
    passwordInput?.addEventListener("blur", updatePasswordStyles);
    confirmInput?.addEventListener("blur", updatePasswordStyles);
    updatePasswordStyles();

    return () => {
      document.querySelectorAll(".password-toggle").forEach((toggle) => toggle.removeEventListener("click", passwordToggleHandler));
      document.querySelectorAll(".legal-link").forEach((link) => link.removeEventListener("click", legalLinkHandler));
      document.querySelectorAll("[data-contact-open='true']").forEach((trigger) => trigger.removeEventListener("click", contactOpenHandler));
      legalModal?.removeEventListener("click", legalModalClick);
      agreeCheckbox?.removeEventListener("change", agreeChange);
      legalDisagreeBtn?.removeEventListener("click", disagreeClick);
      legalAgreeBtn?.removeEventListener("click", agreeClick);
      contactModal?.removeEventListener("click", contactModalClick);
      contactForm?.removeEventListener("submit", contactSubmit);
      googleRegisterBtn?.removeEventListener("click", googleClick);
      form?.removeEventListener("submit", submit);
    };
  }, []);

  return (
    <>
      {/* Header */}
        <header className="nf-header" role="banner">
          <div className="nf-header-inner">
            <div className="logo-group">
              <h1 className="logo">
                <a className="logo-link" href="/" style={{ "textDecoration": "none", "color": "inherit" }}>
                  <img src="images/favicon.png" alt="App icon" className="logo-icon" />
                  <span>&lt;AppName&gt;</span>
                </a>
              </h1>
              <span className="tagline">Track Smarter. Stress Less.</span>
            </div>
      
            <nav className="nf-auth-right" aria-label="Authentication">
              <a href="/login" className="nf-login">Login</a>
            </nav>
          </div>
        </header>
      
        {/* Hero */}
        <main className="main main--register">
          <section className="nf-hero">
            <div className="nf-hero-content">
              <h1 className="nf-title">Take control of your finances.</h1>
              <p className="nf-subtitle">
                Scan receipts in seconds. Categorize automatically. Be tax-ready all year.
              </p>
      
              {/* Create account box */}
              <form id="registerForm" className="auth-form" novalidate>
      
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="nf-input"
                  placeholder="Your Name"
                  autoComplete="name"
                  required
                />
      
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="nf-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
      
                <label htmlFor="password">Password</label>
                <div className="password-field">
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className="nf-input"
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    minLength="8"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    data-target="password"
                    aria-label="Show password"
                    aria-pressed="false"
                  >
                    <svg className="password-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        className="eye"
                        d="M12 5c5.5 0 9.5 4.5 10 6.1-.5 1.6-4.5 6.9-10 6.9S2.5 12.7 2 11.1C2.5 9.5 6.5 5 12 5zm0 2C8 7 4.8 9.9 4.1 11.1 4.8 12.4 8 15 12 15s7.2-2.6 7.9-3.9C19.2 9.9 16 7 12 7zm0 1.5A2.5 2.5 0 1 1 9.5 11 2.5 2.5 0 0 1 12 8.5z"
                      />
                      <path
                        className="eye-off"
                        d="M4.2 4.2a1 1 0 0 1 1.4 0l14.2 14.2a1 1 0 0 1-1.4 1.4l-2.4-2.4A10.8 10.8 0 0 1 12 19c-5.5 0-9.5-4.5-10-6.1.3-1 1.9-3.4 4.4-5.1L4.2 5.6a1 1 0 0 1 0-1.4zm4.3 4.3 1.9 1.9a2.5 2.5 0 0 0 3.2 3.2l1.9 1.9A6 6 0 0 1 8.5 8.5zm3.5-3.4A10.7 10.7 0 0 1 22 11.1c-.3 1-1.9 3.4-4.4 5.1l-1.5-1.5c1.9-1.1 3.4-2.6 3.9-3.6-.7-1.2-3.9-4.1-7.9-4.1-.9 0-1.8.1-2.6.4l-1.5-1.5c1-.3 2.1-.6 3.3-.6z"
                      />
                    </svg>
                  </button>
                </div>
      
                <p className="subtle" style={{ "margin": "-0.25rem 0 0.75rem" }}>
                  Use at least 8 characters.
                </p>
      
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="password-field">
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className="nf-input"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    minLength="8"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    data-target="confirmPassword"
                    aria-label="Show password"
                    aria-pressed="false"
                  >
                    <svg className="password-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        className="eye"
                        d="M12 5c5.5 0 9.5 4.5 10 6.1-.5 1.6-4.5 6.9-10 6.9S2.5 12.7 2 11.1C2.5 9.5 6.5 5 12 5zm0 2C8 7 4.8 9.9 4.1 11.1 4.8 12.4 8 15 12 15s7.2-2.6 7.9-3.9C19.2 9.9 16 7 12 7zm0 1.5A2.5 2.5 0 1 1 9.5 11 2.5 2.5 0 0 1 12 8.5z"
                      />
                      <path
                        className="eye-off"
                        d="M4.2 4.2a1 1 0 0 1 1.4 0l14.2 14.2a1 1 0 0 1-1.4 1.4l-2.4-2.4A10.8 10.8 0 0 1 12 19c-5.5 0-9.5-4.5-10-6.1.3-1 1.9-3.4 4.4-5.1L4.2 5.6a1 1 0 0 1 0-1.4zm4.3 4.3 1.9 1.9a2.5 2.5 0 0 0 3.2 3.2l1.9 1.9A6 6 0 0 1 8.5 8.5zm3.5-3.4A10.7 10.7 0 0 1 22 11.1c-.3 1-1.9 3.4-4.4 5.1l-1.5-1.5c1.9-1.1 3.4-2.6 3.9-3.6-.7-1.2-3.9-4.1-7.9-4.1-.9 0-1.8.1-2.6.4l-1.5-1.5c1-.3 2.1-.6 3.3-.6z"
                      />
                    </svg>
                  </button>
                </div>
      
                <label style={{ "display": "flex", "gap": "0.5rem", "alignItems": "flex-start", "marginTop": "0.25rem" }}>
                  <input type="checkbox" id="agree" name="agree" required style={{ "marginTop": "0.2rem" }} />
                  <span className="subtle">
                    I agree to the <a href="/terms" className="legal-link" data-legal="terms">Terms</a> and <a href="/privacy" className="legal-link" data-legal="privacy">Privacy Policy</a>.
                  </span>
                </label>
      
                <button type="submit" id="registerBtn" className="nf-btn">Create Account</button>
      
                <p id="registerMessage" className="form-message is-hidden" aria-live="polite"></p>
      
                <div className="auth-alt">
                  <p className="auth-alt-label">Or Register with</p>
                  <button type="button" id="googleRegisterBtn" className="google-auth-btn" aria-label="Register with Google">
                    <svg className="google-auth-icon" viewBox="0 0 533.5 544.3" aria-hidden="true" focusable="false">
                      <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.5-36.2-4.7-53.3H272v100.9h146.9c-6.3 34-25 62.9-53.2 82.2v68h86.1c50.4-46.4 81.7-114.9 81.7-197.8z"></path>
                      <path fill="#34A853" d="M272 544.3c72.7 0 133.8-24.1 178.4-65.5l-86.1-68c-24 16.1-54.7 25.5-92.3 25.5-71 0-131.2-47.9-152.7-112.4h-88.9v70.1C74.6 482.9 166.1 544.3 272 544.3z"></path>
                      <path fill="#FBBC05" d="M119.3 323.9c-10.9-32.8-10.9-68.3 0-101.1v-70.1h-88.9c-36.8 73.3-36.8 168 0 241.3l88.9-70.1z"></path>
                      <path fill="#EA4335" d="M272 107.7c39.5-.6 77.7 14 106 40.8l79-79C411.7 24.6 343.4-.3 272 0 166.1 0 74.6 61.4 30.4 152.7l88.9 70.1C140.8 155.6 201 107.7 272 107.7z"></path>
                    </svg>
                    <span>Google</span>
                  </button>
                </div>
              </form>
      
              <div className="auth-links">
                <p>Already have an account? <a href="/login">Login</a></p>
              </div>
            </div>
          </section>
      
          {/* ABOUT SECTION */}
          <section className="nf-about">
            <div className="nf-about-inner">
              <h2>What is &lt;AppName&gt;?</h2>
              <p>
                &lt;AppName&gt; is your digital assistant for managing expenses and receipts with ease.
                Whether you’re a freelancer, small business owner, or simply looking to better understand
                your spending habits, our platform simplifies financial organization from start to finish.
              </p>
      
              <div className="nf-about-grid">
                <div className="nf-about-card">
                  <h3>📸 Smart Scanning</h3>
                  <p>Upload photos or PDFs and let our intelligent OCR automatically extract and categorize receipt data.</p>
                </div>
                <div className="nf-about-card">
                  <h3>📊 Instant Insights</h3>
                  <p>Get a clear view of your spending trends with interactive graphs and exportable summaries for tax season.</p>
                </div>
                <div className="nf-about-card">
                  <h3>💾 Easy Exports</h3>
                  <p>Download your reports to Excel, QuickBooks, or CSV in one click — ready for accountants or personal review.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      
        {/* Footer */}
        <footer className="nf-footer" role="contentinfo">
          <div className="nf-footer-inner">
            <p>&copy; <span id="year"></span> &lt;AppName&gt;. All rights reserved.</p>
            <nav className="nf-legal" aria-label="Footer">
              <a href="/about" className="nf-legal-link" data-public-modal="about">About</a><span className="sep">&bull;</span>
              <a href="/privacy" className="nf-legal-link" data-public-modal="privacy">Privacy</a><span className="sep">&bull;</span>
              <button type="button" className="nf-legal-link" data-public-modal="contact">Contact</button>
            </nav>
          </div>
        </footer>
      
        <div id="legalModal" className="nf-modal hidden" role="dialog" aria-modal="true" aria-labelledby="legalModalTitle">
          <div className="nf-modal-backdrop" data-legal-close="true"></div>
          <div className="nf-modal-content" role="document">
            <div className="nf-modal-header">
              <h2 id="legalModalTitle">Legal</h2>
              <button type="button" className="nf-modal-close" data-legal-close="true" aria-label="Close legal modal">Close</button>
            </div>
            <div className="nf-modal-body" id="legalModalBody">
              <p className="subtle">Loading...</p>
            </div>
            <div className="nf-modal-footer is-hidden" id="legalConsentActions">
              <button type="button" className="nf-modal-action-disagree" id="legalDisagreeBtn">Disagree</button>
              <button type="button" className="nf-modal-action-agree" id="legalAgreeBtn">Agree</button>
            </div>
          </div>
        </div>
      
        <div id="termsTemplate" hidden>
          <section className="legal-hero">
            <h1>Terms of Service</h1>
            <p className="lead">Effective Date: February 8, 2026</p>
          </section>
          <section className="legal-content">
            <article className="card legal-placeholder">
              <p>
                These Terms of Service ("Terms") govern your access to and use of &lt;AppName&gt; ("&lt;AppName&gt;," "we," "us," or "our"). By creating an account, accessing, or using &lt;AppName&gt;, you agree to these Terms.
              </p>
      
              <h2>1. Eligibility and Account</h2>
              <p>You must be legally able to enter into a binding agreement to use &lt;AppName&gt;.</p>
              <p>You are responsible for:</p>
              <ul>
                <li>Providing accurate account information.</li>
                <li>Maintaining the confidentiality of your login credentials.</li>
                <li>All activity that occurs under your account.</li>
              </ul>
              <p>You must promptly notify us if you suspect unauthorized account access.</p>
      
              <h2>2. Services Provided</h2>
              <p>
                &lt;AppName&gt; is a personal finance tool that may include expense and income tracking, receipt/document upload and OCR extraction, AI-assisted parsing and categorization, budgeting and reporting features, and account security tools including optional two-factor authentication.
              </p>
              <p>We may update, improve, suspend, or discontinue features at any time.</p>
      
              <h2>3. Google Sign-In and Third-Party Services</h2>
              <p>
                &lt;AppName&gt; may allow sign-in through Google. By using Google Sign-In, you authorize us to receive basic account information from Google for authentication and account linking.
              </p>
              <p>
                &lt;AppName&gt; may also rely on third-party providers for hosting, storage, email, OCR, AI, and other infrastructure. Use of those services is subject to their own terms and policies.
              </p>
      
              <h2>4. Your Content and Data</h2>
              <p>
                You retain ownership of the content and data you submit to &lt;AppName&gt; (such as receipts, financial records, and account profile information). You grant us a limited license to host, process, transmit, and display your data solely to operate and improve &lt;AppName&gt; and provide support/security functions.
              </p>
              <p>You represent that:</p>
              <ul>
                <li>You have rights to submit the content you upload.</li>
                <li>Your content does not violate law or third-party rights.</li>
              </ul>
      
              <h2>5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul>
                <li>Use &lt;AppName&gt; for unlawful, fraudulent, or abusive purposes.</li>
                <li>Attempt to gain unauthorized access to systems or accounts.</li>
                <li>Interfere with service operation, availability, or security.</li>
                <li>Upload malware or malicious code.</li>
                <li>Reverse engineer or attempt to extract source code except where allowed by law.</li>
              </ul>
              <p>We may suspend or terminate accounts that violate these Terms.</p>
      
              <h2>6. Financial and Tax Disclaimer</h2>
              <p>
                &lt;AppName&gt; is an informational and organizational tool only. It does not provide legal, tax, accounting, or financial advisory services.
              </p>
              <p>
                You are solely responsible for verifying all financial, OCR, and AI-generated outputs and for any decisions or filings made using &lt;AppName&gt; data.
              </p>
      
              <h2>7. Privacy</h2>
              <p>Your use of &lt;AppName&gt; is also governed by our Privacy Policy.</p>
      
              <h2>8. Intellectual Property</h2>
              <p>
                &lt;AppName&gt; software, branding, and related materials are owned by us or our licensors and are protected by applicable intellectual property laws. Except for rights expressly granted in these Terms, no rights are transferred to you.
              </p>
      
              <h2>9. Termination</h2>
              <p>
                You may stop using &lt;AppName&gt; at any time and may request account deletion through available account tools.
              </p>
              <p>
                We may suspend or terminate access immediately if required by law, needed to protect &lt;AppName&gt;/users/third parties, or if you violate these Terms.
              </p>
              <p>
                Termination does not affect provisions that should survive by nature, including ownership, disclaimers, limitations of liability, and dispute terms.
              </p>
      
              <h2>10. Disclaimers</h2>
              <p>
                &lt;AppName&gt; is provided on an "as is" and "as available" basis, without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant uninterrupted, error-free, or fully secure operation at all times.
              </p>
      
              <h2>11. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, &lt;AppName&gt; and its affiliates, officers, employees, and licensors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenues, data, or goodwill arising from or related to your use of the service.
              </p>
              <p>
                To the maximum extent permitted by law, our total liability for any claim arising out of or related to &lt;AppName&gt; will not exceed the greater of the amount you paid us for &lt;AppName&gt; in the 12 months before the claim.
              </p>
      
              <h2>12. Indemnification</h2>
              <p>
                You agree to defend, indemnify, and hold harmless &lt;AppName&gt; and its affiliates, officers, employees, and licensors from claims, damages, liabilities, losses, and expenses (including reasonable legal fees) arising from your use of &lt;AppName&gt;, your content, or your violation of these Terms or applicable law.
              </p>
      
              <h2>13. Governing Law</h2>
              <p>
                These Terms are governed by applicable laws of the jurisdiction in which &lt;AppName&gt; operates, without regard to conflict of law principles, unless otherwise required by law.
              </p>
      
              <h2>14. Changes to Terms</h2>
              <p>
                We may update these Terms from time to time. If we make material changes, we may provide notice in the app, site, or by other reasonable means. Continued use after changes become effective means you accept the updated Terms.
              </p>
      
              <h2>15. Contact</h2>
              <p>
                For questions about these Terms, contact us through &lt;AppName&gt; support channels.
              </p>
            </article>
          </section>
        </div>
      
        <div id="privacyTemplate" hidden>
          <section className="legal-hero">
            <h1>Privacy Policy</h1>
            <p className="lead">Effective Date: February 8, 2026</p>
          </section>
          <section className="legal-content">
            <article className="card legal-placeholder">
              <p>
                &lt;AppName&gt; ("we," "us," or "our") values your privacy. This Privacy Policy explains what information we collect, how we use it, how we share it, and your choices when you use &lt;AppName&gt;.
              </p>
      
              <h2>1. Information We Collect</h2>
              <p>We may collect:</p>
              <ul>
                <li>Account information: name, email address, username, password hash, and profile details you choose to provide.</li>
                <li>Financial content you provide: income and expense records, categories, budgets, notes, and reports.</li>
                <li>Receipt and document data: uploaded files, extracted OCR text, and parsed metadata.</li>
                <li>Authentication and security data: session/device information, login activity, and optional two-factor authentication data.</li>
                <li>Support communications: messages you send through support/contact forms.</li>
                <li>Technical information: IP address, browser/user agent, and basic usage logs for security and reliability.</li>
              </ul>
      
              <h2>2. How We Use Information</h2>
              <p>We use information to:</p>
              <ul>
                <li>Provide and operate &lt;AppName&gt; features.</li>
                <li>Authenticate users and secure accounts.</li>
                <li>Process receipt uploads, OCR, and AI-assisted parsing.</li>
                <li>Store and show your financial records and reports.</li>
                <li>Respond to support requests.</li>
                <li>Detect, prevent, and investigate abuse, fraud, and security incidents.</li>
                <li>Improve product performance and reliability.</li>
              </ul>
      
              <h2>3. Google Sign-In</h2>
              <p>
                If you use Google Sign-In, we receive basic profile data from Google such as your Google account ID, email, and profile name. We use this information only to authenticate your account and link it to &lt;AppName&gt;.
              </p>
      
              <h2>4. How We Share Information</h2>
              <p>
                We do not sell your personal information. We may share data with service providers that help us run the app (for example, cloud hosting, storage, email delivery, OCR/AI processing), subject to contractual and security controls. We may also disclose information when required by law, legal process, or to protect rights, safety, and platform security.
              </p>
      
              <h2>5. Data Retention</h2>
              <p>
                We retain account and app data as long as needed to provide services and comply with legal or operational obligations. If you delete your account, we delete or de-identify data according to our system design and retention requirements, except where retention is required by law.
              </p>
      
              <h2>6. Security</h2>
              <p>
                We use reasonable administrative, technical, and organizational safeguards to protect data. No system is 100% secure, and we cannot guarantee absolute security.
              </p>
      
              <h2>7. Your Choices and Rights</h2>
              <p>
                Depending on your location, you may have rights to access, correct, delete, or export personal information. You can also manage some account settings directly in &lt;AppName&gt;. To request privacy-related actions, contact us using the support details provided by the app.
              </p>
      
              <h2>8. Children's Privacy</h2>
              <p>
                &lt;AppName&gt; is not intended for children under 13 (or the applicable age in your region), and we do not knowingly collect personal data from children.
              </p>
      
              <h2>9. International Data Transfers</h2>
              <p>
                Your information may be processed and stored in countries other than your own, where privacy laws may differ.
              </p>
      
              <h2>10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will update the Effective Date above and post the revised version in the app or website.
              </p>
      
              <h2>11. Contact</h2>
              <p>
                If you have questions about this Privacy Policy, contact us through &lt;AppName&gt; support channels.
              </p>
            </article>
          </section>
        </div>
      
        <div id="contactModal" className="nf-modal hidden" role="dialog" aria-modal="true" aria-labelledby="contactModalTitle">
          <div className="nf-modal-backdrop" data-contact-close="true"></div>
          <div className="nf-modal-content nf-contact-modal-content" role="document">
            <div className="nf-modal-header">
              <h2 id="contactModalTitle">Contact Support</h2>
              <button type="button" className="nf-modal-close" data-contact-close="true" aria-label="Close contact modal">Close</button>
            </div>
            <div className="nf-modal-body">
              <form id="authContactForm" className="nf-contact-form" novalidate>
                <label htmlFor="contactSubject">
                  <span className="label">Subject</span>
                  <input
                    id="contactSubject"
                    name="subject"
                    type="text"
                    autoComplete="off"
                    placeholder="What can we help with?"
                    required
                  />
                </label>
      
                <label htmlFor="contactEmail">
                  <span className="label">Email</span>
                  <input
                    id="contactEmail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </label>
      
                <label htmlFor="contactMessage">
                  <span className="label">Message</span>
                  <textarea
                    id="contactMessage"
                    name="message"
                    rows="5"
                    placeholder="Tell us what happened (include steps to reproduce and any error messages)."
                    required
                  ></textarea>
                </label>
      
                <p id="contactStatus" className="subtle is-hidden" aria-live="polite"></p>
      
                <button type="submit" id="contactSubmitBtn" className="nf-btn">Send Message</button>
              </form>
            </div>
          </div>
        </div>
      
        {/* JS */}
    </>
  );
}

