// scripts/budgeting.js
import { api } from "./api.js";

(() => {
  const STORAGE_KEY = "budgeting_categories";
  const CURRENCY_FALLBACK = "USD";

  const DEFAULT_CATEGORIES = [
    { name: "Housing", budget: null },
    { name: "Utilities", budget: null },
    { name: "Groceries", budget: null },
    { name: "Transportation", budget: null },
    { name: "Dining", budget: null },
    { name: "Health", budget: null },
    { name: "Entertainment", budget: null },
    { name: "Subscriptions", budget: null },
    { name: "Travel", budget: null },
    { name: "Education", budget: null },
    { name: "Giving", budget: null },
    { name: "Savings", budget: null },
    { name: "Other", budget: null },
  ];

  const $ = (sel, root = document) => root.querySelector(sel);

  const fmtMoney = (value, currency) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || CURRENCY_FALLBACK,
    }).format(Number.isFinite(value) ? value : 0);

  const normalizeName = (name) => String(name || "").trim().toLowerCase();

  const showStatus = (msg, tone = "") => {
    const el = $("#budgetStatus");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("is-hidden");
    el.classList.toggle("is-error", tone === "error");
    el.classList.toggle("is-ok", tone === "ok");
  };

  const hideStatus = () => {
    const el = $("#budgetStatus");
    if (!el) return;
    el.textContent = "";
    el.classList.add("is-hidden");
    el.classList.remove("is-error", "is-ok");
  };

  function loadCategories(monthKey) {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${monthKey}`);
    if (!raw) return DEFAULT_CATEGORIES.map((c) => ({ ...c }));

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_CATEGORIES.map((c) => ({ ...c }));

      const normalized = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
      const byName = new Map(parsed.map((c) => [normalizeName(c.name), c]));

      return normalized.map((c) => {
        const stored = byName.get(normalizeName(c.name));
        if (!stored) return c;
        if (stored.budget === null || stored.budget === undefined || stored.budget === "") {
          return { ...c, budget: null };
        }
        const value = Number(stored.budget);
        return { ...c, budget: Number.isFinite(value) ? value : null };
      });
    } catch {
      return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    }
  }

  function saveCategories(categories, monthKey) {
    localStorage.setItem(`${STORAGE_KEY}_${monthKey}`, JSON.stringify(categories));
  }

  function getMonthRange(year, monthIndex) {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    return {
      start,
      end,
      label: start.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    };
  }

  function buildMonthOptions() {
    const now = new Date();
    const options = [];
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const range = getMonthRange(d.getFullYear(), d.getMonth());
      options.push(range);
    }
    return options;
  }

  function buildSpentMap(records, categories) {
    const map = new Map(categories.map((c) => [normalizeName(c.name), 0]));
    const otherKey = normalizeName("Other");

    records.forEach((r) => {
      if (r.type !== "expense") return;
      const key = normalizeName(r.category || "Other");
      const match = map.has(key) ? key : otherKey;
      const current = map.get(match) || 0;
      map.set(match, current + Number(r.amount || 0));
    });

    return map;
  }

  function computeTotals(categories, spentMap) {
    const totals = categories.reduce(
      (acc, c) => {
        const budget = Number.isFinite(c.budget) ? c.budget : 0;
        const spent = spentMap.get(normalizeName(c.name)) || 0;
        const remaining = budget - spent;
        acc.totalBudget += budget;
        acc.totalSpent += spent;
        acc.totalRemaining += remaining;
        if (normalizeName(c.name) !== "savings" && remaining > 0) acc.unused += remaining;
        return acc;
      },
      { totalBudget: 0, totalSpent: 0, totalRemaining: 0, unused: 0 }
    );

    return totals;
  }

  function renderSummary(totals, currency) {
    $("#summaryTotalBudget").textContent = fmtMoney(totals.totalBudget, currency);
    $("#summarySpent").textContent = fmtMoney(totals.totalSpent, currency);
    $("#summaryRemaining").textContent = fmtMoney(totals.totalRemaining, currency);
    $("#summaryUnused").textContent = fmtMoney(totals.unused, currency);
  }

  function renderReallocateOptions(categories) {
    const select = $("#reallocateTarget");
    if (!select) return;
    select.innerHTML = "";

    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  }

  function renderTable(categories, spentMap, currency) {
    const tbody = $("#budgetTbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    categories.forEach((c, idx) => {
      const spent = spentMap.get(normalizeName(c.name)) || 0;
      const budget = Number.isFinite(c.budget) ? c.budget : 0;
      const remaining = budget - spent;
      const progress = budget > 0 ? Math.min(spent / budget, 1) : 0;

      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = c.name;

      const tdBudget = document.createElement("td");
      tdBudget.className = "num";
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = c.budget ?? "";
      input.className = "budget-input";
      input.dataset.index = String(idx);
      tdBudget.appendChild(input);

      const tdSpent = document.createElement("td");
      tdSpent.className = "num";
      tdSpent.textContent = fmtMoney(spent, currency);

      const tdRemaining = document.createElement("td");
      tdRemaining.className = "num remaining";
      tdRemaining.textContent = fmtMoney(remaining, currency);
      if (remaining < 0) tdRemaining.classList.add("negative");

      const tdProgress = document.createElement("td");
      const bar = document.createElement("div");
      bar.className = "progress" + (spent > c.budget ? " over" : "");
      const fill = document.createElement("span");
      fill.style.width = `${progress * 100}%`;
      bar.appendChild(fill);
      tdProgress.appendChild(bar);

      tr.appendChild(tdName);
      tr.appendChild(tdBudget);
      tr.appendChild(tdSpent);
      tr.appendChild(tdRemaining);
      tr.appendChild(tdProgress);

      tbody.appendChild(tr);
    });
  }

  function moveUnused(categories, targetName) {
    const targetKey = normalizeName(targetName);
    let unused = 0;

    const updated = categories.map((c) => {
      const isTarget = normalizeName(c.name) === targetKey;
      if (isTarget) return { ...c };

      const spent = c.spent || 0;
      const budget = Number.isFinite(c.budget) ? c.budget : 0;
      const remaining = budget - spent;
      if (remaining > 0) {
        unused += remaining;
        return { ...c, budget: spent };
      }
      return { ...c };
    });

    const targetIndex = updated.findIndex((c) => normalizeName(c.name) === targetKey);
    if (targetIndex >= 0) {
      const current = Number.isFinite(updated[targetIndex].budget)
        ? updated[targetIndex].budget
        : 0;
      updated[targetIndex].budget = current + unused;
    }

    return { updated, moved: unused };
  }

  async function init() {
    let records = [];
    try {
      records = await api.records.getAll();
    } catch (err) {
      showStatus("Could not load records. Budgets shown without spending data.", "error");
    }

    const monthSelect = $("#budgetMonthSelect");
    const monthOptions = buildMonthOptions();
    if (monthSelect) {
      monthSelect.innerHTML = "";
      monthOptions.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt.key;
        option.textContent = opt.label;
        monthSelect.appendChild(option);
      });
      monthSelect.value = monthOptions[0].key;
    }

    let state = {
      monthKey: monthOptions[0].key,
      monthLabel: monthOptions[0].label,
      monthStart: monthOptions[0].start,
      monthEnd: monthOptions[0].end,
      categories: [],
      spentMap: new Map(),
    };

    const renderForMonth = (monthKey) => {
      const selected = monthOptions.find((m) => m.key === monthKey) || monthOptions[0];
      state.monthKey = selected.key;
      state.monthLabel = selected.label;
      state.monthStart = selected.start;
      state.monthEnd = selected.end;

      const periodEl = $("#budgetPeriod");
      if (periodEl) periodEl.textContent = selected.label;

      const monthRecords = records.filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return false;
        return d >= selected.start && d <= selected.end;
      });

      state.categories = loadCategories(selected.key);
      state.spentMap = buildSpentMap(monthRecords, state.categories);

      state.categories = state.categories.map((c) => ({
        ...c,
        spent: state.spentMap.get(normalizeName(c.name)) || 0,
      }));

      renderSummary(computeTotals(state.categories, state.spentMap), CURRENCY_FALLBACK);
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK);
    };

    renderForMonth(state.monthKey);

    monthSelect?.addEventListener("change", (e) => {
      const next = e.target.value;
      renderForMonth(next);
      hideStatus();
    });

    $("#budgetTbody")?.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.dataset.index) return;

      const idx = Number(target.dataset.index);
      if (target.value === "") {
        state.categories[idx].budget = null;
      } else {
        const next = Number(target.value || 0);
        state.categories[idx].budget = Math.max(0, Number.isFinite(next) ? next : 0);
      }
      saveCategories(state.categories.map(({ name, budget }) => ({ name, budget })), state.monthKey);

      const updatedTotals = computeTotals(state.categories, state.spentMap);
      renderSummary(updatedTotals, CURRENCY_FALLBACK);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK);
      hideStatus();
    });

    $("#btnResetBudgets")?.addEventListener("click", () => {
      state.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
      saveCategories(state.categories.map(({ name, budget }) => ({ name, budget })), state.monthKey);

      const refreshedMap = buildSpentMap(
        records.filter((r) => {
          if (!r.date) return false;
          const d = new Date(r.date);
          if (Number.isNaN(d.getTime())) return false;
          return d >= state.monthStart && d <= state.monthEnd;
        }),
        state.categories
      );
      state.spentMap = refreshedMap;
      state.categories = state.categories.map((c) => ({
        ...c,
        spent: state.spentMap.get(normalizeName(c.name)) || 0,
      }));

      renderSummary(computeTotals(state.categories, state.spentMap), CURRENCY_FALLBACK);
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK);
      showStatus("Budgets reset to defaults.");
    });

    $("#btnAddUnusedToSavings")?.addEventListener("click", () => {
      const mapped = state.categories.map((c) => ({ ...c }));
      const { updated, moved } = moveUnused(mapped, "Savings");
      if (!moved) {
        showStatus("No unused funds to move.");
        return;
      }

      state.categories = updated;
      saveCategories(state.categories.map(({ name, budget }) => ({ name, budget })), state.monthKey);

      const monthRecords = records.filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return false;
        return d >= state.monthStart && d <= state.monthEnd;
      });

      const newMap = buildSpentMap(monthRecords, state.categories);
      state.spentMap = newMap;
      state.categories = state.categories.map((c) => ({
        ...c,
        spent: state.spentMap.get(normalizeName(c.name)) || 0,
      }));

      renderSummary(computeTotals(state.categories, state.spentMap), CURRENCY_FALLBACK);
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK);
      showStatus(`Moved ${fmtMoney(moved, CURRENCY_FALLBACK)} to Savings.`);
    });

    $("#btnReallocateUnused")?.addEventListener("click", () => {
      const target = $("#reallocateTarget")?.value;
      if (!target) return;

      const mapped = state.categories.map((c) => ({ ...c }));
      const { updated, moved } = moveUnused(mapped, target);
      if (!moved) {
        showStatus("No unused funds to move.");
        return;
      }

      state.categories = updated;
      saveCategories(state.categories.map(({ name, budget }) => ({ name, budget })), state.monthKey);

      const monthRecords = records.filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return false;
        return d >= state.monthStart && d <= state.monthEnd;
      });

      const newMap = buildSpentMap(monthRecords, state.categories);
      state.spentMap = newMap;
      state.categories = state.categories.map((c) => ({
        ...c,
        spent: state.spentMap.get(normalizeName(c.name)) || 0,
      }));

      renderSummary(computeTotals(state.categories, state.spentMap), CURRENCY_FALLBACK);
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK);
      showStatus(`Moved ${fmtMoney(moved, CURRENCY_FALLBACK)} to ${target}.`);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
