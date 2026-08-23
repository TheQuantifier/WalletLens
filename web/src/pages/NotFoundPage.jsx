export default function NotFoundPage() {
  return (
    <>
      <header className="nf-header" role="banner">
        <div className="nf-header-inner">
          <div className="logo-group">
            <h1 className="logo">
              <a className="logo-link" href="/">
                <img src="images/favicon.png" alt="WalletLens icon" className="logo-icon" />
                <span>WalletLens</span>
              </a>
            </h1>
            <span className="tagline">Track Smarter. Stress Less.</span>
          </div>
        </div>
      </header>
      <main className="nf-hero" id="mainContent">
        <div className="nf-hero-content card">
          <p className="index-kicker">404 error</p>
          <h1 className="nf-title">That page could not be found.</h1>
          <p className="nf-subtitle">The address may be outdated or mistyped. Your WalletLens data has not been changed.</p>
          <div className="nf-hero-actions">
            <a className="nf-btn" href="/">Return to WalletLens</a>
          </div>
        </div>
      </main>
    </>
  );
}
