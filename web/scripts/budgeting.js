// scripts/budgeting.js
import { api } from "./api.js";

(() => {
  const STORAGE_KEY = "budgeting_categories";
  const CADENCE_STORAGE_KEY = "budgeting_cadence";
  const PERIOD_STORAGE_PREFIX = "budgeting_period_";
  const CURRENCY_FALLBACK = "USD";
  let userCustomCategories = { expense: [] };

  const CADENCE_OPTIONS = [
    { id: "weekly", label: "Weekly", days: 7 },
    { id: "biweekly", label: "Biweekly", days: 14 },
    { id: "monthly", label: "Monthly", months: 1 },
    { id: "3m", label: "3 Months", months: 3 },
    { id: "6m", label: "6 Months", months: 6 },
  ];
  const CADENCE_LOOKUP = new Map(CADENCE_OPTIONS.map((c) => [c.id, c]));

  const BASE_CATEGORIES = [
    { name: "Housing", budget: null },
    { name: "Utilities", budget: null },
    { name: "Groceries", budget: null },
    { name: "Transportation", budget: null },
    { name: "Dining", budget: null },
    { name: "Health", budget: null },
    { name: "Entertainment", budget: null },
    { name: "Shopping", budget: null },
    { name: "Membership", budget: null },
    { name: "Miscellaneous", budget: null },
    { name: "Travel", budget: null },
    { name: "Education", budget: null },
    { name: "Giving", budget: null },
    { name: "Savings", budget: null },
  ];

  const $ = (sel, root = document) => root.querySelector(sel);

  const fmtMoney = (value, currency) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || CURRENCY_FALLBACK,
    }).format(Number.isFinite(value) ? value : 0);

  const normalizeName = (name) => String(name || "").trim().toLowerCase();

  const normalizeCategoryList = (list) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list
      .map((c) => String(c || "").trim())
      .filter((c) => {
        if (!c) return false;
        const key = c.toLowerCase();
        if (key === "other") return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatMonthKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const startOfWeek = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const formatRangeLabel = (start, end) => {
    const sameMonth =
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear();
    const sameYear = start.getFullYear() === end.getFullYear();

    if (sameMonth) {
      const left = start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const right = end.toLocaleDateString(undefined, {
        day: "numeric",
        year: "numeric",
      });
      return `${left}–${right}`;
    }

    if (sameYear) {
      const left = start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const right = end.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${left}–${right}`;
    }

    const left = start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const right = end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${left}–${right}`;
  };

  const formatMonthSpanLabel = (start, end) => {
    const sameYear = start.getFullYear() === end.getFullYear();
    if (sameYear) {
      const left = start.toLocaleDateString(undefined, { month: "short" });
      const right = end.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
      return `${left}–${right}`;
    }
    const left = start.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
    const right = end.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
    return `${left}–${right}`;
  };

  const buildPeriodOptions = (cadenceId) => {
    const cadence = CADENCE_LOOKUP.get(cadenceId) || CADENCE_LOOKUP.get("monthly");
    const now = new Date();
    const options = [];
    const count = 12;

    if (cadence.days) {
      const baseStart = startOfWeek(now);
      for (let i = 0; i < count; i += 1) {
        const start = new Date(baseStart);
        start.setDate(start.getDate() - i * cadence.days);
        const end = new Date(start);
        end.setDate(end.getDate() + cadence.days - 1);
        end.setHours(23, 59, 59, 999);
        options.push({
          start,
          end,
          label: formatRangeLabel(start, end),
          key: formatDateKey(start),
        });
      }
      return options;
    }

    const span = cadence.months || 1;
    for (let i = 0; i < count; i += 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i * span, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + span, 0, 23, 59, 59, 999);
      const label =
        span === 1
          ? start.toLocaleDateString(undefined, { month: "long", year: "numeric" })
          : formatMonthSpanLabel(start, end);
      options.push({
        start,
        end,
        label,
        key: formatMonthKey(start),
      });
    }
    return options;
  };

  const getCadenceLabel = (cadenceId) =>
    CADENCE_LOOKUP.get(cadenceId)?.label || "Monthly";

  const loadUserCustomCategories = async () => {
    try {
      const me = await api.auth.me();
      const expList =
        me?.user?.custom_expense_categories ??
        me?.user?.customExpenseCategories ??
        [];
      userCustomCategories = { expense: normalizeCategoryList(expList) };
    } catch {
      userCustomCategories = { expense: [] };
    }
  };

  const getBudgetCategoryNames = () => {
    const baseNames = BASE_CATEGORIES.map((c) => c.name);
    const baseSet = new Set(baseNames.map((c) => normalizeName(c)));
    const eligibleCustom = (userCustomCategories.expense || []).filter((name) => {
      const key = normalizeName(name);
      if (baseSet.has(key)) return false;
      return true;
    });

    return [...baseNames, ...eligibleCustom];
  };

  const purgeCategoryFromAllMonths = (name) => {
    const key = normalizeName(name);
    const keys = Object.keys(localStorage);
    keys.forEach((k) => {
      if (!k.startsWith(`${STORAGE_KEY}_`)) return;
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

  const isCustomCategory = (name) => {
    const baseSet = new Set(BASE_CATEGORIES.map((c) => normalizeName(c.name)));
    return !baseSet.has(normalizeName(name));
  };

  const deleteCustomCategory = async (name, state) => {
    const key = normalizeName(name);
    if (!key) return;

    const inUse = (state.records || []).some(
      (r) => normalizeName(r.category) === key
    );
    if (inUse) {
      window.alert(
        "Error: could not delete. Custom category is being used by records."
      );
      return;
    }

    userCustomCategories = {
      expense: (userCustomCategories.expense || []).filter(
        (c) => normalizeName(c) !== key
      ),
    };

    try {
      await api.auth.updateProfile({
        customExpenseCategories: userCustomCategories.expense || [],
      });
    } catch (err) {
      console.warn("Failed to delete custom category:", err);
    }

    purgeCategoryFromAllMonths(name);

    state.categories = state.categories.filter(
      (c) => normalizeName(c.name) !== key
    );
    saveCategories(
      state.categories.map(({ name, budget }) => ({ name, budget })),
      state.cadence,
      state.periodKey
    );

    state.spentMap = buildSpentMap(state.records || [], state.categories);
    state.categories = state.categories.map((c) => ({
      ...c,
      spent: state.spentMap.get(normalizeName(c.name)) || 0,
    }));

    renderSummary(computeTotals(state.categories, state.spentMap), CURRENCY_FALLBACK);
    renderReallocateOptions(state.categories);
    renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK);
  };

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

  function loadCategories(cadence, periodKey) {
    let raw = localStorage.getItem(`${STORAGE_KEY}_${cadence}_${periodKey}`);
    if (!raw && cadence === "monthly") {
      const legacyRaw = localStorage.getItem(`${STORAGE_KEY}_${periodKey}`);
      if (legacyRaw) {
        raw = legacyRaw;
        localStorage.setItem(`${STORAGE_KEY}_${cadence}_${periodKey}`, legacyRaw);
        localStorage.removeItem(`${STORAGE_KEY}_${periodKey}`);
      }
    }
    const names = getBudgetCategoryNames();
    const defaults = names.map((name) => ({ name, budget: null }));

    if (!raw) return defaults.map((c) => ({ ...c }));

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return defaults.map((c) => ({ ...c }));

      const byName = new Map(parsed.map((c) => [normalizeName(c.name), c]));

      return defaults.map((c) => {
        const stored = byName.get(normalizeName(c.name));
        if (!stored) return c;
        if (stored.budget === null || stored.budget === undefined || stored.budget === "") {
          return { ...c, budget: null };
        }
        const value = Number(stored.budget);
        return { ...c, budget: Number.isFinite(value) ? value : null };
      });
    } catch {
      return defaults.map((c) => ({ ...c }));
    }
  }

  function saveCategories(categories, cadence, periodKey) {
    localStorage.setItem(
      `${STORAGE_KEY}_${cadence}_${periodKey}`,
      JSON.stringify(categories)
    );
  }

  function buildSpentMap(records, categories) {
    const map = new Map(categories.map((c) => [normalizeName(c.name), 0]));

    records.forEach((r) => {
      if (r.type !== "expense") return;
      const key = normalizeName(r.category || "");
      if (!map.has(key)) return;
      const current = map.get(key) || 0;
      map.set(key, current + Number(r.amount || 0));
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
      const nameWrap = document.createElement("div");
      nameWrap.className = "category-cell";
      const nameLabel = document.createElement("span");
      nameLabel.textContent = c.name;
      nameWrap.appendChild(nameLabel);

      if (isCustomCategory(c.name)) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "custom-category-delete";
        del.dataset.category = c.name;
        del.setAttribute("aria-label", `Delete ${c.name}`);
        del.textContent = "✕";
        nameWrap.appendChild(del);
      }

      tdName.appendChild(nameWrap);

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
    await loadUserCustomCategories();
    let records = [];
    try {
      records = await api.records.getAll();
    } catch (err) {
      showStatus("Could not load records. Budgets shown without spending data.", "error");
    }

    const cadenceSelect = $("#budgetCadenceSelect");
    const periodSelect = $("#budgetMonthSelect");
    const getSavedCadence = () => {
      const saved = localStorage.getItem(CADENCE_STORAGE_KEY);
      return CADENCE_LOOKUP.has(saved) ? saved : "monthly";
    };

    let periodOptions = [];

    const setPeriodOptions = (cadenceId) => {
      periodOptions = buildPeriodOptions(cadenceId);
      if (periodSelect) {
        periodSelect.innerHTML = "";
        periodOptions.forEach((opt) => {
          const option = document.createElement("option");
          option.value = opt.key;
          option.textContent = opt.label;
          periodSelect.appendChild(option);
        });
      }

      const savedKey = localStorage.getItem(`${PERIOD_STORAGE_PREFIX}${cadenceId}`);
      const selected = periodOptions.find((p) => p.key === savedKey) || periodOptions[0];
      if (periodSelect) periodSelect.value = selected.key;
      return selected;
    };

    const initialCadence = getSavedCadence();
    if (cadenceSelect) cadenceSelect.value = initialCadence;
    const initialPeriod = setPeriodOptions(initialCadence);

    let state = {
      cadence: initialCadence,
      periodKey: initialPeriod.key,
      periodLabel: initialPeriod.label,
      periodStart: initialPeriod.start,
      periodEnd: initialPeriod.end,
      categories: [],
      spentMap: new Map(),
      records,
    };

    const renderForPeriod = (periodKey) => {
      const selected = periodOptions.find((p) => p.key === periodKey) || periodOptions[0];
      state.periodKey = selected.key;
      state.periodLabel = selected.label;
      state.periodStart = selected.start;
      state.periodEnd = selected.end;
      localStorage.setItem(`${PERIOD_STORAGE_PREFIX}${state.cadence}`, selected.key);

      const periodEl = $("#budgetPeriod");
      if (periodEl) {
        periodEl.textContent = `${getCadenceLabel(state.cadence)} · ${selected.label}`;
      }

      const periodRecords = records.filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return false;
        return d >= selected.start && d <= selected.end;
      });

      state.categories = loadCategories(state.cadence, selected.key);
      state.spentMap = buildSpentMap(periodRecords, state.categories);

      state.categories = state.categories.map((c) => ({
        ...c,
        spent: state.spentMap.get(normalizeName(c.name)) || 0,
      }));

      renderSummary(computeTotals(state.categories, state.spentMap), CURRENCY_FALLBACK);
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK);
    };

    renderForPeriod(state.periodKey);

    cadenceSelect?.addEventListener("change", (e) => {
      const next = e.target.value;
      state.cadence = CADENCE_LOOKUP.has(next) ? next : "monthly";
      localStorage.setItem(CADENCE_STORAGE_KEY, state.cadence);
      const selected = setPeriodOptions(state.cadence);
      renderForPeriod(selected.key);
      hideStatus();
    });

    periodSelect?.addEventListener("change", (e) => {
      const next = e.target.value;
      renderForPeriod(next);
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
      saveCategories(
        state.categories.map(({ name, budget }) => ({ name, budget })),
        state.cadence,
        state.periodKey
      );

      const updatedTotals = computeTotals(state.categories, state.spentMap);
      renderSummary(updatedTotals, CURRENCY_FALLBACK);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK);
      hideStatus();
    });

    $("#btnResetBudgets")?.addEventListener("click", () => {
      state.categories = getBudgetCategoryNames().map((name) => ({ name, budget: null }));
      saveCategories(
        state.categories.map(({ name, budget }) => ({ name, budget })),
        state.cadence,
        state.periodKey
      );

      const refreshedMap = buildSpentMap(
        records.filter((r) => {
          if (!r.date) return false;
          const d = new Date(r.date);
          if (Number.isNaN(d.getTime())) return false;
          return d >= state.periodStart && d <= state.periodEnd;
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
      saveCategories(
        state.categories.map(({ name, budget }) => ({ name, budget })),
        state.cadence,
        state.periodKey
      );

      const monthRecords = records.filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return false;
        return d >= state.periodStart && d <= state.periodEnd;
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
      saveCategories(
        state.categories.map(({ name, budget }) => ({ name, budget })),
        state.cadence,
        state.periodKey
      );

      const monthRecords = records.filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return false;
        return d >= state.periodStart && d <= state.periodEnd;
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

    const customCategoryModal = $("#customCategoryModal");
    const customCategoryForm = $("#customCategoryForm");
    const customCategoryInput = $("#customCategoryInput");
    const cancelCustomCategoryBtn = $("#cancelCustomCategoryBtn");
    const btnAddBudgetCategory = $("#btnAddBudgetCategory");

    const openCustomModal = () => {
      if (customCategoryInput) customCategoryInput.value = "";
      customCategoryModal?.classList.remove("hidden");
      customCategoryInput?.focus();
    };

    const closeCustomModal = () => {
      customCategoryModal?.classList.add("hidden");
    };

    btnAddBudgetCategory?.addEventListener("click", openCustomModal);
    cancelCustomCategoryBtn?.addEventListener("click", closeCustomModal);
    customCategoryModal?.addEventListener("click", (e) => {
      if (e.target === customCategoryModal) closeCustomModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && customCategoryModal && !customCategoryModal.classList.contains("hidden")) {
        closeCustomModal();
      }
    });

    $("#budgetTbody")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".custom-category-delete");
      if (!btn) return;
      deleteCustomCategory(btn.dataset.category || "", state);
    });

    customCategoryForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = customCategoryInput?.value || "";
      const name = String(raw).trim();
      if (!name) {
        customCategoryInput?.focus();
        return;
      }

      const key = normalizeName(name);
      if (!userCustomCategories.expense?.some((c) => normalizeName(c) === key)) {
        userCustomCategories = {
          expense: [...(userCustomCategories.expense || []), name],
        };
      }

      try {
        await api.auth.updateProfile({
          customExpenseCategories: userCustomCategories.expense || [],
        });
      } catch (err) {
        console.warn("Failed to save custom category:", err);
      }

      const names = getBudgetCategoryNames();
      const exists = state.categories.some((c) => normalizeName(c.name) === key);
      if (!exists && names.includes(name)) {
        state.categories = [
          ...state.categories,
          { name, budget: null, spent: 0 },
        ];
      }

      saveCategories(
        state.categories.map(({ name: n, budget }) => ({ name: n, budget })),
        state.cadence,
        state.periodKey
      );
      state.spentMap = buildSpentMap(
        records.filter((r) => {
          if (!r.date) return false;
          const d = new Date(r.date);
          if (Number.isNaN(d.getTime())) return false;
          return d >= state.periodStart && d <= state.periodEnd;
        }),
        state.categories
      );
      state.categories = state.categories.map((c) => ({
        ...c,
        spent: state.spentMap.get(normalizeName(c.name)) || 0,
      }));

      renderSummary(computeTotals(state.categories, state.spentMap), CURRENCY_FALLBACK);
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK);
      closeCustomModal();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
