import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../scripts/api.js";

const PAGE_SIZE = 1000;

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function loadAllRecords() {
  const all = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const payload = await api.records.getAll({ limit: PAGE_SIZE, offset });
    const rows = rowsFromPayload(payload);
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function rangeWindow(records, range) {
  const validDates = records.map((record) => parseDate(record.date)).filter(Boolean);
  if (range === "all") {
    if (!validDates.length) {
      const now = new Date();
      return { start: startOfDay(now), end: endOfDay(now) };
    }
    return {
      start: startOfDay(new Date(Math.min(...validDates.map((date) => date.getTime())))),
      end: endOfDay(new Date(Math.max(...validDates.map((date) => date.getTime())))),
    };
  }

  const days = Number(range);
  const end = endOfDay(new Date());
  const start = startOfDay(new Date(end));
  start.setDate(start.getDate() - Math.max(1, days || 1) + 1);
  return { start, end };
}

function inWindow(record, windowRange) {
  const date = parseDate(record.date);
  return !!date && date >= windowRange.start && date <= windowRange.end;
}

function displayCurrency() {
  return localStorage.getItem("settings_currency") || localStorage.getItem("auto_currency") || "USD";
}

function fmtMoney(value, currency = displayCurrency()) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value) || 0);
  } catch {
    return `$${(Number(value) || 0).toFixed(2)}`;
  }
}

function fmtPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function groupByCategory(records) {
  const groups = new Map();
  records.forEach((record) => {
    const key = record.category || "Uncategorized";
    groups.set(key, (groups.get(key) || 0) + (Number(record.amount) || 0));
  });
  return [...groups.entries()].sort((a, b) => b[1] - a[1]);
}

function countMonths(records) {
  const months = new Set();
  records.forEach((record) => {
    const date = parseDate(record.date);
    if (date) months.add(monthKey(date));
  });
  return months.size || 1;
}

