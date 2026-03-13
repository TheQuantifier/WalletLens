// ========== HOME DASHBOARD LOGIC (with dynamic dashboard view) ==========
import { api } from "./api.js";

(() => {
  const CURRENCY_FALLBACK = "USD";
  const $ = (sel, root = document) => root.querySelector(sel);
  const BASE_EXPENSE_CATEGORIES = [
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

  const BASE_INCOME_CATEGORIES = [
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

  let userCustomCategories = { expense: [], income: [] };
  let allRecordsCache = [];
  let pendingCategorySelect = null;
  const LINKED_ACCOUNTS_KEY = "linked_accounts";
  const BANK_FILTER_KEY = "home_bank_filter";
  let currentComputed = null;
  let currentNetWorth = null;
  let currentViewLabel = "This Month";
  let currentSpendVelocity = null;

  const NETWORTH_ITEMS_KEY = "netWorthItems";

  const setText = (sel, value) => {
    const el = $(sel);
    if (el) el.textContent = value;
  };

  const showTxnStatus = (msg, kind = "ok") => {
    const el = $("#txnStatus");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("is-hidden");
    el.classList.toggle("is-ok", kind === "ok");
    el.classList.toggle("is-error", kind === "error");
  };

  const clearTxnStatus = () => {
    const el = $("#txnStatus");
    if (!el) return;
    el.textContent = "";
    el.classList.add("is-hidden");
    el.classList.remove("is-ok", "is-error");
  };

  // Avoid injecting unsanitized user content into innerHTML
  const escapeHTML = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const debounce = (fn, delay = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  const fmtMoney = (value, currency) => {
    const num = Number(value);
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || CURRENCY_FALLBACK,
    }).format(Number.isFinite(num) ? num : 0);
  };

  const fmtPercent = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${(num * 100).toFixed(1)}%`;
  };

  const getCSSVar = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const fmtDate = (iso) =>
    new Date(iso + (iso?.length === 10 ? "T00:00:00" : ""))
      .toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });

  const safeFmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso + (iso?.length === 10 ? "T00:00:00" : ""));
    if (Number.isNaN(d.getTime())) return "—";
    return fmtDate(iso);
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const formatMonthKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const normalizeName = (name) => String(name || "").trim().toLowerCase();

  const normalizeCategoryList = (list) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list
      .map((c) => String(c || "").trim())
      .filter((c) => {
        if (!c) return false;
        const key = c.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const loadLinkedAccounts = () => {
    const raw = localStorage.getItem(LINKED_ACCOUNTS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getAccountBalance = (account) => {
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
  };

  const sumAccountBalances = (accounts) =>
    (accounts || []).reduce((sum, acc) => sum + getAccountBalance(acc), 0);

  const loadNetWorthItems = async () => {
    try {
      const data = await api.netWorth.list();
      const items = Array.isArray(data?.items) ? data.items : data;
      return Array.isArray(items) ? items : [];
    } catch {
      const raw = localStorage.getItem(NETWORTH_ITEMS_KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
  };

  const saveNetWorthItems = (items) => {
    localStorage.setItem(NETWORTH_ITEMS_KEY, JSON.stringify(items || []));
  };

  const splitNetWorthItems = (items) => {
    const assets = [];
    const liabilities = [];
    (items || []).forEach((item) => {
      if (!item || !item.name || !Number.isFinite(Number(item.amount))) return;
      const payload = { ...item, amount: Number(item.amount) };
      if (item.type === "liability") liabilities.push(payload);
      else assets.push(payload);
    });
    assets.sort((a, b) => b.amount - a.amount);
    liabilities.sort((a, b) => b.amount - a.amount);
    return { assets, liabilities };
  };

  const getRecordBankId = (record) =>
    record?.bankId ||
    record?.accountId ||
    record?.institutionId ||
    record?.bank_id ||
    record?.account_id ||
    record?.institution_id ||
    "";

  const filterRecordsByBank = (records, bankId) => {
    if (!bankId || bankId === "all") return records;
    return (records || []).filter((r) => getRecordBankId(r) === bankId);
  };

  const loadUserCustomCategories = async () => {
    try {
      const me = await api.auth.me();
      const expList =
        me?.user?.custom_expense_categories ??
        me?.user?.customExpenseCategories ??
        [];
      const incList =
        me?.user?.custom_income_categories ??
        me?.user?.customIncomeCategories ??
        [];
      userCustomCategories = {
        expense: normalizeCategoryList(expList),
        income: normalizeCategoryList(incList),
      };
    } catch {
      userCustomCategories = { expense: [], income: [] };
    }
  };

  const populateCategorySelect = () => {
    const select = $("#txnCategory");
    if (!select) return;
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a category";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    const type = $("#txnType")?.value === "income" ? "income" : "expense";
    const base =
      type === "income" ? BASE_INCOME_CATEGORIES : BASE_EXPENSE_CATEGORIES;
    const merged = [...base];
    (userCustomCategories[type] || []).forEach((name) => {
      if (!merged.some((c) => normalizeName(c) === normalizeName(name))) {
        merged.push(name);
      }
    });

    merged
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
      });

    renderCustomCategoryList(type);
  };

  const renderCustomCategoryList = (type) => {
    const listEl = $("#txnCustomCategories");
    if (!listEl) return;
    listEl.innerHTML = "";

    const base =
      type === "income" ? BASE_INCOME_CATEGORIES : BASE_EXPENSE_CATEGORIES;
    const normalizedDefaults = new Set(base.map((c) => normalizeName(c)));
    const custom = (userCustomCategories[type] || []).filter(
      (name) => !normalizedDefaults.has(normalizeName(name))
    );

    if (!custom.length) return;

    custom.forEach((name) => {
      const row = document.createElement("div");
      row.className = "custom-category-item";

      const label = document.createElement("span");
      label.textContent = name;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "custom-category-delete";
      del.dataset.category = name;
      del.setAttribute("aria-label", `Delete ${name}`);
      del.textContent = "✕";

      row.appendChild(label);
      row.appendChild(del);
      listEl.appendChild(row);
    });
  };

  const removeCategoryFromSelect = (name) => {
    const select = $("#txnCategory");
    if (!select) return;
    Array.from(select.options).forEach((opt) => {
      if (opt.value === name) opt.remove();
    });
    if (select.value === name) select.value = "";
  };

  const purgeCategoryFromAllMonths = (name) => {
    const key = normalizeName(name);
    const keys = Object.keys(localStorage);
    keys.forEach((k) => {
      if (!k.startsWith("budgeting_categories_")) return;
      const raw = localStorage.getItem(k);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const filtered = parsed.filter(
          (c) => normalizeName(c?.name) !== key
        );
        localStorage.setItem(k, JSON.stringify(filtered));
      } catch {
        // ignore bad payloads
      }
    });
  };

  const deleteCustomCategory = async (name, type) => {
    const normalized = normalizeName(name);
    if (!normalized) return;

    let records = allRecordsCache;
    if (!records.length) {
      try {
        records = await api.records.getAll();
      } catch {
        records = [];
      }
    }

    const inUse = records.some(
      (r) => r.type === type && normalizeName(r.category) === normalized
    );
    if (inUse) {
      window.alert(
        "Error: could not delete. Custom category is being used by records."
      );
      return;
    }

    userCustomCategories = {
      ...userCustomCategories,
      [type]: (userCustomCategories[type] || []).filter(
        (c) => normalizeName(c) !== normalized
      ),
    };

    try {
      await api.auth.updateProfile({
        customExpenseCategories: userCustomCategories.expense || [],
        customIncomeCategories: userCustomCategories.income || [],
      });
    } catch (err) {
      console.warn("Failed to delete custom category:", err);
    }

    purgeCategoryFromAllMonths(name);
    populateCategorySelect();
    removeCategoryFromSelect(name);
  };

  // ============================================================
  //  FILTER RECORDS BY DASHBOARD VIEW
  // ============================================================
  function filterRecordsByView(records, view) {
    if (view === "All" || view === "All Time") return records;

    const now = new Date();
    return records.filter((r) => {
      if (!r.date) return false;
      const d = new Date(r.date);

      switch (view) {
        case "Weekly": {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          return d >= startOfWeek && d <= endOfWeek;
        }

        case "Monthly":
          return (
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
          );

        case "Yearly":
          return d.getFullYear() === now.getFullYear();

        default:
          return true;
      }
    });
  }

  function computeMonthlyProjection(records) {
    const now = new Date();
    const monthRecords = filterRecordsByView(records, "Monthly");
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = Math.max(1, now.getDate());
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

    const totalIncome = monthRecords
      .filter((r) => r.type === "income")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalSpending = monthRecords
      .filter((r) => r.type === "expense")
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    const currentNetSaved = totalIncome - totalSpending;
    const avgIncomePerDay = totalIncome / daysElapsed;
    const avgSpendingPerDay = totalSpending / daysElapsed;
    const projectedAdditionalSavings = (avgIncomePerDay - avgSpendingPerDay) * daysRemaining;
    const assumedGrowthRate = 0;
    const projectedSavings = currentNetSaved + projectedAdditionalSavings;

    return {
      projectedSavings,
      currentNetSaved,
      projectedAdditionalSavings,
      assumedGrowthRate,
      daysElapsed,
      daysInMonth,
      daysRemaining,
      totalIncome,
      totalSpending,
    };
  }

  // ============================================================
  //  SPEND VELOCITY + TOP CATEGORIES
  // ============================================================
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

  const sumBudgetSheet = (sheet) => {
    if (!sheet) return 0;
    const standard = BUDGET_COLUMNS.reduce((sum, key) => {
      const val = Number(sheet?.[key] ?? 0);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);
    const custom = Array.isArray(sheet.custom_categories)
      ? sheet.custom_categories.reduce((sum, entry) => {
          const val = Number(entry?.amount ?? 0);
          return sum + (Number.isFinite(val) ? val : 0);
        }, 0)
      : 0;
    return standard + custom;
  };

  const getPeriodProgress = (range) => {
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
    const daysTotal = Math.max(1, Math.round(totalMs / 86400000) + 1);
    const daysElapsed = Math.max(1, Math.round(elapsedMs / 86400000) + 1);
    return { daysElapsed, daysTotal };
  };

  async function loadSpendVelocity() {
    const cadence = "monthly";
    const period = formatMonthKey(new Date());
    try {
      const sheet = await api.budgetSheets.lookup({ cadence, period });
      const summary = await api.budgetSheets.summary({ cadence, period });
      const budgetTotal = sumBudgetSheet(sheet);
      const spent = Number(summary?.totals?.totalSpent || 0);
      return {
        hasBudget: budgetTotal > 0,
        budgetTotal,
        spent,
        range: summary?.range,
      };
    } catch {
      return { hasBudget: false, budgetTotal: 0, spent: 0, range: null };
    }
  }

  function renderSpendVelocity(data, currency = CURRENCY_FALLBACK) {
    setText("#velocityPeriodLabel", "This month");
    const percentEl = $("#velocityPercent");
    const budgetEl = $("#velocityBudget");
    const spentEl = $("#velocitySpent");
    const paceEl = $("#velocityPace");
    const captionEl = $("#velocityCaption");
    const progressEl = $("#spendVelocityProgress");
    const markerEl = $("#spendVelocityMarker");

    if (!percentEl || !budgetEl || !spentEl || !paceEl || !progressEl || !markerEl) return;

    if (!data?.hasBudget) {
      percentEl.textContent = "—";
      budgetEl.textContent = "Set a budget";
      spentEl.textContent = fmtMoney(data?.spent || 0, currency);
      paceEl.textContent = "—";
      if (captionEl) {
        captionEl.textContent = "Set a monthly budget to track spend velocity.";
      }
      progressEl.style.strokeDasharray = "0 1";
      progressEl.style.strokeDashoffset = "0";
      markerEl.setAttribute("cx", "20");
      markerEl.setAttribute("cy", "100");
      return;
    }

    const budgetTotal = Number(data.budgetTotal || 0);
    const spent = Number(data.spent || 0);
    const ratio = budgetTotal > 0 ? spent / budgetTotal : 0;
    const { daysElapsed, daysTotal } = getPeriodProgress(data.range);
    const paceRatio = clamp(daysElapsed / daysTotal, 0, 1);
    const expected = budgetTotal * paceRatio;

    percentEl.textContent = `${Math.round(ratio * 100)}%`;
    budgetEl.textContent = fmtMoney(budgetTotal, currency);
    spentEl.textContent = fmtMoney(spent, currency);

    const paceDiff = spent - expected;
    const paceState =
      Math.abs(paceDiff) < budgetTotal * 0.03
        ? "On pace"
        : paceDiff > 0
        ? "Over pace"
        : "Under pace";
    paceEl.textContent = paceState;

    if (captionEl) {
      captionEl.textContent = `${daysElapsed}/${daysTotal} days · ${fmtMoney(
        expected,
        currency
      )} expected by now`;
    }

    const arcLength = progressEl.getTotalLength();
    const clamped = clamp(ratio, 0, 1);
    progressEl.style.strokeDasharray = `${arcLength} ${arcLength}`;
    progressEl.style.strokeDashoffset = `${arcLength * (1 - clamped)}`;
    progressEl.classList.toggle("is-over", ratio > 1);

    const angle = Math.PI * (1 - paceRatio);
    const centerX = 100;
    const centerY = 100;
    const radius = 80;
    const markerX = centerX + radius * Math.cos(angle);
    const markerY = centerY - radius * Math.sin(angle);
    markerEl.setAttribute("cx", markerX.toFixed(2));
    markerEl.setAttribute("cy", markerY.toFixed(2));
  }

  // ============================================================
  //  NET WORTH LINE CHART
  // ============================================================
  function hexToRgba(hex, alpha) {
    const cleaned = hex.replace("#", "");
    if (cleaned.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function drawNetWorthChart(canvas, series, currency) {
    if (!canvas) return;
    const parent = canvas.parentElement || canvas;
    const parentWidth = parent.clientWidth || 600;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = parentWidth * dpr;
    canvas.height = 260 * dpr;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, parentWidth, 260);

    if (!series?.length) return;

    const P = { t: 20, r: 20, b: 45, l: 78 };
    const innerW = canvas.width / dpr - P.l - P.r;
    const innerH = canvas.height / dpr - P.t - P.b;

    const values = series.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(1, (max - min) * 0.1);
    const yMin = min - pad;
    const yMax = max + pad;

    const primary = getCSSVar("--primary") || "#0057b8";
    const accent = getCSSVar("--accent") || "#00a3e0";

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(P.l, P.t + innerH);
    ctx.lineTo(P.l + innerW, P.t + innerH);
    ctx.stroke();

    const stepX = innerW / Math.max(series.length - 1, 1);
    const points = series.map((p, i) => {
      const x = P.l + stepX * i;
      const y = P.t + innerH - ((p.value - yMin) / (yMax - yMin)) * innerH;
      return { x, y };
    });

    ctx.beginPath();
    points.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(P.l + innerW, P.t + innerH);
    ctx.lineTo(P.l, P.t + innerH);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(primary, 0.12);
    ctx.fill();

    ctx.fillStyle = accent;
    points.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#6b7280";
    ctx.font = "12px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(fmtMoney(yMax, currency), P.l - 10, P.t + 4);
    ctx.fillText(fmtMoney(yMin, currency), P.l - 10, P.t + innerH);

    ctx.textAlign = "center";
    series.forEach((p, i) => {
      if (i % 2 === 1 && series.length > 4) return;
      const x = P.l + stepX * i;
      ctx.fillText(p.label, x, P.t + innerH + 20);
    });

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Month", P.l + innerW / 2, P.t + innerH + 38);
    ctx.save();
    ctx.translate(28, P.t + innerH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Net Worth", 0, 0);
    ctx.restore();

    canvas.__netWorthSeries = series;
    canvas.__netWorthCurrency = currency;
    canvas.__netWorthDims = {
      P,
      innerW,
      innerH,
      yMin,
      yMax,
      stepX,
      dpr,
      parentWidth,
    };

    if (!canvas.__netWorthHoverBound) {
      canvas.__netWorthHoverBound = true;
      canvas.addEventListener("mousemove", (e) => {
        const s = canvas.__netWorthSeries;
        const dims = canvas.__netWorthDims;
        if (!s?.length || !dims) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const index = Math.round((x - dims.P.l) / dims.stepX);
        const clamped = Math.max(0, Math.min(s.length - 1, index));
        drawNetWorthChart(canvas, s, canvas.__netWorthCurrency);
        const ctxHover = canvas.getContext("2d");
        ctxHover.setTransform(1, 0, 0, 1, 0, 0);
        ctxHover.scale(dims.dpr, dims.dpr);

        const pointX = dims.P.l + dims.stepX * clamped;
        const value = s[clamped].value;
        const pointY =
          dims.P.t +
          dims.innerH -
          ((value - dims.yMin) / (dims.yMax - dims.yMin)) * dims.innerH;

        ctxHover.strokeStyle = "rgba(255,255,255,0.35)";
        ctxHover.lineWidth = 1;
        ctxHover.beginPath();
        ctxHover.moveTo(pointX, dims.P.t);
        ctxHover.lineTo(pointX, dims.P.t + dims.innerH);
        ctxHover.stroke();

        ctxHover.fillStyle = "#ffffff";
        ctxHover.beginPath();
        ctxHover.arc(pointX, pointY, 4, 0, Math.PI * 2);
        ctxHover.fill();

        const label = fmtMoney(value, canvas.__netWorthCurrency);
        ctxHover.font = "600 12px system-ui";
        const pad = 6;
        const textW = ctxHover.measureText(label).width;
        const boxW = textW + pad * 2;
        const boxH = 22;
        const boxX = Math.min(
          Math.max(dims.P.l, pointX - boxW / 2),
          dims.P.l + dims.innerW - boxW
        );
        const boxY = Math.max(dims.P.t, pointY - 30);

        ctxHover.fillStyle = "rgba(17,24,39,0.75)";
        ctxHover.beginPath();
        if (ctxHover.roundRect) {
          ctxHover.roundRect(boxX, boxY, boxW, boxH, 6);
        } else {
          ctxHover.rect(boxX, boxY, boxW, boxH);
        }
        ctxHover.fill();

        ctxHover.fillStyle = "#ffffff";
        ctxHover.textAlign = "center";
        ctxHover.textBaseline = "middle";
        ctxHover.fillText(label, boxX + boxW / 2, boxY + boxH / 2);
      });

      canvas.addEventListener("mouseleave", () => {
        const s = canvas.__netWorthSeries;
        if (!s?.length) return;
        drawNetWorthChart(canvas, s, canvas.__netWorthCurrency);
      });
    }
  }

  function renderTopCategories(listEl, categories, currency) {
    if (!listEl) return;
    listEl.innerHTML = "";

    const entries = Object.entries(categories || {}).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      const li = document.createElement("li");
      li.className = "subtle";
      li.textContent = "No spending yet.";
      listEl.appendChild(li);
      return;
    }

    const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
    entries.slice(0, 3).forEach(([name, amt]) => {
      const li = document.createElement("li");
      const left = document.createElement("span");
      left.textContent = name;
      const right = document.createElement("span");
      right.textContent = `${fmtMoney(amt, currency)} • ${fmtPercent(amt / total)}`;
      li.appendChild(left);
      li.appendChild(right);
      listEl.appendChild(li);
    });
  }

  function renderUpcomingRecurring(listEl, items) {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!items?.length) {
      listEl.innerHTML = '<p class="subtle">No upcoming recurring items.</p>';
      return;
    }
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "upcoming-item";
      const amount = fmtMoney(item.amount, item.currency || CURRENCY_FALLBACK);
      const dateLabel = safeFmtDate(item.date || item.nextRun);
      const categoryLabel = item.category || "Uncategorized";
      row.innerHTML = `
        <div>
          <div class="label">${escapeHTML(item.name || "Recurring item")}</div>
          <div class="meta">${dateLabel} · ${escapeHTML(categoryLabel)}</div>
        </div>
        <div>${amount}</div>
      `;
      listEl.appendChild(row);
    });
  }

  async function loadUpcomingRecurring() {
    const listEl = $("#recurringUpcomingHome");
    if (!listEl) return;
    try {
      const res = await api.recurring.upcoming({ days: 30 });
      const items = Array.isArray(res) ? res : (res?.items || res?.data || []);
      renderUpcomingRecurring(listEl, items);
    } catch (err) {
      console.warn("Failed to load upcoming recurring:", err);
      listEl.innerHTML = '<p class="subtle">Upcoming recurring is unavailable right now.</p>';
    }
  }

  // ============================================================
  //  COMPUTE SUMMARY
  // ============================================================
  function computeOverview(records) {
    const expenses = records.filter((r) => r.type === "expense");
    const income = records.filter((r) => r.type === "income");

    const currency = CURRENCY_FALLBACK;

    const total_spending = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
    const total_income = income.reduce((s, r) => s + Number(r.amount || 0), 0);
    const net_balance = total_income - total_spending;

    const categories = expenses.reduce((acc, r) => {
      const key = r.category || "Uncategorized";
      acc[key] = (acc[key] || 0) + Number(r.amount || 0);
      return acc;
    }, {});

    const dates = records.map((r) => r.date).filter(Boolean);
    const latestISO = dates.length ? dates.sort().slice(-1)[0] : null;

    return {
      total_spending,
      total_income,
      net_balance,
      categories,
      currency,
      last_updated: latestISO || new Date().toISOString(),
    };
  }

  function buildCashflowTrend(records, monthsBack = 6) {
    const now = new Date();
    const months = [];
    for (let i = monthsBack - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString(undefined, { month: "short" }),
        net: 0,
      });
    }

    records.forEach((r) => {
      if (!r.date) return;
      const d = new Date(r.date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = months.find((m) => m.key === key);
      if (!bucket) return;
      const amt = Number(r.amount || 0);
      bucket.net += r.type === "income" ? amt : -amt;
    });

    return months;
  }

  // ============================================================
  //  NET WORTH DATA + RENDER
  // ============================================================
  function buildMonthlyNet(records, monthsBack = 12) {
    const now = new Date();
    const months = [];
    for (let i = monthsBack - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString(undefined, { month: "short" }),
        net: 0,
      });
    }

    records.forEach((r) => {
      if (!r.date) return;
      const d = new Date(r.date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = months.find((m) => m.key === key);
      if (!bucket) return;
      const amt = Number(r.amount || 0);
      bucket.net += r.type === "income" ? amt : -amt;
    });

    return months;
  }

  async function getNetWorthData(records, currency) {
    const items = await loadNetWorthItems();
    const { assets, liabilities } = splitNetWorthItems(items);
    const hasData = assets.length > 0 || liabilities.length > 0;
    const assetsTotal = assets.reduce((s, a) => s + a.amount, 0);
    const liabilitiesTotal = liabilities.reduce((s, l) => s + l.amount, 0);
    const netWorthNow = assetsTotal - liabilitiesTotal;

    const months = buildMonthlyNet([], 12);
    const trend = hasData
      ? months.map((m) => ({ label: m.label, value: netWorthNow }))
      : [];

    return {
      currency,
      asOf: hasData ? new Date().toISOString() : null,
      assets,
      liabilities,
      trend,
      baseBalance: 0,
      hasData,
    };
  }

  function renderNetWorth(data) {
    if (!data) return;
    const assetsTotal = (data.assets || []).reduce((s, a) => s + a.amount, 0);
    const liabilitiesTotal = (data.liabilities || []).reduce((s, l) => s + l.amount, 0);
    const netWorth = assetsTotal - liabilitiesTotal;

    if (!data.hasData && !data.assets?.length && !data.liabilities?.length && !data.trend?.length) {
      setText("#netWorthTotal", "—");
      setText("#assetsTotal", "—");
      setText("#liabilitiesTotal", "—");
      setText("#netWorthDelta", "Connect accounts to see your net worth trend.");
      setText("#netWorthUpdated", "No net worth data yet");
    } else {
      setText("#netWorthTotal", fmtMoney(netWorth, data.currency));
      setText("#assetsTotal", fmtMoney(assetsTotal, data.currency));
      setText("#liabilitiesTotal", fmtMoney(liabilitiesTotal, data.currency));

      const deltaBase = data.trend?.length ? data.trend[0].value : netWorth;
      const delta = netWorth - deltaBase;
      const deltaLabel = delta >= 0 ? "up" : "down";
      setText(
        "#netWorthDelta",
        `${delta >= 0 ? "+" : "-"}${fmtMoney(Math.abs(delta), data.currency)} ${deltaLabel} vs previous period`
      );
      setText(
        "#netWorthUpdated",
        data.asOf ? `Updated ${new Date(data.asOf).toLocaleDateString()}` : "No net worth data yet"
      );
    }

    const assetsList = $("#assetsList");
    const liabilitiesList = $("#liabilitiesList");
    if (assetsList) assetsList.innerHTML = "";
    if (liabilitiesList) liabilitiesList.innerHTML = "";

    const renderList = (el, items, type) => {
      if (!el) return;
      if (!items?.length) {
        const li = document.createElement("li");
        li.className = "subtle";
        li.textContent = "No items yet.";
        el.appendChild(li);
        return;
      }
      items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "networth-item";
        const name = document.createElement("span");
        name.className = "networth-item__name";
        name.textContent = item.name;
        const value = document.createElement("span");
        value.textContent = fmtMoney(item.amount, data.currency);
        const del = document.createElement("button");
        del.type = "button";
        del.className = "networth-item__remove";
        del.textContent = "Remove";
        del.addEventListener("click", () => removeNetWorthItem(item.id));
        li.appendChild(name);
        li.appendChild(value);
        li.appendChild(del);
        el.appendChild(li);
      });
    };

    renderList(assetsList, data.assets, "asset");
    renderList(liabilitiesList, data.liabilities, "liability");

    if (data.trend?.length) {
      drawNetWorthChart($("#netWorthChart"), data.trend, data.currency);
    }
  }

  const addNetWorthItem = async (type, name, amount) => {
    try {
      const res = await api.netWorth.create({ type, name, amount });
      return res?.item || null;
    } catch {
      const items = await loadNetWorthItems();
      const next = {
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        type,
        name: String(name || "").trim(),
        amount: Number(amount),
        createdAt: new Date().toISOString(),
      };
      items.push(next);
      saveNetWorthItems(items);
      return next;
    }
  };

  const removeNetWorthItem = async (id) => {
    try {
      await api.netWorth.remove(id);
    } catch {
      const items = await loadNetWorthItems();
      const next = items.filter((item) => item.id !== id);
      saveNetWorthItems(next);
    }
    window.location.reload();
  };

  function setupBankFilter(accounts, onChange) {
    const wrap = $("#kpiBankWrap");
    const select = $("#kpiBankSelect");
    if (!wrap || !select) return "all";

    if (!accounts?.length) {
      wrap.style.display = "none";
      return "all";
    }

    wrap.style.display = "flex";
    select.innerHTML = "";

    const options = [{ id: "all", name: "All accounts" }, ...accounts];
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.id;
      option.textContent = opt.name || opt.id;
      select.appendChild(option);
    });

    const saved = localStorage.getItem(BANK_FILTER_KEY) || "all";
    const valid = options.some((opt) => opt.id === saved) ? saved : "all";
    select.value = valid;

    select.addEventListener("change", () => {
      localStorage.setItem(BANK_FILTER_KEY, select.value || "all");
      if (typeof onChange === "function") onChange();
    });

    return valid;
  }

  const getSelectedBankId = () => {
    const select = $("#kpiBankSelect");
    return select?.value || "all";
  };

  function renderKpis(comp, viewLabel, projection) {
    setText("#kpiIncome", fmtMoney(comp.total_income, comp.currency));
    setText("#kpiSpending", fmtMoney(comp.total_spending, comp.currency));
    setText("#kpiBalance", fmtMoney(comp.net_balance, comp.currency));
    setText("#heroProjectedSavings", fmtMoney(projection.projectedSavings, comp.currency));

    setText("#kpiPeriodIncome", viewLabel);
    setText("#kpiPeriodSpending", viewLabel);
    setText("#kpiPeriodBalance", viewLabel);
    setText(
      "#heroProjectedDelta",
      `${projection.daysRemaining} projected days at current pace`
    );

    setText(
      "#lastUpdated",
      "Data updated " + new Date(comp.last_updated).toLocaleString()
    );

    const projectedSavingsEl = $("#heroProjectedSavings");
    if (projectedSavingsEl) {
      const projectedSavings = Number(projection.projectedSavings) || 0;
      const projectedIncome = Number(projection.totalIncome) || 0;
      const projectedRatio =
        projectedIncome > 0 ? projectedSavings / projectedIncome : projectedSavings > 0 ? 1 : 0;
      const projectedGradientProgress =
        projectedSavings < 0
          ? clamp(
              (projectedSavings + Math.max(projectedIncome, Math.abs(projectedSavings), 1)) /
                Math.max(projectedIncome, Math.abs(projectedSavings), 1),
              0,
              1
            ) * 0.25
          : 0.25 + clamp(projectedRatio / 0.1, 0, 1) * 0.75;
      const projectedHue = projectedGradientProgress * 145;
      const projectedLightness = 46 - projectedGradientProgress * 6;

      projectedSavingsEl.classList.add("value--gradient");
      projectedSavingsEl.style.setProperty(
        "--cashflow-color",
        `hsl(${projectedHue} 78% ${projectedLightness}%)`
      );
    }

    const cashflowEl = $("#heroCashflowHealth");
    const cashflowDeltaEl = $("#heroCashflowDelta");
    if (cashflowEl) {
      const income = Number(comp.total_income) || 0;
      const spending = Number(comp.total_spending) || 0;
      const netCashflow = income - spending;
      const surplusRatio = income > 0 ? netCashflow / income : netCashflow > 0 ? 1 : 0;
      const gradientProgress =
        netCashflow < 0
          ? clamp((netCashflow + Math.max(income, spending, 1)) / Math.max(income, spending, 1), 0, 1) * 0.25
          : 0.25 + clamp(surplusRatio / 0.1, 0, 1) * 0.75;
      const hue = gradientProgress * 145;
      const lightness = 46 - gradientProgress * 6;

      cashflowEl.textContent = fmtMoney(netCashflow, comp.currency);
      cashflowEl.classList.add("value--gradient");
      cashflowEl.style.setProperty("--cashflow-color", `hsl(${hue} 78% ${lightness}%)`);

      if (cashflowDeltaEl) {
        if (netCashflow < 0) {
          if (income <= 0) {
            cashflowDeltaEl.textContent = "Deficit: 100.0%+ of income";
          } else {
            cashflowDeltaEl.textContent = `Deficit: ${Math.abs(surplusRatio * 100).toFixed(1)}% of income`;
          }
        } else if (income <= 0) {
          cashflowDeltaEl.textContent = "No income recorded in this view";
        } else if (surplusRatio === 0) {
          cashflowDeltaEl.textContent = "Break-even: 0.0% of income left after spending";
        } else if (surplusRatio < 0.1) {
          cashflowDeltaEl.textContent = `Orange zone: ${(surplusRatio * 100).toFixed(1)}% of income left after spending`;
        } else {
          cashflowDeltaEl.textContent = `Healthy surplus: ${(surplusRatio * 100).toFixed(1)}% of income left after spending`;
        }
      }
    }

    const getSpendingHue = (ratio) => {
      const clamped = Math.max(0, Math.min(1, ratio));
      if (clamped <= 0.6) return 120;
      if (clamped >= 0.8) return 0;
      const t = (clamped - 0.6) / 0.2;
      return 120 - t * 120;
    };

    const spendingEl = $("#kpiSpending");
    if (spendingEl) {
      spendingEl.classList.remove("kpi-good", "kpi-warn", "kpi-alert", "kpi-bad");
      const income = Number(comp.total_income) || 0;
      const spending = Number(comp.total_spending) || 0;
      const ratio = income > 0 ? spending / income : spending > 0 ? 1 : 0;
      const hue = getSpendingHue(ratio);
      spendingEl.style.color = `hsl(${hue} 80% 40%)`;
    }

    const incomeEl = $("#kpiIncome");
    if (incomeEl) {
      const income = Number(comp.total_income) || 0;
      const spending = Number(comp.total_spending) || 0;
      if (spending > income && spending > 0) {
        incomeEl.style.color = "var(--bad)";
      } else if (income > 0) {
        const ratio = income > 0 ? spending / income : 0;
        const hue = getSpendingHue(ratio);
        incomeEl.style.color = `hsl(${hue} 80% 40%)`;
      } else {
        incomeEl.style.color = "";
      }
    }

    const balanceEl = $("#kpiBalance");
    if (balanceEl) {
      const income = Number(comp.total_income) || 0;
      const spending = Number(comp.total_spending) || 0;
      const netBalance = Number(comp.net_balance) || 0;
      if (netBalance < 0) {
        balanceEl.style.color = "var(--bad)";
      } else {
        const ratio = income > 0 ? spending / income : spending > 0 ? 1 : 0;
        const hue = Math.max(30, getSpendingHue(ratio));
        balanceEl.style.color = `hsl(${hue} 80% 40%)`;
      }
    }
  }

  // ============================================================
  //  TABLE
  // ============================================================
  function renderExpensesTable(tbody, records, currency) {
    if (!tbody) return;
    tbody.innerHTML = "";

    const expenses = records
      .filter((r) => r.type === "expense")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);

    if (!expenses.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.className = "subtle";
      td.textContent = "No expenses yet.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    expenses.forEach((txn) => {
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = fmtDate(txn.date);

      const tdCat = document.createElement("td");
      tdCat.textContent = txn.category || "";

      const tdAmt = document.createElement("td");
      tdAmt.className = "num";
      tdAmt.textContent = fmtMoney(txn.amount, currency);

      const tdNote = document.createElement("td");
      tdNote.textContent = txn.note || "";

      tr.appendChild(tdDate);
      tr.appendChild(tdCat);
      tr.appendChild(tdAmt);
      tr.appendChild(tdNote);

      tbody.appendChild(tr);
    });
  }

  // ============================================================
  //  CSV EXPORT
  // ============================================================
  function exportRecordsToCSV(records) {
    if (!records || !records.length) {
      alert("No records available to export.");
      return;
    }

    const headers = ["Date", "Type", "Category", "Amount", "Notes"];
    const rows = [headers.join(",")];

    records.forEach((r) => {
      const date = r.date ? new Date(r.date).toISOString().split("T")[0] : "";
      const type = r.type || "";
      const category = (r.category || "").replace(/,/g, ";");
      const amount = r.amount ?? "";
      const notes = (r.note || "").replace(/,/g, ";");
      rows.push([date, type, category, amount, notes].join(","));
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download =
      `finance_records_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  // ============================================================
  //  API LOADER
  // ============================================================
  async function loadFromAPI() {
    const records = await api.records.getAll();
    allRecordsCache = Array.isArray(records) ? records : [];
    return records;
  }

  // ============================================================
  //  UI ACTIONS
  // ============================================================
  function wireActions() {
    const modal = $("#addTxnModal");
    const form = $("#txnForm");
    const btnCancel = $("#btnCancelModal");
    const customCategoryModal = $("#customCategoryModal");
    const customCategoryForm = $("#customCategoryForm");
    const customCategoryInput = $("#customCategoryInput");
    const cancelCustomCategoryBtn = $("#cancelCustomCategoryBtn");
    const customList = $("#txnCustomCategories");

    const btnAddTxn = $("#btnAddTxn");
    const assetForm = $("#assetForm");
    const liabilityForm = $("#liabilityForm");

    const closeModal = () => modal?.classList.add("hidden");
    const openModal = () => modal?.classList.remove("hidden");
    const openCustomModal = () => customCategoryModal?.classList.remove("hidden");
    const closeCustomModal = () => {
      if (pendingCategorySelect && pendingCategorySelect.value === "Other") {
        pendingCategorySelect.value = "";
      }
      customCategoryModal?.classList.add("hidden");
      pendingCategorySelect = null;
    };

    $("#btnUpload")?.addEventListener("click", () => {
      window.location.href = "upload.html";
    });

    $("#btnExport")?.addEventListener("click", async () => {
      try {
        const records = await api.records.getAll();
        exportRecordsToCSV(records);
      } catch (err) {
        alert("Failed to export CSV: " + err.message);
      }
    });

    btnAddTxn?.addEventListener("click", openModal);

    btnCancel?.addEventListener("click", closeModal);
    cancelCustomCategoryBtn?.addEventListener("click", closeCustomModal);

    // Close modal on ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) {
        closeModal();
      }
      if (e.key === "Escape" && customCategoryModal && !customCategoryModal.classList.contains("hidden")) {
        closeCustomModal();
      }
    });

    // Close modal when clicking the backdrop (but not the modal content)
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    customCategoryModal?.addEventListener("click", (e) => {
      if (e.target === customCategoryModal) closeCustomModal();
    });

    $("#txnCategory")?.addEventListener("change", (e) => {
      const select = e.target;
      if (select.value === "Other") {
        pendingCategorySelect = select;
        if (customCategoryInput) customCategoryInput.value = "";
        openCustomModal();
        customCategoryInput?.focus();
      }
    });

    $("#txnType")?.addEventListener("change", () => {
      populateCategorySelect();
    });

    customList?.addEventListener("click", (e) => {
      const btn = e.target.closest(".custom-category-delete");
      if (!btn) return;
      const type = $("#txnType")?.value === "income" ? "income" : "expense";
      deleteCustomCategory(btn.dataset.category || "", type);
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearTxnStatus();

      const newTxn = {
        type: $("#txnType").value,
        date: $("#txnDate").value,
        category: $("#txnCategory").value,
        amount: parseFloat($("#txnAmount").value),
        note: $("#txnNotes")?.value || "",
      };

      if (!newTxn.type || !newTxn.date) {
        showTxnStatus("Please select a type and date.", "error");
        return;
      }

      if (!Number.isFinite(newTxn.amount) || newTxn.amount <= 0) {
        showTxnStatus("Please enter a valid amount greater than 0.", "error");
        return;
      }

      try {
        await api.records.create(newTxn);
        showTxnStatus("Transaction added.", "ok");
        window.setTimeout(() => window.location.reload(), 600);
      } catch (err) {
        showTxnStatus("Failed to save transaction: " + err.message, "error");
      }
    });

    customCategoryForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!pendingCategorySelect) return;

      const raw = customCategoryInput?.value || "";
      const name = String(raw).trim();
      if (!name) {
        customCategoryInput?.focus();
        return;
      }

      const type = $("#txnType")?.value === "income" ? "income" : "expense";
      if (!userCustomCategories[type]?.some((c) => normalizeName(c) === normalizeName(name))) {
        userCustomCategories = {
          ...userCustomCategories,
          [type]: [...(userCustomCategories[type] || []), name],
        };
      }

      try {
        await api.auth.updateProfile({
          customExpenseCategories: userCustomCategories.expense || [],
          customIncomeCategories: userCustomCategories.income || [],
        });
      } catch (err) {
        console.warn("Failed to save custom category:", err);
      }

      populateCategorySelect();
      const select = $("#txnCategory");
      if (select) {
        select.value = name;
      }
      closeCustomModal();
    });

    assetForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#assetName")?.value || "";
      const amount = Number($("#assetAmount")?.value || 0);
      if (!name.trim() || !Number.isFinite(amount) || amount <= 0) return;
      await addNetWorthItem("asset", name, amount);
      window.location.reload();
    });

    liabilityForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#liabilityName")?.value || "";
      const amount = Number($("#liabilityAmount")?.value || 0);
      if (!name.trim() || !Number.isFinite(amount) || amount <= 0) return;
      await addNetWorthItem("liability", name, amount);
      window.location.reload();
    });
  }

  async function personalizeWelcome() {
    try {
      const { user } = await api.auth.me();
      const displayName = user?.fullName ?? user?.full_name ?? user?.username ?? "";
      setText("#welcomeTitle", `Welcome back, ${displayName}`);
    } catch {
      setText("#welcomeTitle", "Welcome back");
    }
  }

  // ============================================================
  //  INIT
  // ============================================================
  async function renderDashboard(records, dashboardView, accounts) {
    const viewLabel =
      dashboardView === "Weekly"
        ? "This Week"
        : dashboardView === "Monthly"
        ? "This Month"
        : dashboardView === "Yearly"
        ? "This Year"
        : dashboardView === "All" || dashboardView === "All Time"
        ? "All Time"
        : "This Month";
    currentViewLabel = viewLabel;

    const bankId = getSelectedBankId();
    const bankRecords = filterRecordsByBank(records, bankId);
    const filteredRecords = filterRecordsByView(bankRecords, dashboardView);

    const computed = computeOverview(filteredRecords);
    const projection = computeMonthlyProjection(bankRecords);
    const spendVelocity = await loadSpendVelocity();
    const netWorthData = await getNetWorthData(bankRecords, computed.currency);

    currentComputed = computed;
    currentNetWorth = netWorthData;
    currentSpendVelocity = spendVelocity;

    renderKpis(computed, viewLabel, projection);
    renderSpendVelocity(spendVelocity, computed.currency);
    renderNetWorth(netWorthData);
    renderExpensesTable($("#txnTbody"), filteredRecords, computed.currency);
    renderTopCategories($("#topCategoriesList"), computed.categories, computed.currency);
  }

  async function init() {
    await loadUserCustomCategories();
    populateCategorySelect();
    wireActions();
    await personalizeWelcome();

    try {
      const records = await loadFromAPI();

      const savedSettings =
        JSON.parse(localStorage.getItem("userSettings")) || {};
      const legacyView = savedSettings.dashboardView;
      const storedView =
        localStorage.getItem("settings_dashboard_view") ||
        localStorage.getItem("defaultDashboardView");
      const normalizedView =
        storedView === "All" ? "All Time" : storedView;
      const normalizedLegacy =
        legacyView === "All" ? "All Time" : legacyView;
      const dashboardView =
        normalizedView || normalizedLegacy || "All Time";
      const accounts = loadLinkedAccounts();

      setupBankFilter(accounts, () => {
        renderDashboard(records, dashboardView, accounts);
      });
      await renderDashboard(records, dashboardView, accounts);
      await loadUpcomingRecurring();

      const redraw = debounce(() => {
        if (!currentComputed) return;
        renderSpendVelocity(currentSpendVelocity, currentComputed.currency);
        if (currentNetWorth?.trend?.length) {
          drawNetWorthChart($("#netWorthChart"), currentNetWorth.trend, currentNetWorth.currency);
        }
      }, 150);

      window.addEventListener("resize", redraw);

      // Re-draw chart when theme changes so colors/labels stay readable
      window.addEventListener("storage", (e) => {
        if (e.key === "theme") redraw();
      });
    } catch (err) {
      console.error(err);
      setText("#lastUpdated", "Could not load data.");
      const tbody = $("#txnTbody");
      if (tbody) {
        tbody.innerHTML = "";
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.className = "subtle";
        td.textContent = "Failed to load records.";
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
