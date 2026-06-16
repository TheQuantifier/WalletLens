export default function TimeoutPage() {
  return (
    <>
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
          </div>
        </header>
      
        <main className="main main--login">
          <section className="nf-hero">
            <div className="nf-hero-content">
              <h1 className="nf-title">Session Timed Out</h1>
              <p className="nf-subtitle">You were signed out after being inactive for too long.</p>
              <div className="nf-signup" style={{ "maxWidth": "420px" }}>
                <a className="nf-btn" href="login.html" style={{ "textDecoration": "none", "textAlign": "center" }}>Log In Again</a>
                <a className="nf-login" href="about.html" style={{ "textAlign": "center" }}>Back to About</a>
              </div>
            </div>
          </section>
        </main>
    </>
  );
}
