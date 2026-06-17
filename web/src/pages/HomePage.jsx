import { useEffect, useMemo, useRef, useState } from "react";
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

const BUDGET_COLUMNS = [
  "housing",
  "utilities",
  "groceries",
  "transportation",
  "dining",
  "health",
  "entertainment",
  "shopping",
  "membership",
  "miscellaneous",
  "education",
  "giving",
  "savings",
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function parseAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

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

function getCssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function hexToRgba(hex, alpha) {
  const cleaned = String(hex || "").replace("#", "").trim();
  if (cleaned.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawNetWorthChart(canvas, series, currency = CURRENCY) {
  if (!canvas) return;
  const parent = canvas.parentElement || canvas;
  const parentWidth = parent.clientWidth || 600;
  const dpr = window.devicePixelRatio || 1;
  const height = 260;

  canvas.width = parentWidth * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, parentWidth, height);

  if (!series?.length) return;

  const padding = { top: 20, right: 20, bottom: 45, left: 78 };
  const innerW = parentWidth - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = series.map((point) => parseAmount(point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.1);
  const yMin = min - pad;
  const yMax = max + pad;
  const ySpan = Math.max(1, yMax - yMin);
  const primary = getCssVar("--primary", "#0057b8");
  const accent = getCssVar("--accent", "#00a3e0");
  const muted = getCssVar("--muted", "#6b7280");
  const grid = getCssVar("--border", "#e5e7eb");
  const text = getCssVar("--text", "#111827");

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + innerH);
  ctx.lineTo(padding.left + innerW, padding.top + innerH);
  ctx.stroke();

  const stepX = innerW / Math.max(series.length - 1, 1);
  const points = series.map((point, index) => {
    const x = padding.left + stepX * index;
    const y = padding.top + innerH - ((parseAmount(point.value) - yMin) / ySpan) * innerH;
    return { x, y };
  });

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.lineTo(padding.left + innerW, padding.top + innerH);
  ctx.lineTo(padding.left, padding.top + innerH);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(primary, 0.12);
  ctx.fill();

  ctx.fillStyle = accent;
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = muted;
  ctx.font = "12px system-ui";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(formatMoney(yMax, currency), padding.left - 10, padding.top + 4);
  ctx.fillText(formatMoney(yMin, currency), padding.left - 10, padding.top + innerH);

  ctx.textAlign = "center";
  series.forEach((point, index) => {
    if (index % 2 === 1 && series.length > 4) return;
    ctx.fillText(point.label, padding.left + stepX * index, padding.top + innerH + 20);
  });

  ctx.fillStyle = text;
  ctx.font = "700 18px system-ui";
  ctx.fillText("Month", padding.left + innerW / 2, padding.top + innerH + 38);
  ctx.save();
  ctx.translate(28, padding.top + innerH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Net Worth", 0, 0);
  ctx.restore();
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

function computeMonthlyProjection(records) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, now.getDate());
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
  const monthly = records.filter(isThisMonth);
  const totalIncome = monthly
    .filter((record) => record.type === "income")
    .reduce((sum, record) => sum + parseAmount(record.amount), 0);
  const totalSpending = monthly
    .filter((record) => record.type === "expense")
    .reduce((sum, record) => sum + parseAmount(record.amount), 0);
  const currentNetSaved = totalIncome - totalSpending;
  const avgIncomePerDay = totalIncome / daysElapsed;
  const avgSpendingPerDay = totalSpending / daysElapsed;

  return {
    projectedSavings: currentNetSaved + (avgIncomePerDay - avgSpendingPerDay) * daysRemaining,
    daysRemaining,
    totalIncome,
    totalSpending,
  };
}

function getCashflowColor(value, total) {
  const base = Math.max(Math.abs(value), Math.abs(total), 1);
  const ratio = total > 0 ? value / total : value > 0 ? 1 : 0;
  const progress =
    value < 0 ? clamp((value + base) / base, 0, 1) * 0.25 : 0.25 + clamp(ratio / 0.1, 0, 1) * 0.75;
  const hue = progress * 145;
  const lightness = 46 - progress * 6;
  return `hsl(${hue} 78% ${lightness}%)`;
}

function getCashflowDelta(netCashflow, income) {
  const surplusRatio = income > 0 ? netCashflow / income : netCashflow > 0 ? 1 : 0;
  if (netCashflow < 0) {
    return income <= 0 ? "Deficit: 100.0%+ of income" : `Deficit: ${Math.abs(surplusRatio * 100).toFixed(1)}% of income`;
  }
  if (income <= 0) return "No income recorded in this view";
  if (surplusRatio === 0) return "Break-even: 0.0% of income left after spending";
  if (surplusRatio < 0.1) return `Orange zone: ${(surplusRatio * 100).toFixed(1)}% of income left after spending`;
  return `Healthy surplus: ${(surplusRatio * 100).toFixed(1)}% of income left after spending`;
}

function normalizeNetWorthItems(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.items || payload?.data || [];
  return Array.isArray(rows)
    ? rows
        .map((item) => ({
          ...item,
          id: item.id || item.name,
          type: item.type === "liability" ? "liability" : "asset",
          name: String(item.name || "").trim(),
          amount: parseAmount(item.amount),
        }))
        .filter((item) => item.name && item.amount > 0)
    : [];
}

function getAccountBalance(account) {
  if (!account || typeof account !== "object") return 0;
  const direct =
    account.balance ??
    account.currentBalance ??
    account.availableBalance ??
    account.current_balance ??
    account.available_balance;
  if (Number.isFinite(Number(direct))) return Number(direct);
  const nested = account.balances || account.balanceInfo || {};
  const nestedValue = nested.current ?? nested.available ?? nested.balance;
  return Number.isFinite(Number(nestedValue)) ? Number(nestedValue) : 0;
}

function buildLinkedAccountNetWorthItems(accounts = []) {
  const assets = [];
  const liabilities = [];
  const assetTypes = new Set(["depository", "investment", "brokerage", "other"]);
  const liabilityTypes = new Set(["credit", "loan"]);

  (accounts || []).forEach((account) => {
    const balance = getAccountBalance(account);
    const name = account?.officialName || account?.official_name || account?.name || account?.institutionName || "Linked account";
    const item = {
      id: account?.id || name,
      name,
      amount: Math.abs(balance),
      source: "plaid",
    };
    const type = String(account?.type || "").toLowerCase();
    if (liabilityTypes.has(type) || (!assetTypes.has(type) && balance < 0)) liabilities.push(item);
    else assets.push(item);
  });

  return { assets, liabilities };
}

function splitNetWorthItems(items) {
  const assets = [];
  const liabilities = [];
  items.forEach((item) => {
    if (item.type === "liability") liabilities.push(item);
    else assets.push(item);
  });
  assets.sort((a, b) => b.amount - a.amount);
  liabilities.sort((a, b) => b.amount - a.amount);
  return { assets, liabilities };
}

function buildMonthlyNet(records, monthsBack = 12) {
  const now = new Date();
  const months = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString(undefined, { month: "short" }),
      net: 0,
    });
  }

  records.forEach((record) => {
    if (!record.date) return;
    const date = new Date(record.date);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = months.find((month) => month.key === key);
    if (!bucket) return;
    bucket.net += record.type === "income" ? parseAmount(record.amount) : -parseAmount(record.amount);
  });

  return months;
}

