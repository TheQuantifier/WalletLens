// src/controllers/budget_sheets.controller.js
import asyncHandler from "../middleware/async.js";
import { query } from "../config/db.js";
import {
  CATEGORY_COLUMNS,
  createBudgetSheet,
  updateBudgetSheet,
  getBudgetSheetById,
  findBudgetSheetByCadencePeriod,
  listBudgetSheets,
  deleteBudgetSheet,
} from "../models/budget_sheet.model.js";
import { logActivity } from "../services/activity.service.js";

const CADENCES = new Set([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semi-annually",
  "yearly",
]);

const COLUMN_TO_DISPLAY_NAME = {
  housing: "Housing",
  utilities: "Utilities",
  groceries: "Groceries",
  transportation: "Transportation",
  dining: "Dining",
  health: "Health",
  entertainment: "Entertainment",
  shopping: "Shopping",
  membership: "Membership",
  miscellaneous: "Miscellaneous",
  education: "Education",
  giving: "Giving",
  savings: "Savings",
};

function parsePeriodWindow(cadence, period) {
  const safeCadence = String(cadence || "");
  const safePeriod = String(period || "");
  const asUtcDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  };

  if (safeCadence === "weekly" || safeCadence === "biweekly") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(safePeriod)) return null;
    const start = asUtcDate(safePeriod);
    const spanDays = safeCadence === "weekly" ? 7 : 14;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + spanDays - 1);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }

  if (safeCadence === "monthly") {
    if (!/^\d{4}-\d{2}$/.test(safePeriod)) return null;
    const [year, month] = safePeriod.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { start, end };
  }

  if (
    safeCadence === "quarterly" ||
    safeCadence === "semi-annually" ||
    safeCadence === "yearly"
  ) {
    if (!/^\d{4}-\d{2}$/.test(safePeriod)) return null;
    const [year, month] = safePeriod.split("-").map(Number);
    const spanMonths =
      safeCadence === "quarterly" ? 3 : safeCadence === "semi-annually" ? 6 : 12;
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1 + spanMonths, 0, 23, 59, 59, 999));
    return { start, end };
  }

  return null;
}

function normalizeCustomCategories(customCategories) {
  if (!Array.isArray(customCategories)) return [];
  return customCategories
    .map((entry) => ({
      category: String(entry?.category || "").trim(),
      amount:
        entry?.amount === null || entry?.amount === undefined || entry?.amount === ""
          ? null
          : Number(entry.amount),
    }))
    .filter((entry) => entry.category.length > 0);
}

function normalizeCategories(categories) {
  const normalized = {};
  CATEGORY_COLUMNS.forEach((col) => {
    const raw = categories?.[col];
    if (raw === null || raw === undefined || raw === "") {
      normalized[col] = null;
      return;
    }
    const num = Number(raw);
    normalized[col] = Number.isFinite(num) ? num : null;
  });
  return normalized;
}

// ==========================================================
// GET /api/budget-sheets
// ==========================================================
export const getAll = asyncHandler(async (req, res) => {
  const { cadence, period, limit } = req.query;
  const list = await listBudgetSheets(req.user.id, {
    cadence,
    period,
    limit: limit ? Number(limit) : 50,
  });
  res.json(list);
});

// ==========================================================
// GET /api/budget-sheets/lookup?cadence=&period=
// ==========================================================
export const lookup = asyncHandler(async (req, res) => {
  const { cadence, period } = req.query;
  if (!cadence || !period) {
    return res.status(400).json({ message: "cadence and period are required" });
  }
  if (!CADENCES.has(String(cadence))) {
    return res.status(400).json({ message: "Invalid cadence" });
  }
  const sheet = await findBudgetSheetByCadencePeriod(req.user.id, String(cadence), String(period));
  if (!sheet) return res.status(404).json({ message: "Budget sheet not found" });
  res.json(sheet);
});

