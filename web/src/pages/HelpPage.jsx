import { useEffect, useState } from "react";
import { api } from "../../scripts/api.js";

const faqs = [
  ["How do I change my password?", "Go to Settings and select Change Password in the Security section."],
  ["Where do I see my transactions?", "Open the Records page to view all expenses and income entries."],
  ["How do I upload receipts?", "Use the Upload Receipts page to drag and drop or browse for files."],
  ["What file types can I upload?", "JPG, PNG, and PDF receipts are supported."],
  ["How do I edit or delete a transaction?", "On the Records page, use the actions menu next to a transaction to edit or delete it."],
  ["How do I add income records?", "In Records, switch to the Income section and use the Add Income button."],
  ["How do categories work?", "Categories help organize spending and are used in reports and budgets."],
  ["Can I create a custom category?", "Yes. Use Add Category when creating or editing a record."],
  ["Why don't my charts match my records?", "Charts reflect the selected date range and filters. Update the range to match what you're viewing."],
  ["How do I export my data?", "Use Export on each page to download that page's data, or go to Settings to choose CSV, Excel, Google Sheets, or PDF and export your full account."],
  ["How do budgets work?", "Set a budget per category on the Budgeting page and track remaining amounts."],
  ["What does Budget frequency mean?", "Frequency controls the time span for budgets, such as monthly or quarterly."],
  ["How do I change my dashboard view?", "Update the Default Dashboard View in Settings to Weekly, Monthly, Yearly, or All Time."],
  ["How do I change my time zone?", "Open Settings and choose your Time Zone under Formatting."],
  ["How do I update my currency format?", "Go to Settings and choose your preferred currency and number format."],
  ["Are linked accounts supported?", "Linked accounts are coming soon. For now, you can manage records manually."],
  ["How do notifications work?", "Enable or disable email and SMS notifications in Settings."],
  ["How do I delete my account?", "Open Settings and use Delete Account. This action is permanent."],
];

export default function HelpPage() {
  const isAuthenticated = Boolean(sessionStorage.getItem("auth_token"));
  const backOnly = !isAuthenticated;
  const [form, setForm] = useState({ subject: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!backOnly) return undefined;
    document.body.classList.add("legal-page");
    return () => document.body.classList.remove("legal-page");
  }, [backOnly]);

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/");
  };

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.message.trim() || (backOnly && !form.email.trim())) {
      setStatus(backOnly ? "Please add subject, email, and message." : "Please add subject and message.");
      return;
    }

    setSending(true);
    setStatus("Sending your message...");
    try {
      if (backOnly) {
        await api.support.contactPublic({ ...form, name: "Guest User" });
      } else {
        await api.support.contact({ subject: form.subject, message: form.message });
      }
      setStatus("Thanks. Your message has been sent to support.");
      setForm({ subject: "", email: "", message: "" });
    } catch (err) {
      setStatus(err?.message || "Unable to send message right now.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {!backOnly && <div id="header"></div>}

      <main className="main main--profile">
        <section className="profile-hero">
          <div className="title-wrap">
            {backOnly && <button type="button" className="legal-back-btn" onClick={goBack}>Go Back</button>}
            <h1>Help & Support</h1>
            <p className="subtle">Find answers and troubleshoot issues</p>
          </div>
        </section>

        <div className="profile-grid">
          <section className="card">
            <h2>Frequently Asked Questions</h2>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
            <details>
              <summary>How do I contact support?</summary>
              <p>Email us at <a href="mailto:support.wisewallet@manuswebworks.org">support.wisewallet@manuswebworks.org</a></p>
            </details>
          </section>

          <section className="card">
            <h2>Contact Support</h2>
            <form id="supportForm" onSubmit={submit} noValidate>
              <label htmlFor="supportSubject">
                <span className="label">Subject</span>
                <input id="supportSubject" name="subject" type="text" autoComplete="off" placeholder="What can we help with?" value={form.subject} onChange={update} required />
              </label>

              {backOnly && (
                <label htmlFor="supportEmail">
                  <span className="label">Email</span>
                  <input id="supportEmail" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update} required />
                </label>
              )}

              <label htmlFor="supportMessage">
                <span className="label">Message</span>
                <textarea id="supportMessage" name="message" rows="5" placeholder="Tell us what happened." value={form.message} onChange={update} required></textarea>
              </label>

              {status ? <p id="supportStatus" className="subtle" aria-live="polite">{status}</p> : null}
              <button type="submit" className="btn btn--primary" disabled={sending}>{sending ? "Sending..." : "Send Message"}</button>
            </form>
          </section>
        </div>
      </main>

      {!backOnly && <div id="footer"></div>}
    </>
  );
}
