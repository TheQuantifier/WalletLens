import { useEffect, useMemo, useState } from "react";
import { api } from "../../scripts/api.js";

const FREQUENCIES = [
  { id: "weekly", label: "Weekly", annual: 52 },
  { id: "biweekly", label: "Biweekly", annual: 26 },
  { id: "monthly", label: "Monthly", annual: 12 },
  { id: "quarterly", label: "Quarterly", annual: 4 },
  { id: "semi-annually", label: "Semi-annually", annual: 2 },
  { id: "yearly", label: "Yearly", annual: 1 },
  { id: "one-time", label: "One-time", annual: 1 },
];

const FREQ = new Map(FREQUENCIES.map((item) => [item.id, item]));
const ALLOCATION_TYPES = [
  "Everyday cash",
  "Emergency fund",
  "Retirement",
  "Investing",
  "Debt paydown",
  "Education",
  "Giving",
  "Tax reserve",
  "Operating reserve",
  "Payroll reserve",
  "Growth fund",
  "Owner pay",
  "Other",
];
const PERSONAL_PURPOSE_DEFAULTS = ["Everyday Cash", "Emergency Fund", "Retirement", "Investing", "Goal Fund"];
const BUSINESS_PURPOSE_DEFAULTS = ["Operating Reserve", "Tax Reserve", "Payroll Reserve", "Growth Fund", "Owner Pay"];
const SOURCE_DEFAULTS = [
  "Take-home pay",
  "Checking",
  "Savings",
  "Everyday Cash",
  "Emergency Fund",
  "Money Market",
  "Investment",
  "Business Checking",
  "Operating Reserve",
  "Tax Reserve",
];
const TAX_KIND_OPTIONS = [
  { id: "manual", label: "Manual tax %" },
  { id: "federal", label: "Federal income tax" },
  { id: "social_security", label: "Social Security tax" },
  { id: "medicare", label: "Medicare tax" },
  { id: "state", label: "State tax" },
  { id: "local", label: "Local tax" },
];
const DEFAULT_TAX_DATA = {
  year: 2025,
  filingStatus: "single",
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

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function money(value) {
  const currency = localStorage.getItem("settings_currency") || localStorage.getItem("auto_currency") || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value) || 0);
  } catch {
    return `$${(Number(value) || 0).toFixed(2)}`;
  }
}

function signedMoney(value, isDebit = false) {
  const amount = Math.abs(num(value));
  return `${isDebit ? "-" : ""}${money(amount)}`;
}

