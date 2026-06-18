import { useEffect, useState } from "react";
import { api } from "../../scripts/api.js";

function postAuthDestination(user) {
  const accountStatus = String(user?.account_status || user?.accountStatus || "active").trim().toLowerCase();
  return accountStatus === "expired" ? "/expired" : "/home";
}

function navigateTo(path) {
  if (window.__walletlensNavigate) window.__walletlensNavigate(path);
  else window.location.href = path;
}

function GoogleMark() {
  return (
    <svg className="google-auth-icon" viewBox="0 0 533.5 544.3" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.5-36.2-4.7-53.3H272v100.9h146.9c-6.3 34-25 62.9-53.2 82.2v68h86.1c50.4-46.4 81.7-114.9 81.7-197.8z" />
      <path fill="#34A853" d="M272 544.3c72.7 0 133.8-24.1 178.4-65.5l-86.1-68c-24 16.1-54.7 25.5-92.3 25.5-71 0-131.2-47.9-152.7-112.4h-88.9v70.1C74.6 482.9 166.1 544.3 272 544.3z" />
      <path fill="#FBBC05" d="M119.3 323.9c-10.9-32.8-10.9-68.3 0-101.1v-70.1h-88.9c-36.8 73.3-36.8 168 0 241.3l88.9-70.1z" />
      <path fill="#EA4335" d="M272 107.7c39.5-.6 77.7 14 106 40.8l79-79C411.7 24.6 343.4-.3 272 0 166.1 0 74.6 61.4 30.4 152.7l88.9 70.1C140.8 155.6 201 107.7 272 107.7z" />
    </svg>
  );
}

function PasswordEyeIcon() {
  return (
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
  );
}