function buildNetWorthTrend(records, currentNetWorth, monthsBack = 12) {
  const months = buildMonthlyNet(records, monthsBack);
  const trend = new Array(months.length);
  let running = parseAmount(currentNetWorth);
  for (let index = months.length - 1; index >= 0; index -= 1) {
    trend[index] = { label: months[index].label, value: running };
    running -= parseAmount(months[index].net);
  }
  return trend;
}

function normalizeNetWorthTrend(trend, currentNetWorth, asOf = new Date()) {
  const currentDate = new Date(asOf || new Date());
  const currentMonthLabel = currentDate.toLocaleDateString(undefined, { month: "short" });
  const safeTrend = Array.isArray(trend)
    ? trend
        .map((point) => ({ label: String(point?.label || "").trim(), value: Number(point?.value) }))
        .filter((point) => point.label && Number.isFinite(point.value))
    : [];

  if (!safeTrend.length) return [];
  const normalized = safeTrend.slice(-12);
  const lastPoint = normalized[normalized.length - 1];
  if (lastPoint?.label === currentMonthLabel) {
    lastPoint.value = parseAmount(currentNetWorth);
    return normalized;
  }
  normalized.push({ label: currentMonthLabel, value: parseAmount(currentNetWorth) });
  return normalized.slice(-12);
}