function num(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function annualize(row, frequency = row.frequency) {
  return num(row.amount) * (FREQ.get(frequency)?.annual || 12);
}

function annualizeAmount(amount, frequency) {
  return num(amount) * (FREQ.get(frequency)?.annual || 12);
}

function plannedAnnual(row, baseAnnual = 0) {
  const allocationPercent = Math.max(0, Math.min(100, num(row.percent)));
  if (allocationPercent > 0 && baseAnnual > 0) return baseAnnual * (allocationPercent / 100);
  return annualize(row);
}

function convertAnnual(annual, frequency) {
  const factor = FREQ.get(frequency)?.annual || 12;
  return annual / factor;
}

function percent(value) {
  const next = Number(value);
  return Number.isFinite(next) ? `${(next * 100).toFixed(next > 0 && next < 0.01 ? 2 : 1)}%` : "-";
}

function normalizeTaxData(value) {
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
}

function getTaxKind(row) {
  const explicit = String(row.taxKind || "").trim();
  if (explicit) return explicit;
  const text = `${row.label || ""} ${row.category || ""}`.toLowerCase();
  if (text.includes("federal")) return "federal";
  if (text.includes("social security")) return "social_security";
  if (text.includes("medicare")) return "medicare";
  if (text.includes("fica")) return "social_security";
  if (text.includes("state")) return "state";
  if (text.includes("local")) return "local";
  return row.type === "tax" ? "manual" : "";
}

function calculateFederalTax(grossAnnual, taxData) {
  const federal = normalizeTaxData(taxData).federalIncomeTax;
  const standardDeduction = Math.max(0, num(federal.standardDeduction));
  const taxableIncome = Math.max(0, grossAnnual - standardDeduction);
  let tax = 0;
  const applied = [];
  for (const rawBracket of federal.brackets || []) {
    const over = Math.max(0, num(rawBracket.over));
    const upper = rawBracket.upTo === null || rawBracket.upTo === undefined || rawBracket.upTo === ""
      ? Infinity
      : Math.max(over, num(rawBracket.upTo));
    const rate = Math.max(0, Math.min(1, num(rawBracket.rate)));
    if (taxableIncome <= over || rate <= 0) continue;
    const taxableAtRate = Math.max(0, Math.min(taxableIncome, upper) - over);
    if (!taxableAtRate) continue;
    const amount = taxableAtRate * rate;
    tax += amount;
    applied.push({ over, upTo: Number.isFinite(upper) ? upper : null, rate, taxable: taxableAtRate, amount });
  }
  const topRate = applied.at(-1)?.rate || 0;
  return {
    amount: tax,
    effectiveRate: grossAnnual > 0 ? tax / grossAnnual : 0,
    displayRate: grossAnnual > 0 ? tax / grossAnnual : 0,
    details: [
      `Top bracket reached: ${percent(topRate)}`,
      `Gross income: ${money(grossAnnual)}`,
      `Standard deduction: ${money(standardDeduction)}`,
      `Taxable income: ${money(taxableIncome)}`,
      ...applied.map((item) => {
        const cap = item.upTo === null ? "and above" : `to ${money(item.upTo)}`;
        return `${percent(item.rate)} on ${money(item.over)} ${cap}: ${money(item.amount)}`;
      }),
      `Effective rate: ${percent(grossAnnual > 0 ? tax / grossAnnual : 0)}`,
    ],
  };
}

function calculateTaxForRow(row, grossAnnual, taxData) {
  if (row.type !== "tax") return { amount: annualize(row), effectiveRate: 0, displayRate: 0, details: [] };
  const overrideMode = String(row.taxOverrideMode || "").trim();
  const overridePercent = num(row.taxOverridePercent);
  const overrideAmount = num(row.taxOverrideAmount);
  if (overrideMode === "percent" && overridePercent > 0) {
    const rate = Math.max(0, Math.min(1, overridePercent / 100));
    return {
      amount: grossAnnual * rate,
      effectiveRate: rate,
      displayRate: rate,
      corrected: true,
      details: [`Corrected to ${percent(rate)} for this planning sheet.`, `Gross income: ${money(grossAnnual)}`],
    };
  }
  if (overrideMode === "amount" && overrideAmount > 0) {
    const annualAmount = annualizeAmount(overrideAmount, row.frequency);
    return {
      amount: annualAmount,
      effectiveRate: grossAnnual > 0 ? annualAmount / grossAnnual : 0,
      displayRate: grossAnnual > 0 ? annualAmount / grossAnnual : 0,
      corrected: true,
      details: [`Corrected amount: ${money(overrideAmount)} ${frequencyLabel(row.frequency).toLowerCase()}.`, `Annualized correction: ${money(annualAmount)}`],
    };
  }
  const kind = getTaxKind(row);
  const data = normalizeTaxData(taxData);
  if (kind === "federal") return calculateFederalTax(grossAnnual, data);
  if (kind === "social_security") {
    const rate = Math.max(0, Math.min(1, num(data.fica.socialSecurity.rate)));
    const wageBase = data.fica.socialSecurity.wageBase === null ? grossAnnual : Math.max(0, num(data.fica.socialSecurity.wageBase));
    const taxable = Math.min(grossAnnual, wageBase);
    return {
      amount: taxable * rate,
      effectiveRate: grossAnnual > 0 ? (taxable * rate) / grossAnnual : 0,
      displayRate: rate,
      details: [`${percent(rate)} Social Security tax`, `Wage base: ${money(wageBase)}`, `Taxed wages: ${money(taxable)}`],
    };
  }
  if (kind === "medicare") {
    const rate = Math.max(0, Math.min(1, num(data.fica.medicare.rate)));
    const taxable = grossAnnual;
    return {
      amount: taxable * rate,
      effectiveRate: grossAnnual > 0 ? (taxable * rate) / grossAnnual : 0,
      displayRate: rate,
      details: [`${percent(rate)} Medicare tax`, `Taxed wages: ${money(taxable)}`],
    };
  }
  if (kind === "state" || kind === "local") {
    const label = kind === "state" ? "State tax" : "Local tax";
    const configuredRate = Math.max(0, Math.min(1, num(row.percent) / 100));
    if (configuredRate > 0) {
      return {
        amount: grossAnnual * configuredRate,
        effectiveRate: configuredRate,
        displayRate: configuredRate,
        details: [`${label} configured at ${percent(configuredRate)} for this row.`, `Gross income: ${money(grossAnnual)}`],
      };
    }
    const configuredAmount = annualize(row);
    if (configuredAmount > 0) {
      return {
        amount: configuredAmount,
        effectiveRate: grossAnnual > 0 ? configuredAmount / grossAnnual : 0,
        displayRate: grossAnnual > 0 ? configuredAmount / grossAnnual : 0,
        details: [`${label} amount entered as ${money(num(row.amount))} ${frequencyLabel(row.frequency).toLowerCase()}.`],
      };
    }
    return {
      amount: 0,
      effectiveRate: 0,
      displayRate: 0,
      details: [`No default ${kind} tax formula is configured yet. Use Correct to set a user-specific percentage or amount.`],
    };
  }
  const manualRate = Math.max(0, Math.min(1, num(row.percent) / 100));
  if (manualRate > 0) {
    return {
      amount: grossAnnual * manualRate,
      effectiveRate: manualRate,
      displayRate: manualRate,
      details: [`Manual ${percent(manualRate)} tax on ${money(grossAnnual)} gross income.`],
    };
  }
  return {
    amount: annualize(row),
    effectiveRate: grossAnnual > 0 ? annualize(row) / grossAnnual : 0,
    displayRate: grossAnnual > 0 ? annualize(row) / grossAnnual : 0,
    details: [`Manual amount entered as ${money(num(row.amount))} ${frequencyLabel(row.frequency).toLowerCase()}.`],
  };
}

function emptyRow(overrides = {}) {
  return {
    id: makeId("planning_row"),
    label: "",
    type: "item",
    taxKind: "",
    category: "",
    frequency: "monthly",
    amount: "",
    percent: "",
    taxOverrideMode: "",
    taxOverridePercent: "",
    taxOverrideAmount: "",
    sourceAccount: "Savings",
    destinationAccount: "",
    startDate: "",
    endDate: "",
    taxable: false,
    notes: "",
    ...overrides,
  };
}

function defaultPlanningData(isBusiness = false) {
  const purposeDefaults = isBusiness ? BUSINESS_PURPOSE_DEFAULTS : PERSONAL_PURPOSE_DEFAULTS;
  return {
    version: 1,
    accountType: isBusiness ? "business" : "personal",
    tables: {
      takeHomePay: {
        frequency: "yearly",
        rows: [
          emptyRow({ label: isBusiness ? "Revenue" : "Salary", type: "income", category: isBusiness ? "Revenue" : "Salary", frequency: "yearly" }),
          emptyRow({ label: isBusiness ? "Business taxes" : "Federal tax", type: "tax", taxKind: "federal", category: "Tax", frequency: "yearly" }),
          emptyRow({ label: isBusiness ? "State business tax" : "State tax", type: "tax", taxKind: "state", category: "Tax", frequency: "yearly" }),
          emptyRow({ label: "Social Security tax", type: "tax", taxKind: "social_security", category: "Tax", frequency: "yearly" }),
          emptyRow({ label: "Medicare tax", type: "tax", taxKind: "medicare", category: "Tax", frequency: "yearly" }),
        ],
      },
      startingBalance: {
        frequency: "one-time",
        rows: [
          emptyRow({ label: isBusiness ? "Business checking" : "Checking", type: "liquid", category: "Liquid cash", frequency: "one-time", sourceAccount: isBusiness ? "Business Checking" : "Checking" }),
          emptyRow({ label: isBusiness ? "Operating reserve" : "High-yield savings", type: "liquid", category: "Reserve cash", frequency: "one-time", sourceAccount: isBusiness ? "Operating Reserve" : "Savings" }),
          emptyRow({ label: isBusiness ? "Business investments" : "Investment portfolio", type: "investment", category: "Invested assets", frequency: "one-time", sourceAccount: "Investment" }),
        ],
      },
      savingsBreakdown: {
        frequency: "one-time",
        rows: purposeDefaults.map((label) => emptyRow({ label, type: "purpose", category: label, frequency: "one-time", sourceAccount: label, destinationAccount: label })),
      },
      expenseItems: {
        frequency: "monthly",
        rows: isBusiness
          ? [
              emptyRow({ label: "Tax reserve", type: "Tax reserve", category: "Tax reserve", frequency: "monthly", percent: "25", sourceAccount: "Take-home pay", destinationAccount: "Tax Reserve" }),
              emptyRow({ label: "Operating reserve", type: "Operating reserve", category: "Operating reserve", frequency: "monthly", percent: "10", sourceAccount: "Take-home pay", destinationAccount: "Operating Reserve" }),
              emptyRow({ label: "Owner pay", type: "Owner pay", category: "Owner pay", frequency: "monthly", percent: "40", sourceAccount: "Take-home pay", destinationAccount: "Owner Pay" }),
            ]
          : [
              emptyRow({ label: "Emergency fund", type: "Emergency fund", category: "Emergency fund", frequency: "monthly", percent: "10", sourceAccount: "Take-home pay", destinationAccount: "Emergency Fund" }),
              emptyRow({ label: "Retirement", type: "Retirement", category: "Retirement", frequency: "monthly", percent: "15", sourceAccount: "Take-home pay", destinationAccount: "Retirement" }),
              emptyRow({ label: "Investing", type: "Investing", category: "Investing", frequency: "monthly", percent: "10", sourceAccount: "Take-home pay", destinationAccount: "Investing" }),
            ],
      },
      temporaryExpenses: {
        frequency: "monthly",
        rows: [
          emptyRow({ label: isBusiness ? "Planned equipment purchase" : "Known future commitment", type: "commitment", category: "Scheduled commitment", frequency: "monthly", sourceAccount: isBusiness ? "Operating Reserve" : "Savings" }),
        ],
      },
    },
  };
}

function normalizeData(payload, isBusiness) {
  const base = defaultPlanningData(isBusiness);
  const data = payload && typeof payload === "object" ? payload : {};
  return {
    ...base,
    ...data,
    tables: {
      ...base.tables,
      ...(data.tables || {}),
    },
  };
}

function dateOccurrences(row, frequency = row.frequency) {
  if (!row.startDate || !row.endDate) return annualize(row, frequency);
  const start = new Date(`${row.startDate}T00:00:00`);
  const end = new Date(`${row.endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return annualize(row, frequency);
  const days = Math.max(1, (end - start) / 86400000 + 1);
  const annual = annualize(row, frequency);
  return annual * Math.min(days / 365, 1);
}

function computePlanning(data, taxData = DEFAULT_TAX_DATA) {
  const tables = data.tables || {};
  const takeHomeRows = tables.takeHomePay?.rows || [];
  const grossAnnual = takeHomeRows.filter((row) => row.type === "income").reduce((sum, row) => sum + annualize(row), 0);
  const taxAnnual = takeHomeRows
    .filter((row) => row.type === "tax")
    .reduce((sum, row) => sum + calculateTaxForRow(row, grossAnnual, taxData).amount, 0);
  const takeHomeAnnual = grossAnnual - taxAnnual;

  const startingRows = tables.startingBalance?.rows || [];
  const startingLiquid = startingRows.filter((row) => row.type !== "investment" && row.type !== "roth").reduce((sum, row) => sum + num(row.amount), 0);
  const startingInvestments = startingRows.filter((row) => row.type === "investment").reduce((sum, row) => sum + num(row.amount), 0);

  const plannedFundingAnnual = (tables.expenseItems?.rows || []).reduce((sum, row) => sum + plannedAnnual(row, takeHomeAnnual), 0);
  const temporaryRows = tables.temporaryExpenses?.rows || [];
  const scheduledFromLiquid = temporaryRows
    .filter((row) => !String(row.sourceAccount || "").toLowerCase().includes("investment"))
    .reduce((sum, row) => sum + dateOccurrences(row), 0);
  const scheduledCommitmentTotal = temporaryRows.reduce((sum, row) => sum + dateOccurrences(row), 0);
  const unassignedTakeHomeAnnual = takeHomeAnnual - plannedFundingAnnual - scheduledCommitmentTotal;
  const currentLiquidAfterCommitments = startingLiquid - scheduledFromLiquid;
  const projectedNetPosition = startingLiquid + startingInvestments + takeHomeAnnual - scheduledCommitmentTotal;

  return {
    grossAnnual,
    taxAnnual,
    takeHomeAnnual,
    startingLiquid,
    startingInvestments,
    plannedFundingAnnual,
    scheduledFromLiquid,
    scheduledCommitmentTotal,
    unassignedTakeHomeAnnual,
    currentLiquidAfterCommitments,
    projectedNetPosition,
    liquidAfterExpenses: currentLiquidAfterCommitments,
    salaryAfterExpensesAnnual: unassignedTakeHomeAnnual,
    netWorthAfterExpenses: projectedNetPosition,
  };
}

function FrequencySelect({ value, onChange, includeOneTime = false }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {FREQUENCIES.filter((item) => includeOneTime || item.id !== "one-time").map((item) => (
        <option key={item.id} value={item.id}>{item.label}</option>
      ))}
    </select>
  );
}

function frequencyLabel(value) {
  return FREQ.get(value)?.label || value || "Monthly";
}

function formatDateRange(row) {
  if (!row.startDate && !row.endDate) return "-";
  if (row.startDate && row.endDate) return `${row.startDate} to ${row.endDate}`;
  return row.startDate || row.endDate;
}

function isDebitPlanningRow(tableKey, row) {
  const type = String(row?.type || "").toLowerCase();
  if (type === "tax" || type === "expense" || type === "debit" || type === "commitment") return true;
  return tableKey === "temporaryExpenses";
}

function PlanningTable({
  title,
  description,
  tableKey,
  data,
  setData,
  columns,
  taxData,
  expenseSource = false,
  sourceColumnLabel = "Paid from",
  sourceFieldLabel = "Paid from",
  quickAdd = false,
  quickAddLabel = "Add entry",
  onQuickAdd,
}) {
  const table = data.tables[tableKey];
  const rows = table.rows || [];
  const isTakeHomePay = tableKey === "takeHomePay";
  const isAllocationPlan = tableKey === "expenseItems";
  const showNotes = !isTakeHomePay;
  const planningTakeHomeRows = data.tables.takeHomePay?.rows || [];
  const planningGrossAnnual = planningTakeHomeRows.filter((row) => row.type === "income").reduce((sum, row) => sum + annualize(row), 0);
  const planningTaxAnnual = planningTakeHomeRows
    .filter((row) => row.type === "tax")
    .reduce((sum, row) => sum + calculateTaxForRow(row, planningGrossAnnual, taxData).amount, 0);
  const planningTakeHomeAnnual = planningGrossAnnual - planningTaxAnnual;
  const grossAnnual = isTakeHomePay ? planningGrossAnnual : 0;
  const rowTaxCalculations = isTakeHomePay
    ? new Map(rows.map((row) => [row.id, calculateTaxForRow(row, grossAnnual, taxData)]))
    : new Map();
  const takeHomeTaxAnnual = isTakeHomePay
    ? rows.filter((row) => row.type === "tax").reduce((sum, row) => sum + (rowTaxCalculations.get(row.id)?.amount || 0), 0)
    : 0;
  const takeHomeAnnual = grossAnnual - takeHomeTaxAnnual;
  const [editingRow, setEditingRow] = useState(null);
  const [editingMode, setEditingMode] = useState("edit");
  const [correctingRow, setCorrectingRow] = useState(null);
  const sourceAccounts = Array.from(new Set([
    ...SOURCE_DEFAULTS,
    ...(data.tables.savingsBreakdown?.rows || []).map((row) => row.label).filter(Boolean),
    ...(data.tables.savingsBreakdown?.rows || []).map((row) => row.destinationAccount).filter(Boolean),
    ...(data.tables.startingBalance?.rows || []).map((row) => row.label).filter(Boolean),
    ...rows.map((row) => row.sourceAccount).filter(Boolean),
    ...rows.map((row) => row.destinationAccount).filter(Boolean),
  ]));

  const updateTable = (patch) => {
    setData((current) => ({
      ...current,
      tables: {
        ...current.tables,
        [tableKey]: { ...current.tables[tableKey], ...patch },
      },
    }));
  };

  const removeRow = (rowId) => {
    updateTable({ rows: rows.filter((row) => row.id !== rowId) });
  };

  const addRow = () => {
    setEditingMode("add");
    setEditingRow(emptyRow({ sourceAccount: expenseSource ? "Take-home pay" : "", frequency: table.frequency }));
  };

  const editRow = (row) => {
    setEditingMode("edit");
    setEditingRow({ ...row });
  };

  const correctTaxRow = (row) => {
    const mode = row.taxOverrideMode || (row.taxOverrideAmount ? "amount" : "percent");
    setCorrectingRow({
      ...row,
      taxOverrideMode: mode,
      taxOverridePercent: row.taxOverridePercent ?? "",
      taxOverrideAmount: row.taxOverrideAmount ?? "",
    });
  };

  const updateEditingRow = (patch) => {
    setEditingRow((current) => ({ ...current, ...patch }));
  };

  const updateCorrectingRow = (patch) => {
    setCorrectingRow((current) => ({ ...current, ...patch }));
  };

  const saveEditingRow = (event) => {
    event.preventDefault();
    if (!editingRow) return;
    if (editingMode === "add") {
      updateTable({ rows: [...rows, editingRow] });
    } else {
      updateTable({ rows: rows.map((row) => (row.id === editingRow.id ? editingRow : row)) });
    }
    setEditingRow(null);
    setEditingMode("edit");
  };

  const saveTaxCorrection = (event) => {
    event.preventDefault();
    if (!correctingRow) return;
    updateTable({
      rows: rows.map((row) => (row.id === correctingRow.id ? correctingRow : row)),
    });
    setCorrectingRow(null);
  };

  const revertTaxCorrection = () => {
    if (!correctingRow) return;
    const revertedRow = {
      ...correctingRow,
      taxOverrideMode: "",
      taxOverridePercent: "",
      taxOverrideAmount: "",
    };
    updateTable({
      rows: rows.map((row) => (
        row.id === correctingRow.id
          ? revertedRow
          : row
      )),
    });
    setCorrectingRow(revertedRow);
  };

  return (
    <section className="planning-table-card">
      <div className="planning-table-head">
        <div>
          <h2>{title}</h2>
          <p className="subtle">{description}</p>
        </div>
        <div className="planning-table-actions">
          <label>
            <span>View</span>
            <FrequencySelect value={table.frequency} includeOneTime onChange={(frequency) => updateTable({ frequency })} />
          </label>
          {quickAdd ? <button className="btn" type="button" onClick={onQuickAdd}>{quickAddLabel}</button> : null}
          {!isTakeHomePay ? <button className="btn btn--primary" type="button" onClick={addRow}>Add entry</button> : null}
        </div>
      </div>

      <div className="planning-table-wrap">
        <table className="planning-table">
          <thead>
            <tr>
              <th>Item</th>
              {columns.type ? <th>Type</th> : null}
              {columns.category ? <th>Category</th> : null}
              <th>Frequency</th>
              {columns.taxPercent ? <th className="num">Tax %</th> : null}
              {columns.percent ? <th className="num">{columns.percentLabel || "Percent"}</th> : null}
              <th className="num">Amount</th>
              <th className="num">{table.frequency === "one-time" ? "Total" : `As ${FREQ.get(table.frequency)?.label || "Monthly"}`}</th>
              {expenseSource ? <th>{sourceColumnLabel}</th> : null}
              {columns.destination ? <th>Destination</th> : null}
              {columns.dates ? <th>Dates</th> : null}
              {showNotes ? <th className="planning-notes-col">Notes</th> : null}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isDebit = isDebitPlanningRow(tableKey, row);
              const taxCalculation = rowTaxCalculations.get(row.id);
              const annualAmount = isTakeHomePay && row.type === "tax"
                ? taxCalculation?.amount || 0
                : isAllocationPlan
                  ? plannedAnnual(row, planningTakeHomeAnnual)
                  : annualize(row);
              const rowAmount = isTakeHomePay && row.type === "tax"
                ? convertAnnual(annualAmount, row.frequency)
                : isAllocationPlan && num(row.percent) > 0
                  ? convertAnnual(annualAmount, row.frequency)
                  : num(row.amount);
              const convertedAmount = table.frequency === "one-time" ? rowAmount : convertAnnual(annualAmount, table.frequency);
              return (
              <tr key={row.id} className={isDebit ? "planning-row--debit" : ""}>
                <td className="planning-title-cell">{row.label || "-"}</td>
                {columns.type ? <td>{row.type || "-"}</td> : null}
                {columns.category ? <td>{row.category || "-"}</td> : null}
                <td>{frequencyLabel(row.frequency)}</td>
                {columns.taxPercent ? (
                  <td className="num">
                    {row.type === "tax" ? (
                      <span className="planning-tax-rate">
                        {percent(taxCalculation?.displayRate || taxCalculation?.effectiveRate || 0)}
                        <span className="info-popover">
                          <button type="button" className="info-popover__trigger" aria-label={`${row.label || "Tax"} breakdown`}>i</button>
                          <span className="info-popover__panel" role="tooltip">
                            {(taxCalculation?.details || []).map((line) => <span key={line}>{line}</span>)}
                          </span>
                        </span>
                      </span>
                    ) : "-"}
                  </td>
                ) : null}
                {columns.percent ? <td className="num">{num(row.percent) > 0 ? `${num(row.percent).toFixed(1)}%` : "-"}</td> : null}
                <td className={`num ${isDebit ? "planning-debit" : ""}`}>{signedMoney(rowAmount, isDebit)}</td>
                <td className={`num planning-computed ${isDebit ? "planning-debit" : ""}`}>{signedMoney(convertedAmount, isDebit)}</td>
                {expenseSource ? <td>{row.sourceAccount || "Take-home pay"}</td> : null}
                {columns.destination ? <td>{row.destinationAccount || "-"}</td> : null}
                {columns.dates ? <td>{formatDateRange(row)}</td> : null}
                {showNotes ? <td className="planning-notes-cell">{row.notes || "-"}</td> : null}
                <td>
                  <div className="planning-row-actions">
                    {isTakeHomePay ? (
                      row.type === "tax" ? (
                        <button className="planning-correct-btn" type="button" onClick={() => correctTaxRow(row)}>Correct</button>
                      ) : (
                        <button className="btn btn--small" type="button" onClick={() => editRow(row)}>Edit</button>
                      )
                    ) : (
                      <>
                        <button className="btn btn--small" type="button" onClick={() => editRow(row)}>Edit</button>
                        <button className="planning-remove-row" type="button" onClick={() => removeRow(row.id)} aria-label={`Remove ${row.label || "row"}`}>Delete</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );})}
          </tbody>
          {isTakeHomePay ? (
            <tfoot>
              <tr>
                <td className="planning-title-cell">Take-Home Pay</td>
                <td></td>
                <td></td>
                <td>{frequencyLabel(table.frequency)}</td>
                <td className="num">{percent(grossAnnual > 0 ? takeHomeAnnual / grossAnnual : 0)}</td>
                <td className="num">{money(convertAnnual(takeHomeAnnual, table.frequency))}</td>
                <td className="num planning-computed">{money(convertAnnual(takeHomeAnnual, table.frequency))}</td>
                <td></td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {editingRow ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`${tableKey}EditTitle`} onClick={(event) => { if (event.target === event.currentTarget) setEditingRow(null); }}>
          <div className="modal-content card planning-entry-modal">
            <h2 id={`${tableKey}EditTitle`}>{editingMode === "add" ? `Add ${title} Entry` : `Edit ${title} Entry`}</h2>
            <form className="txn-form" onSubmit={saveEditingRow}>
              <label>
                <span>Item</span>
                <input value={editingRow.label} onChange={(event) => updateEditingRow({ label: event.target.value })} placeholder="Item" />
              </label>
              {columns.type ? (
                <label>
                  <span>Type</span>
                  <select
                    value={editingRow.type}
                    onChange={(event) => {
                      const type = event.target.value;
                      updateEditingRow({
                        type,
                        category: type === "tax" ? "Tax" : type,
                        taxKind: type === "tax" ? (editingRow.taxKind || "manual") : "",
                      });
                    }}
                  >
                    {(columns.typeOptions || ["income", "tax", "liquid", "investment", "item"]).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              ) : null}
              {isTakeHomePay && editingRow.type === "tax" ? (
                <label>
                  <span>Tax calculation</span>
                  <select value={editingRow.taxKind || "manual"} onChange={(event) => updateEditingRow({ taxKind: event.target.value })}>
                    {TAX_KIND_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              ) : null}
              {columns.category ? (
                <label>
                  <span>Category</span>
                  <input value={editingRow.category} onChange={(event) => updateEditingRow({ category: event.target.value })} placeholder="Category" />
                </label>
              ) : null}
              <label>
                <span>Frequency</span>
                <FrequencySelect value={editingRow.frequency} includeOneTime onChange={(frequency) => updateEditingRow({ frequency })} />
              </label>
              <label>
                <span>Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingRow.amount}
                  onChange={(event) => updateEditingRow({ amount: event.target.value })}
                  disabled={isTakeHomePay && editingRow.type === "tax" && ["federal", "social_security", "medicare"].includes(getTaxKind(editingRow))}
                />
              </label>
              {isTakeHomePay && editingRow.type === "tax" && ["manual", "state", "local"].includes(getTaxKind(editingRow)) ? (
                <label>
                  <span>Tax %</span>
                  <input type="number" min="0" max="100" step="0.01" value={editingRow.percent} onChange={(event) => updateEditingRow({ percent: event.target.value })} />
                </label>
              ) : null}
              {columns.percent ? (
                <label>
                  <span>{columns.percentLabel || "Percent"}</span>
                  <input type="number" min="0" max="100" step="0.01" value={editingRow.percent} onChange={(event) => updateEditingRow({ percent: event.target.value })} />
                </label>
              ) : null}
              {expenseSource ? (
                <label>
                  <span>{sourceFieldLabel}</span>
                  <select value={editingRow.sourceAccount || "Take-home pay"} onChange={(event) => updateEditingRow({ sourceAccount: event.target.value })}>
                    {sourceAccounts.map((account) => <option key={account} value={account}>{account}</option>)}
                  </select>
                </label>
              ) : null}
              {columns.destination ? (
                <label>
                  <span>Destination</span>
                  <input value={editingRow.destinationAccount} onChange={(event) => updateEditingRow({ destinationAccount: event.target.value })} placeholder="Destination" />
                </label>
              ) : null}
              {columns.dates ? (
                <div className="planning-modal-grid">
                  <label>
                    <span>Start date</span>
                    <input type="date" value={editingRow.startDate} onChange={(event) => updateEditingRow({ startDate: event.target.value })} />
                  </label>
                  <label>
                    <span>End date</span>
                    <input type="date" value={editingRow.endDate} onChange={(event) => updateEditingRow({ endDate: event.target.value })} />
                  </label>
                </div>
              ) : null}
              {showNotes ? (
                <label>
                  <span>Notes</span>
                  <textarea value={editingRow.notes} onChange={(event) => updateEditingRow({ notes: event.target.value })} placeholder="Optional" />
                </label>
              ) : null}
              <div className="modal-actions">
                <button className="btn btn--primary" type="submit">{editingMode === "add" ? "Add entry" : "Save entry"}</button>
                <button className="btn" type="button" onClick={() => setEditingRow(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {correctingRow ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`${tableKey}CorrectionTitle`} onClick={(event) => { if (event.target === event.currentTarget) setCorrectingRow(null); }}>
          <div className="modal-content card planning-entry-modal">
            <h2 id={`${tableKey}CorrectionTitle`}>Correct {correctingRow.label || "Tax"}</h2>
            <form className="txn-form" onSubmit={saveTaxCorrection}>
              {(() => {
                const preview = calculateTaxForRow(correctingRow, grossAnnual, taxData);
                return (
                  <div className="planning-tax-correction-preview">
                    <span>Current tax</span>
                    <strong>{signedMoney(convertAnnual(preview.amount, correctingRow.frequency), true)}</strong>
                    <span className="planning-tax-rate">
                      {percent(preview.displayRate || preview.effectiveRate || 0)}
                      <span className="info-popover">
                        <button type="button" className="info-popover__trigger" aria-label={`${correctingRow.label || "Tax"} calculation breakdown`}>i</button>
                        <span className="info-popover__panel" role="tooltip">
                          {(preview.details || []).map((line) => <span key={line}>{line}</span>)}
                        </span>
                      </span>
                    </span>
                  </div>
                );
              })()}
              <label>
                <span>Tax type</span>
                <input value={TAX_KIND_OPTIONS.find((option) => option.id === getTaxKind(correctingRow))?.label || getTaxKind(correctingRow)} readOnly />
              </label>
              <label>
                <span>Correction method</span>
                <select value={correctingRow.taxOverrideMode || "percent"} onChange={(event) => updateCorrectingRow({ taxOverrideMode: event.target.value })}>
                  <option value="percent">Correct percentage</option>
                  <option value="amount">Custom amount</option>
                </select>
              </label>
              {String(correctingRow.taxOverrideMode || "percent") === "amount" ? (
                <>
                  <label>
                    <span>Frequency</span>
                    <FrequencySelect value={correctingRow.frequency} includeOneTime onChange={(frequency) => updateCorrectingRow({ frequency })} />
                  </label>
                  <label>
                    <span>Custom amount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={correctingRow.taxOverrideAmount}
                      onChange={(event) => updateCorrectingRow({ taxOverrideAmount: event.target.value })}
                    />
                  </label>
                </>
              ) : (
                <label>
                  <span>Corrected tax %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={correctingRow.taxOverridePercent}
                    onChange={(event) => updateCorrectingRow({ taxOverridePercent: event.target.value })}
                  />
                </label>
              )}
              <p className="subtle">Revert to default removes the saved correction and returns this row to the calculated tax data.</p>
              <div className="modal-actions">
                <button className="btn btn--primary" type="submit">Save correction</button>
                <button className="btn" type="button" onClick={revertTaxCorrection}>Revert to default</button>
                <button className="btn btn--link" type="button" onClick={() => setCorrectingRow(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function PlanningPage() {
  const [data, setData] = useState(defaultPlanningData(false));
  const [isBusiness, setIsBusiness] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Loading planning tables...");
  const [quickAllocationOpen, setQuickAllocationOpen] = useState(false);
  const [quickAllocation, setQuickAllocation] = useState({
    type: "Emergency fund",
    frequency: "monthly",
    amount: "",
    percent: "10",
    sourceAccount: "Take-home pay",
    destinationAccount: "Emergency Fund",
  });
  const [taxData, setTaxData] = useState(DEFAULT_TAX_DATA);
  const totals = useMemo(() => computePlanning(data, taxData), [data, taxData]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [me, payload, publicSettings] = await Promise.all([
          api.auth.me().catch(() => null),
          api.planningSheets.get().catch(() => null),
          api.appSettings.getPublic().catch(() => null),
        ]);
        if (!active) return;
        const business = Boolean(me?.user?.active_organization_id || me?.user?.activeOrganizationId || ["org_user", "org_admin"].includes(String(me?.user?.role || "").toLowerCase()));
        setIsBusiness(business);
        setData(normalizeData(payload?.planningSheet?.data, business));
        setTaxData(normalizeTaxData(publicSettings?.taxData));
        setStatus("Planning tables updated.");
      } catch (err) {
        setStatus(`Could not load planning tables: ${err?.message || "Unknown error"}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.planningSheets.save({ ...data, accountType: isBusiness ? "business" : "personal" });
      setData(normalizeData(saved?.planningSheet?.data, isBusiness));
      setStatus("Planning saved.");
      window.dispatchEvent(new CustomEvent("planning:updated"));
    } catch (err) {
      setStatus(`Could not save planning: ${err?.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const addQuickAllocation = (event) => {
    event.preventDefault();
    setData((current) => ({
      ...current,
      tables: {
        ...current.tables,
        expenseItems: {
          ...current.tables.expenseItems,
          rows: [
            ...current.tables.expenseItems.rows,
            emptyRow({
              label: quickAllocation.type,
              type: quickAllocation.type,
              category: quickAllocation.type,
              frequency: quickAllocation.frequency,
              amount: quickAllocation.amount,
              percent: quickAllocation.percent,
              sourceAccount: quickAllocation.sourceAccount || "Take-home pay",
              destinationAccount: quickAllocation.destinationAccount || quickAllocation.type,
            }),
          ],
        },
      },
    }));
    setQuickAllocationOpen(false);
    setQuickAllocation({
      type: "Emergency fund",
      frequency: "monthly",
      amount: "",
      percent: "10",
      sourceAccount: "Take-home pay",
      destinationAccount: "Emergency Fund",
    });
  };

  return (
    <>
      <div id="header"></div>
      <main className="main main--planning">
        <section className="planning-hero">
          <div>
            <p className="planning-kicker">{isBusiness ? "Business Planning" : "Personal Planning"}</p>
            <h1>Planning</h1>
            <p className="subtle">Turn income into after-tax take-home pay, then divide it into long-term accounts and purpose-based reserves.</p>
          </div>
          <div className="planning-actions">
            <span className="status-banner subtle" aria-live="polite">{loading ? "Loading..." : status}</span>
            <button className="btn btn--primary" type="button" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save planning"}</button>
          </div>
        </section>

        <section className="planning-summary-grid" aria-label="Planning totals">
          <article><span>After-Tax Take-Home</span><strong>{money(convertAnnual(totals.takeHomeAnnual, "monthly"))}</strong><small>Monthly</small></article>
          <article><span>Planned Account Funding</span><strong>{money(convertAnnual(totals.plannedFundingAnnual, "monthly"))}</strong><small>Monthly</small></article>
          <article><span>Budgetable After Planning</span><strong>{money(convertAnnual(totals.unassignedTakeHomeAnnual, "monthly"))}</strong><small>Monthly</small></article>
          <article><span>Projected Net Position</span><strong>{money(totals.projectedNetPosition)}</strong></article>
        </section>

        <PlanningTable
          title={isBusiness ? "Income and Taxes" : "Income and Taxes"}
          description={isBusiness ? "Estimate net business earnings after federal, state, payroll, and manual tax rows." : "Estimate take-home pay after federal, state, FICA, and manual tax rows."}
          tableKey="takeHomePay"
          data={data}
          setData={setData}
          taxData={taxData}
          columns={{ type: true, category: true, taxPercent: true, typeOptions: ["income", "tax"] }}
        />

        <PlanningTable
          title="Current Balances"
          description="Track existing cash, reserve, and investment balances before new funding is allocated."
          tableKey="startingBalance"
          data={data}
          setData={setData}
          columns={{ type: true, category: true, typeOptions: ["liquid", "investment"] }}
        />

        <PlanningTable
          title="Purpose Accounts"
          description="Name the major accounts or buckets that receive planned funding."
          tableKey="savingsBreakdown"
          data={data}
          setData={setData}
          columns={{ category: true, destination: true }}
        />

        <PlanningTable
          title="Allocation Plan"
          description="Divide after-tax take-home pay into major accounts by percentage or fixed transfer amount."
          tableKey="expenseItems"
          data={data}
          setData={setData}
          columns={{ type: true, category: true, percent: true, percentLabel: "Take-home %", destination: true, typeOptions: ALLOCATION_TYPES }}
          expenseSource
          sourceColumnLabel="From"
          sourceFieldLabel="From"
          quickAdd
          quickAddLabel="Add allocation"
          onQuickAdd={() => setQuickAllocationOpen(true)}
        />

        <PlanningTable
          title="Scheduled Commitments"
          description="Track known future obligations that should reduce the amount available for short-term budgeting."
          tableKey="temporaryExpenses"
          data={data}
          setData={setData}
          columns={{ category: true, dates: true }}
          expenseSource
          sourceColumnLabel="From account"
          sourceFieldLabel="From account"
        />

        <section className="planning-bottom-totals">
          <article>
            <span>Current Liquid After Commitments</span>
            <strong>{money(totals.currentLiquidAfterCommitments)}</strong>
          </article>
          <article>
            <span>Budgetable After Planning</span>
            <div className="planning-total-row"><b>Yearly</b><strong>{money(totals.unassignedTakeHomeAnnual)}</strong></div>
            <div className="planning-total-row"><b>Monthly</b><strong>{money(convertAnnual(totals.unassignedTakeHomeAnnual, "monthly"))}</strong></div>
            <div className="planning-total-row"><b>Weekly</b><strong>{money(convertAnnual(totals.unassignedTakeHomeAnnual, "weekly"))}</strong></div>
          </article>
          <article>
            <span>Annual Planned Funding</span>
            <strong>{money(totals.plannedFundingAnnual)}</strong>
          </article>
        </section>
      </main>
      <div id="footer"></div>

      {quickAllocationOpen ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="quickAllocationTitle" onClick={(event) => { if (event.target === event.currentTarget) setQuickAllocationOpen(false); }}>
          <div className="modal-content card planning-major-modal">
            <h2 id="quickAllocationTitle">Add Allocation</h2>
            <form className="txn-form" onSubmit={addQuickAllocation}>
              <label><span>Purpose</span><select value={quickAllocation.type} onChange={(event) => setQuickAllocation({ ...quickAllocation, type: event.target.value, destinationAccount: event.target.value })}>{ALLOCATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
              <label><span>Frequency</span><FrequencySelect value={quickAllocation.frequency} onChange={(frequency) => setQuickAllocation({ ...quickAllocation, frequency })} /></label>
              <label><span>Take-home %</span><input type="number" min="0" max="100" step="0.01" value={quickAllocation.percent} onChange={(event) => setQuickAllocation({ ...quickAllocation, percent: event.target.value })} /></label>
              <label><span>Fixed amount</span><input type="number" min="0" step="0.01" value={quickAllocation.amount} onChange={(event) => setQuickAllocation({ ...quickAllocation, amount: event.target.value })} /></label>
              <label><span>From</span><select value={quickAllocation.sourceAccount} onChange={(event) => setQuickAllocation({ ...quickAllocation, sourceAccount: event.target.value })}>{SOURCE_DEFAULTS.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
              <label><span>Destination</span><input value={quickAllocation.destinationAccount} onChange={(event) => setQuickAllocation({ ...quickAllocation, destinationAccount: event.target.value })} /></label>
              <div className="modal-actions">
                <button className="btn btn--primary" type="submit">Add allocation</button>
                <button className="btn" type="button" onClick={() => setQuickAllocationOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
