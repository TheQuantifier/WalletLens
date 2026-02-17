// src/controllers/records.controller.js
import asyncHandler from "../middleware/async.js";

import {
  createRecord,
  listRecords,
  getRecordById,
  updateRecord,
  deleteRecord,
  countRecordsByUser,
} from "../models/record.model.js";

import { query } from "../config/db.js";
import { logActivity } from "../services/activity.service.js";
import { findUserById } from "../models/user.model.js";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../constants/categories.js";

// ==========================================================
// Helper: Parse YYYY-MM-DD into a stable UTC-noon Date
// Prevents timezone shifting issues
// ==========================================================
export function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

// ==========================================================
// GET /api/records/:id
// ==========================================================
export const getOne = asyncHandler(async (req, res) => {
  const record = await getRecordById(req.user.id, req.params.id);

  if (!record) {
    return res.status(404).json({ message: "Record not found" });
  }

  res.json(record);
});

// ==========================================================
// GET /api/records
// ==========================================================
export const getAll = asyncHandler(async (req, res) => {
  const type = req.query.type ? String(req.query.type) : undefined;
  const parsedLimit = Number.parseInt(String(req.query.limit ?? ""), 10);
  const parsedOffset = Number.parseInt(String(req.query.offset ?? ""), 10);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 1000)
      : 200;
  const offset =
    Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const records = await listRecords(req.user.id, { type, limit, offset });
  res.json(records);
});

// ==========================================================
// GET /api/records/stats
// ==========================================================
export const getStats = asyncHandler(async (req, res) => {
  const totalRecords = await countRecordsByUser(req.user.id);
  res.json({ totalRecords });
});

// ==========================================================
// GET /api/records/categories
// ==========================================================
export const getCategories = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  const customExpense = Array.isArray(user?.custom_expense_categories)
    ? user.custom_expense_categories
    : [];
  const customIncome = Array.isArray(user?.custom_income_categories)
    ? user.custom_income_categories
    : [];

  const merge = (base, custom) => {
    const seen = new Set();
    const out = [];
    [...base, ...custom].forEach((name) => {
      const key = String(name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(String(name).trim());
    });
    return out;
  };

  res.json({
    expense: merge(EXPENSE_CATEGORIES, customExpense),
    income: merge(INCOME_CATEGORIES, customIncome),
  });
});

// ==========================================================
// POST /api/records
// ==========================================================
export const create = asyncHandler(async (req, res) => {
  const { type, amount, category, date, note } = req.body;

  if (!type || amount === undefined || amount === null || !category) {
    return res
      .status(400)
      .json({ message: "Missing required fields: type, amount, category" });
  }

  if (!["income", "expense"].includes(type)) {
    return res.status(400).json({ message: "Invalid type" });
  }

  const numAmount = Number(amount);
  if (Number.isNaN(numAmount) || numAmount < 0) {
    return res.status(400).json({ message: "Amount must be a number ≥ 0" });
  }

  // Validate date format if provided
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
  }

  const parsedDate = date ? parseDateOnly(date) : new Date();

  const record = await createRecord(req.user.id, {
    type,
    amount: numAmount,
    category: String(category).trim(),
    date: parsedDate,
    note: note !== undefined ? String(note) : "",
    linkedReceiptId: null,
  });

  await logActivity({
    userId: req.user.id,
    action: "record_create",
    entityType: "record",
    entityId: record.id,
    metadata: { type },
    req,
  });
  res.status(201).json(record);
});

// ==========================================================
// PUT /api/records/:id
// FULL EDIT SUPPORT (even for receipt-linked records)
// ==========================================================
export const update = asyncHandler(async (req, res) => {
  const { type, amount, category, date, note } = req.body;

  const existing = await getRecordById(req.user.id, req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Record not found" });
  }

  // Validation
  if (type !== undefined && !["income", "expense"].includes(type)) {
    return res.status(400).json({ message: "Invalid type" });
  }

  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ message: "Amount must be a number ≥ 0" });
    }
  }

  if (date !== undefined && date !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
  }

  const changes = {};

  if (type !== undefined) changes.type = type;
  if (amount !== undefined) changes.amount = Number(amount);
  if (category !== undefined) changes.category = String(category).trim();

  if (date !== undefined) {
    // only update if non-empty; otherwise preserve old value
    changes.date = date ? parseDateOnly(date) : existing.date;
  }

  if (note !== undefined) changes.note = String(note);

  const updated = await updateRecord(req.user.id, req.params.id, changes);

  await logActivity({
    userId: req.user.id,
    action: "record_update",
    entityType: "record",
    entityId: updated?.id || req.params.id,
    metadata: { fields: Object.keys(changes) },
    req,
  });
  res.json({ message: "Record updated", record: updated });
});

// ==========================================================
// DELETE /api/records/:id
// Supports optional deletion of linked receipt
// deleteReceipt=true|false
// ==========================================================
export const remove = asyncHandler(async (req, res) => {
  const deleteReceiptFlag = req.query.deleteReceipt === "true";

  const record = await getRecordById(req.user.id, req.params.id);
  if (!record) {
    return res.status(404).json({ message: "Record not found" });
  }

  const linkedReceiptId = record.linked_receipt_id;

  // If the record has a linked receipt, handle receipt deletion or unlinking
  if (linkedReceiptId) {
    if (deleteReceiptFlag) {
      // NOTE: We are not deleting the R2 object here yet (services later).
      // We still delete the receipt row to match "deleteReceipt=true" behavior.
      await query(
        `DELETE FROM receipts WHERE id = $1 AND user_id = $2`,
        [linkedReceiptId, req.user.id]
      );
    } else {
      // Keep receipt but unlink (optional: FK on receipts.linked_record_id will also null on record delete)
      await query(
        `UPDATE receipts
         SET linked_record_id = NULL, updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [linkedReceiptId, req.user.id]
      );
    }
  }

  // Finally, delete the record itself
  await deleteRecord(req.user.id, req.params.id);

  await logActivity({
    userId: req.user.id,
    action: "record_delete",
    entityType: "record",
    entityId: req.params.id,
    metadata: { deletedReceipt: deleteReceiptFlag },
    req,
  });
  res.json({
    message: "Record deleted",
    deletedReceipt: deleteReceiptFlag,
  });
});
