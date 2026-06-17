import { useEffect, useMemo, useState } from "react";
import { api } from "../../scripts/api.js";
import { exportSheets, getPreferredExportFormat } from "../../scripts/export-utils.js";

const RECORD_PAGE_SIZE = 1000;
const CURRENCY = "USD";

const EXPENSE_CATEGORIES = [
  "Housing",
  "Utilities",
  "Groceries",
  "Transportation",
  "Dining",
  "Health",
  "Entertainment",
  "Shopping",
  "Membership",
  "Miscellaneous",
  "Education",
  "Giving",
  "Savings",
  "Other",
];

const INCOME_CATEGORIES = [
  "Salary / Wages",
  "Bonus / Commission",
  "Business Income",
  "Freelance / Contract",
  "Rental Income",
  "Interest / Dividends",
  "Capital Gains",
  "Refunds / Reimbursements",
  "Gifts Received",
  "Government Benefits",
  "Other",
];

function formatMoney(value, currency = CURRENCY) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function navigateTo(path) {
  if (window.__walletlensNavigate) window.__walletlensNavigate(path);
  else window.location.href = path;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isThisMonth(record) {
  if (!record?.date) return false;
  const date = new Date(record.date);
  if (Number.isNaN(date.getTime())) return false;
  return monthKey(date) === monthKey();
}

function normalizeRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function loadAllRecords() {
  const all = [];
  for (let offset = 0; ; offset += RECORD_PAGE_SIZE) {
    const payload = await api.records.getAll({ limit: RECORD_PAGE_SIZE, offset });
    const rows = normalizeRecords(payload);
    all.push(...rows);
    if (rows.length < RECORD_PAGE_SIZE) break;
  }
  return all;
}

function computeDashboard(records) {
  const current = records.filter(isThisMonth);
  const expenses = current.filter((record) => record.type === "expense");
  const income = current.filter((record) => record.type === "income");
  const totalIncome = income.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const totalSpending = expenses.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const categoryTotals = expenses.reduce((acc, record) => {
    const category = record.category || "Uncategorized";
    acc[category] = (acc[category] || 0) + Number(record.amount || 0);
    return acc;
  }, {});

  return {
    current,
    totalIncome,
    totalSpending,
    netBalance: totalIncome - totalSpending,
    topCategories: Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    recent: [...records]
      .sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0))
      .slice(0, 8),
  };
}

function buildFocusItems(summary) {
  const items = [];
  if (summary.totalSpending > summary.totalIncome && summary.totalIncome > 0) {
    items.push("Spending is currently above income for this month.");
  }
  if (summary.topCategories[0]) {
    items.push(`${summary.topCategories[0].category} is your largest spending category this month.`);
  }
  if (summary.netBalance > 0) {
    items.push(`You are ahead by ${formatMoney(summary.netBalance)} this month.`);
  }
  return items.length ? items.slice(0, 3) : ["No spending focus identified for this week."];
}

