export default function ExpiredPage() {
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
          <div className="nf-hero-content" style={{ "maxWidth": "760px" }}>
            <h1 className="nf-title">Account Access Expired</h1>
            <p className="nf-subtitle">
              Your free trial has ended. You can export your data, delete your account, or request renewed access.
            </p>
            <div className="nf-signup" style={{ "maxWidth": "560px", "gap": "0.9rem" }}>
              <div className="card" style={{ "textAlign": "left", "width": "100%", "padding": "1rem 1.1rem", "borderRadius": "18px" }}>
                <p className="subtle" style={{ "margin": "0 0 0.35rem" }}>Access status</p>
                <strong id="expiredAccountStatus">Checking account…</strong>
                <p id="expiredAccountMeta" className="subtle" style={{ "margin": "0.45rem 0 0" }}></p>
                <p id="expiredSupportMeta" className="subtle" style={{ "margin": "0.45rem 0 0" }}></p>
              </div>
              <textarea
                id="expiredRequestMessage"
                rows="5"
                placeholder="Optional note htmlFor the support team"
                style={{ "width": "100%", "borderRadius": "18px", "padding": "1rem", "border": "1px solid rgba(15,23,42,0.14)", "resize": "vertical" }}
              ></textarea>
              <button className="nf-btn" id="expiredExportBtn" type="button" style={{ "textAlign": "center" }}>Download All My Data</button>
              <button className="nf-btn" id="expiredRequestBtn" type="button" style={{ "textAlign": "center" }}>Request Access</button>
              <button className="nf-btn" id="expiredDeleteBtn" type="button" style={{ "textAlign": "center", "background": "#b91c1c" }}>Delete Account</button>
              <a className="nf-login" id="expiredLogoutLink" href="/login" style={{ "textAlign": "center" }}>Log Out</a>
              <p id="expiredStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

