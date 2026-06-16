export default function ReportsPage() {
  return (
    <>
      <div id="header"></div>
      
      
        <main className="main main--reports">
      
          {/* ========== SUMMARY ========== */}
          <section className="summary report-hero">
            <div className="hero-head">
              <div>
                <p className="hero-kicker">Reports</p>
                <h1>Command Center</h1>
                <p className="hero-sub">Fast clarity on where money moves, what wins, and what needs a reset.</p>
              </div>
      
              <div className="reports-controls">
                <label className="control">
                  <span className="label">Date Range</span>
                  <select id="reportsRange" name="reportsRange">
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last 12 months</option>
                    <option value="all" selected>All time</option>
                  </select>
                </label>
      
                <button className="btn btn--primary" id="btnRefreshReports" type="button">Refresh</button>
      
                <p id="reportsStatus" className="status-banner subtle is-hidden reports-status" aria-live="polite"></p>
              </div>
            </div>
      
            <div className="cards cards--kpis">
              <div className="card">
                <h3>Total Expenses</h3>
                <p id="total-expenses" aria-live="polite">Loading...</p>
              </div>
      
              <div className="card">
                <h3>Total Income</h3>
                <p id="total-income" aria-live="polite">Loading...</p>
              </div>
      
              <div className="card">
                <h3>Net Cashflow</h3>
                <p id="net-cashflow" aria-live="polite">Loading...</p>
              </div>
      
              <div className="card">
                <h3>Monthly Average</h3>
                <p id="monthly-average" aria-live="polite">Loading...</p>
              </div>
      
              <div className="card">
                <h3>Top Category</h3>
                <p id="top-category" aria-live="polite">Loading...</p>
              </div>
      
              <div className="card">
                <h3>Savings Rate</h3>
                <p id="savings-rate" aria-live="polite">Loading...</p>
              </div>
            </div>
      
            <div className="insight-band" aria-live="polite">
              <div className="insight" id="insight-primary">Loading insights...</div>
              <div className="insight" id="insight-secondary">Loading insights...</div>
              <div className="insight" id="insight-tertiary">Loading insights...</div>
            </div>
          </section>
      
          {/* ========== CATEGORY BARS ========== */}
          <section className="chart-section chart-section--split">
            <div className="section-head">
              <div>
                <h2>Category Pulse</h2>
                <p className="section-sub">Bar charts beat pies for quick comparison.</p>
              </div>
            </div>
      
            <div className="chart-row chart-row--tall">
              <div className="chart-box">
                <h3>Expenses by Category</h3>
                <canvas id="barChartExpenses"></canvas>
              </div>
      
              <div className="chart-box">
                <h3>Income Sources</h3>
                <canvas id="barChartIncome"></canvas>
              </div>
            </div>
          </section>
      
          {/* ========== MONTHLY TREND ========== */}
          <section className="chart-section chart-section--timeline">
            <div className="section-head">
              <div>
                <h2>Cashflow Timeline</h2>
                <p className="section-sub">See momentum, not just totals.</p>
              </div>
      
              <div className="toggles">
                <label className="toggle"><input type="checkbox" id="toggle-expenses" defaultChecked /> <span>Expenses</span></label>
                <label className="toggle"><input type="checkbox" id="toggle-income" defaultChecked /> <span>Income</span></label>
              </div>
            </div>
      
            <canvas id="monthlyChart"></canvas>
          </section>
      
        </main>
      
        <div id="footer"></div>
    </>
  );
}