// ==========================================================
// GET /api/budget-sheets/summary?cadence=&period=
// Server-side budget aggregation for consistency across devices.
// ==========================================================
export const summary = asyncHandler(async (req, res) => {
  const { cadence, period } = req.query;
  if (!cadence || !period) {
    return res.status(400).json({ message: "cadence and period are required" });
  }
  if (!CADENCES.has(String(cadence))) {
    return res.status(400).json({ message: "Invalid cadence" });
  }

  const window = parsePeriodWindow(cadence, period);
  if (!window) {
    return res.status(400).json({ message: "Invalid period format for selected cadence" });
  }

  const sheet = await findBudgetSheetByCadencePeriod(req.user.id, String(cadence), String(period));
  if (!sheet) return res.status(404).json({ message: "Budget sheet not found" });

  const { rows } = await query(
    `
    SELECT lower(category) AS category_key, COALESCE(SUM(amount), 0)::numeric AS total
    FROM records
    WHERE user_id = $1
      AND type = 'expense'
      AND date >= $2
      AND date <= $3
    GROUP BY lower(category)
    `,
    [req.user.id, window.start.toISOString(), window.end.toISOString()]
  );

  const spentMap = new Map(
    rows.map((row) => [String(row.category_key || "").trim(), Number(row.total || 0)])
  );

  const standard = {};
  CATEGORY_COLUMNS.forEach((column) => {
    const categoryName = COLUMN_TO_DISPLAY_NAME[column] || column;
    const spent = spentMap.get(String(categoryName).toLowerCase()) || 0;
    standard[column] = Number(spent.toFixed(2));
  });

  const custom = Array.isArray(sheet.custom_categories)
    ? sheet.custom_categories.map((entry) => {
        const category = String(entry?.category || "").trim();
        const spent = category ? spentMap.get(category.toLowerCase()) || 0 : 0;
        return {
          category,
          budget: Number(entry?.amount || 0),
          spent: Number(spent.toFixed(2)),
        };
      })
    : [];

  const totalSpent = Number(
    Array.from(spentMap.values()).reduce((acc, value) => acc + Number(value || 0), 0).toFixed(2)
  );

  res.json({
    cadence: String(cadence),
    period: String(period),
    range: {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    },
    totals: {
      standard,
      custom,
      totalSpent,
    },
  });
});

// ==========================================================
// GET /api/budget-sheets/:id
// ==========================================================
export const getOne = asyncHandler(async (req, res) => {
  const sheet = await getBudgetSheetById(req.user.id, req.params.id);
  if (!sheet) return res.status(404).json({ message: "Budget sheet not found" });
  res.json(sheet);
});

// ==========================================================
// POST /api/budget-sheets
// ==========================================================
export const create = asyncHandler(async (req, res) => {
  const { cadence, period, categories, customCategories } = req.body || {};

  if (!cadence || !period) {
    return res.status(400).json({ message: "cadence and period are required" });
  }
  if (!CADENCES.has(String(cadence))) {
    return res.status(400).json({ message: "Invalid cadence" });
  }

  const normalizedCategories = normalizeCategories(categories || {});
  const normalizedCustom = normalizeCustomCategories(customCategories);

  const sheet = await createBudgetSheet(req.user.id, {
    cadence: String(cadence),
    period: String(period),
    categories: normalizedCategories,
    customCategories: normalizedCustom,
  });

  await logActivity({
    userId: req.user.id,
    action: "budget_sheet_create",
    entityType: "budget_sheet",
    entityId: sheet.id,
    metadata: { cadence, period },
    req,
  });
  res.status(201).json(sheet);
});

// ==========================================================
// PUT /api/budget-sheets/:id
// ==========================================================
export const update = asyncHandler(async (req, res) => {
  const { cadence, period, categories, customCategories } = req.body || {};

  if (cadence !== undefined && !CADENCES.has(String(cadence))) {
    return res.status(400).json({ message: "Invalid cadence" });
  }

  const normalizedCategories = categories ? normalizeCategories(categories) : undefined;
  const normalizedCustom =
    customCategories !== undefined ? normalizeCustomCategories(customCategories) : undefined;

  const sheet = await updateBudgetSheet(req.user.id, req.params.id, {
    cadence: cadence !== undefined ? String(cadence) : undefined,
    period: period !== undefined ? String(period) : undefined,
    categories: normalizedCategories,
    customCategories: normalizedCustom,
  });

  if (!sheet) return res.status(404).json({ message: "Budget sheet not found" });
  await logActivity({
    userId: req.user.id,
    action: "budget_sheet_update",
    entityType: "budget_sheet",
    entityId: sheet.id,
    metadata: { cadence, period },
    req,
  });
  res.json(sheet);
});

// ==========================================================
// DELETE /api/budget-sheets/:id
// ==========================================================
export const remove = asyncHandler(async (req, res) => {
  const sheet = await deleteBudgetSheet(req.user.id, req.params.id);
  if (!sheet) return res.status(404).json({ message: "Budget sheet not found" });

  await logActivity({
    userId: req.user.id,
    action: "budget_sheet_delete",
    entityType: "budget_sheet",
    entityId: sheet.id,
    metadata: { cadence: sheet.cadence, period: sheet.period },
    req,
  });

  res.json({ success: true });
});
