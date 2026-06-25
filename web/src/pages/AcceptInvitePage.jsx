import { useEffect, useState } from "react";
import { api } from "../../scripts/api.js";

function navigateTo(path) {
  if (window.__walletlensNavigate) window.__walletlensNavigate(path);
  else window.location.href = path;
}

export default function AcceptInvitePage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [form, setForm] = useState({ fullName: "", password: "", confirmPassword: "" });

  useEffect(() => {
    if (!token) {
      setMessage("This invitation link is incomplete.");
      setLoading(false);
      return;
    }
    Promise.all([
      api.auth.getOrganizationInvitation(token),
      api.auth.me().catch(() => ({ user: null })),
    ])
      .then(([{ invitation: nextInvitation }, { user }]) => { setInvitation(nextInvitation); setCurrentUser(user || null); })
      .catch((error) => setMessage(error?.message || "This invitation is unavailable."))
      .finally(() => setLoading(false));
  }, [token]);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setMessage("Creating your account...");
    try {
      await api.auth.acceptOrganizationInvitation(token, {
        fullName: form.fullName,
        password: form.password,
      });
      navigateTo("/home");
    } catch (error) {
      setMessage(error?.message || "Unable to accept this invitation.");
      setSubmitting(false);
    }
  };

  const acceptExisting = async () => {
    setSubmitting(true);
    setMessage("Adding the organization to your account...");
    try {
      await api.auth.acceptExistingOrganizationInvitation(token);
      navigateTo("/team");
    } catch (error) {
      setMessage(error?.message || "Unable to accept this invitation.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="nf-header" role="banner"><div className="nf-header-inner"><div className="logo-group"><h1 className="logo"><a className="logo-link" href="/"><img src="images/favicon.png" alt="App icon" className="logo-icon" /><span>&lt;AppName&gt;</span></a></h1><span className="tagline">Track Smarter. Stress Less.</span></div><nav className="nf-auth-right"><a href="/login" className="nf-login">Login</a></nav></div></header>
      <main className="main main--register account-type-main">
        <section className="nf-hero account-type-hero">
          <div className="nf-hero-content invite-accept-content">
            <p className="registration-step">Organization invitation</p>
            <h1 className="nf-title">Join {invitation?.organizationName || "your organization"}</h1>
            {loading ? <p className="nf-subtitle">Checking your invitation...</p> : null}
            {!loading && invitation ? (
              <>
                <p className="nf-subtitle">This invitation is for <strong>{invitation.email}</strong>.</p>
                {invitation.hasExistingAccount ? (
                  currentUser ? (
                    <div className="auth-form business-register-form invite-accept-form">
                      <p>Accepting adds this organization to your existing account and makes it your active workspace.</p>
                      <button className="nf-btn" type="button" disabled={submitting} onClick={acceptExisting}>{submitting ? "Joining..." : "Join Organization"}</button>
                      {message ? <p className="form-message business-message-error" aria-live="polite">{message}</p> : null}
                    </div>
                  ) : (
                    <div className="auth-form business-register-form invite-accept-form">
                      <p>An account already exists for this email. Sign in to add this organization to it.</p>
                      <a className="nf-btn" href={`/login?returnTo=${encodeURIComponent(`/acceptinvite?token=${token}`)}`}>Sign In to Accept</a>
                    </div>
                  )
                ) : <form className="auth-form business-register-form invite-accept-form" onSubmit={submit}>
                  <label>Full name<input className="nf-input" name="fullName" value={form.fullName} onChange={update} autoComplete="name" required /></label>
                  <label>Password<input className="nf-input" type="password" name="password" value={form.password} onChange={update} autoComplete="new-password" minLength="8" required /></label>
                  <label>Confirm password<input className="nf-input" type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} autoComplete="new-password" minLength="8" required /></label>
                  <button className="nf-btn" type="submit" disabled={submitting}>{submitting ? "Creating..." : "Accept Invitation"}</button>
                  {message ? <p className="form-message business-message-error" aria-live="polite">{message}</p> : null}
                </form>}
              </>
            ) : null}
            {!loading && !invitation ? <p className="form-message business-message-error" aria-live="polite">{message}</p> : null}
          </div>
        </section>
      </main>
      <footer className="nf-footer"><div className="nf-footer-inner"><p>© {new Date().getFullYear()} &lt;AppName&gt;. All rights reserved.</p><nav className="nf-legal"><a href="/about" data-public-modal="about">About</a><span className="sep">•</span><a href="/privacy" data-public-modal="privacy">Privacy</a><span className="sep">•</span><button type="button" className="nf-legal-link" data-public-modal="contact">Contact</button></nav></div></footer>
    </>
  );
}