export default function HomePage() {
  const [records, setRecords] = useState([]);
  const [user, setUser] = useState(null);
  const [netWorth, setNetWorth] = useState(null);
  const [recurring, setRecurring] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [txnStatus, setTxnStatus] = useState("");
  const [form, setForm] = useState({
    type: "expense",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    category: "",
    note: "",
  });

  const customCategories = useMemo(
    () => ({
      expense: Array.isArray(user?.custom_expense_categories)
        ? user.custom_expense_categories
        : Array.isArray(user?.customExpenseCategories)
          ? user.customExpenseCategories
          : [],
      income: Array.isArray(user?.custom_income_categories)
        ? user.custom_income_categories
        : Array.isArray(user?.customIncomeCategories)
          ? user.customIncomeCategories
          : [],
    }),
    [user]
  );

  const categories = useMemo(() => {
    const base = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const custom = customCategories[form.type] || [];
    return [...new Set([...base, ...custom])];
  }, [customCategories, form.type]);

  const summary = useMemo(() => computeDashboard(records), [records]);
  const focusItems = useMemo(() => buildFocusItems(summary), [summary]);

  async function loadDashboard() {
    setStatus("loading");
    setError("");
    try {
      const [me, allRecords, netWorthOverview, upcoming] = await Promise.all([
        api.auth.me().catch(() => null),
        loadAllRecords(),
        api.netWorth.overview(365).catch(() => null),
        api.recurring.upcoming({ days: 30 }).catch(() => []),
      ]);
      setUser(me?.user || null);
      setRecords(allRecords);
      setNetWorth(netWorthOverview);
      setRecurring(normalizeRecords(upcoming?.items ? upcoming.items : upcoming).slice(0, 5));
      setStatus("ready");
    } catch (err) {
      setError(err?.message || "Could not load dashboard data.");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (form.category && !categories.includes(form.category)) {
      setForm((current) => ({ ...current, category: "" }));
    }
  }, [categories, form.category]);

  async function handleSubmit(event) {
    event.preventDefault();
    setTxnStatus("");
    const amount = Number(form.amount);
    if (!form.type || !form.date || !form.category || !Number.isFinite(amount) || amount <= 0) {
      setTxnStatus("Enter a date, category, and amount greater than 0.");
      return;
    }

    try {
      await api.records.create({
        type: form.type,
        date: form.date,
        category: form.category,
        amount,
        note: form.note,
        applyRules: true,
      });
      setModalOpen(false);
      setForm({
        type: "expense",
        date: new Date().toISOString().slice(0, 10),
        amount: "",
        category: "",
        note: "",
      });
      await loadDashboard();
    } catch (err) {
      setTxnStatus(err?.message || "Failed to save transaction.");
    }
  }

  async function exportRecords() {
    await exportSheets({
      format: getPreferredExportFormat(),
      filenameBase: `walletlens_records_${new Date().toISOString().slice(0, 10)}`,
      sheets: [
        {
          name: "All Records",
          rows: records.map((record) => ({
            Date: record.date ? new Date(record.date).toISOString().slice(0, 10) : "",
            Type: record.type || "",
            Category: record.category || "",
            Amount: Number(record.amount || 0),
            Notes: record.note || "",
          })),
        },
      ],
    });
  }

  const displayName = user?.fullName || user?.full_name || user?.username || "";
  const isLoading = status === "loading";

  return (
    <>
      <div id="header"></div>

      <main className="main main--home">
        <section className="hero">
          <div className="hero-primary card">
            <span className="hero-badge">Monthly outlook</span>
            <div className="hero-head">
              <h1>{displayName ? `Welcome back, ${displayName}` : "Welcome back"}</h1>
              <p className="subtle">
                {isLoading
                  ? "Loading dashboard..."
                  : error || `Updated ${new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
              </p>
            </div>

            <div className="hero-metrics" aria-label="Key insights">
              <div className="hero-metric">
                <span className="label">Projected savings</span>
                <span className="value">{formatMoney(summary.netBalance)}</span>
                <span className="delta subtle">This month so far</span>
              </div>
              <div className="hero-metric">
                <span className="label">Cashflow health</span>
                <span className="value">{summary.netBalance >= 0 ? "Positive" : "Needs attention"}</span>
                <span className="delta subtle">Income vs spending</span>
              </div>
            </div>

            <div className="quick-actions" role="group" aria-label="Quick actions">
              <button className="btn btn--primary" type="button" onClick={() => navigateTo("/upload")}>
                Upload Receipt
              </button>
              <button className="btn" type="button" onClick={() => setModalOpen(true)}>
                Add Transaction
              </button>
              <button className="btn" type="button" onClick={exportRecords} disabled={!records.length}>
                Export
              </button>
              <a className="btn btn--link" href="/reports">
                Go to Reports →
              </a>
            </div>
          </div>

          <aside className="hero-secondary card" aria-label="Focus summary">
            <h3>Focus this week</h3>
            <ul className="focus-list" aria-live="polite">
              {focusItems.map((item) => (
                <li key={item}>
                  <span className="focus-dot"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="focus-foot">
              <a className="btn btn--link" href="/budgeting">
                Plan your budget →
              </a>
            </div>
          </aside>
        </section>

        <section className="net-worth" aria-label="Net worth dashboard">
          <div className="net-worth-header">
            <div>
              <h2>Net Worth</h2>
              <p className="subtle">
                {netWorth?.asOf ? `Updated ${formatDate(netWorth.asOf)}` : "Add assets and liabilities to track net worth."}
              </p>
            </div>
            <a className="btn btn--link" href="/reports">
              View full reports →
            </a>
          </div>
          <div className="net-worth-grid">
            <article className="card net-worth-summary">
              <p className="label">Total Net Worth</p>
              <p className="value">{formatMoney(netWorth?.netWorth ?? netWorth?.baseBalance ?? 0)}</p>
              <p className="delta subtle">Based on saved net worth items</p>
            </article>
          </div>
        </section>

        <section className="kpis" aria-label="Summary metrics">
          <article className="kpi card kpi--income">
            <h2>Total Income</h2>
            <p className="kpi-value">{formatMoney(summary.totalIncome)}</p>
            <span className="kpi-sub">This month</span>
          </article>
          <article className="kpi card kpi--spending">
            <h2>Total Spending</h2>
            <p className="kpi-value negative">{formatMoney(summary.totalSpending)}</p>
            <span className="kpi-sub">This month</span>
          </article>
          <article className="kpi card kpi--balance">
            <h2>Net Balance</h2>
            <p className="kpi-value">{formatMoney(summary.netBalance)}</p>
            <span className="kpi-sub">Income − Spending</span>
          </article>
        </section>

        <section className="summary-section">
          <div className="summary-card card">
            <div className="summary-header">
              <h2>Spend Velocity</h2>
              <span className="subtle">This month</span>
            </div>
            <div className="velocity-grid">
              <div className="velocity-metrics">
                <div className="velocity-row">
                  <span className="label">Spent</span>
                  <strong>{formatMoney(summary.totalSpending)}</strong>
                </div>
                <div className="velocity-row">
                  <span className="label">Income</span>
                  <strong>{formatMoney(summary.totalIncome)}</strong>
                </div>
                <div className="velocity-row">
                  <span className="label">Pace</span>
                  <strong>{summary.netBalance >= 0 ? "On track" : "Over pace"}</strong>
                </div>
                <p className="chart-caption subtle">Budget pacing is calculated from current month income and spending.</p>
                <a className="btn btn--link" href="/budgeting">
                  Adjust budget →
                </a>
              </div>
            </div>
          </div>

          <aside className="breakdown card">
            <div className="summary-header">
              <h3>Top spending categories</h3>
              <a className="btn btn--link" href="/reports">
                View report →
              </a>
            </div>
            <ul className="cat-list">
              {summary.topCategories.length ? (
                summary.topCategories.map((item) => (
                  <li key={item.category}>
                    <span>{item.category}</span>
                    <strong>{formatMoney(item.amount)}</strong>
                  </li>
                ))
              ) : (
                <li className="subtle">No spending records this month.</li>
              )}
            </ul>
          </aside>
        </section>

        <section className="upcoming-recurring" aria-label="Upcoming recurring transactions">
          <div className="upcoming-header">
            <h2>Upcoming Recurring</h2>
            <a className="btn btn--link" href="/recurring">
              Manage recurring →
            </a>
          </div>
          <div className="card upcoming-card">
            <div className="upcoming-list">
              {recurring.length ? (
                recurring.map((item) => (
                  <div className="upcoming-item" key={item.id || `${item.name}-${item.date || item.nextRun}`}>
                    <div>
                      <div className="label">{item.name || "Recurring item"}</div>
                      <div className="meta">
                        {formatDate(item.date || item.nextRun)} · {item.category || "Uncategorized"}
                      </div>
                    </div>
                    <div>{formatMoney(item.amount || 0, item.currency || CURRENCY)}</div>
                  </div>
                ))
              ) : (
                <p className="subtle">No upcoming recurring items.</p>
              )}
            </div>
          </div>
        </section>

        <section className="recent" aria-label="Recent transactions">
          <div className="recent-header">
            <h2>Recent Transactions</h2>
            <a className="btn btn--link" href="/records">
              View all
            </a>
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
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="subtle">
                      Loading...
                    </td>
                  </tr>
                ) : summary.recent.length ? (
                  summary.recent.map((record) => (
                    <tr key={record.id || `${record.date}-${record.category}-${record.amount}`}>
                      <td>{formatDate(record.date)}</td>
                      <td>{record.category || "Uncategorized"}</td>
                      <td className="num">{formatMoney(record.amount || 0, record.currency || CURRENCY)}</td>
                      <td>{record.note || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="subtle">
                      No records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <div id="footer"></div>

      {modalOpen && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div className="modal-content card">
            <h2 id="modalTitle">Add New Transaction</h2>
            <form className="txn-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <label>
                  <span>Type</span>
                  <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value, category: "" })} required>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                <label>
                  <span>Date</span>
                  <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
                </label>
              </div>
              <div className="form-row form-row--with-list">
                <label>
                  <span>Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>Category</span>
                  <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required>
                    <option value="" disabled>
                      Select a category
                    </option>
                    {categories.map((category) => (
                      <option value={category} key={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label style={{ width: "100%" }}>
                  <span>Notes</span>
                  <input type="text" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
                </label>
              </div>
              {txnStatus && <p className="status-banner subtle is-error">{txnStatus}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary">
                  Save
                </button>
                <button type="button" className="btn" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