function sumBudgetSheet(sheet) {
  if (!sheet) return 0;
  const standard = BUDGET_COLUMNS.reduce((sum, key) => sum + parseAmount(sheet?.[key]), 0);
  const custom = Array.isArray(sheet.custom_categories)
    ? sheet.custom_categories.reduce((sum, entry) => sum + parseAmount(entry?.amount), 0)
    : Array.isArray(sheet.customCategories)
      ? sheet.customCategories.reduce((sum, entry) => sum + parseAmount(entry?.amount), 0)
      : 0;
  return standard + custom;
}

function getPeriodProgress(range) {
  if (!range?.start || !range?.end) {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return { daysElapsed: now.getDate(), daysTotal: daysInMonth };
  }
  const start = new Date(range.start);
  const end = new Date(range.end);
  const now = new Date();
  const totalMs = Math.max(1, end.getTime() - start.getTime());
  const elapsedMs = Math.min(Math.max(0, now.getTime() - start.getTime()), totalMs);
  return {
    daysTotal: Math.max(1, Math.round(totalMs / 86400000) + 1),
    daysElapsed: Math.max(1, Math.round(elapsedMs / 86400000) + 1),
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
  const netWorthCanvasRef = useRef(null);
  const velocityProgressRef = useRef(null);
  const velocityMarkerRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [user, setUser] = useState(null);
  const [netWorth, setNetWorth] = useState(null);
  const [netWorthItems, setNetWorthItems] = useState([]);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [spendVelocity, setSpendVelocity] = useState(null);
  const [recurring, setRecurring] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [txnStatus, setTxnStatus] = useState("");
  const [netWorthStatus, setNetWorthStatus] = useState("");
  const [netWorthForm, setNetWorthForm] = useState({
    asset: { name: "", amount: "" },
    liability: { name: "", amount: "" },
  });
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
  const projection = useMemo(() => computeMonthlyProjection(records), [records]);
  const cashflowColor = useMemo(
    () => getCashflowColor(summary.netBalance, summary.totalIncome || summary.totalSpending),
    [summary.netBalance, summary.totalIncome, summary.totalSpending]
  );
  const projectedColor = useMemo(
    () => getCashflowColor(projection.projectedSavings, projection.totalIncome),
    [projection.projectedSavings, projection.totalIncome]
  );
  const netWorthData = useMemo(() => {
    const manual = splitNetWorthItems(netWorthItems);
    const linked = buildLinkedAccountNetWorthItems(linkedAccounts);
    const assets = [...linked.assets, ...manual.assets];
    const liabilities = [...linked.liabilities, ...manual.liabilities];
    const assetsTotal = assets.reduce((sum, item) => sum + parseAmount(item.amount), 0);
    const liabilitiesTotal = liabilities.reduce((sum, item) => sum + parseAmount(item.amount), 0);
    const currentNetWorth = assetsTotal - liabilitiesTotal;
    const snapshotTrend = normalizeNetWorthTrend(netWorth?.trend, currentNetWorth, netWorth?.asOf || new Date());
    const fallbackTrend = assets.length || liabilities.length ? buildNetWorthTrend(records, currentNetWorth, 12) : [];

    return {
      assets,
      liabilities,
      assetsTotal,
      liabilitiesTotal,
      netWorth: currentNetWorth,
      trend: snapshotTrend.length ? snapshotTrend : fallbackTrend,
      currency: netWorth?.currency || CURRENCY,
      asOf: netWorth?.asOf,
      snapshotBacked: snapshotTrend.length > 1,
      hasData: Boolean(assets.length || liabilities.length || snapshotTrend.length),
    };
  }, [linkedAccounts, netWorth, netWorthItems, records]);
  const velocity = useMemo(() => {
    const budgetTotal = parseAmount(spendVelocity?.budgetTotal);
    const spent = parseAmount(spendVelocity?.spent || summary.totalSpending);
    const ratio = budgetTotal > 0 ? spent / budgetTotal : 0;
    const { daysElapsed, daysTotal } = getPeriodProgress(spendVelocity?.range);
    const paceRatio = clamp(daysElapsed / daysTotal, 0, 1);
    const expected = budgetTotal * paceRatio;
    const paceDiff = spent - expected;
    const paceState =
      !budgetTotal
        ? "-"
        : Math.abs(paceDiff) < budgetTotal * 0.03
          ? "On pace"
          : paceDiff > 0
            ? "Over pace"
            : "Under pace";

    return {
      budgetTotal,
      spent,
      ratio,
      paceRatio,
      paceState,
      daysElapsed,
      daysTotal,
      expected,
      hasBudget: budgetTotal > 0,
    };
  }, [spendVelocity, summary.totalSpending]);

  async function loadDashboard() {
    setStatus("loading");
    setError("");
    try {
      const period = monthKey();
      const [me, allRecords, netWorthOverview, netWorthList, accounts, budgetSheet, budgetSummary, upcoming] = await Promise.all([
        api.auth.me().catch(() => null),
        loadAllRecords(),
        api.netWorth.overview(365).catch(() => null),
        api.netWorth.list().catch(() => ({ items: [] })),
        api.plaid.accounts().catch(() => []),
        api.budgetSheets.lookup({ cadence: "monthly", period }).catch(() => null),
        api.budgetSheets.summary({ cadence: "monthly", period }).catch(() => null),
        api.recurring.upcoming({ days: 30 }).catch(() => []),
      ]);
      setUser(me?.user || null);
      setRecords(allRecords);
      setNetWorth(netWorthOverview);
      setNetWorthItems(normalizeNetWorthItems(netWorthList));
      setLinkedAccounts(normalizeRecords(accounts?.accounts || accounts));
      setSpendVelocity({
        hasBudget: sumBudgetSheet(budgetSheet) > 0,
        budgetTotal: sumBudgetSheet(budgetSheet),
        spent: parseAmount(budgetSummary?.totals?.totalSpent),
        range: budgetSummary?.range || null,
      });
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

  useEffect(() => {
    drawNetWorthChart(netWorthCanvasRef.current, netWorthData.trend, netWorthData.currency);
    const redraw = () => drawNetWorthChart(netWorthCanvasRef.current, netWorthData.trend, netWorthData.currency);
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [netWorthData.currency, netWorthData.trend]);

  useEffect(() => {
    const progress = velocityProgressRef.current;
    const marker = velocityMarkerRef.current;
    if (!progress || !marker) return;

    if (!velocity.hasBudget) {
      progress.style.strokeDasharray = "0 1";
      progress.style.strokeDashoffset = "0";
      progress.classList.remove("is-over");
      marker.setAttribute("cx", "20");
      marker.setAttribute("cy", "100");
      return;
    }

    const arcLength = progress.getTotalLength();
    const clamped = clamp(velocity.ratio, 0, 1);
    progress.style.strokeDasharray = `${arcLength} ${arcLength}`;
    progress.style.strokeDashoffset = `${arcLength * (1 - clamped)}`;
    progress.classList.toggle("is-over", velocity.ratio > 1);

    const angle = Math.PI * (1 - velocity.paceRatio);
    const markerX = 100 + 80 * Math.cos(angle);
    const markerY = 100 - 80 * Math.sin(angle);
    marker.setAttribute("cx", markerX.toFixed(2));
    marker.setAttribute("cy", markerY.toFixed(2));
  }, [velocity]);

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

  async function addNetWorthItem(type, event) {
    event.preventDefault();
    setNetWorthStatus("");
    const current = netWorthForm[type] || {};
    const amount = Number(current.amount);
    const name = String(current.name || "").trim();
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      setNetWorthStatus("Enter a name and amount greater than 0.");
      return;
    }

    try {
      await api.netWorth.create({ type, name, amount });
      setNetWorthForm((next) => ({ ...next, [type]: { name: "", amount: "" } }));
      await loadDashboard();
    } catch (err) {
      setNetWorthStatus(err?.message || "Failed to save net worth item.");
    }
  }

  async function removeNetWorthItem(item) {
    if (!item?.id || item.source === "plaid") return;
    setNetWorthStatus("");
    try {
      await api.netWorth.remove(item.id);
      await loadDashboard();
    } catch (err) {
      setNetWorthStatus(err?.message || "Failed to remove net worth item.");
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
              <h1 id="welcomeTitle">{displayName ? `Welcome back, ${displayName}` : "Welcome back"}</h1>
              <p className="subtle" id="lastUpdated">
                {isLoading
                  ? "Loading dashboard..."
                  : error || `Updated ${new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
              </p>
            </div>

            <div className="hero-metrics" aria-label="Key insights">
              <div className="hero-metric">
                <span className="label">
                  Projected savings
                  <span className="info-popover">
                    <button type="button" className="info-popover__trigger" aria-label="Projected savings guidance">i</button>
                    <span className="info-popover__panel" role="tooltip">
                      Projected savings estimates future savings based on current month income, spending, and the remaining days in the month.
                    </span>
                  </span>
                </span>
                <span className="value value--gradient" id="heroProjectedSavings" style={{ "--cashflow-color": projectedColor }}>
                  {formatMoney(projection.projectedSavings)}
                </span>
                <span className="delta subtle" id="heroProjectedDelta">{projection.daysRemaining} projected days at current pace</span>
              </div>
              <div className="hero-metric">
                <span className="label">
                  Cashflow health
                  <span className="info-popover">
                    <button type="button" className="info-popover__trigger" aria-label="Cashflow health guidance">i</button>
                    <span className="info-popover__panel" role="tooltip">
                      Cashflow health compares income against spending and highlights whether the current month is running a surplus or deficit.
                    </span>
                  </span>
                </span>
                <span className="value value--gradient" id="heroCashflowHealth" style={{ "--cashflow-color": cashflowColor }}>
                  {formatMoney(summary.netBalance)}
                </span>
                <span className="delta subtle" id="heroCashflowDelta">{getCashflowDelta(summary.netBalance, summary.totalIncome)}</span>
              </div>
            </div>

            <div className="quick-actions" role="group" aria-label="Quick actions">
              <button className="btn btn--primary" id="btnUpload" type="button" onClick={() => navigateTo("/upload")}>
                Upload Receipt
              </button>
              <button className="btn" id="btnAddTxn" type="button" onClick={() => setModalOpen(true)}>
                Add Transaction
              </button>
              <button className="btn" id="btnExport" type="button" onClick={exportRecords} disabled={!records.length}>
                Export
              </button>
              <a className="btn btn--link" href="/reports" id="btnReports">
                Go to Reports &rarr;
              </a>
            </div>
          </div>

          <aside className="hero-secondary card" aria-label="Focus summary">
            <h3>Focus this week</h3>
            <ul className="focus-list" id="focusList" aria-live="polite">
              {focusItems.map((item) => (
                <li key={item}>
                  <span className="focus-dot"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="focus-foot">
              <a className="btn btn--link" href="/budgeting">
                Plan your budget &rarr;
              </a>
            </div>
          </aside>
        </section>

        <section className="net-worth" id="netWorthSection" aria-label="Net worth dashboard">
          <div className="net-worth-header">
            <div>
              <h2>Net Worth</h2>
              <div className="net-worth-status">
                <p className="subtle" id="netWorthUpdated">
                  {netWorthData.asOf ? `Updated ${formatDate(netWorthData.asOf)}` : netWorthData.hasData ? "Tracking started recently" : "No net worth data yet"}
                </p>
                <span className="subtle net-worth-empty-hint" id="netWorthEmptyHint">
                  (Add an asset or linked account to see net worth trend)
                </span>
              </div>
            </div>
            <a className="btn btn--link" href="/reports">
              View full reports &rarr;
            </a>
          </div>
          <div className="net-worth-grid" id="netWorthGrid">
            <article className="card net-worth-summary">
              <div className="net-worth-total">
                <p className="label">Total Net Worth</p>
                <p className="value" id="netWorthTotal">{formatMoney(netWorthData.netWorth, netWorthData.currency)}</p>
                <p className="delta subtle" id="netWorthDelta">
                  {netWorthData.snapshotBacked && netWorthData.trend.length > 1
                    ? `${netWorthData.netWorth - netWorthData.trend[0].value >= 0 ? "+" : "-"}${formatMoney(
                        Math.abs(netWorthData.netWorth - netWorthData.trend[0].value),
                        netWorthData.currency
                      )} vs previous period`
                    : "Tracking started recently. The trend will improve as snapshots accumulate."}
                </p>
              </div>
              <div className="net-worth-chart">
                <canvas ref={netWorthCanvasRef} id="netWorthChart" aria-label="Net worth trend" role="img"></canvas>
                <p className="chart-caption subtle">Recent months</p>
              </div>
            </article>

            <article className="card net-worth-breakdown">
              <div className="breakdown-col">
                <h3>Assets</h3>
                <ul id="assetsList" className="networth-list">
                  {netWorthData.assets.length ? (
                    netWorthData.assets.map((item) => (
                      <li className="networth-item" key={`asset-${item.id}-${item.name}`}>
                        <span className="networth-item__name">{item.name}</span>
                        <span>{formatMoney(item.amount, netWorthData.currency)}</span>
                        <button
                          className="networth-item__remove"
                          type="button"
                          disabled={item.source === "plaid"}
                          title={item.source === "plaid" ? "Remove this account from the Profile page to exclude it from net worth." : undefined}
                          onClick={() => removeNetWorthItem(item)}
                        >
                          {item.source === "plaid" ? "Linked" : "Remove"}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="subtle">No items yet.</li>
                  )}
                </ul>
                <form className="networth-form" id="assetForm" onSubmit={(event) => addNetWorthItem("asset", event)}>
                  <input
                    type="text"
                    id="assetName"
                    placeholder="Asset name (e.g., House)"
                    value={netWorthForm.asset.name}
                    onChange={(event) => setNetWorthForm((next) => ({ ...next, asset: { ...next.asset, name: event.target.value } }))}
                    required
                  />
                  <input
                    type="number"
                    id="assetAmount"
                    placeholder="Amount"
                    min="0"
                    step="0.01"
                    value={netWorthForm.asset.amount}
                    onChange={(event) => setNetWorthForm((next) => ({ ...next, asset: { ...next.asset, amount: event.target.value } }))}
                    required
                  />
                  <button className="btn" type="submit">Add</button>
                </form>
                <div className="breakdown-total">
                  <span>Total Assets</span>
                  <strong id="assetsTotal">{formatMoney(netWorthData.assetsTotal, netWorthData.currency)}</strong>
                </div>
              </div>
              <div className="breakdown-col">
                <h3>Liabilities</h3>
                <ul id="liabilitiesList" className="networth-list">
                  {netWorthData.liabilities.length ? (
                    netWorthData.liabilities.map((item) => (
                      <li className="networth-item" key={`liability-${item.id}-${item.name}`}>
                        <span className="networth-item__name">{item.name}</span>
                        <span>{formatMoney(item.amount, netWorthData.currency)}</span>
                        <button
                          className="networth-item__remove"
                          type="button"
                          disabled={item.source === "plaid"}
                          title={item.source === "plaid" ? "Remove this account from the Profile page to exclude it from net worth." : undefined}
                          onClick={() => removeNetWorthItem(item)}
                        >
                          {item.source === "plaid" ? "Linked" : "Remove"}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="subtle">No items yet.</li>
                  )}
                </ul>
                <form className="networth-form" id="liabilityForm" onSubmit={(event) => addNetWorthItem("liability", event)}>
                  <input
                    type="text"
                    id="liabilityName"
                    placeholder="Liability name (e.g., Credit Card)"
                    value={netWorthForm.liability.name}
                    onChange={(event) => setNetWorthForm((next) => ({ ...next, liability: { ...next.liability, name: event.target.value } }))}
                    required
                  />
                  <input
                    type="number"
                    id="liabilityAmount"
                    placeholder="Amount"
                    min="0"
                    step="0.01"
                    value={netWorthForm.liability.amount}
                    onChange={(event) => setNetWorthForm((next) => ({ ...next, liability: { ...next.liability, amount: event.target.value } }))}
                    required
                  />
                  <button className="btn" type="submit">Add</button>
                </form>
                <div className="breakdown-total">
                  <span>Total Liabilities</span>
                  <strong id="liabilitiesTotal">{formatMoney(netWorthData.liabilitiesTotal, netWorthData.currency)}</strong>
                </div>
              </div>
            </article>
          </div>
          {netWorthStatus && <p className="status-banner subtle is-error">{netWorthStatus}</p>}
        </section>

        {linkedAccounts.length > 0 && (
          <div className="kpi-toolbar" id="kpiBankWrap" aria-label="Account filter">
            <label className="subtle" htmlFor="kpiBankSelect">Account</label>
            <select id="kpiBankSelect" aria-label="Select account" defaultValue="all">
              <option value="all">All accounts</option>
              {linkedAccounts.map((account) => (
                <option value={account.id || account.name} key={account.id || account.name}>
                  {account.name || account.officialName || account.institutionName || "Linked account"}
                </option>
              ))}
            </select>
          </div>
        )}

        <section className="kpis" aria-label="Summary metrics">
          <article className="kpi card kpi--income">
            <h2>Total Income</h2>
            <p className="kpi-value" id="kpiIncome">{formatMoney(summary.totalIncome)}</p>
            <span className="kpi-sub" id="kpiPeriodIncome">This month</span>
          </article>
          <article className="kpi card kpi--spending">
            <h2>Total Spending</h2>
            <p className="kpi-value negative" id="kpiSpending">{formatMoney(summary.totalSpending)}</p>
            <span className="kpi-sub" id="kpiPeriodSpending">This month</span>
          </article>
          <article className="kpi card kpi--balance">
            <h2>Net Balance</h2>
            <p className="kpi-value" id="kpiBalance">{formatMoney(summary.netBalance)}</p>
            <span className="kpi-sub" id="kpiPeriodBalance">Income - Spending</span>
          </article>
        </section>

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
                  <path ref={velocityProgressRef} className="gauge-progress" id="spendVelocityProgress" d="M 20 100 A 80 80 0 0 1 180 100"></path>
                  <circle ref={velocityMarkerRef} className="gauge-marker" id="spendVelocityMarker" cx="20" cy="100" r="4"></circle>
                </svg>
                <div className="velocity-center">
                  <strong id="velocityPercent">{velocity.hasBudget ? `${Math.round(velocity.ratio * 100)}%` : "-"}</strong>
                  <span className="subtle">of budget used</span>
                </div>
              </div>
              <div className="velocity-metrics">
                <div className="velocity-row">
                  <span className="label">Budget</span>
                  <strong id="velocityBudget">{velocity.hasBudget ? formatMoney(velocity.budgetTotal) : "Set a budget"}</strong>
                </div>
                <div className="velocity-row">
                  <span className="label">Spent</span>
                  <strong id="velocitySpent">{formatMoney(velocity.spent)}</strong>
                </div>
                <div className="velocity-row">
                  <span className="label">Pace</span>
                  <strong id="velocityPace">{velocity.paceState}</strong>
                </div>
                <p className="chart-caption subtle" id="velocityCaption">
                  {velocity.hasBudget
                    ? `${velocity.daysElapsed}/${velocity.daysTotal} days - ${formatMoney(velocity.expected)} expected by now`
                    : "Set a monthly budget to track spend velocity."}
                </p>
                <a className="btn btn--link" href="/budgeting">
                  Adjust budget &rarr;
                </a>
              </div>
            </div>
          </div>

          <aside className="breakdown card">
            <div className="summary-header">
              <h3>Top spending categories</h3>
              <a className="btn btn--link" href="/reports">
                View report &rarr;
              </a>
            </div>
            <ul className="cat-list" id="topCategoriesList">
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
              Manage recurring &rarr;
            </a>
          </div>
          <div className="card upcoming-card">
            <div className="upcoming-list" id="recurringUpcomingHome">
              {recurring.length ? (
                recurring.map((item) => (
                  <div className="upcoming-item" key={item.id || `${item.name}-${item.date || item.nextRun}`}>
                    <div>
                      <div className="label">{item.name || "Recurring item"}</div>
                      <div className="meta">
                        {formatDate(item.date || item.nextRun)} - {item.category || "Uncategorized"}
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
              <tbody id="txnTbody">
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
                      <td>{record.note || "-"}</td>
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
        <div className="modal" id="addTxnModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div className="modal-content card">
            <h2 id="modalTitle">Add New Transaction</h2>
            <form className="txn-form" id="txnForm" onSubmit={handleSubmit}>
              <div className="form-row">
                <label>
                  <span>Type</span>
                  <select id="txnType" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value, category: "" })} required>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                <label>
                  <span>Date</span>
                  <input id="txnDate" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
                </label>
              </div>
              <div className="form-row form-row--with-list">
                <label>
                  <span>Amount</span>
                  <input
                    type="number"
                    id="txnAmount"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>Category</span>
                  <select id="txnCategory" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required>
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
                  <input id="txnNotes" type="text" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
                </label>
              </div>
              {txnStatus && <p id="txnStatus" className="status-banner subtle is-error">{txnStatus}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn btn--primary">
                  Save
                </button>
                <button type="button" className="btn" id="btnCancelModal" onClick={() => setModalOpen(false)}>
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

