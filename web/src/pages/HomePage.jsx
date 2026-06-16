export default function HomePage() {
  return (
    <>
      {/* Header injected by default.js */}
        <div id="header"></div>
      
      
        {/* ==================== MAIN ==================== */}
        <main className="main main--home">
          
          {/* Hero */}
          <section className="hero">
            <div className="hero-primary card">
              <span className="hero-badge">Monthly outlook</span>
              <div className="hero-head">
                <h1 id="welcomeTitle">Welcome back</h1>
                <p className="subtle" id="lastUpdated">Loading summary…</p>
              </div>
      
              <div className="hero-metrics" aria-label="Key insights">
                <div className="hero-metric">
                  <span className="label">
                    Projected savings
                    <span className="info-popover">
                      <button type="button" className="info-popover__trigger" aria-label="Projected savings guidance">
                        i
                      </button>
                      <span className="info-popover__panel" role="tooltip">
                        Projected savings are estimated future amounts of money accumulated through regular deposits, interest, or cost-cutting measures, calculated based on current financial data and assumptions. In this app, projected savings = current month income minus spending, plus the expected savings for the remaining days of the month at your current daily pace. Example: if you have earned $3,600 and spent $2,400 over 12 days, you have saved $1,200 so far. If that $100 daily savings pace continues for 19 more days, your projected savings becomes $3,100.
                        <strong>Arvest Bank</strong>
                      </span>
                    </span>
                  </span>
                  <span className="value" id="heroProjectedSavings">—</span>
                  <span className="delta subtle" id="heroProjectedDelta">Based on last 30 days</span>
                </div>
                <div className="hero-metric">
                  <span className="label">
                    Cashflow health
                    <span className="info-popover">
                      <button type="button" className="info-popover__trigger" aria-label="Cashflow health guidance">
                        i
                      </button>
                      <span className="info-popover__panel" role="tooltip">
                        A healthy net cash flow for individuals is consistently positive, with most financial experts recommending a surplus of at least 10% to 20% of gross income remaining after all expenses. This positive balance allows for essential savings, investments, and debt reduction, ensuring financial resilience against unexpected expenses.
                        <strong>Bogart Wealth</strong>
                      </span>
                    </span>
                  </span>
                  <span className="value" id="heroCashflowHealth">—</span>
                  <span className="delta subtle" id="heroCashflowDelta">Income vs spending</span>
                </div>
              </div>
      
              <div className="quick-actions" role="group" aria-label="Quick actions">
                <button className="btn btn--primary" id="btnUpload">Upload Receipt</button>
                <button className="btn" id="btnAddTxn">Add Transaction</button>
                <button className="btn" id="btnExport">Export</button>
                <a className="btn btn--link" href="reports.html" id="btnReports">Go to Reports →</a>
              </div>
            </div>
      
            <aside className="hero-secondary card" aria-label="Focus summary">
              <h3>Focus this week</h3>
              <ul className="focus-list" id="focusList" aria-live="polite">
                <li><span className="focus-dot"></span><span>Loading weekly focus…</span></li>
              </ul>
              <div className="focus-foot">
                <a className="btn btn--link" href="budgeting.html">Plan your budget →</a>
              </div>
            </aside>
          </section>
      
          <section className="net-worth" id="netWorthSection" aria-label="Net worth dashboard">
            <div className="net-worth-header">
              <div>
                <h2>Net Worth</h2>
                <div className="net-worth-status">
                  <p className="subtle" id="netWorthUpdated">Loading net worth…</p>
                  <span className="subtle net-worth-empty-hint" id="netWorthEmptyHint">(Add a bank account to see net worth section)</span>
                </div>
              </div>
              <a className="btn btn--link" href="reports.html">View full reports →</a>
            </div>
      
            <div className="net-worth-grid" id="netWorthGrid">
              <article className="card net-worth-summary">
                <div className="net-worth-total">
                  <p className="label">Total Net Worth</p>
                  <p className="value" id="netWorthTotal">—</p>
                  <p className="delta subtle" id="netWorthDelta">—</p>
                </div>
                <div className="net-worth-chart">
                  <canvas id="netWorthChart" aria-label="Net worth trend" role="img"></canvas>
                  <p className="chart-caption subtle">Recent months</p>
                </div>
              </article>
      
              <article className="card net-worth-breakdown">
                <div className="breakdown-col">
                  <h3>Assets</h3>
                  <ul id="assetsList" className="networth-list"></ul>
                  <form className="networth-form" id="assetForm">
                    <input type="text" id="assetName" placeholder="Asset name (e.g., House)" required />
                    <input type="number" id="assetAmount" placeholder="Amount" min="0" step="0.01" required />
                    <button className="btn" type="submit">Add</button>
                  </form>
                  <div className="breakdown-total">
                    <span>Total Assets</span>
                    <strong id="assetsTotal">—</strong>
                  </div>
                </div>
                <div className="breakdown-col">
                  <h3>Liabilities</h3>
                  <ul id="liabilitiesList" className="networth-list"></ul>
                  <form className="networth-form" id="liabilityForm">
                    <input type="text" id="liabilityName" placeholder="Liability name (e.g., Credit Card)" required />
                    <input type="number" id="liabilityAmount" placeholder="Amount" min="0" step="0.01" required />
                    <button className="btn" type="submit">Add</button>
                  </form>
                  <div className="breakdown-total">
                    <span>Total Liabilities</span>
                    <strong id="liabilitiesTotal">—</strong>
                  </div>
                </div>
              </article>
            </div>
          </section>
      
          <div className="kpi-toolbar" id="kpiBankWrap" aria-label="Account filter">
            <label className="subtle" htmlFor="kpiBankSelect">Account</label>
            <select id="kpiBankSelect" aria-label="Select account"></select>
          </div>
      
          {/* KPI cards */}
          <section className="kpis" aria-label="Summary metrics">
            <article className="kpi card kpi--income">
              <h2>Total Income</h2>
              <p className="kpi-value" id="kpiIncome">—</p>
              <span className="kpi-sub" id="kpiPeriodIncome">This month</span>
            </article>
      
            <article className="kpi card kpi--spending">
              <h2>Total Spending</h2>
              <p className="kpi-value negative" id="kpiSpending">—</p>
              <span className="kpi-sub" id="kpiPeriodSpending">This month</span>
            </article>
      
            <article className="kpi card kpi--balance">
              <h2>Net Balance</h2>
              <p className="kpi-value" id="kpiBalance">—</p>
              <span className="kpi-sub" id="kpiPeriodBalance">Income − Spending</span>
            </article>
          </section>
      
          {/* Summary + breakdown */}
          <section className="summary-section">
            <div className="summary-card card">
              <div className="summary-header">
                <h2>Spend Velocity</h2>
                <span className="subtle" id="velocityPeriodLabel">This month</span>
              </div>
              <div className="velocity-grid">
                <div className="velocity-gauge">
                  <svg id="spendVelocityGauge" viewBox="0 0 200 120" role="img" aria-label="Budget usage gauge">
                    <path className="gauge-track" d="M 20 100 A 80 80 0 0 1 180 100"></path>
                    <path className="gauge-progress" id="spendVelocityProgress" d="M 20 100 A 80 80 0 0 1 180 100"></path>
                    <circle className="gauge-marker" id="spendVelocityMarker" cx="20" cy="100" r="4"></circle>
                  </svg>
                  <div className="velocity-center">
                    <strong id="velocityPercent">—</strong>
                    <span className="subtle">of budget used</span>
                  </div>
                </div>
                <div className="velocity-metrics">
                  <div className="velocity-row">
                    <span className="label">Budget</span>
                    <strong id="velocityBudget">—</strong>
                  </div>
                  <div className="velocity-row">
                    <span className="label">Spent</span>
                    <strong id="velocitySpent">—</strong>
                  </div>
                  <div className="velocity-row">
                    <span className="label">Pace</span>
                    <strong id="velocityPace">—</strong>
                  </div>
                  <p className="chart-caption subtle" id="velocityCaption">Set a monthly budget to track spend velocity.</p>
                  <a className="btn btn--link" href="budgeting.html">Adjust budget →</a>
                </div>
              </div>
            </div>
      
            <aside className="breakdown card">
              <div className="summary-header">
                <h3>Top spending categories</h3>
                <a className="btn btn--link" href="reports.html">View report →</a>
              </div>
              <ul id="topCategoriesList" className="cat-list"></ul>
            </aside>
          </section>
      
          {/* Upcoming recurring */}
          <section className="upcoming-recurring" aria-label="Upcoming recurring transactions">
            <div className="upcoming-header">
              <h2>Upcoming Recurring</h2>
              <a className="btn btn--link" href="recurring.html">Manage recurring →</a>
            </div>
            <div className="card upcoming-card">
              <div id="recurringUpcomingHome" className="upcoming-list">
                <p className="subtle">Loading upcoming occurrences…</p>
              </div>
            </div>
          </section>
      
          {/* Recent transactions */}
          <section className="recent" aria-label="Recent transactions">
            <div className="recent-header">
              <h2>Recent Transactions</h2>
              <a className="btn btn--link" href="records.html">View all</a>
            </div>
      
            <div className="table-wrap card" role="region" aria-label="Recent transactions table" tabIndex="0">
              <table className="txn-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th className="num">Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody id="txnTbody">
                  <tr><td colSpan="4" className="subtle">Loading…</td></tr>
                </tbody>
              </table>
            </div>
          </section>
      
        </main>
      
        {/* Footer injected by default.js */}
        <div id="footer"></div>
        
      
      
        {/* ========== ADD TRANSACTION MODAL ========== */}
        <div id="addTxnModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div className="modal-content card">
            <h2 id="modalTitle">Add New Transaction</h2>
      
            <form id="txnForm" className="txn-form">
              
              <div className="form-row">
                <label>
                  <span>Type</span>
                  <select id="txnType" required>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
      
                <label>
                  <span>Date</span>
                  <input type="date" id="txnDate" required />
                </label>
              </div>
      
              <div className="form-row form-row--with-list">
                <label>
                  <span>Amount</span>
                  <input type="number" id="txnAmount" step="0.01" required />
                </label>
      
                <label>
                  <span>Category</span>
                  <select id="txnCategory" required>
                    <option value="" disabled selected>Select a category</option>
                  </select>
                </label>
                <div className="custom-category-list" id="txnCustomCategories" aria-live="polite"></div>
              </div>
      
              <div className="form-row">
                <label style={{ "width": "100%" }}>
                  <span>Notes</span>
                  <input type="text" id="txnNotes" />
                </label>
              </div>
      
              <p id="txnStatus" className="status-banner subtle is-hidden" aria-live="polite"></p>
      
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary">Save</button>
                <button type="button" className="btn" id="btnCancelModal">Cancel</button>
              </div>
      
            </form>
          </div>
        </div>
      
        {/* ========== CUSTOM CATEGORY MODAL ========== */}
        <div id="customCategoryModal" className="modal hidden" role="dialog" aria-modal="true" aria-labelledby="customCategoryTitle">
          <div className="modal-content card">
            <h2 id="customCategoryTitle">Add Custom Category</h2>
            <p className="subtle">Enter a name to add a custom category.</p>
      
            <form id="customCategoryForm" className="txn-form">
              <div className="form-row">
                <label><span>Category Name</span><input type="text" id="customCategoryInput" autoComplete="off" required /></label>
              </div>
      
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary">Save Category</button>
                <button type="button" className="btn" id="cancelCustomCategoryBtn">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      
        {/* Scripts */}
    </>
  );
}
