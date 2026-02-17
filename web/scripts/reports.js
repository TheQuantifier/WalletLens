// scripts/reports.js
import { api } from "./api.js";

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  const els = {
    range: $("#reportsRange"),
    refresh: $("#btnRefreshReports"),
    status: $("#reportsStatus"),

    totalExpenses: $("#total-expenses"),
    totalIncome: $("#total-income"),
    monthlyAverage: $("#monthly-average"),
    topCategory: $("#top-category"),

    pieExp: $("#pieChartExpenses"),
    pieInc: $("#pieChartIncome"),
    monthly: $("#monthlyChart"),

    toggleExp: $("#toggle-expenses"),
    toggleInc: $("#toggle-income"),

  };

  let cache = [];
  let charts = { expPie: null, incPie: null, monthly: null };
  const PAGE_SIZE = 500;

  const debounce = (fn, delay = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  // Parse ISO-ish dates safely. If we get a date-only string (YYYY-MM-DD),
  // interpret it as local midnight to avoid timezone shifting.
  const parseISODate = (iso) => {
    if (!iso) return null;
    if (typeof iso !== "string") return new Date(iso);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T00:00:00`);
    return new Date(iso);
  };

  const showStatus = (msg, kind = "ok") => {
    if (!els.status) return;
    els.status.textContent = msg;
    els.status.classList.remove("is-hidden");
    els.status.style.display = "block";
    els.status.classList.toggle("is-ok", kind === "ok");
    els.status.classList.toggle("is-error", kind === "error");
  };

  const clearStatusSoon = (ms = 2000) => {
    if (!els.status) return;
    window.setTimeout(() => {
      els.status.style.display = "none";
      els.status.textContent = "";
      els.status.classList.add("is-hidden");
      els.status.classList.remove("is-ok", "is-error");
    }, ms);
  };

  // Display currency
  const getDisplayCurrency = () =>
    localStorage.getItem("settings_currency") ||
    localStorage.getItem("auto_currency") ||
    "USD";

    // Minimal FX rates fallback (daily shared cache via backend)
  const DEFAULT_FX_BASE = "USD";
  const DEFAULT_FX_RATES = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.1,
    CAD: 1.37,
    AUD: 1.55,
    JPY: 148,
  };

  let fxRates = { base: DEFAULT_FX_BASE, rates: { ...DEFAULT_FX_RATES } };

  const normalizeCurrency = (value) => String(value || "").trim().toUpperCase();

  const setFxRates = (payload) => {
    const base = normalizeCurrency(payload?.base || DEFAULT_FX_BASE);
    const rates = payload?.rates;
    if (!rates || typeof rates !== "object") return;
    fxRates = { base, rates: { ...rates, [base]: 1 } };
  };

  const convertCurrency = (amount, fromCurrency, toCurrency) => {
    const from = normalizeCurrency(fromCurrency);
    const to = normalizeCurrency(toCurrency);
    if (!from || !to || from === to) return amount;

    const base = fxRates.base || DEFAULT_FX_BASE;
    const rates = fxRates.rates || {};

    if (from === base) {
      const rateTo = Number(rates[to]);
      return Number.isFinite(rateTo) ? amount * rateTo : amount;
    }

    const rateFrom = Number(rates[from]);
    if (!Number.isFinite(rateFrom) || rateFrom === 0) return amount;

    if (to === base) {
      return amount / rateFrom;
    }

    const rateTo = Number(rates[to]);
    if (!Number.isFinite(rateTo)) return amount;
    return (amount / rateFrom) * rateTo;
  };

  const fmtMoney = (value, originalCurrency = "USD") => {
    const currency = getDisplayCurrency();
    const converted = convertCurrency(Number(value) || 0, originalCurrency, currency);
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(converted);
  };

  const theme = () => document.documentElement.getAttribute("data-theme") || "light";

  const palette = () =>
    theme() === "dark"
      ? ["#60a5fa", "#38bdf8", "#818cf8", "#22d3ee", "#93c5fd", "#67e8f9", "#a5b4fc", "#fca5a5"]
      : ["#0057b8", "#00a3e0", "#1e3a8a", "#0ea5e9", "#2563eb", "#0891b2", "#3b82f6", "#ef4444"];

  const chartText = () => (theme() === "dark" ? "#e5e7eb" : "#111827");
  const chartGrid = () => (theme() === "dark" ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.10)");
  const incomeLineColor = () => (theme() === "dark" ? "#60a5fa" : "#0057b8");
  const expenseLineColor = () => (theme() === "dark" ? "#fca5a5" : "#ef4444");

  const togglePieIndex = (chart, index) => {
    if (!chart) return;
    if (typeof chart.toggleDataVisibility === "function") {
      chart.toggleDataVisibility(index);
    } else {
      const meta = chart.getDatasetMeta(0);
      if (meta?.data?.[index]) {
        meta.data[index].hidden = !meta.data[index].hidden;
      }
    }
    chart.update();
  };

  const isPieIndexVisible = (chart, index) => {
    if (!chart) return true;
    if (typeof chart.getDataVisibility === "function") {
      return chart.getDataVisibility(index);
    }
    const meta = chart.getDatasetMeta?.(0);
    return !(meta?.data?.[index]?.hidden);
  };

  const pieLegend = () => ({
    position: "bottom",
    labels: { color: chartText() },
    onClick: (e, item, legend) => togglePieIndex(legend?.chart, item.index),
  });

  const destroyCharts = () => {
    Object.values(charts).forEach((c) => {
      try {
        c?.destroy?.();
      } catch {}
    });
    charts = { expPie: null, incPie: null, monthly: null };
  };

  const startOfDay = (d) => {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
  };

  const endOfDay = (d) => {
    const out = new Date(d);
    out.setHours(23, 59, 59, 999);
    return out;
  };

  const dateKey = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getRangeWindow = (records, rangeVal) => {
    const validDates = (records || [])
      .map((r) => parseISODate(r?.date))
      .filter((d) => d && !Number.isNaN(d.getTime()));

    if (rangeVal === "all") {
      if (!validDates.length) {
        const now = new Date();
        return { start: startOfDay(now), end: endOfDay(now) };
      }
      const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));
      return { start: startOfDay(minDate), end: endOfDay(maxDate) };
    }

    const days = Number(rangeVal);
    if (!Number.isFinite(days) || days <= 0) {
      const now = new Date();
      return { start: startOfDay(now), end: endOfDay(now) };
    }

    const end = endOfDay(new Date());
    const start = startOfDay(new Date(end));
    start.setDate(start.getDate() - days + 1);
    return { start, end };
  };

  const withinWindow = (iso, window) => {
    if (!iso || !window?.start || !window?.end) return false;
    const d = parseISODate(iso);
    if (!d || Number.isNaN(d.getTime())) return false;
    return d >= window.start && d <= window.end;
  };

  const normalize = (records) =>
    (records || [])
      .filter((r) => r && (r.type === "expense" || r.type === "income"))
      .map((r) => ({
        ...r,
        amount: Number(r.amount) || 0,
        currency: r.currency || "USD",
        category: r.category || "Uncategorized",
      }));

  const groupByCategory = (records) => {
    const m = new Map();
    const displayCur = getDisplayCurrency();
    records.forEach((r) => {
      const k = r.category || "Uncategorized";
      const prev = m.get(k) || 0;
      const amt = convertCurrency(r.amount, r.currency, displayCur);
      m.set(k, prev + amt);
    });
    return [...m.entries()];
  };

  const sortCategoriesAlpha = (entries) =>
    (entries || []).slice().sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));

  const topCategoryByAmount = (entries) =>
    (entries || []).reduce(
      (best, current) => (current[1] > best[1] ? current : best),
      ["—", 0]
    );

  const monthKeyFromDate = (d) => {
    if (!d || Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  const getSeriesBounds = (records, rangeWindow) => {
    const validDates = (records || [])
      .map((r) => parseISODate(r?.date))
      .filter((d) => d && !Number.isNaN(d.getTime()));

    if (!validDates.length) {
      return { start: new Date(rangeWindow.start), end: new Date(rangeWindow.end) };
    }

    const minDate = new Date(Math.min(...validDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));
    return { start: startOfDay(minDate), end: endOfDay(maxDate) };
  };

  const pickTimeGranularity = (start, end) => {
    const dayMs = 24 * 60 * 60 * 1000;
    const spanDays = Math.max(1, Math.floor((end - start) / dayMs) + 1);
    return spanDays <= 120 ? "day" : "month";
  };

  const buildTimeSeries = (records, rangeWindow) => {
    const displayCur = getDisplayCurrency();
    const bounds = getSeriesBounds(records, rangeWindow);
    const granularity = pickTimeGranularity(bounds.start, bounds.end);
    const m = new Map();

    if (granularity === "day") {
      const cursor = new Date(bounds.start);
      while (cursor <= bounds.end) {
        m.set(dateKey(cursor), { income: 0, expense: 0, date: new Date(cursor) });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const cursor = new Date(bounds.start.getFullYear(), bounds.start.getMonth(), 1);
      const endMonth = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), 1);
      while (cursor <= endMonth) {
        m.set(monthKeyFromDate(cursor), { income: 0, expense: 0, date: new Date(cursor) });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    records.forEach((r) => {
      if (!r.date) return;
      const d = parseISODate(r.date);
      if (!d || Number.isNaN(d.getTime())) return;
      const key = granularity === "day" ? dateKey(d) : monthKeyFromDate(d);
      if (!key) return;
      const prev = m.get(key) || { income: 0, expense: 0, date: d };
      const amt = convertCurrency(r.amount, r.currency, displayCur);
      if (r.type === "income") prev.income += amt;
      else prev.expense += amt;
      m.set(key, prev);
    });

    const keys = [...m.keys()].sort();
    const labels = keys.map((k) =>
      m.get(k).date.toLocaleDateString(
        undefined,
        granularity === "day"
          ? { month: "short", day: "numeric" }
          : { year: "numeric", month: "short" }
      )
    );

    return {
      labels,
      income: keys.map((k) => m.get(k).income),
      expense: keys.map((k) => m.get(k).expense),
      granularity,
    };
  };

  const countDistinctMonths = (records) => {
    const months = new Set();
    (records || []).forEach((r) => {
      const d = parseISODate(r?.date);
      const key = monthKeyFromDate(d);
      if (key) months.add(key);
    });
    return months.size;
  };

  const setText = (el, text) => {
    if (!el) return;
    el.textContent = text;
  };


  const computeAndRender = () => {
    const rangeVal = els.range?.value || "all";
    const normalized = normalize(cache);
    const rangeWindow = getRangeWindow(normalized, rangeVal);
    const records = normalized.filter((r) => withinWindow(r.date, rangeWindow));

    const expenses = records.filter((r) => r.type === "expense");
    const income = records.filter((r) => r.type === "income");

    const displayCur = getDisplayCurrency();
    const totalExp = expenses.reduce(
      (s, r) => s + convertCurrency(r.amount, r.currency, displayCur),
      0
    );
    const totalInc = income.reduce(
      (s, r) => s + convertCurrency(r.amount, r.currency, displayCur),
      0
    );

    setText(els.totalExpenses, fmtMoney(totalExp, displayCur));
    setText(els.totalIncome, fmtMoney(totalInc, displayCur));

    const timeSeries = buildTimeSeries(records, rangeWindow);
    const monthsCount = Math.max(1, countDistinctMonths(records));
    const avgMonthlyExp = totalExp / monthsCount;
    setText(els.monthlyAverage, fmtMoney(avgMonthlyExp, displayCur));

    const expCats = groupByCategory(expenses);
    setText(els.topCategory, topCategoryByAmount(expCats)[0] || "—");

    destroyCharts();

    // Pie: Expenses
    if (els.pieExp && window.Chart) {
      const ctx = els.pieExp.getContext("2d");
      const expCatsAlpha = sortCategoriesAlpha(expCats);
      const labels = expCatsAlpha.map(([k]) => k);
      const data = expCatsAlpha.map(([, v]) => v);
      const colors = labels.map((_, i) => palette()[i % palette().length]);

      charts.expPie = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderWidth: 1 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          legend: pieLegend(),
          plugins: {
            legend: pieLegend(),
            datalabels: {
              color: "#fff",
              font: { weight: "bold" },
              formatter: (value, ctx) => {
                if (!isPieIndexVisible(ctx.chart, ctx.dataIndex)) {
                  return "";
                }
                const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                if (!sum) return "0%";
                return `${((value / sum) * 100).toFixed(1)}%`;
              },
            },
          },
        },
        plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
      });
    }

    // Pie: Income
    if (els.pieInc && window.Chart) {
      const ctx = els.pieInc.getContext("2d");
      const incCats = groupByCategory(income);
      const incCatsAlpha = sortCategoriesAlpha(incCats);
      const labels = incCatsAlpha.map(([k]) => k);
      const data = incCatsAlpha.map(([, v]) => v);
      const colors = labels.map((_, i) => palette()[i % palette().length]);

      charts.incPie = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderWidth: 1 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          legend: pieLegend(),
          plugins: {
            legend: pieLegend(),
            datalabels: {
              color: "#fff",
              font: { weight: "bold" },
              formatter: (value, ctx) => {
                if (!isPieIndexVisible(ctx.chart, ctx.dataIndex)) {
                  return "";
                }
                const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                if (!sum) return "0%";
                return `${((value / sum) * 100).toFixed(1)}%`;
              },
            },
          },
        },
        plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
      });
    }

    // Monthly trend
    if (els.monthly && window.Chart) {
      const ctx = els.monthly.getContext("2d");
      const showExp = els.toggleExp?.checked ?? true;
      const showInc = els.toggleInc?.checked ?? true;

      charts.monthly = new Chart(ctx, {
        type: "line",
        data: {
          labels: timeSeries.labels,
          datasets: [
            {
              label: "Expenses",
              data: timeSeries.expense,
              hidden: !showExp,
              borderColor: expenseLineColor(),
              backgroundColor: expenseLineColor(),
              pointBackgroundColor: expenseLineColor(),
              pointRadius: 3,
              pointHoverRadius: 6,
              pointHitRadius: 16,
              borderWidth: 2,
              tension: 0.25,
            },
            {
              label: "Income",
              data: timeSeries.income,
              hidden: !showInc,
              borderColor: incomeLineColor(),
              backgroundColor: incomeLineColor(),
              pointBackgroundColor: incomeLineColor(),
              pointRadius: 3,
              pointHoverRadius: 6,
              pointHitRadius: 16,
              borderWidth: 2,
              tension: 0.25,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          plugins: {
            legend: { labels: { color: chartText() } },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y, displayCur)}`,
                footer: (items) => {
                  const total = (items || []).reduce(
                    (sum, item) => sum + (Number(item?.parsed?.y) || 0),
                    0
                  );
                  return `Total: ${fmtMoney(total, displayCur)}`;
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: "Time", color: chartText() },
              ticks: { color: chartText() },
              grid: { color: chartGrid() },
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Amount", color: chartText() },
              ticks: {
                color: chartText(),
                callback: (v) => {
                  try {
                    return new Intl.NumberFormat(undefined, { notation: "compact" }).format(v);
                  } catch {
                    return v;
                  }
                },
              },
              grid: { color: chartGrid() },
            },
          },
        },
      });
    }

    const rangeLabel = rangeVal === "all" ? "all time" : `last ${rangeVal} days`;
    showStatus(`Updated for ${rangeLabel}.`);
    clearStatusSoon(2000);
  };

  const debouncedCompute = debounce(computeAndRender, 150);

  const loadFxRates = async () => {
    try {
      const data = await api.fxRates.get(DEFAULT_FX_BASE);
      setFxRates(data);
      debouncedCompute();
    } catch (err) {
      console.warn("Failed to load FX rates:", err);
    }
  };

  const load = async () => {
    try {
      showStatus("Loading reports...");
      const all = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const batch = await api.records.getAll({ limit: PAGE_SIZE, offset });
        const rows = Array.isArray(batch) ? batch : (batch?.records || batch?.data || []);
        all.push(...rows);
        if (!Array.isArray(rows) || rows.length < PAGE_SIZE) break;
      }
      cache = all;
      computeAndRender();
    } catch (err) {
      console.error("Error loading reports:", err);
      showStatus("Could not load reports.", "error");
    }
  };

  // Wire UI once (avoid duplicate listeners)
  els.range?.addEventListener("change", () => debouncedCompute());
  els.refresh?.addEventListener("click", () => load());
  els.toggleExp?.addEventListener("change", () => debouncedCompute());
  els.toggleInc?.addEventListener("change", () => debouncedCompute());

  // Resize redraw
  window.addEventListener("resize", debounce(() => computeAndRender(), 200));

  // React to theme/currency updates
  window.addEventListener("storage", (e) => {
    if (e.key === "theme" || e.key === "settings_currency" || e.key === "auto_currency") {
      debouncedCompute();
    }
  });

  // Same-tab theme changes: observe data-theme attr
  const obs = new MutationObserver(() => debouncedCompute());
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Initial
  document.addEventListener("DOMContentLoaded", () => {
    loadFxRates();
    load();
  });
})();
