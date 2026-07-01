import { useEffect } from "react";

export default function CareersPage() {
  const isAuthenticated = Boolean(sessionStorage.getItem("auth_token"));
  const backOnly = !isAuthenticated;
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/");
  };

  useEffect(() => {
    if (!backOnly) return undefined;
    document.body.classList.add("legal-page");
    return () => document.body.classList.remove("legal-page");
  }, [backOnly]);

  return (
    <>
      {!backOnly && <div id="header"></div>}
      
      
        <main className="main main--careers">
          <section className="careers-hero">
            <div>
              {backOnly && <button type="button" className="legal-back-btn" onClick={goBack}>Go Back</button>}
              <h1>Careers at &lt;AppName&gt;</h1>
              <p className="lead">
                We are looking for someone to partner with us as we grow &lt;AppName&gt;.
                If you thrive in lean, fast-moving teams and want real product ownership,
                we would love to hear from you. We believe &lt;AppName&gt; has the potential to become
                a multimillion-dollar company.
              </p>
            </div>
            <div className="hero-card card">
              <h2>Role Focus</h2>
              <p>
                These are collaborative roles with meaningful impact on strategy, brand, and product experience.
                You will be teaming with us to make the app better and have a chance to become a vital part of the company.
                We are currently focused on four core areas.
              </p>
              <div className="role-pill-group">
                <span className="role-pill">Marketing Officer</span>
                <span className="role-pill">Front End Designer</span>
                <span className="role-pill">Cybersecurity Lead</span>
                <span className="role-pill">Legal & Compliance Lead</span>
              </div>
            </div>
          </section>
      
          <section className="careers-roles">
            <article className="card role-card">
              <div className="role-header">
                <h2>Marketing Officer</h2>
                <span className="role-tag">Partner Role</span>
              </div>
              <p className="role-summary">
                Help shape &lt;AppName&gt;'s market positioning, launch strategy, and growth engine.
              </p>
              <ul className="role-list">
                <li>Define brand narrative, messaging, and go-to-market plan.</li>
                <li>Own growth experiments across content, partnerships, and community.</li>
                <li>Build a lightweight marketing system that scales with traction.</li>
              </ul>
            </article>
      
            <article className="card role-card">
              <div className="role-header">
                <h2>Front End Designer</h2>
                <span className="role-tag">Partner Role</span>
              </div>
              <p className="role-summary">
                Lead UI/UX direction and elevate the visual and interaction design across the app.
              </p>
              <ul className="role-list">
                <li>Create polished UI patterns and page layouts that feel premium.</li>
                <li>Collaborate on design systems, components, and motion.</li>
                <li>Ship improvements quickly with real user feedback.</li>
              </ul>
            </article>
      
            <article className="card role-card">
              <div className="role-header">
                <h2>Legal & Compliance Lead</h2>
                <span className="role-tag">Partner Role</span>
              </div>
              <p className="role-summary">
                Lead legal and compliance readiness for a modern web app, keeping &lt;AppName&gt; safe as we scale.
              </p>
              <ul className="role-list">
                <li>Own privacy policy, terms, cookie notices, and data retention practices.</li>
                <li>Review product changes for legal risk and guide compliance from day one.</li>
                <li>Monitor relevant regulations and translate requirements into clear actions.</li>
              </ul>
            </article>
      
            <article className="card role-card">
              <div className="role-header">
                <h2>Cybersecurity Lead</h2>
                <span className="role-tag">Partner Role</span>
              </div>
              <p className="role-summary">
                Build the security posture for &lt;AppName&gt; and set the foundation for safe growth.
              </p>
              <ul className="role-list">
                <li>Define security standards, threat modeling, and secure SDLC practices.</li>
                <li>Partner on auth, data protection, and incident response planning.</li>
                <li>Establish monitoring, vulnerability management, and security reviews.</li>
              </ul>
            </article>
          </section>
      
          <section className="careers-contact card">
            <h2>Get in Touch</h2>
            <p>
              If this sounds like you, reach out with a short note and a portfolio, case study, or past work samples.
            </p>
            <p>
              Email us at <a href="mailto:support.wisewallet@manuswebworks.org">support.wisewallet@manuswebworks.org</a>
            </p>
          </section>
        </main>
      
        {!backOnly && <div id="footer"></div>}
    </>
  );
}
