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
    "Subscriptions",
    "Travel",
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

  const getCSSVar = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const fmtDate = (iso) =>
    new Date(iso + (iso?.length === 10 ? "T00:00:00" : ""))
      .toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });

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

  const loadUserCustomCategories = async () => {
    try {
      const me = await api.auth.me();
      const expList =
        me?.user?.custom_expense_categories ??
        me?.user?.customExpenseCategories ??
        me?.user?.custom_categories ??
        me?.user?.customCategories ??
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

    merged.forEach((name) => {
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
    if (view === "All") return records; // NEW: All-time view

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

  // ============================================================
  //  SIMPLE BAR CHART
  // ============================================================
  function drawBarChart(canvas, dataObj) {
    if (!canvas) return;

    const parent = canvas.parentElement || canvas;
    const parentWidth = parent.clientWidth || 600;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = parentWidth * dpr;
    canvas.height = 300 * dpr;

    const ctx = canvas.getContext("2d");
    // Reset transforms so repeated draws (resize/theme redraw) never accumulate scaling.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const entries = Object.entries(dataObj || {});
    const labels = entries.map((e) => e[0]);
    const values = entries.map((e) => +e[1] || 0);
    const max = Math.max(1, ...values);

    // Clear in CSS pixels (since we've scaled the context).
    ctx.clearRect(0, 0, parentWidth, 300);

    const P = { t: 20, r: 20, b: 50, l: 40 };
    const innerW = canvas.width / dpr - P.l - P.r;
    const innerH = canvas.height / dpr - P.t - P.b;

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(P.l, P.t);
    ctx.lineTo(P.l, P.t + innerH);
    ctx.lineTo(P.l + innerW, P.t + innerH);
    ctx.stroke();

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const palette = isDark
      ? ["#60a5fa", "#38bdf8", "#818cf8", "#22d3ee", "#93c5fd", "#67e8f9", "#a5b4fc"]
      : ["#0057b8", "#00a3e0", "#1e3a8a", "#0ea5e9", "#2563eb", "#0891b2", "#3b82f6"];

    const gap = 14;
    const barW = Math.max(
      10,
      (innerW - gap * (values.length + 1)) / Math.max(values.length, 1)
    );

    values.forEach((v, i) => {
      const h = (v / max) * (innerH - 10);
      const x = P.l + gap + i * (barW + gap);
      const y = P.t + innerH - h;

      ctx.fillStyle = palette[i % palette.length];
      ctx.fillRect(x, y, barW, h);

      ctx.fillStyle = isDark ? "#fff" : "#111827";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(v.toFixed(2), x + barW / 2, y - 6);

      ctx.fillStyle = "#6b7280";
      ctx.save();
      ctx.translate(x + barW / 2, P.t + innerH + 16);
      ctx.rotate(-Math.PI / 10);
      ctx.fillText(labels[i], 0, 0);
      ctx.restore();
    });
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

    const P = { t: 20, r: 20, b: 30, l: 40 };
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
    ctx.fillText(fmtMoney(yMax, currency), P.l - 6, P.t + 4);
    ctx.fillText(fmtMoney(yMin, currency), P.l - 6, P.t + innerH);

    ctx.textAlign = "center";
    series.forEach((p, i) => {
      if (i % 2 === 1 && series.length > 4) return;
      const x = P.l + stepX * i;
      ctx.fillText(p.label, x, P.t + innerH + 20);
    });
  }

  // ============================================================
  //  UI HELPERS
  // ============================================================
  function renderLegend(container, categories) {
    if (!container) return;
    container.innerHTML = "";

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const palette = isDark
      ? ["#60a5fa", "#38bdf8", "#818cf8", "#22d3ee", "#93c5fd", "#67e8f9", "#a5b4fc"]
      : ["#0057b8", "#00a3e0", "#1e3a8a", "#0ea5e9", "#2563eb", "#0891b2", "#3b82f6"];

    Object.keys(categories || {}).forEach((name, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.color = palette[i % palette.length];

      const dot = document.createElement("span");
      dot.className = "dot";
      chip.appendChild(dot);
      chip.appendChild(document.createTextNode(name));

      container.appendChild(chip);
    });
  }

  function renderBreakdown(listEl, categories, currency) {
    if (!listEl) return;
    listEl.innerHTML = "";

    const total = Object.values(categories || {}).reduce((a, b) => a + b, 0);

    Object.entries(categories || {})
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, amt]) => {
        const pct = total ? Math.round((amt / total) * 100) : 0;
        const li = document.createElement("li");
        const left = document.createElement("span");
        left.textContent = name;
        const right = document.createElement("span");
        right.textContent = `${fmtMoney(amt, currency)} (${pct}%)`;
        li.appendChild(left);
        li.appendChild(right);
        listEl.appendChild(li);
      });
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

  function getNetWorthData(records, currency) {
    const stored = localStorage.getItem("netWorthData");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.assets && parsed?.liabilities && parsed?.trend) return parsed;
      } catch {
        // fall through to demo
      }
    }

    if (!records?.length) {
      return {
        currency,
        asOf: null,
        assets: [],
        liabilities: [],
        trend: [],
      };
    }

    const base = 0;
    const months = buildMonthlyNet(records, 12);
    let running = base;
    const trend = months.map((m) => {
      running += m.net;
      return { label: m.label, value: Math.max(0, running) };
    });

    return {
      currency,
      asOf: new Date().toISOString(),
      assets: [],
      liabilities: [],
      trend,
    };
  }

  function renderNetWorth(data) {
    if (!data) return;
    const assetsTotal = (data.assets || []).reduce((s, a) => s + a.amount, 0);
    const liabilitiesTotal = (data.liabilities || []).reduce((s, l) => s + l.amount, 0);
    const netWorth = assetsTotal - liabilitiesTotal;

    if (!data.assets?.length && !data.liabilities?.length && !data.trend?.length) {
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

    const renderList = (el, items) => {
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
        const name = document.createElement("span");
        name.textContent = item.name;
        const value = document.createElement("span");
        value.textContent = fmtMoney(item.amount, data.currency);
        li.appendChild(name);
        li.appendChild(value);
        el.appendChild(li);
      });
    };

    renderList(assetsList, data.assets);
    renderList(liabilitiesList, data.liabilities);

    if (data.trend?.length) {
      drawNetWorthChart($("#netWorthChart"), data.trend, data.currency);
    }
  }

  function renderKpis(comp, viewLabel) {
    setText("#kpiIncome", fmtMoney(comp.total_income, comp.currency));
    setText("#kpiSpending", fmtMoney(comp.total_spending, comp.currency));
    setText("#kpiBalance", fmtMoney(comp.net_balance, comp.currency));

    setText("#kpiPeriodIncome", viewLabel);
    setText("#kpiPeriodSpending", viewLabel);
    setText("#kpiPeriodBalance", viewLabel);

    setText(
      "#lastUpdated",
      "Data updated " + new Date(comp.last_updated).toLocaleString()
    );
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
  async function init() {
    await loadUserCustomCategories();
    populateCategorySelect();
    wireActions();
    await personalizeWelcome();

    try {
      const records = await loadFromAPI();

      const savedSettings =
        JSON.parse(localStorage.getItem("userSettings")) || {};

      const dashboardView = savedSettings.dashboardView || "Monthly";

      const viewLabel =
        dashboardView === "Weekly"
          ? "This Week"
          : dashboardView === "Monthly"
          ? "This Month"
          : dashboardView === "Yearly"
          ? "This Year"
          : dashboardView === "All"
          ? "All Time"
          : "This Month";

      const filteredRecords = filterRecordsByView(records, dashboardView);

      const computed = computeOverview(filteredRecords);
      const netWorthData = getNetWorthData(records, computed.currency);

      renderKpis(computed, viewLabel);
      renderNetWorth(netWorthData);
      renderExpensesTable($("#txnTbody"), filteredRecords, computed.currency);

      const canvas = $("#categoriesChart");
      drawBarChart(canvas, computed.categories);

      renderLegend($("#chartLegend"), computed.categories);
      renderBreakdown($("#categoryList"), computed.categories, computed.currency);

      const redraw = debounce(() => {
        drawBarChart(canvas, computed.categories);
        if (netWorthData.trend?.length) {
          drawNetWorthChart($("#netWorthChart"), netWorthData.trend, netWorthData.currency);
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
