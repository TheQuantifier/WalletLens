import { useEffect, useState } from "react";
import { api } from "../../scripts/api.js";

const initialForm = {
  businessName: "", businessType: "", industry: "", businessEmail: "", businessPhone: "",
  website: "", address: "", city: "", region: "", postalCode: "", country: "",
  adminFullName: "", adminEmail: "", password: "", confirmPassword: "", agree: false,
};

function navigateTo(path) {
  if (window.__walletlensNavigate) window.__walletlensNavigate(path);
  else window.location.href = path;
}

export default function RegisterBusinessPage() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [legalStep, setLegalStep] = useState(null);
  const [legalFlowActive, setLegalFlowActive] = useState(false);

  useEffect(() => {
    document.body.style.overflow = legalStep ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [legalStep]);

  const update = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const openLegalDocument = (event, kind) => {
    event.preventDefault();
    setLegalFlowActive(false);
    setLegalStep(kind);
  };

  const startLegalFlow = () => {
    setForm((current) => ({ ...current, agree: false }));
    setLegalFlowActive(true);
    setLegalStep("terms");
  };

  const closeLegal = () => {
    setLegalStep(null);
    setLegalFlowActive(false);
  };

  const acceptLegalStep = () => {
    if (!legalFlowActive) {
      closeLegal();
      return;
    }
    if (legalStep === "terms") {
      setLegalStep("privacy");
      return;
    }
    setForm((current) => ({ ...current, agree: true }));
    closeLegal();
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(false);
    if (form.password !== form.confirmPassword) {
      setError(true); setMessage("Passwords do not match."); return;
    }
    if (!form.agree) {
      setError(true); setMessage("Please agree to the Terms and Privacy Policy."); return;
    }
    setSubmitting(true); setMessage("Creating your business account...");
    try {
      const { confirmPassword, agree, ...payload } = form;
      await api.auth.registerBusiness(payload);
      setMessage("Business account created. Redirecting...");
      navigateTo("/home");
    } catch (err) {
      setError(true); setMessage(err?.message || "Business registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="nf-header" role="banner"><div className="nf-header-inner"><div className="logo-group"><h1 className="logo"><a className="logo-link" href="/"><img src="images/favicon.png" alt="App icon" className="logo-icon" /><span>&lt;AppName&gt;</span></a></h1><span className="tagline">Track Smarter. Stress Less.</span></div><nav className="nf-auth-right"><a href="/login" className="nf-login">Login</a></nav></div></header>
      <main className="main main--register business-register-main">
        <section className="nf-hero business-register-hero">
          <div className="nf-hero-content business-register-content">
            <a href="/registerwho" className="registration-back">← Account type</a>
            <p className="registration-step">Business account</p>
            <h1 className="nf-title">Create your organization</h1>
            <p className="nf-subtitle">This setup creates two linked records: your organization profile and your personal administrator login.</p>
            <form className="auth-form business-register-form" onSubmit={submit}>
              <fieldset><legend>Business information</legend><div className="business-form-grid">
                <label>Business name<input className="nf-input" name="businessName" value={form.businessName} onChange={update} autoComplete="organization" required /></label>
                <label>Business type<input className="nf-input" name="businessType" value={form.businessType} onChange={update} placeholder="LLC, corporation, nonprofit..." /></label>
                <label>Industry<input className="nf-input" name="industry" value={form.industry} onChange={update} placeholder="Retail, consulting, healthcare..." /></label>
                <label>Business email<input className="nf-input" type="email" name="businessEmail" value={form.businessEmail} onChange={update} autoComplete="email" required /></label>
                <label>Business phone<input className="nf-input" type="tel" name="businessPhone" value={form.businessPhone} onChange={update} autoComplete="tel" /></label>
                <label>Website<input className="nf-input" type="url" name="website" value={form.website} onChange={update} placeholder="https://example.com" /></label>
                <label className="business-field-wide">Street address<input className="nf-input" name="address" value={form.address} onChange={update} autoComplete="street-address" /></label>
                <label>City<input className="nf-input" name="city" value={form.city} onChange={update} autoComplete="address-level2" /></label>
                <label>State / province<input className="nf-input" name="region" value={form.region} onChange={update} autoComplete="address-level1" /></label>
                <label>Postal code<input className="nf-input" name="postalCode" value={form.postalCode} onChange={update} autoComplete="postal-code" /></label>
                <label>Country<input className="nf-input" name="country" value={form.country} onChange={update} autoComplete="country-name" /></label>
              </div></fieldset>
              <fieldset><legend>Organization administrator</legend><p className="subtle business-legend-note">The person creating the business account automatically becomes its administrator. The administrator can be reassigned later in the app.</p><div className="business-form-grid">
                <label>Full name<input className="nf-input" name="adminFullName" value={form.adminFullName} onChange={update} autoComplete="name" required /></label>
                <label>Email address<input className="nf-input" type="email" name="adminEmail" value={form.adminEmail} onChange={update} autoComplete="email" required /></label>
                <label>Password<input className="nf-input" type="password" name="password" value={form.password} onChange={update} autoComplete="new-password" minLength="8" required /></label>
                <label>Confirm password<input className="nf-input" type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} autoComplete="new-password" minLength="8" required /></label>
              </div></fieldset>
              <label className="business-consent"><input type="checkbox" name="agree" checked={form.agree} onChange={(event) => event.target.checked ? startLegalFlow() : setForm((current) => ({ ...current, agree: false }))} required /><span>I agree to the <a href="/terms" onClick={(event) => openLegalDocument(event, "terms")}>Terms</a> and <a href="/privacy" onClick={(event) => openLegalDocument(event, "privacy")}>Privacy Policy</a>.</span></label>
              <button className="nf-btn" type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Business Account"}</button>
              {message && <p className={`form-message ${error ? "business-message-error" : "business-message-ok"}`} aria-live="polite">{message}</p>}
            </form>
          </div>
        </section>
      </main>
      {legalStep && (
        <div className="nf-modal" role="dialog" aria-modal="true" aria-labelledby="businessLegalModalTitle">
          <button type="button" className="nf-modal-backdrop business-legal-backdrop" aria-label="Close legal document" onClick={closeLegal}></button>
          <div className="nf-modal-content" role="document">
            <div className="nf-modal-header">
              <h2 id="businessLegalModalTitle">{legalStep === "terms" ? "Terms of Service" : "Privacy Policy"}</h2>
              <button type="button" className="nf-modal-close" onClick={closeLegal}>Close</button>
            </div>
            <div className="nf-modal-body business-legal-modal-body">
              <iframe title={legalStep === "terms" ? "Terms of Service" : "Privacy Policy"} src={`/${legalStep}?embedded=1`} />
            </div>
            {legalFlowActive && (
              <div className="nf-modal-footer">
                <button type="button" className="nf-modal-action-disagree" onClick={closeLegal}>Disagree</button>
                <button type="button" className="nf-modal-action-agree" onClick={acceptLegalStep}>{legalStep === "terms" ? "Agree & Continue" : "Agree"}</button>
              </div>
            )}
          </div>
        </div>
      )}
      <footer className="nf-footer"><div className="nf-footer-inner"><p>© {new Date().getFullYear()} &lt;AppName&gt;. All rights reserved.</p><nav className="nf-legal"><a href="/privacy">Privacy</a><span className="sep">•</span><a href="/terms">Terms</a></nav></div></footer>
    </>
  );
}
