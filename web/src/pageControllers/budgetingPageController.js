// scripts/budgeting.js
import { api } from "../../scripts/api.js";
import { exportSheets, getPreferredExportFormat } from "../../scripts/export-utils.js";

export function initBudgetingPage() {
  if (window.__walletlensBudgetingPageInitialized) return;
  window.__walletlensBudgetingPageInitialized = true;
  const CURRENCY_FALLBACK = "USD";
  let userCustomCategories = { expense: [] };
  let businessContext = false;

  const CADENCE_OPTIONS = [
    { id: "weekly", label: "Weekly", days: 7 },
    { id: "biweekly", label: "Biweekly", days: 14 },
    { id: "monthly", label: "Monthly", months: 1 },
    { id: "quarterly", label: "Quarterly", months: 3 },
    { id: "semi-annually", label: "Semi-Annually", months: 6 },
    { id: "yearly", label: "Yearly", months: 12 },
  ];
  const CADENCE_LOOKUP = new Map(CADENCE_OPTIONS.map((c) => [c.id, c]));
  const CADENCE_ANNUAL_FACTOR = {
    weekly: 52,
    biweekly: 26,
    monthly: 12,
    quarterly: 4,
    "semi-annually": 2,
    yearly: 1,
  };
  const PLANNING_FREQUENCY_FACTOR = {
    weekly: 52,
    biweekly: 26,
    monthly: 12,
    quarterly: 4,
    "semi-annually": 2,
    yearly: 1,
    "one-time": 1,
  };
  const DEFAULT_TAX_DATA = {
    federalIncomeTax: {
      standardDeduction: 15750,
      brackets: [
        { over: 0, upTo: 11925, rate: 0.10 },
        { over: 11925, upTo: 48475, rate: 0.12 },
        { over: 48475, upTo: 103350, rate: 0.22 },
        { over: 103350, upTo: 197300, rate: 0.24 },
        { over: 197300, upTo: 250525, rate: 0.32 },
        { over: 250525, upTo: 626350, rate: 0.35 },
        { over: 626350, upTo: null, rate: 0.37 },
      ],
    },
    fica: {
      socialSecurity: { rate: 0.062, wageBase: 176100 },
      medicare: { rate: 0.0145, wageBase: null },
    },
  };

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
    { name: "Education", budget: null },
    { name: "Giving", budget: null },
    { name: "Savings", budget: null },
  ];
  const BUSINESS_BUDGET_CATEGORIES = [
    "Cost of Goods Sold", "Payroll", "Rent & Lease", "Utilities", "Marketing & Advertising",
    "Software & Subscriptions", "Insurance", "Professional Services", "Travel", "Business Meals",
    "Taxes & Fees", "Office Supplies", "Repairs & Maintenance", "Other",
  ];

  const CATEGORY_COLUMN_MAP = new Map([
    ["Housing", "housing"],
    ["Utilities", "utilities"],
    ["Groceries", "groceries"],
    ["Transportation", "transportation"],
    ["Dining", "dining"],
    ["Health", "health"],
    ["Entertainment", "entertainment"],
    ["Shopping", "shopping"],
    ["Membership", "membership"],
    ["Miscellaneous", "miscellaneous"],
    ["Education", "education"],
    ["Giving", "giving"],
    ["Savings", "savings"],
  ]);

  const COLUMN_CATEGORY_MAP = new Map(
    Array.from(CATEGORY_COLUMN_MAP.entries()).map(([name, col]) => [col, name])
  );

  const $ = (sel, root = document) => root.querySelector(sel);

  const fmtMoney = (value, currency) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || CURRENCY_FALLBACK,
    }).format(Number.isFinite(value) ? value : 0);

  const progressFillColor = (progress) => {
    const clamped = Math.max(0, Math.min(1, progress));
    const hue = 120 - clamped * 90;
    return `hsl(${hue} 85% 45%)`;
  };

  const savingsFillColor = (progress) => {
    const clamped = Math.max(0, Math.min(1, progress));
    let hue = 30;
    if (clamped <= 0.3) {
      hue = 30;
    } else if (clamped <= 0.6) {
      const t = (clamped - 0.3) / 0.3;
      hue = 30 + t * 30;
    } else if (clamped <= 0.9) {
      const t = (clamped - 0.6) / 0.3;
      hue = 60 + t * 60;
    } else {
      hue = 120;
    }
    return `hsl(${hue} 85% 45%)`;
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
        if (key === "other") return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const planningAnnualize = (row, frequency) => {
    const amount = Number(row?.amount);
    if (!Number.isFinite(amount)) return 0;
    return amount * (PLANNING_FREQUENCY_FACTOR[frequency || row?.frequency] || 12);
  };

  const planningAnnualizeAmount = (amount, frequency) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return 0;
    return value * (PLANNING_FREQUENCY_FACTOR[frequency] || 12);
  };

  const normalizeTaxData = (value) => {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
      ...DEFAULT_TAX_DATA,
      ...source,
      federalIncomeTax: {
        ...DEFAULT_TAX_DATA.federalIncomeTax,
        ...(source.federalIncomeTax || {}),
        brackets: Array.isArray(source.federalIncomeTax?.brackets) && source.federalIncomeTax.brackets.length
          ? source.federalIncomeTax.brackets
          : DEFAULT_TAX_DATA.federalIncomeTax.brackets,
      },
      fica: {
        socialSecurity: {
          ...DEFAULT_TAX_DATA.fica.socialSecurity,
          ...(source.fica?.socialSecurity || {}),
        },
        medicare: {
          ...DEFAULT_TAX_DATA.fica.medicare,
          ...(source.fica?.medicare || {}),
        },
      },
    };
  };

  const getPlanningTaxKind = (row) => {
    const explicit = String(row?.taxKind || "").trim();
    if (explicit) return explicit;
    const text = `${row?.label || ""} ${row?.category || ""}`.toLowerCase();
    if (text.includes("federal")) return "federal";
    if (text.includes("social security") || text.includes("fica")) return "social_security";
    if (text.includes("medicare")) return "medicare";
    if (text.includes("state")) return "state";
    if (text.includes("local")) return "local";
    return row?.type === "tax" ? "manual" : "";
  };

  const calculateFederalPlanningTax = (grossAnnual, taxData) => {
    const federal = normalizeTaxData(taxData).federalIncomeTax;
    const taxableIncome = Math.max(0, grossAnnual - Math.max(0, Number(federal.standardDeduction) || 0));
    return (federal.brackets || []).reduce((sum, bracket) => {
      const over = Math.max(0, Number(bracket?.over) || 0);
      const upTo = bracket?.upTo === null || bracket?.upTo === undefined || bracket?.upTo === ""
        ? Infinity
        : Math.max(over, Number(bracket?.upTo) || 0);
      const rate = Math.max(0, Math.min(1, Number(bracket?.rate) || 0));
      if (taxableIncome <= over || rate <= 0) return sum;
      return sum + Math.max(0, Math.min(taxableIncome, upTo) - over) * rate;
    }, 0);
  };

  const calculatePlanningTax = (row, grossAnnual, taxData) => {
    const overrideMode = String(row?.taxOverrideMode || "").trim();
    const overridePercent = Number(row?.taxOverridePercent);
    const overrideAmount = Number(row?.taxOverrideAmount);
    if (overrideMode === "percent" && Number.isFinite(overridePercent) && overridePercent > 0) {
      return grossAnnual * Math.max(0, Math.min(1, overridePercent / 100));
    }
    if (overrideMode === "amount" && Number.isFinite(overrideAmount) && overrideAmount > 0) {
      return planningAnnualizeAmount(overrideAmount, row?.frequency);
    }
    const data = normalizeTaxData(taxData);
    const kind = getPlanningTaxKind(row);
    if (kind === "federal") return calculateFederalPlanningTax(grossAnnual, data);
    if (kind === "social_security") {
      const rate = Math.max(0, Math.min(1, Number(data.fica.socialSecurity.rate) || 0));
      const wageBase = data.fica.socialSecurity.wageBase === null ? grossAnnual : Math.max(0, Number(data.fica.socialSecurity.wageBase) || 0);
      return Math.min(grossAnnual, wageBase) * rate;
    }
    if (kind === "medicare") {
      return grossAnnual * Math.max(0, Math.min(1, Number(data.fica.medicare.rate) || 0));
    }
    if (kind === "state" || kind === "local") {
      const configuredRate = Math.max(0, Math.min(1, (Number(row?.percent) || 0) / 100));
      if (configuredRate > 0) return grossAnnual * configuredRate;
      return planningAnnualize(row);
    }
    const manualRate = Math.max(0, Math.min(1, (Number(row?.percent) || 0) / 100));
    return manualRate > 0 ? grossAnnual * manualRate : planningAnnualize(row);
  };

  const planningTemporaryTotal = (row, frequency) => {
    if (!row?.startDate || !row?.endDate) return planningAnnualize(row, frequency);
    const start = new Date(`${row.startDate}T00:00:00`);
    const end = new Date(`${row.endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return planningAnnualize(row, frequency);
    }
    const days = Math.max(1, (end - start) / 86400000 + 1);
    return planningAnnualize(row, frequency) * Math.min(days / 365, 1);
  };

  const computePlanningSalaryAfterExpensesAnnual = (data, taxData) => {
    const tables = data?.tables || {};
    const takeHomeRows = Array.isArray(tables.takeHomePay?.rows) ? tables.takeHomePay.rows : [];
    const incomeAnnual = takeHomeRows
      .filter((row) => row?.type === "income")
      .reduce((sum, row) => sum + planningAnnualize(row), 0);
    const taxAnnual = takeHomeRows
      .filter((row) => row?.type === "tax")
      .reduce((sum, row) => sum + calculatePlanningTax(row, incomeAnnual, taxData), 0);
    const expenseAnnual = (Array.isArray(tables.expenseItems?.rows) ? tables.expenseItems.rows : [])
      .reduce((sum, row) => sum + planningAnnualize(row), 0);
    const temporaryTotal = (Array.isArray(tables.temporaryExpenses?.rows) ? tables.temporaryExpenses.rows : [])
      .reduce((sum, row) => sum + planningTemporaryTotal(row), 0);
    return incomeAnnual - taxAnnual - expenseAnnual - temporaryTotal;
  };

  const amountForCadence = (annual, cadenceId) => {
    const factor = CADENCE_ANNUAL_FACTOR[cadenceId] || 12;
    return annual / factor;
  };

  const renderPlanningSalaryCards = (annual) => {
    const yearly = $("#planningSalaryYearly");
    const monthly = $("#planningSalaryMonthly");
    const weekly = $("#planningSalaryWeekly");
    if (yearly) yearly.textContent = fmtMoney(annual, CURRENCY_FALLBACK);
    if (monthly) monthly.textContent = fmtMoney(amountForCadence(annual, "monthly"), CURRENCY_FALLBACK);
    if (weekly) weekly.textContent = fmtMoney(amountForCadence(annual, "weekly"), CURRENCY_FALLBACK);
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

  const MONTH_ABBREV = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const formatMonthDay = (date) => `${MONTH_ABBREV[date.getMonth()]} ${date.getDate()}`;

  const formatMonthDayYear = (date) =>
    `${MONTH_ABBREV[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

  const formatRangeLabel = (start, end) => {
    const sameMonth =
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear();
    const sameYear = start.getFullYear() === end.getFullYear();

    if (sameMonth) {
      return `${formatMonthDay(start)} - ${end.getDate()}, ${end.getFullYear()}`;
    }

    if (sameYear) {
      return `${formatMonthDay(start)} - ${formatMonthDay(end)}, ${end.getFullYear()}`;
    }

    return `${formatMonthDayYear(start)} - ${formatMonthDayYear(end)}`;
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

  const buildPeriodOptionFromKey = (cadenceId, periodKey) => {
    const cadence = CADENCE_LOOKUP.get(cadenceId);
    const key = String(periodKey || "");
    if (!cadence) return null;

    if (cadence.days) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
      const [year, month, day] = key.split("-").map(Number);
      const start = new Date(year, month - 1, day);
      if (formatDateKey(start) !== key) return null;
      const end = new Date(start);
      end.setDate(end.getDate() + cadence.days - 1);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: formatRangeLabel(start, end), key };
    }

    if (!/^\d{4}-\d{2}$/.test(key)) return null;
    const [year, month] = key.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    if (formatMonthKey(start) !== key) return null;
    const span = cadence.months || 1;
    const end = new Date(start.getFullYear(), start.getMonth() + span, 0, 23, 59, 59, 999);
    const label =
      span === 1
        ? start.toLocaleDateString(undefined, { month: "long", year: "numeric" })
        : span === 12
          ? String(start.getFullYear())
          : formatMonthSpanLabel(start, end);
    return { start, end, label, key };
  };

  const buildPeriodOptions = (cadenceId, selectedKey) => {
    const cadence = CADENCE_LOOKUP.get(cadenceId) || CADENCE_LOOKUP.get("monthly");
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const options = [];
    let count = 12;
    const yearsAhead = cadence.days
      ? 1
      : cadence.months >= 3
        ? 5
        : 1;
    const horizonEnd = new Date(
      now.getFullYear() + yearsAhead,
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    if (cadence.days) {
      count = 15;
      const baseStart = startOfWeek(now);
      for (let i = 0; i < count; i += 1) {
        const start = new Date(baseStart);
        start.setDate(start.getDate() + i * cadence.days);
        const end = new Date(start);
        end.setDate(end.getDate() + cadence.days - 1);
        end.setHours(23, 59, 59, 999);
        if (start > horizonEnd) break;
        options.push({
          start,
          end,
          label: formatRangeLabel(start, end),
          key: formatDateKey(start),
        });
      }
      const filtered = options
        .filter((opt) => opt.end >= today)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      const savedPeriod = buildPeriodOptionFromKey(cadenceId, selectedKey);
      if (savedPeriod && !filtered.some((option) => option.key === savedPeriod.key)) {
        filtered.push(savedPeriod);
        filtered.sort((a, b) => a.start.getTime() - b.start.getTime());
      }
      return filtered;
    }

    const span = cadence.months || 1;
    const alignedMonth =
      span >= 3 ? Math.floor(now.getMonth() / span) * span : now.getMonth();
    const baseStart = new Date(now.getFullYear(), alignedMonth, 1);
    count = 15;
    for (let i = 0; i < count; i += 1) {
      const start = new Date(baseStart);
      start.setMonth(start.getMonth() + i * span);
      const end = new Date(start.getFullYear(), start.getMonth() + span, 0, 23, 59, 59, 999);
      if (start > horizonEnd) break;
      const label =
        span === 1
          ? start.toLocaleDateString(undefined, { month: "long", year: "numeric" })
          : span === 12
            ? String(start.getFullYear())
            : formatMonthSpanLabel(start, end);
      options.push({
        start,
        end,
        label,
        key: formatMonthKey(start),
      });
    }
    const filtered = options
      .filter((opt) => opt.end >= today)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const savedPeriod = buildPeriodOptionFromKey(cadenceId, selectedKey);
    if (savedPeriod && !filtered.some((option) => option.key === savedPeriod.key)) {
      filtered.push(savedPeriod);
      filtered.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    return filtered;
  };

  const getCadenceLabel = (cadenceId) =>
    CADENCE_LOOKUP.get(cadenceId)?.label || "Monthly";

  const makeBudgetKey = (cadenceId, periodKey) => `${cadenceId}__${periodKey}`;

  const parseBudgetKey = (value) => {
    if (!value) return null;
    const parts = String(value).split("__");
    if (parts.length < 2) return null;
    return {
      cadence: parts[0],
      periodKey: parts.slice(1).join("__"),
    };
  };

  const getPeriodLabel = (cadenceId, periodKey) => {
    const options = buildPeriodOptions(cadenceId, periodKey);
    const match = options.find((opt) => opt.key === periodKey);
    return match ? match.label : periodKey;
  };

  const buildBudgetLabel = (cadenceId, periodKey) =>
    `${getCadenceLabel(cadenceId)} - ${getPeriodLabel(cadenceId, periodKey)}`;

  const getBudgetEntriesFromDb = async () => {
    try {
      const sheets = await api.budgetSheets.getAll({ limit: 500 });
      if (!Array.isArray(sheets)) return [];
      return sheets
        .map((sheet) => ({
          cadence: sheet?.cadence,
          periodKey: sheet?.period,
        }))
        .filter((entry) => CADENCE_LOOKUP.has(entry.cadence) && entry.periodKey);
    } catch (err) {
      showStatus("Could not load saved budgets.", "error");
      return [];
    }
  };

  const orderBudgetEntries = (entries) => {
    const cadenceIndex = new Map(CADENCE_OPTIONS.map((c, idx) => [c.id, idx]));
    const periodOrderMaps = new Map();
    const getOrderMap = (cadenceId) => {
      if (!periodOrderMaps.has(cadenceId)) {
        const options = buildPeriodOptions(cadenceId);
        periodOrderMaps.set(
          cadenceId,
          new Map(options.map((opt, idx) => [opt.key, idx]))
        );
      }
      return periodOrderMaps.get(cadenceId);
    };

    return [...entries].sort((a, b) => {
      const cadenceDiff =
        (cadenceIndex.get(a.cadence) ?? 999) - (cadenceIndex.get(b.cadence) ?? 999);
      if (cadenceDiff !== 0) return cadenceDiff;
      const orderMap = getOrderMap(a.cadence);
      const aIndex = orderMap?.get(a.periodKey) ?? 999;
      const bIndex = orderMap?.get(b.periodKey) ?? 999;
      return aIndex - bIndex;
    });
  };

  const populatePeriodSelect = (selectEl, cadenceId, selectedKey) => {
    if (!selectEl) return null;
    const options = buildPeriodOptions(cadenceId, selectedKey);
    selectEl.innerHTML = "";
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.key;
      option.textContent = opt.label;
      selectEl.appendChild(option);
    });
    const selected = options.find((opt) => opt.key === selectedKey) || options[0];
    selectEl.value = selected.key;
    return selected;
  };

  const loadUserCustomCategories = async () => {
    try {
      const me = await api.auth.me();
      const expList =
        me?.user?.custom_expense_categories ??
        me?.user?.customExpenseCategories ??
        [];
      businessContext = Boolean(me?.user?.active_organization_id || me?.user?.activeOrganizationId || ["org_user", "org_admin"].includes(String(me?.user?.role || "").toLowerCase()));
      userCustomCategories = { expense: normalizeCategoryList(expList) };
    } catch {
      userCustomCategories = { expense: [] };
    }
  };

  const getBudgetCategoryNames = () => {
    const baseNames = businessContext ? BUSINESS_BUDGET_CATEGORIES : BASE_CATEGORIES.map((c) => c.name);
    const baseSet = new Set(baseNames.map((c) => normalizeName(c)));
    const eligibleCustom = (userCustomCategories.expense || []).filter((name) => {
      const key = normalizeName(name);
      if (baseSet.has(key)) return false;
      return true;
    });

    return [...baseNames, ...eligibleCustom].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  };

  const buildBudgetPayload = (categories) => {
    const categoryValues = {};
    CATEGORY_COLUMN_MAP.forEach((col, name) => {
      const match = categories.find((c) => c.name === name);
      const value = match?.budget;
      categoryValues[col] = Number.isFinite(value) ? value : null;
    });

    const customCategories = categories
      .filter((c) => isCustomCategory(c.name))
      .map((c) => ({
        category: c.name,
        amount: Number.isFinite(c.budget) ? c.budget : null,
      }));

    return { categories: categoryValues, customCategories };
  };

  const applySheetToState = (sheet, state) => {
    if (!sheet) return;
    const baseCategories = (businessContext ? [] : BASE_CATEGORIES).map((base) => {
      const col = CATEGORY_COLUMN_MAP.get(base.name);
      return {
        name: base.name,
        budget: Number.isFinite(Number(sheet?.[col])) ? Number(sheet[col]) : null,
      };
    });

    const custom = Array.isArray(sheet.custom_categories)
      ? sheet.custom_categories.map((entry) => ({
          name: String(entry?.category || "").trim(),
          budget: Number.isFinite(Number(entry?.amount)) ? Number(entry.amount) : null,
        }))
      : [];

    const businessDefaults = businessContext
      ? BUSINESS_BUDGET_CATEGORIES.map((name) => ({ name, budget: null }))
      : [];
    const merged = [
      ...businessDefaults,
      ...baseCategories,
      ...custom.filter((c) => c.name && isCustomCategory(c.name) && !businessDefaults.some((base) => normalizeName(base.name) === normalizeName(c.name))),
    ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    custom.forEach((entry) => {
      const target = merged.find((item) => normalizeName(item.name) === normalizeName(entry.name));
      if (target) target.budget = entry.budget;
    });

    state.categories = merged.map((c) => ({ ...c }));
  };

  const isCustomCategory = (name) => {
    if (businessContext) return true;
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

    state.categories = state.categories.filter(
      (c) => normalizeName(c.name) !== key
    );
    state.isDirty = true;
    const saveBtn = $("#btnSaveBudget");
    if (saveBtn) saveBtn.disabled = false;

    state.spentMap = buildSpentMap(state.records || [], state.categories);
    state.categories = state.categories.map((c) => ({
      ...c,
      spent: state.spentMap.get(normalizeName(c.name)) || 0,
    }));

    renderSummary(
      computeTotals(state.categories, state.spentMap),
      CURRENCY_FALLBACK,
      computeIncomeTotal(state.records, state.periodStart, state.periodEnd)
    );
    renderReallocateOptions(state.categories);
    renderTable(
      state.categories,
      state.spentMap,
      CURRENCY_FALLBACK,
      amountForCadence(state.planningSalaryAnnual || 0, state.cadence || "monthly")
    );
  };

  const showStatus = (msg, tone = "") => {
    const el = $("#budgetStatus");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("is-hidden");
    el.classList.toggle("is-error", tone === "error");
    el.classList.toggle("is-ok", tone === "ok");
  };

  const showSaveStatus = (msg, tone = "") => {
    const el = $("#budgetSaveStatus");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("is-hidden");
    el.classList.toggle("is-error", tone === "error");
    el.classList.toggle("is-ok", tone === "ok");
  };

  const hideSaveStatus = () => {
    const el = $("#budgetSaveStatus");
    if (!el) return;
    el.textContent = "";
    el.classList.add("is-hidden");
    el.classList.remove("is-error", "is-ok");
  };

  const hideStatus = () => {
    const el = $("#budgetStatus");
    if (!el) return;
    el.textContent = "";
    el.classList.add("is-hidden");
    el.classList.remove("is-error", "is-ok");
  };

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

  const computeIncomeTotal = (records, start, end) => {
    if (!Array.isArray(records)) return 0;
    return records.reduce((sum, r) => {
      if (r?.type !== "income") return sum;
      if (start && end) {
        if (!r.date) return sum;
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return sum;
        if (d < start || d > end) return sum;
      }
      return sum + (Number(r.amount) || 0);
    }, 0);
  };

  const clamp01 = (value) => Math.min(1, Math.max(0, value));

  const resetSummaryCardStyles = () => {
    document
      .querySelectorAll(".summary-card")
      .forEach((card) => {
        card.style.background = "";
        card.style.borderColor = "";
      });
  };

  function renderSummary(totals, currency, incomeTotal = null) {
    $("#summaryTotalBudget").textContent = fmtMoney(totals.totalBudget, currency);
    $("#summarySpent").textContent = fmtMoney(totals.totalSpent, currency);
    $("#summaryRemaining").textContent = fmtMoney(totals.totalRemaining, currency);
    $("#summaryUnused").textContent = fmtMoney(totals.unused, currency);
    resetSummaryCardStyles();
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

  function renderTable(categories, spentMap, currency, budgetBase = 0) {
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
      const tdPercent = document.createElement("td");
      tdPercent.className = "num";
      const percentInput = document.createElement("input");
      percentInput.type = "number";
      percentInput.min = "0";
      percentInput.step = "0.1";
      percentInput.value = budgetBase > 0 && budget > 0 ? ((budget / budgetBase) * 100).toFixed(1) : "";
      percentInput.className = "budget-input budget-percent-input";
      percentInput.dataset.index = String(idx);
      percentInput.dataset.field = "percent";
      tdPercent.appendChild(percentInput);

      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = c.budget ?? "";
      input.className = "budget-input";
      input.dataset.index = String(idx);
      input.dataset.field = "amount";
      tdBudget.appendChild(input);

      const tdSpent = document.createElement("td");
      tdSpent.className = "num";
      tdSpent.textContent = fmtMoney(spent, currency);

      const tdRemaining = document.createElement("td");
      tdRemaining.className = "num remaining";
      tdRemaining.textContent = fmtMoney(remaining, currency);
      if (remaining < 0) tdRemaining.classList.add("negative");

      const tdProgress = document.createElement("td");
      const isSavings = normalizeName(c.name) === "savings";
      const bar = document.createElement("div");
      bar.className = "progress" + (!isSavings && spent > c.budget ? " over" : "");
      const fill = document.createElement("span");
      fill.style.width = `${progress * 100}%`;
      if (!isSavings && spent > budget) {
        fill.style.backgroundColor = "var(--bad)";
      } else {
        fill.style.backgroundColor = isSavings
          ? savingsFillColor(progress)
          : progressFillColor(progress);
      }
      bar.appendChild(fill);
      tdProgress.appendChild(bar);

      tr.appendChild(tdName);
      tr.appendChild(tdPercent);
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

    const budgetSelect = $("#budgetSelector");
    const cadenceSelect = $("#budgetCadenceSelect");
    const periodSelect = $("#budgetMonthSelect");
    let periodOptions = [];
    let budgetEntries = [];

    const setPeriodOptions = (cadenceId, selectedKey) => {
      periodOptions = buildPeriodOptions(cadenceId, selectedKey);
      const selected = periodOptions.find((p) => p.key === selectedKey) || periodOptions[0];
      return selected;
    };

    const renderBudgetSelector = (entries, selectedKey) => {
      if (!budgetSelect) return;
      budgetSelect.innerHTML = "";
      if (!entries.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No budgets yet";
        option.disabled = true;
        option.selected = true;
        budgetSelect.appendChild(option);
        budgetSelect.disabled = true;
        const deleteBtn = $("#btnDeleteBudget");
        if (deleteBtn) deleteBtn.disabled = true;
        return;
      }
      budgetSelect.disabled = false;
      const deleteBtn = $("#btnDeleteBudget");
      if (deleteBtn) deleteBtn.disabled = false;
      entries.forEach((entry) => {
        const option = document.createElement("option");
        option.value = makeBudgetKey(entry.cadence, entry.periodKey);
        option.textContent = buildBudgetLabel(entry.cadence, entry.periodKey);
        budgetSelect.appendChild(option);
      });
      if (selectedKey) budgetSelect.value = selectedKey;
    };

    const syncBudgetSelector = (cadenceId, periodKey) => {
      const ordered = orderBudgetEntries(budgetEntries);
      if (!ordered.length) {
        renderBudgetSelector([], null);
        return;
      }
      const selected =
        ordered.find((entry) => entry.cadence === cadenceId && entry.periodKey === periodKey) ||
        ordered[0];
      renderBudgetSelector(ordered, makeBudgetKey(selected.cadence, selected.periodKey));
    };

    let initialCadence = "monthly";
    let initialPeriod = setPeriodOptions(initialCadence);

    budgetEntries = await getBudgetEntriesFromDb();
    if (budgetEntries.length > 0) {
      const match = budgetEntries.find(
        (entry) => entry.cadence === initialCadence && entry.periodKey === initialPeriod.key
      );
      const selected = match || orderBudgetEntries(budgetEntries)[0];
      initialCadence = selected.cadence;
      initialPeriod = setPeriodOptions(initialCadence, selected.periodKey);
    }

    if (cadenceSelect) cadenceSelect.value = initialCadence;
    populatePeriodSelect(periodSelect, initialCadence, initialPeriod.key);
    syncBudgetSelector(initialCadence, initialPeriod.key);

    let state = {
      cadence: initialCadence,
      periodKey: initialPeriod.key,
      periodLabel: initialPeriod.label,
      periodStart: initialPeriod.start,
      periodEnd: initialPeriod.end,
      categories: [],
      spentMap: new Map(),
      records,
      planningSalaryAnnual: 0,
      sheetId: null,
      isDirty: false,
    };

    const getBudgetBase = () => amountForCadence(state.planningSalaryAnnual || 0, state.cadence);

    const loadPlanningSalary = async () => {
      try {
        const [payload, publicSettings] = await Promise.all([
          api.planningSheets.get(),
          api.appSettings.getPublic().catch(() => null),
        ]);
        state.planningSalaryAnnual = computePlanningSalaryAfterExpensesAnnual(payload?.planningSheet?.data, publicSettings?.taxData);
      } catch {
        state.planningSalaryAnnual = 0;
      }
      renderPlanningSalaryCards(state.planningSalaryAnnual);
    };

    await loadPlanningSalary();
    window.addEventListener("planning:updated", loadPlanningSalary);

    const getPeriodRecords = () =>
      records.filter((r) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) return false;
        return d >= state.periodStart && d <= state.periodEnd;
      });

    const loadSpentMapFromServer = async () => {
      if (!api?.budgetSheets?.summary) return false;
      try {
        const summary = await api.budgetSheets.summary({
          cadence: state.cadence,
          period: state.periodKey,
        });
        const map = new Map();
        const standard = summary?.totals?.standard || {};
        Object.entries(standard).forEach(([column, spent]) => {
          const categoryName = COLUMN_CATEGORY_MAP.get(column);
          if (!categoryName) return;
          map.set(normalizeName(categoryName), Number(spent || 0));
        });
        (summary?.totals?.custom || []).forEach((entry) => {
          const category = String(entry?.category || "").trim();
          if (!category) return;
          map.set(normalizeName(category), Number(entry?.spent || 0));
        });
        state.spentMap = map;
        return true;
      } catch (err) {
        console.warn("Falling back to local budget aggregation:", err);
        return false;
      }
    };

    const refreshView = ({ forceLocal = false } = {}) => {
      const periodRecords = getPeriodRecords();
      if (forceLocal || !state.spentMap || state.spentMap.size === 0) {
        state.spentMap = buildSpentMap(periodRecords, state.categories);
      }
      state.categories = state.categories.map((c) => ({
        ...c,
        spent: state.spentMap.get(normalizeName(c.name)) || 0,
      }));

      renderSummary(
        computeTotals(state.categories, state.spentMap),
        CURRENCY_FALLBACK,
        computeIncomeTotal(periodRecords)
      );
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK, getBudgetBase());
    };

    const saveBudgetSheet = async ({ silent = false } = {}) => {
      const saveBtn = $("#btnSaveBudget");
      const payload = buildBudgetPayload(state.categories);
      hideSaveStatus();
      try {
        let targetId = state.sheetId;
        if (!targetId) {
          try {
            const existing = await api.budgetSheets.lookup({
              cadence: state.cadence,
              period: state.periodKey,
            });
            targetId = existing?.id || null;
          } catch {
            targetId = null;
          }
        }

        if (targetId) {
          const updated = await api.budgetSheets.update(targetId, {
            cadence: state.cadence,
            period: state.periodKey,
            categories: payload.categories,
            customCategories: payload.customCategories,
          });
          state.sheetId = updated?.id || targetId;
        } else {
          const created = await api.budgetSheets.create({
            cadence: state.cadence,
            period: state.periodKey,
            categories: payload.categories,
            customCategories: payload.customCategories,
          });
          state.sheetId = created?.id || null;
        }
        state.isDirty = false;
        if (saveBtn) saveBtn.disabled = true;
        if (!silent) showSaveStatus("Budget saved.", "ok");
        await refreshBudgetEntries();
      } catch (err) {
        if (!silent) showSaveStatus("Failed to save budget.", "error");
        console.warn("Failed to save budget sheet:", err);
      }
    };

    const loadBudgetSheet = async () => {
      try {
        const sheet = await api.budgetSheets.lookup({
          cadence: state.cadence,
          period: state.periodKey,
        });
        state.sheetId = sheet?.id || null;
        applySheetToState(sheet, state);
        state.isDirty = false;
        const saveBtn = $("#btnSaveBudget");
        if (saveBtn) saveBtn.disabled = true;
        const usedServer = await loadSpentMapFromServer();
        refreshView({ forceLocal: !usedServer });
      } catch (err) {
        if (err?.message?.includes("not found")) {
          state.sheetId = null;
          return;
        }
        console.warn("Failed to load budget sheet:", err);
      }
    };

    const renderForPeriod = async (periodKey) => {
      const selected = periodOptions.find((p) => p.key === periodKey) || periodOptions[0];
      state.periodKey = selected.key;
      state.periodLabel = selected.label;
      state.periodStart = selected.start;
      state.periodEnd = selected.end;

      const periodEl = $("#budgetPeriod");
      if (periodEl) {
        periodEl.textContent = `${getCadenceLabel(state.cadence)} · ${selected.label}`;
      }

      state.categories = getBudgetCategoryNames().map((name) => ({
        name,
        budget: null,
      }));
      state.isDirty = false;
      const saveBtn = $("#btnSaveBudget");
      if (saveBtn) saveBtn.disabled = true;
      const hasSavedBudget = budgetEntries.some(
        (entry) => entry.cadence === state.cadence && entry.periodKey === state.periodKey
      );
      if (hasSavedBudget) {
        await loadBudgetSheet();
      } else {
        state.sheetId = null;
        refreshView({ forceLocal: true });
      }
      syncBudgetSelector(state.cadence, state.periodKey);
    };

    await renderForPeriod(state.periodKey);

    const changeBudgetSelection = async (cadenceId, periodKey) => {
      state.cadence = CADENCE_LOOKUP.has(cadenceId) ? cadenceId : "monthly";
      const selected = setPeriodOptions(state.cadence, periodKey);
      await renderForPeriod(selected.key);
      if (cadenceSelect) cadenceSelect.value = state.cadence;
      populatePeriodSelect(periodSelect, state.cadence, state.periodKey);
      hideStatus();
    };

    const refreshBudgetEntries = async () => {
      budgetEntries = await getBudgetEntriesFromDb();
      syncBudgetSelector(state.cadence, state.periodKey);
    };

    budgetSelect?.addEventListener("change", async (e) => {
      const selected = parseBudgetKey(e.target.value);
      if (!selected) return;
      await changeBudgetSelection(selected.cadence, selected.periodKey);
    });

    $("#budgetTbody")?.addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.dataset.index) return;

      const idx = Number(target.dataset.index);
      const field = target.dataset.field || "amount";
      const budgetBase = getBudgetBase();
      if (field === "percent") {
        if (target.value === "" || budgetBase <= 0) {
          state.categories[idx].budget = null;
        } else {
          const percent = Number(target.value || 0);
          state.categories[idx].budget = Math.max(
            0,
            Number.isFinite(percent) ? (budgetBase * percent) / 100 : 0
          );
        }
      } else {
        if (target.value === "") {
          state.categories[idx].budget = null;
        } else {
          const next = Number(target.value || 0);
          state.categories[idx].budget = Math.max(0, Number.isFinite(next) ? next : 0);
        }
      }
      state.isDirty = true;
      const saveBtn = $("#btnSaveBudget");
      if (saveBtn) saveBtn.disabled = false;

      const updatedTotals = computeTotals(state.categories, state.spentMap);
      renderSummary(
        updatedTotals,
        CURRENCY_FALLBACK,
        computeIncomeTotal(state.records, state.periodStart, state.periodEnd)
      );
      const row = target.closest("tr");
      if (row) {
        const category = state.categories[idx];
        const spent = state.spentMap.get(normalizeName(category.name)) || 0;
        const budget = Number.isFinite(category.budget) ? category.budget : 0;
        const remaining = budget - spent;
        const progress = budget > 0 ? Math.min(spent / budget, 1) : 0;
        const isSavings = normalizeName(category.name) === "savings";

        const amountInput = row.querySelector('input[data-field="amount"]');
        const percentInput = row.querySelector('input[data-field="percent"]');
        if (amountInput && amountInput !== target) {
          amountInput.value = category.budget ?? "";
        }
        if (percentInput && percentInput !== target) {
          percentInput.value = budgetBase > 0 && budget > 0 ? ((budget / budgetBase) * 100).toFixed(1) : "";
        }

        const remainingCell = row.querySelector("td.remaining");
        if (remainingCell) {
          remainingCell.textContent = fmtMoney(remaining, CURRENCY_FALLBACK);
          remainingCell.classList.toggle("negative", remaining < 0);
        }

        const progressBar = row.querySelector(".progress");
        const progressFill = row.querySelector(".progress > span");
        if (progressBar) {
          progressBar.classList.toggle("over", !isSavings && spent > budget);
        }
        if (progressFill) {
          progressFill.style.width = `${progress * 100}%`;
          if (!isSavings && spent > budget) {
            progressFill.style.backgroundColor = "var(--bad)";
          } else {
            progressFill.style.backgroundColor = isSavings
              ? savingsFillColor(progress)
              : progressFillColor(progress);
          }
        }
      }
      hideStatus();
    });

    $("#btnResetBudgets")?.addEventListener("click", () => {
      state.categories = getBudgetCategoryNames().map((name) => ({ name, budget: null }));
      state.isDirty = true;
      const saveBtn = $("#btnSaveBudget");
      if (saveBtn) saveBtn.disabled = false;

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

      renderSummary(
        computeTotals(state.categories, state.spentMap),
        CURRENCY_FALLBACK,
        computeIncomeTotal(state.records, state.periodStart, state.periodEnd)
      );
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK, getBudgetBase());
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
      state.isDirty = true;
      const saveBtn = $("#btnSaveBudget");
      if (saveBtn) saveBtn.disabled = false;

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

      renderSummary(
        computeTotals(state.categories, state.spentMap),
        CURRENCY_FALLBACK,
        computeIncomeTotal(state.records, state.periodStart, state.periodEnd)
      );
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK, getBudgetBase());
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
      state.isDirty = true;
      const saveBtn = $("#btnSaveBudget");
      if (saveBtn) saveBtn.disabled = false;

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

      renderSummary(
        computeTotals(state.categories, state.spentMap),
        CURRENCY_FALLBACK,
        computeIncomeTotal(state.records, state.periodStart, state.periodEnd)
      );
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK, getBudgetBase());
      showStatus(`Moved ${fmtMoney(moved, CURRENCY_FALLBACK)} to ${target}.`);
    });

    const btnSaveBudget = $("#btnSaveBudget");
    const btnExportBudgetCsv = $("#btnExportBudgetCsv");

    btnSaveBudget?.addEventListener("click", async () => {
      await saveBudgetSheet();
    });

    btnExportBudgetCsv?.addEventListener("click", async () => {
      await saveBudgetSheet({ silent: true });
      await exportSheets({
        title: `Budget ${state.cadence} ${state.periodKey}`,
        filenameBase: `budget_${state.cadence}_${state.periodKey}`,
        format: getPreferredExportFormat(),
        sheets: [
          {
            name: "Budget",
            rows: state.categories.map((c) => ({
              Category: c.name,
              Percent:
                getBudgetBase() > 0 && Number.isFinite(c.budget)
                  ? Number(((c.budget / getBudgetBase()) * 100).toFixed(2))
                  : "",
              Budget: Number.isFinite(c.budget) ? c.budget : "",
              Spent: Number.isFinite(c.spent) ? c.spent : 0,
              Remaining:
                Number.isFinite(c.budget) && Number.isFinite(c.spent)
                  ? Number((c.budget || 0) - (c.spent || 0))
                  : "",
            })),
          },
        ],
      });
      showStatus("Export started.", "ok");
    });

    const addBudgetModal = $("#addBudgetModal");
    const addBudgetForm = $("#addBudgetForm");
    const addBudgetCadenceSelect = $("#budgetCadenceSelect");
    const addBudgetPeriodSelect = $("#budgetMonthSelect");
    const btnAddBudget = $("#btnAddBudget");
    const cancelAddBudgetBtn = $("#cancelAddBudgetBtn");
    const deleteBudgetModal = $("#deleteBudgetModal");
    const deleteBudgetText = $("#deleteBudgetText");
    const btnDeleteBudget = $("#btnDeleteBudget");
    const confirmDeleteBudgetBtn = $("#confirmDeleteBudgetBtn");
    const cancelDeleteBudgetBtn = $("#cancelDeleteBudgetBtn");

    const openAddBudgetModal = () => {
      addBudgetModal?.classList.remove("hidden");
      if (addBudgetCadenceSelect) addBudgetCadenceSelect.value = state.cadence;
      populatePeriodSelect(addBudgetPeriodSelect, state.cadence, state.periodKey);
      addBudgetCadenceSelect?.focus();
    };

    const closeAddBudgetModal = () => {
      addBudgetModal?.classList.add("hidden");
    };

    btnAddBudget?.addEventListener("click", openAddBudgetModal);
    cancelAddBudgetBtn?.addEventListener("click", closeAddBudgetModal);
    addBudgetModal?.addEventListener("click", (e) => {
      if (e.target === addBudgetModal) closeAddBudgetModal();
    });

    addBudgetCadenceSelect?.addEventListener("change", (e) => {
      const next = e.target.value;
      populatePeriodSelect(addBudgetPeriodSelect, next);
    });

    addBudgetForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cadenceId = addBudgetCadenceSelect?.value || "monthly";
      const periodKey = addBudgetPeriodSelect?.value;
      await changeBudgetSelection(cadenceId, periodKey);
      await saveBudgetSheet({ silent: true });
      closeAddBudgetModal();
    });

    const deleteBudgetFromDb = async () => {
      let sheetId = state.sheetId;
      if (!sheetId) {
        try {
          const sheet = await api.budgetSheets.lookup({
            cadence: state.cadence,
            period: state.periodKey,
          });
          sheetId = sheet?.id || null;
        } catch (err) {
          if (err?.message?.includes("not found")) return null;
          throw err;
        }
      }

      if (!sheetId) return null;
      await api.budgetSheets.delete(sheetId);
      if (state.sheetId === sheetId) state.sheetId = null;
      return sheetId;
    };

    const openDeleteBudgetModal = () => {
      const label = buildBudgetLabel(state.cadence, state.periodKey);
      if (deleteBudgetText) {
        deleteBudgetText.textContent = "Are you sure you want to delete the budget for ";
        const strong = document.createElement("strong");
        strong.textContent = label;
        deleteBudgetText.appendChild(strong);
        deleteBudgetText.appendChild(document.createTextNode("?"));
      }
      deleteBudgetModal?.classList.remove("hidden");
      confirmDeleteBudgetBtn?.focus();
    };

    const closeDeleteBudgetModal = () => {
      deleteBudgetModal?.classList.add("hidden");
    };

    btnDeleteBudget?.addEventListener("click", openDeleteBudgetModal);
    cancelDeleteBudgetBtn?.addEventListener("click", closeDeleteBudgetModal);
    deleteBudgetModal?.addEventListener("click", (e) => {
      if (e.target === deleteBudgetModal) closeDeleteBudgetModal();
    });

    confirmDeleteBudgetBtn?.addEventListener("click", async () => {
      try {
        await deleteBudgetFromDb();
      } catch (err) {
        showStatus("Failed to delete budget from server.", "error");
        return;
      }

      const deleteCadence = state.cadence;
      const deletePeriod = state.periodKey;
      await refreshBudgetEntries();

      closeDeleteBudgetModal();

      if (budgetEntries.length > 0) {
        const ordered = orderBudgetEntries(budgetEntries);
        const next = ordered[0];
        await changeBudgetSelection(next.cadence, next.periodKey);
        showStatus("Budget deleted.", "ok");
        return;
      }

      renderBudgetSelector([], null);
      state.sheetId = null;
      state.categories = getBudgetCategoryNames().map((name) => ({ name, budget: null }));
      state.isDirty = false;
      const saveBtn = $("#btnSaveBudget");
      if (saveBtn) saveBtn.disabled = true;
      refreshView();
      showStatus("Budget deleted. Add a budget to continue.", "ok");
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
      if (e.key !== "Escape") return;
      if (deleteBudgetModal && !deleteBudgetModal.classList.contains("hidden")) {
        closeDeleteBudgetModal();
        return;
      }
      if (addBudgetModal && !addBudgetModal.classList.contains("hidden")) {
        closeAddBudgetModal();
        return;
      }
      if (customCategoryModal && !customCategoryModal.classList.contains("hidden")) {
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

      state.isDirty = true;
      const saveBtn = $("#btnSaveBudget");
      if (saveBtn) saveBtn.disabled = false;
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

      renderSummary(
        computeTotals(state.categories, state.spentMap),
        CURRENCY_FALLBACK,
        computeIncomeTotal(state.records, state.periodStart, state.periodEnd)
      );
      renderReallocateOptions(state.categories);
      renderTable(state.categories, state.spentMap, CURRENCY_FALLBACK, getBudgetBase());
      closeCustomModal();
    });
  }

  init();
}