function ContactModal({ open, onClose }) {
  const [form, setForm] = useState({ subject: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus("Please add subject, email, and message.");
      return;
    }
    setSending(true);
    setStatus("Sending your message...");
    try {
      await api.support.contactPublic({ ...form, name: "Guest User" });
      setStatus("Thanks. Your message has been sent to support.");
      setForm({ subject: "", email: "", message: "" });
    } catch (err) {
      setStatus(err?.message || "Unable to send message right now.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div id="contactModal" className="nf-modal" role="dialog" aria-modal="true" aria-labelledby="contactModalTitle">
      <div className="nf-modal-backdrop" onClick={onClose}></div>
      <div className="nf-modal-content nf-contact-modal-content" role="document">
        <div className="nf-modal-header">
          <h2 id="contactModalTitle">Contact Support</h2>
          <button type="button" className="nf-modal-close" onClick={onClose}>Close</button>
        </div>
        <div className="nf-modal-body">
          <form id="authContactForm" className="nf-contact-form" onSubmit={submit}>
            <label htmlFor="contactSubject">
              <span className="label">Subject</span>
              <input id="contactSubject" name="subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} autoComplete="off" placeholder="What can we help with?" required />
            </label>
            <label htmlFor="contactEmail">
              <span className="label">Email</span>
              <input id="contactEmail" name="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" placeholder="you@example.com" required />
            </label>
            <label htmlFor="contactMessage">
              <span className="label">Message</span>
              <textarea id="contactMessage" name="message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} rows="5" placeholder="Tell us what happened." required />
            </label>
            {status ? <p id="contactStatus" className="subtle" aria-live="polite">{status}</p> : null}
            <button type="submit" id="contactSubmitBtn" className="nf-btn" disabled={sending}>{sending ? "Sending..." : "Send Message"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [appName, setAppName] = useState(sessionStorage.getItem("appName") || "WalletLens");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(sessionStorage.getItem("authRedirectMessage") || "");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [verification, setVerification] = useState({ mode: "login", token: "", code: "" });
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem("authRedirectMessage");

    api.appSettings.getPublic()
      .then((settings) => {
        const nextName = settings?.appName || "WalletLens";
        setAppName(nextName);
        sessionStorage.setItem("appName", nextName);
        window.dispatchEvent(new CustomEvent("appName:updated", { detail: { appName: nextName } }));
      })
      .catch(() => {});

    const googleRedirect = api.auth.consumeGoogleRedirect();
    if (googleRedirect?.token || googleRedirect?.success) {
      api.auth.me()
        .then(({ user }) => {
          navigateTo(postAuthDestination(user));
        })
        .catch(() => {
          navigateTo("/home");
        });
      return;
    }
    if (googleRedirect?.error) setMessage(googleRedirect.error);

    api.auth.googleConfig()
      .then((cfg) => setGoogleEnabled(!!cfg?.enabled))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!identifier.trim() || !password.trim()) {
      setMessage("Please enter your email/username and password.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.auth.login(identifier.trim(), password);
      if (result?.requires2fa) {
        setVerification({ mode: "login", token: result.twoFactorToken || "", code: "" });
        setMessage("Enter the verification code sent to your email.");
        return;
      }
      navigateTo(postAuthDestination(result?.user));
    } catch (err) {
      setMessage(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    setMessage("");
    if (!identifier.trim()) {
      setMessage("Enter your email or username first.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.auth.requestPasswordResetLogin(identifier.trim());
      setVerification({ mode: "reset", token: result?.twoFactorToken || "", code: "" });
      setMessage(result?.message || "If that account exists, a verification code has been emailed.");
    } catch (err) {
      setMessage(err?.message || "Unable to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!verification.code.trim()) {
      setMessage("Please enter the 6-digit code.");
      return;
    }
    if (!verification.token) {
      setMessage("Verification expired. Please log in again.");
      setVerification({ mode: "login", token: "", code: "" });
      return;
    }
    setLoading(true);
    try {
      const result =
        verification.mode === "reset"
          ? await api.auth.verifyPasswordResetLogin(verification.code.trim(), verification.token)
          : await api.auth.verifyTwoFaLogin(verification.code.trim(), verification.token);
      setVerification({ mode: "login", token: "", code: "" });
      if (verification.mode === "reset" && result?.passwordResetRequired) {
        sessionStorage.setItem("passwordResetToken", result.passwordResetToken || "");
        sessionStorage.setItem("forcePasswordReset", "true");
        navigateTo("/settings?passwordReset=1");
        return;
      }
      navigateTo(postAuthDestination(result?.user));
    } catch (err) {
      setMessage(err?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="nf-header" role="banner">
        <div className="nf-header-inner">
          <div className="logo-group">
            <h1 className="logo">
              <a className="logo-link" href="/" style={{ textDecoration: "none", color: "inherit" }}>
                <img src="images/favicon.png" alt="App icon" className="logo-icon" />
                <span>{appName}</span>
              </a>
            </h1>
            <span className="tagline">Track Smarter. Stress Less.</span>
          </div>
          <nav className="nf-auth-right" aria-label="Authentication">
            <a href="/registerwho" className="nf-login">Register</a>
          </nav>
        </div>
      </header>

      <main className="main main--login">
        <section className="nf-hero">
          <div className="nf-hero-content">
            <h1 className="nf-title">Welcome back</h1>
            <p className="nf-subtitle">Log in to manage your finances and view your records.</p>

            <form id="loginForm" className="nf-signup" autoComplete="off" onSubmit={submit}>
              <input id="email" className="nf-input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Email or username" aria-label="Email or username" required />
              <div className="password-field">
                <input id="password" className="nf-input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" aria-label="Password" required />
                <button type="button" className={`password-toggle${showPassword ? " is-active" : ""}`} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                  <PasswordEyeIcon />
                </button>
              </div>
              <button type="submit" className="nf-btn" disabled={loading}>{loading ? "Working..." : "Login"}</button>
              <button type="button" id="forgotPasswordBtn" className="nf-text-btn" onClick={requestPasswordReset} disabled={loading}>Forgot password?</button>

              <div className="auth-alt">
                <p className="auth-alt-label">Or Login with</p>
                <button type="button" id="googleLoginBtn" className="google-auth-btn" disabled={!googleEnabled} onClick={() => api.auth.beginGoogleAuth("login", window.location.href)} aria-label="Login with Google">
                  <GoogleMark />
                  <span>Google</span>
                </button>
              </div>

              {verification.token ? (
                <div id="twoFactorWrap" className="two-factor-wrap">
                  <p id="twoFactorPrompt" className="subtle">
                    {verification.mode === "reset"
                      ? "Enter the password reset code sent to your email."
                      : "Enter the code sent to your email."}
                  </p>
                  <input id="twoFactorCode" className="nf-input" value={verification.code} onChange={(event) => setVerification({ ...verification, code: event.target.value })} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" />
                  <button type="button" id="verifyTwoFactorBtn" className="nf-btn" onClick={verifyCode} disabled={loading}>Verify Code</button>
                </div>
              ) : null}
            </form>

            <p className="auth-links">Do not have an account? <a href="/registerwho">Create one</a>.</p>
            {message ? <p id="loginError" className="nf-error" aria-live="polite">{message}</p> : null}
          </div>
        </section>
      </main>

      <footer className="nf-footer" role="contentinfo">
        <div className="nf-footer-inner">
          <p>&copy; {new Date().getFullYear()} {appName}. All rights reserved.</p>
          <nav className="nf-legal" aria-label="Footer">
            <a href="/privacy" className="nf-legal-link">Privacy</a><span className="sep">&bull;</span>
            <a href="/terms" className="nf-legal-link">Terms</a><span className="sep">&bull;</span>
            <button type="button" className="nf-legal-link" onClick={() => setContactOpen(true)}>Contact</button>
          </nav>
        </div>
      </footer>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}

