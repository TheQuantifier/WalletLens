export default function TimeoutPage() {
  return (
    <>
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
          </div>
        </header>
      
        <main className="main main--login">
          <section className="nf-hero">
            <div className="nf-hero-content">
              <h1 className="nf-title">Session Timed Out</h1>
              <p className="nf-subtitle">You were signed out after being inactive for too long.</p>
              <div className="nf-signup" style={{ "maxWidth": "420px" }}>
                <a className="nf-btn" href="/login" style={{ "textDecoration": "none", "textAlign": "center" }}>Log In Again</a>
                <a className="nf-login" href="/about" style={{ "textAlign": "center" }}>Back to About</a>
              </div>
            </div>
          </section>
        </main>
        <footer className="nf-footer" role="contentinfo">
          <div className="nf-footer-inner">
            <p>© {new Date().getFullYear()} &lt;AppName&gt;. All rights reserved.</p>
            <nav className="nf-legal" aria-label="Footer">
              <a href="/about" data-public-modal="about">About</a><span className="sep">•</span>
              <a href="/privacy" data-public-modal="privacy">Privacy</a><span className="sep">•</span>
              <button type="button" className="nf-legal-link" data-public-modal="contact">Contact</button>
            </nav>
          </div>
        </footer>
    </>
  );
}

