export default function LoginPage() {
  return (
    <>
      {/* Header */}
        <header className="nf-header" role="banner">
          <div className="nf-header-inner">
            <div className="logo-group">
              <h1 className="logo">
                <a className="logo-link" href="index.html" style={{ "textDecoration": "none", "color": "inherit" }}>
                  <img src="images/favicon.png" alt="App icon" className="logo-icon" />
                  <span>&lt;AppName&gt;</span>
                </a>
              </h1>
              <span className="tagline">Track Smarter. Stress Less.</span>
            </div>
            <nav className="nf-auth-right" aria-label="Authentication">
              <a href="register.html" className="nf-login">Register</a>
            </nav>
          </div>
        </header>
      
        {/* Main */}
        <main className="main main--login">
          <section className="nf-hero">
            <div className="nf-hero-content">
              <h1 className="nf-title">Welcome back</h1>
              <p className="nf-subtitle">Log in to manage your finances and view your records.</p>
      
              <form id="loginForm" className="nf-signup" autoComplete="off">
                <input
                  type="text"
                  id="email"
                  className="nf-input"
                  placeholder="Email or username"
                  aria-label="Email or username"
                  required
                />
                <div className="password-field">
                  <input
                    type="password"
                    id="password"
                    className="nf-input"
                    placeholder="Password"
                    aria-label="Password"
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
                <button type="submit" className="nf-btn">Login</button>
                <button type="button" id="forgotPasswordBtn" className="nf-text-btn">Forgot password?</button>
      
                <div className="auth-alt">
                  <p className="auth-alt-label">Or Login with</p>
                  <button type="button" id="googleLoginBtn" className="google-auth-btn" aria-label="Login with Google">
                    <svg className="google-auth-icon" viewBox="0 0 533.5 544.3" aria-hidden="true" focusable="false">
                      <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.5-36.2-4.7-53.3H272v100.9h146.9c-6.3 34-25 62.9-53.2 82.2v68h86.1c50.4-46.4 81.7-114.9 81.7-197.8z"></path>
                      <path fill="#34A853" d="M272 544.3c72.7 0 133.8-24.1 178.4-65.5l-86.1-68c-24 16.1-54.7 25.5-92.3 25.5-71 0-131.2-47.9-152.7-112.4h-88.9v70.1C74.6 482.9 166.1 544.3 272 544.3z"></path>
                      <path fill="#FBBC05" d="M119.3 323.9c-10.9-32.8-10.9-68.3 0-101.1v-70.1h-88.9c-36.8 73.3-36.8 168 0 241.3l88.9-70.1z"></path>
                      <path fill="#EA4335" d="M272 107.7c39.5-.6 77.7 14 106 40.8l79-79C411.7 24.6 343.4-.3 272 0 166.1 0 74.6 61.4 30.4 152.7l88.9 70.1C140.8 155.6 201 107.7 272 107.7z"></path>
                    </svg>
                    <span>Google</span>
                  </button>
                </div>
      
                <div id="twoFactorWrap" className="two-factor-wrap is-hidden">
                  <p id="twoFactorPrompt" className="subtle">Enter the code sent to your email.</p>
                  <input
                    type="text"
                    id="twoFactorCode"
                    className="nf-input"
                    placeholder="6-digit code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                  <button type="button" id="verifyTwoFactorBtn" className="nf-btn">Verify Code</button>
                </div>
              </form>
      
              <p className="auth-links">
                Don’t have an account? <a href="register.html">Create one</a>.
              </p>
              <p id="loginError" className="nf-error"></p>
            </div>
          </section>
        </main>
      
        <footer className="nf-footer" role="contentinfo">
          <div className="nf-footer-inner">
            <p>&copy; <span id="year"></span> &lt;AppName&gt;. All rights reserved.</p>
            <nav className="nf-legal" aria-label="Footer">
              <a href="privacy.html" className="nf-legal-link">Privacy</a><span className="sep">&bull;</span>
              <a href="terms.html" className="nf-legal-link">Terms</a><span className="sep">&bull;</span>
              <button type="button" className="nf-legal-link" data-contact-open="true">Contact</button>
            </nav>
          </div>
        </footer>
      
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
      
        {/* MUST USE type="module" because login.js imports api.js */}
    </>
  );
}
