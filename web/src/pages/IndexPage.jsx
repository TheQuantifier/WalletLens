export default function IndexPage() {
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
      
            <nav className="index-auth-actions" aria-label="Authentication">
              <a href="/login" className="btn">Login</a>
              <a href="/registerwho" className="btn btn--primary">Register</a>
            </nav>
          </div>
        </header>
      
        <main className="main main--index">
          <section className="nf-hero index-hero">
            <div className="index-hero-copy">
              <p className="index-kicker">Receipts and expenses, finally organized</p>
              <h1 className="nf-title">Turn receipts and manual records into clean, export-ready books.</h1>
              <p className="nf-subtitle">
                &lt;AppName&gt; helps individuals and small teams capture expenses fast, standardize categories with rules,
                and generate reports you can actually use. Upload receipts, add records manually, and stay ready
                for taxes, reimbursements, or review.
              </p>
              <div className="index-hero-meta">
                <span>Free to start</span>
                <span className="index-hero-dot">•</span>
                <span>Export anytime</span>
                <span className="index-hero-dot">•</span>
                <span>Built for personal use, freelancers, and small teams</span>
              </div>
      
              <div className="index-cta-row">
                <a href="/registerwho" className="btn btn--primary index-primary-cta">Create Free Account</a>
                <a href="/login" className="btn index-secondary-cta">Log In</a>
              </div>
      
              <div className="index-proof-grid" aria-label="Highlights">
                <article className="index-proof-card">
                  <strong>Receipt OCR</strong>
                  <span>Extract amounts, dates, and merchants from uploads.</span>
                </article>
                <article className="index-proof-card">
                  <strong>Rules + AI</strong>
                  <span>Auto-categorize with smart suggestions and custom rules.</span>
                </article>
                <article className="index-proof-card">
                  <strong>Export Ready</strong>
                  <span>Generate clean data for taxes, reimbursement, or accounting.</span>
                </article>
              </div>
            </div>
      
            <aside className="index-hero-panel card" aria-label="Live snapshot">
              <p className="index-panel-kicker">Recent records</p>
              <div className="index-hero-mock">
                <div className="index-mock-header">
                  <span>Recent activity</span>
                  <span className="index-mock-total">All synced</span>
                </div>
                <div className="index-mock-row">
                  <div>
                    <strong>Office supplies</strong>
                    <span>Expense • Tagged</span>
                  </div>
                  <span className="index-mock-amount">-$48.20</span>
                </div>
                <div className="index-mock-row">
                  <div>
                    <strong>Client reimbursement</strong>
                    <span>Income • Received</span>
                  </div>
                  <span className="index-mock-amount index-mock-amount--positive">+$640.00</span>
                </div>
                <div className="index-mock-row">
                  <div>
                    <strong>Cloud tools</strong>
                    <span>Expense • Auto-categorized</span>
                  </div>
                  <span className="index-mock-amount">-$29.99</span>
                </div>
              </div>
            </aside>
          </section>
      
          <section className="index-section index-section--trust">
            <div className="index-trust">
              <p className="index-trust-label">Trusted by people who cannot afford messy books</p>
              <div className="index-trust-logos">
                <span>Everyday users</span>
                <span>Freelancers</span>
                <span>Studios</span>
                <span>Consultants</span>
                <span>Side hustles</span>
                <span>Small teams</span>
              </div>
            </div>
          </section>
      
          <section className="index-section index-section--how">
            <div className="index-section-heading">
              <p className="index-kicker">How it works</p>
              <h2>Three steps to clean, reliable expense data.</h2>
              <p className="subtle">
                Everything stays connected: receipts, categories, vendors, and reports.
              </p>
            </div>
      
            <div className="index-how-grid">
              <article className="card index-how-card">
                <span className="index-how-step">01</span>
                <h3>Capture every receipt</h3>
                <p>Snap a photo, upload a PDF, or add a manual record in seconds.</p>
              </article>
              <article className="card index-how-card">
                <span className="index-how-step">02</span>
                <h3>Let rules do the sorting</h3>
                <p>Auto-categorize with AI and keep edge cases handled by your rules.</p>
              </article>
              <article className="card index-how-card">
                <span className="index-how-step">03</span>
                <h3>Export when you need it</h3>
                <p>Generate clean exports for taxes, reimbursement, or a quick review.</p>
              </article>
            </div>
          </section>
      
          <section className="index-section index-section--walterlens">
            <div className="index-section-heading">
              <p className="index-kicker">Meet WalterLens</p>
              <h2>Your finance co-pilot for quick answers and clean actions.</h2>
              <p className="subtle">
                Ask questions like “What did I spend on software last month?” or “Show reimbursements I still owe.”
                WalterLens pulls answers from your data, so you can move faster with confidence.
              </p>
            </div>
      
            <div className="index-walterlens-panel card">
              <div className="index-wl-line index-wl-line--user">
                <span>Show my top 3 categories this month.</span>
              </div>
              <div className="index-wl-line index-wl-line--assistant">
                <span>Top categories: Software, Travel, Meals. Want a CSV export?</span>
              </div>
              <div className="index-wl-line index-wl-line--user">
                <span>Yes, and tag them for reimbursement.</span>
              </div>
              <div className="index-wl-line index-wl-line--assistant">
                <span>Done. I tagged 6 records and prepared the export.</span>
              </div>
            </div>
          </section>
      
          <section className="index-section index-section--compare">
            <div className="index-section-heading">
              <p className="index-kicker">Before vs After</p>
              <h2>Stop cleaning up your finances. Let the system do it.</h2>
            </div>
      
            <div className="index-compare-grid">
              <article className="card index-compare-card index-compare-card--before">
                <h3>Before &lt;AppName&gt;</h3>
                <div className="index-compare-list">
                  <p>Receipts scattered across inboxes, folders, and photos.</p>
                  <p>Manual category edits every single month.</p>
                  <p>Exports that never line up with what you need.</p>
                </div>
              </article>
              <article className="card index-compare-card index-compare-card--after">
                <h3>After &lt;AppName&gt;</h3>
                <div className="index-compare-list">
                  <p>Receipts linked to every transaction automatically.</p>
                  <p>Rules and AI keep categories consistent.</p>
                  <p>Reports and exports ready the moment you are.</p>
                </div>
              </article>
            </div>
          </section>
      
          <section className="index-section index-section--testimonials">
            <div className="index-section-heading">
              <p className="index-kicker">What users say</p>
              <h2>“I stopped dreading month-end.”</h2>
            </div>
      
            <div className="index-testimonial-grid">
              <article className="card index-testimonial">
                <p>
                  “We moved from spreadsheets to &lt;AppName&gt; and instantly saw where every receipt lived.
                  Reimbursements are no longer a scramble.”
                </p>
                <span className="index-testimonial-meta">Operations lead • Boutique agency</span>
              </article>
              <article className="card index-testimonial">
                <p>
                  “The rules engine saves me hours. I upload, the categories stick, and exports are done.”
                </p>
                <span className="index-testimonial-meta">Freelance designer</span>
              </article>
              <article className="card index-testimonial">
                <p>
                  “It feels like a finance co-pilot. I finally trust the numbers I hand to my accountant.”
                </p>
                <span className="index-testimonial-meta">Small business owner</span>
              </article>
            </div>
          </section>
      
          <section className="index-section index-section--what">
            <div className="index-section-heading">
              <p className="index-kicker">What &lt;AppName&gt; actually does</p>
              <h2>One workflow from receipt to reliable expense data.</h2>
              <p className="subtle">
                Built for people who want less manual cleanup and more confidence in their numbers.
              </p>
            </div>
      
            <div className="index-feature-grid">
              <article className="card index-feature-card">
                <h3>Smart receipt intake</h3>
                <p>Upload images or PDFs and extract structured transaction data with OCR-backed processing.</p>
              </article>
              <article className="card index-feature-card">
                <h3>Manual record support</h3>
                <p>Add income and expenses directly while still benefiting from categories, rules, and reporting.</p>
              </article>
              <article className="card index-feature-card">
                <h3>Rules engine</h3>
                <p>Create repeatable logic like “if note contains payroll, categorize as Salary / Wages.”</p>
              </article>
              <article className="card index-feature-card">
                <h3>Budgeting and reports</h3>
                <p>Track where money goes, compare against plan, and export organized data when needed.</p>
              </article>
            </div>
          </section>
      
          <section className="index-section index-section--story">
            <div className="index-story card">
              <div>
                <p className="index-kicker">Why this matters</p>
                <h2>Most people do not need more finance software. They need less cleanup.</h2>
              </div>
              <p>
                &lt;AppName&gt; is designed to remove repeated administrative work from personal and small-business finance.
                Instead of manually retyping receipts, fixing categories every week, and hunting for old records later,
                you get one place to collect information, automate decisions, and keep your books readable.
              </p>
            </div>
          </section>
      
          <section className="nf-about index-about">
            <div className="nf-about-inner">
              <h2>Built for real-world finance workflows</h2>
              <p>
                Whether you are tracking personal spending, side-income, freelance expenses, or a small operation,
                &lt;AppName&gt; gives you a system that stays usable as your data grows.
              </p>
      
              <div className="nf-about-grid">
                <div className="nf-about-card">
                  <h3>Fewer repeated edits</h3>
                  <p>Use rules and structured categories so recurring transactions stop requiring manual correction.</p>
                </div>
                <div className="nf-about-card">
                  <h3>Faster month-end review</h3>
                  <p>Look back through organized records and receipts without reconstructing context from scratch.</p>
                </div>
                <div className="nf-about-card">
                  <h3>Cleaner handoff</h3>
                  <p>Exports and reporting stay useful because the data behind them is more consistent from day one.</p>
                </div>
              </div>
            </div>
          </section>
      
          <section className="index-section index-section--cta">
            <div className="index-cta-panel card">
              <div>
                <p className="index-kicker">Ready to start</p>
                <h2>See what your finances look like when the system does the boring part.</h2>
              </div>
              <div className="index-cta-actions">
                <a href="/registerwho" className="btn btn--primary">Create Your Account</a>
              </div>
            </div>
          </section>
        </main>
      
        <footer className="nf-footer index-footer" role="contentinfo">
          <div className="nf-footer-inner">
            <p>&copy; <span id="year"></span> &lt;AppName&gt;. All rights reserved.</p>
            <nav className="nf-legal" aria-label="Footer">
              <a href="/about" className="nf-legal-link" data-public-modal="about">About</a><span className="sep">&bull;</span>
              <a href="/privacy" className="nf-legal-link" data-public-modal="privacy">Privacy</a><span className="sep">&bull;</span>
              <button type="button" className="nf-legal-link" data-public-modal="contact">Contact</button>
            </nav>
          </div>
        </footer>
    </>
  );
}

