// src/controllers/budget_sheets.controller.js
import asyncHandler from "../middleware/async.js";
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
