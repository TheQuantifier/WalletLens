function AccountChoice({ href, title, description, children }) {
  return (
    <a href={href} className="account-choice-card">
      <span className="account-choice-icon" aria-hidden="true">{children}</span>
      <span className="account-choice-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="account-choice-arrow" aria-hidden="true">→</span>
    </a>
  );
}

export default function RegisterWhoPage() {
  return (
    <>
      <header className="nf-header" role="banner">
        <div className="nf-header-inner">
          <div className="logo-group">
            <h1 className="logo"><a className="logo-link" href="/"><img src="images/favicon.png" alt="App icon" className="logo-icon" /><span>&lt;AppName&gt;</span></a></h1>
            <span className="tagline">Track Smarter. Stress Less.</span>
          </div>
          <nav className="nf-auth-right" aria-label="Authentication"><a href="/login" className="nf-login">Login</a></nav>
        </div>
      </header>
      <main className="main main--register account-type-main">
        <section className="nf-hero account-type-hero">
          <div className="nf-hero-content account-type-content">
            <p className="registration-step">Account setup</p>
            <h1 className="nf-title">How will you use &lt;AppName&gt;?</h1>
            <p className="nf-subtitle">Choose the account that matches how you manage finances.</p>
            <div className="account-choice-grid">
              <AccountChoice href="/register" title="Personal account" description="Track your own spending, receipts, budgets, and reports.">👤</AccountChoice>
              <AccountChoice href="/registerbusiness" title="Business account" description="Create an organization and manage its team and financial records.">🏢</AccountChoice>
            </div>
            <p className="auth-links">Already have an account? <a href="/login">Login</a></p>
          </div>
        </section>
      </main>
      <footer className="nf-footer" role="contentinfo"><div className="nf-footer-inner"><p>© {new Date().getFullYear()} &lt;AppName&gt;. All rights reserved.</p><nav className="nf-legal"><a href="/about" data-public-modal="about">About</a><span className="sep">•</span><a href="/privacy" data-public-modal="privacy">Privacy</a><span className="sep">•</span><button type="button" className="nf-legal-link" data-public-modal="contact">Contact</button></nav></div></footer>
    </>
  );
}