function buildSeries(records, windowRange) {
  const spanDays = Math.max(1, Math.round((windowRange.end - windowRange.start) / 86400000));
  const granularity = spanDays <= 120 ? "day" : "month";
  const points = new Map();

  if (granularity === "day") {
    const cursor = new Date(windowRange.start);
    while (cursor <= windowRange.end) {
      points.set(dayKey(cursor), { date: new Date(cursor), income: 0, expense: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const cursor = new Date(windowRange.start.getFullYear(), windowRange.start.getMonth(), 1);
    const end = new Date(windowRange.end.getFullYear(), windowRange.end.getMonth(), 1);
    while (cursor <= end) {
      points.set(monthKey(cursor), { date: new Date(cursor), income: 0, expense: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  records.forEach((record) => {
    const date = parseDate(record.date);
    if (!date) return;
    const key = granularity === "day" ? dayKey(date) : monthKey(date);
    const point = points.get(key) || { date, income: 0, expense: 0 };
    point[record.type] += Number(record.amount) || 0;
    points.set(key, point);
  });

  return [...points.values()].sort((a, b) => a.date - b.date);
}

function computeReports(records, range) {
  const normalized = records
    .filter((record) => record && (record.type === "expense" || record.type === "income"))
    .map((record) => ({
      ...record,
      amount: Number(record.amount) || 0,
      category: record.category || "Uncategorized",
    }));
  const windowRange = rangeWindow(normalized, range);
  const scoped = normalized.filter((record) => inWindow(record, windowRange));
  const expenses = scoped.filter((record) => record.type === "expense");
  const income = scoped.filter((record) => record.type === "income");
  const totalExpenses = expenses.reduce((sum, record) => sum + record.amount, 0);
  const totalIncome = income.reduce((sum, record) => sum + record.amount, 0);
  const net = totalIncome - totalExpenses;
  const expenseGroups = groupByCategory(expenses);
  const incomeGroups = groupByCategory(income);
  const topCategory = expenseGroups[0] || ["-", 0];
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : NaN;
  const monthCount = countMonths(scoped);
  const topShare = totalExpenses > 0 ? (topCategory[1] / totalExpenses) * 100 : NaN;

  return {
    totalExpenses,
    totalIncome,
    net,
    monthlyAverage: totalExpenses / monthCount,
    topCategory: topCategory[0],
    savingsRate,
    expenseGroups,
    incomeGroups,
    series: buildSeries(scoped, windowRange),
    insights: [
      topCategory[0] !== "-" ? `Top spend: ${topCategory[0]} at ${fmtPercent(topShare)} of expenses.` : "Add records to unlock spending insights.",
      `Net cashflow: ${fmtMoney(net)} for this range.`,
      `Active months: ${monthCount} with records in range.`,
    ],
  };
}

function KpiCard({ label, value }) {
  return (
    <div className="card">
      <h3>{label}</h3>
      <p aria-live="polite">{value}</p>
    </div>
  );
}

function CategoryBars({ groups, emptyLabel }) {
  const top = groups.slice(0, 8);
  const max = Math.max(1, ...top.map(([, amount]) => amount));

  if (!top.length) {
    return <p className="subtle report-empty">{emptyLabel}</p>;
  }

  return (
    <div className="report-bars" role="list">
      {top.map(([category, amount]) => (
        <div className="report-bar-row" role="listitem" key={category}>
          <div className="report-bar-label">
            <span>{category}</span>
            <strong>{fmtMoney(amount)}</strong>
          </div>
          <div className="report-bar-track" aria-hidden="true">
            <span style={{ width: `${Math.max(4, (amount / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline({ series, showExpenses, showIncome }) {
  const width = 720;
  const height = 260;
  const pad = 28;
  const values = series.flatMap((point) => [
    showIncome ? point.income : 0,
    showExpenses ? point.expense : 0,
  ]);
  const max = Math.max(1, ...values);

  const linePoints = (field) =>
    series
      .map((point, index) => {
        const x = pad + (series.length <= 1 ? 0 : (index / (series.length - 1)) * (width - pad * 2));
        const y = height - pad - ((point[field] || 0) / max) * (height - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");

  if (!series.length) {
    return <p className="subtle report-empty">No timeline data yet.</p>;
  }

  return (
    <svg className="report-timeline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Income and expense timeline">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="report-axis" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="report-axis" />
      {[0.25, 0.5, 0.75].map((tick) => (
        <line
          key={tick}
          x1={pad}
          x2={width - pad}
          y1={height - pad - tick * (height - pad * 2)}
          y2={height - pad - tick * (height - pad * 2)}
          className="report-gridline"
        />
      ))}
      {showExpenses ? <polyline points={linePoints("expense")} className="report-line report-line--expense" /> : null}
      {showIncome ? <polyline points={linePoints("income")} className="report-line report-line--income" /> : null}
      <text x={pad} y={height - 6} className="report-axis-label">
        {series[0]?.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </text>
      <text x={width - pad} y={height - 6} textAnchor="end" className="report-axis-label">
        {series.at(-1)?.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </text>
    </svg>
  );
}

export default function ReportsPage() {
  const [records, setRecords] = useState([]);
  const [range, setRange] = useState("all");
  const [status, setStatus] = useState({ message: "Loading reports...", kind: "ok" });
  const [loading, setLoading] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);
  const [showIncome, setShowIncome] = useState(true);
  const [, refreshCurrency] = useState(0);
  const expenseCanvasRef = useRef(null);
  const incomeCanvasRef = useRef(null);
  const monthlyCanvasRef = useRef(null);
  const chartRefs = useRef({ expense: null, income: null, monthly: null });

  const load = async () => {
    setLoading(true);
    setStatus({ message: "Loading reports...", kind: "ok" });
    try {
      const next = await loadAllRecords();
      setRecords(next);
      setStatus({ message: "Reports updated.", kind: "ok" });
    } catch (err) {
      setStatus({ message: `Could not load reports: ${err?.message || "Unknown error"}`, kind: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === "settings_currency" || event.key === "auto_currency") refreshCurrency((value) => value + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!status.message || status.kind === "error" || loading) return undefined;
    const timeout = window.setTimeout(() => setStatus({ message: "", kind: "ok" }), 2500);
    return () => window.clearTimeout(timeout);
  }, [status, loading]);

  const report = useMemo(() => computeReports(records, range), [records, range]);

  useEffect(() => {
    const Chart = window.Chart;
    if (!Chart) return undefined;

    Object.values(chartRefs.current).forEach((chart) => {
      try {
        chart?.destroy?.();
      } catch {}
    });
    chartRefs.current = { expense: null, income: null, monthly: null };

    const theme = document.documentElement.getAttribute("data-theme") || "light";
    const textColor = theme === "dark" ? "#e5e7eb" : "#111827";
    const gridColor = theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.10)";
    const palette =
      theme === "dark"
        ? ["#2dd4bf", "#38bdf8", "#818cf8", "#22d3ee", "#a78bfa", "#fb7185", "#f59e0b", "#60a5fa"]
        : ["#0f766e", "#2563eb", "#f59e0b", "#0ea5e9", "#7c3aed", "#ef4444", "#14b8a6", "#f97316"];

    const makeBar = (canvas, groups, label) => {
      if (!canvas) return null;
      const top = groups.slice(0, 7);
      return new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
          labels: top.map(([name]) => name),
          datasets: [
            {
              label,
              data: top.map(([, amount]) => amount),
              borderRadius: 10,
              backgroundColor: top.map((_, index) => palette[index % palette.length]),
              barThickness: 18,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${fmtMoney(ctx.parsed.x)}`,
              },
            },
            datalabels: {
              anchor: "end",
              align: "right",
              color: textColor,
              clamp: true,
              clip: false,
              offset: 6,
              padding: 4,
              font: { size: 11, weight: "700" },
              formatter: (value) =>
                new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: displayCurrency(),
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value),
            },
          },
          layout: { padding: { top: 12, right: 46, bottom: 16, left: 10 } },
          scales: {
            x: {
              grid: { color: gridColor },
              grace: "12%",
              ticks: {
                color: textColor,
                callback: (value) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(value),
              },
            },
            y: { grid: { display: false }, ticks: { color: textColor } },
          },
        },
        plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
      });
    };

    chartRefs.current.expense = makeBar(expenseCanvasRef.current, report.expenseGroups, "Expenses");
    chartRefs.current.income = makeBar(incomeCanvasRef.current, report.incomeGroups, "Income");

    if (monthlyCanvasRef.current) {
      chartRefs.current.monthly = new Chart(monthlyCanvasRef.current.getContext("2d"), {
        type: "line",
        data: {
          labels: report.series.map((point) =>
            point.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
          ),
          datasets: [
            {
              label: "Expenses",
              data: report.series.map((point) => point.expense),
              hidden: !showExpenses,
              borderColor: theme === "dark" ? "#fca5a5" : "#ef4444",
              backgroundColor: theme === "dark" ? "rgba(252,165,165,0.16)" : "rgba(239,68,68,0.14)",
              pointBackgroundColor: theme === "dark" ? "#fca5a5" : "#ef4444",
              pointRadius: 3,
              pointHoverRadius: 6,
              borderWidth: 2,
              tension: 0.25,
              fill: true,
            },
            {
              label: "Income",
              data: report.series.map((point) => point.income),
              hidden: !showIncome,
              borderColor: theme === "dark" ? "#60a5fa" : "#0057b8",
              backgroundColor: theme === "dark" ? "rgba(96,165,250,0.16)" : "rgba(0,87,184,0.12)",
              pointBackgroundColor: theme === "dark" ? "#60a5fa" : "#0057b8",
              pointRadius: 3,
              pointHoverRadius: 6,
              borderWidth: 2,
              tension: 0.25,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 10, right: 14, bottom: 18, left: 8 } },
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { labels: { color: textColor } },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`,
              },
            },
          },
          scales: {
            x: { title: { display: true, text: "Time", color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Amount", color: textColor },
              ticks: {
                color: textColor,
                callback: (value) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(value),
              },
              grid: { color: gridColor },
            },
          },
        },
      });
    }

    return () => {
      Object.values(chartRefs.current).forEach((chart) => {
        try {
          chart?.destroy?.();
        } catch {}
      });
    };
  }, [report, showExpenses, showIncome]);

  return (
    <>
      <div id="header"></div>
      <main className="main main--reports">
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
                <select value={range} onChange={(event) => setRange(event.target.value)}>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="365">Last 12 months</option>
                  <option value="all">All time</option>
                </select>
              </label>
              <button className="btn btn--primary" type="button" onClick={load} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              {status.message ? (
                <p className={`status-banner subtle reports-status ${status.kind === "error" ? "is-error" : "is-ok"}`} aria-live="polite">
                  {status.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="cards cards--kpis">
            <KpiCard label="Total Expenses" value={loading ? "Loading..." : fmtMoney(report.totalExpenses)} />
            <KpiCard label="Total Income" value={loading ? "Loading..." : fmtMoney(report.totalIncome)} />
            <KpiCard label="Net Cashflow" value={loading ? "Loading..." : fmtMoney(report.net)} />
            <KpiCard label="Monthly Average" value={loading ? "Loading..." : fmtMoney(report.monthlyAverage)} />
            <KpiCard label="Top Category" value={loading ? "Loading..." : report.topCategory} />
            <KpiCard label="Savings Rate" value={loading ? "Loading..." : fmtPercent(report.savingsRate)} />
          </div>

          <div className="insight-band" aria-live="polite">
            {report.insights.map((insight) => (
              <div className="insight" key={insight}>{loading ? "Loading insights..." : insight}</div>
            ))}
          </div>
        </section>

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
              <canvas id="barChartExpenses" ref={expenseCanvasRef}></canvas>
            </div>
            <div className="chart-box">
              <h3>Income Sources</h3>
              <canvas id="barChartIncome" ref={incomeCanvasRef}></canvas>
            </div>
          </div>
        </section>

        <section className="chart-section chart-section--timeline">
          <div className="section-head">
            <div>
              <h2>Cashflow Timeline</h2>
              <p className="section-sub">See momentum, not just totals.</p>
            </div>
            <div className="toggles">
              <label className="toggle">
                <input type="checkbox" checked={showExpenses} onChange={(event) => setShowExpenses(event.target.checked)} />
                <span>Expenses</span>
              </label>
              <label className="toggle">
                <input type="checkbox" checked={showIncome} onChange={(event) => setShowIncome(event.target.checked)} />
                <span>Income</span>
              </label>
            </div>
          </div>
          <canvas id="monthlyChart" ref={monthlyCanvasRef}></canvas>
        </section>
      </main>
      <div id="footer"></div>
    </>
  );
}
