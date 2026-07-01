import asyncHandler from "../middleware/async.js";
import { getPlanningSheet, upsertPlanningSheet } from "../models/planning_sheet.model.js";
import { logActivity } from "../services/activity.service.js";

const FREQUENCIES = new Set(["weekly", "biweekly", "monthly", "quarterly", "semi-annually", "yearly", "one-time"]);
const TABLE_KEYS = new Set([
  "takeHomePay",
  "startingBalance",
  "savingsBreakdown",
  "expenseItems",
  "temporaryExpenses",
  "investments",
]);

function text(value, fallback = "", max = 160) {
  const next = String(value || "").trim().slice(0, max);
  return next || fallback;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function normalizeFrequency(value, fallback = "monthly") {
  const next = String(value || "").trim();
  return FREQUENCIES.has(next) ? next : fallback;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 200).map((row, index) => ({
    id: text(row?.id, `row-${index + 1}`, 80),
    label: text(row?.label || row?.name, "Untitled"),
    type: text(row?.type, "item", 80),
    taxKind: text(row?.taxKind, "", 80),
    category: text(row?.category, "", 120),
    frequency: normalizeFrequency(row?.frequency),
    amount: nullableNumber(row?.amount),
    percent: nullableNumber(row?.percent),
    taxOverrideMode: text(row?.taxOverrideMode, "", 40),
    taxOverridePercent: nullableNumber(row?.taxOverridePercent),
    taxOverrideAmount: nullableNumber(row?.taxOverrideAmount),
    sourceAccount: text(row?.sourceAccount || row?.source, "Savings", 120),
    destinationAccount: text(row?.destinationAccount, "", 120),
    startDate: text(row?.startDate, "", 40),
    endDate: text(row?.endDate, "", 40),
    taxable: Boolean(row?.taxable),
    notes: text(row?.notes, "", 300),
  }));
}

function normalizeTable(table, key) {
  return {
    key,
    frequency: normalizeFrequency(table?.frequency, key === "startingBalance" ? "one-time" : "monthly"),
    rows: normalizeRows(table?.rows),
  };
}

function normalizePlanningData(data) {
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const tables = {};
  TABLE_KEYS.forEach((key) => {
    tables[key] = normalizeTable(source?.tables?.[key], key);
  });
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    accountType: text(source.accountType, "personal", 40),
    tables,
  };
}

export const getOne = asyncHandler(async (req, res) => {
  const sheet = await getPlanningSheet(req.user.id);
  res.json({ planningSheet: sheet || null });
});

export const save = asyncHandler(async (req, res) => {
  const data = normalizePlanningData(req.body?.data);
  const sheet = await upsertPlanningSheet(req.user.id, data);

  await logActivity({
    userId: req.user.id,
    action: "planning_sheet_update",
    entityType: "planning_sheet",
    entityId: sheet?.id || null,
    metadata: { tableCount: Object.keys(data.tables || {}).length },
    req,
  });

  res.json({ planningSheet: sheet });
});
