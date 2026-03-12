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
    netCashflow: $("#net-cashflow"),
    monthlyAverage: $("#monthly-average"),
    topCategory: $("#top-category"),
    savingsRate: $("#savings-rate"),

    insightPrimary: $("#insight-primary"),
    insightSecondary: $("#insight-secondary"),
    insightTertiary: $("#insight-tertiary"),

    barExp: $("#barChartExpenses"),
    barInc: $("#barChartIncome"),
    monthly: $("#monthlyChart"),

    toggleExp: $("#toggle-expenses"),
    toggleInc: $("#toggle-income"),

  };

  let cache = [];
  let charts = { expBar: null, incBar: null, monthly: null };
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
      ? ["#2dd4bf", "#38bdf8", "#818cf8", "#22d3ee", "#a78bfa", "#fb7185", "#f59e0b", "#60a5fa"]
      : ["#0f766e", "#2563eb", "#f59e0b", "#0ea5e9", "#7c3aed", "#ef4444", "#14b8a6", "#f97316"];

  const chartText = () => (theme() === "dark" ? "#e5e7eb" : "#111827");
  const chartGrid = () => (theme() === "dark" ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.10)");
  const incomeLineColor = () => (theme() === "dark" ? "#60a5fa" : "#0057b8");
  const expenseLineColor = () => (theme() === "dark" ? "#fca5a5" : "#ef4444");

  const destroyCharts = () => {
    Object.values(charts).forEach((c) => {
      try {
        c?.destroy?.();
      } catch {}
    });
    charts = { expBar: null, incBar: null, monthly: null };
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

  const topCategoryByAmount = (entries) =>
    (entries || []).reduce(
      (best, current) => (current[1] > best[1] ? current : best),
      ["—", 0]
    );

  const topCategories = (entries, limit = 7) => {
    const sorted = (entries || []).slice().sort((a, b) => b[1] - a[1]);
    if (sorted.length <= limit) return sorted;
    const top = sorted.slice(0, limit);
    const restTotal = sorted.slice(limit).reduce((s, [, v]) => s + v, 0);
    if (restTotal > 0) top.push(["Other", restTotal]);
    return top;
  };

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

  const fmtPercent = (value) => {
    if (!Number.isFinite(value)) return "—";
    return `${value.toFixed(1)}%`;
  };

  const fmtCompact = (value, currency) => {
    const formatted = fmtMoney(value, currency);
    if (formatted.length <= 10) return formatted;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    } catch {
      return formatted;
    }
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

    const netCash = totalInc - totalExp;
    setText(els.netCashflow, fmtMoney(netCash, displayCur));

    const timeSeries = buildTimeSeries(records, rangeWindow);
    const monthsCount = Math.max(1, countDistinctMonths(records));
    const avgMonthlyExp = totalExp / monthsCount;
    setText(els.monthlyAverage, fmtMoney(avgMonthlyExp, displayCur));

    const expCats = groupByCategory(expenses);
    setText(els.topCategory, topCategoryByAmount(expCats)[0] || "—");

    const savings = totalInc > 0 ? ((totalInc - totalExp) / totalInc) * 100 : NaN;
    setText(els.savingsRate, fmtPercent(savings));

    const topExp = topCategoryByAmount(expCats);
    const topShare = totalExp > 0 ? (topExp[1] / totalExp) * 100 : NaN;
    setText(
      els.insightPrimary,
      topExp[0] && topExp[0] !== "—"
        ? `Top spend: ${topExp[0]} at ${fmtPercent(topShare)} of expenses.`
        : "Add a few records to unlock insights."
    );
    setText(
      els.insightSecondary,
      `Net cashflow: ${fmtMoney(netCash, displayCur)} for this range.`
    );
    setText(
      els.insightTertiary,
      `Active months: ${Math.max(1, monthsCount)} with records in range.`
    );

    destroyCharts();

    // Bars: Expenses
    if (els.barExp && window.Chart) {
      const ctx = els.barExp.getContext("2d");
      const expCatsTop = topCategories(expCats, 7);
      const labels = expCatsTop.map(([k]) => k);
      const data = expCatsTop.map(([, v]) => v);
      const maxExp = data.length ? Math.max(...data) : 0;

      charts.expBar = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Expenses",
              data,
              borderRadius: 10,
              backgroundColor: labels.map((_, i) => palette()[i % palette().length]),
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
                label: (ctx) => `${ctx.label}: ${fmtMoney(ctx.parsed.x, displayCur)}`,
              },
            },
            datalabels: {
              anchor: "end",
              align: "right",
              color: chartText(),
              clamp: true,
              clip: false,
              offset: 6,
              padding: 4,
              font: { size: 11, weight: "700" },
              formatter: (value) => fmtCompact(value, displayCur),
            },
          },
          layout: {
            padding: { top: 12, right: 46, bottom: 16, left: 10 },
          },
          scales: {
            x: {
              grid: { color: chartGrid() },
              grace: "12%",
              suggestedMax: maxExp ? maxExp * 1.12 : undefined,
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
            },
            y: {
              grid: { display: false },
              ticks: { color: chartText() },
            },
          },
        },
        plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
      });
    }

    // Bars: Income
    if (els.barInc && window.Chart) {
      const ctx = els.barInc.getContext("2d");
      const incCats = groupByCategory(income);
      const incCatsTop = topCategories(incCats, 7);
      const labels = incCatsTop.map(([k]) => k);
      const data = incCatsTop.map(([, v]) => v);
      const maxInc = data.length ? Math.max(...data) : 0;

      charts.incBar = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Income",
              data,
              borderRadius: 10,
              backgroundColor: labels.map((_, i) => palette()[i % palette().length]),
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
                label: (ctx) => `${ctx.label}: ${fmtMoney(ctx.parsed.x, displayCur)}`,
              },
            },
            datalabels: {
              anchor: "end",
              align: "right",
              color: chartText(),
              clamp: true,
              clip: false,
              offset: 6,
              padding: 4,
              font: { size: 11, weight: "700" },
              formatter: (value) => fmtCompact(value, displayCur),
            },
          },
          layout: {
            padding: { top: 12, right: 46, bottom: 16, left: 10 },
          },
          scales: {
            x: {
              grid: { color: chartGrid() },
              grace: "12%",
              suggestedMax: maxInc ? maxInc * 1.12 : undefined,
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
            },
            y: {
              grid: { display: false },
              ticks: { color: chartText() },
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

      const makeFill = (color) => (context) => {
        const { chart } = context;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return color;
        const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        grad.addColorStop(0, `${color}55`);
        grad.addColorStop(1, `${color}05`);
        return grad;
      };

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
              backgroundColor: makeFill(expenseLineColor()),
              pointBackgroundColor: expenseLineColor(),
              pointRadius: 3,
              pointHoverRadius: 6,
              pointHitRadius: 16,
              borderWidth: 2,
              tension: 0.25,
              fill: true,
            },
            {
              label: "Income",
              data: timeSeries.income,
              hidden: !showInc,
              borderColor: incomeLineColor(),
              backgroundColor: makeFill(incomeLineColor()),
              pointBackgroundColor: incomeLineColor(),
              pointRadius: 3,
              pointHoverRadius: 6,
              pointHitRadius: 16,
              borderWidth: 2,
              tension: 0.25,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: { top: 10, right: 14, bottom: 18, left: 8 },
          },
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
