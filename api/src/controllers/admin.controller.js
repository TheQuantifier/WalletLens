// src/controllers/admin.controller.js
import asyncHandler from "../middleware/async.js";
import { query } from "../config/db.js";
import {
  listUsers,
  findUserById,
  updateUserById,
} from "../models/user.model.js";
import {
  listRecordsAdmin,
  getRecordByIdAdmin,
  updateRecordAdmin,
  deleteRecordAdmin,
} from "../models/record.model.js";
import { logActivity } from "../services/activity.service.js";
import { parseDateOnly } from "./records.controller.js";

// ==========================================================
// USERS
// ==========================================================
export const listUsersAdmin = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const queryText = String(req.query.q || "").trim();

  const users = await listUsers({ limit, offset, queryText });
  res.json({ users });
});

export const listUserOptionsAdmin = asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `
    SELECT
      id,
      username,
      email,
      full_name,
      COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(username), ''), email) AS display_name
    FROM users
    ORDER BY lower(COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(username), ''), email)) ASC
    `
  );
  res.json({ users: rows });
});

export const getUserAdmin = asyncHandler(async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

export const updateUserAdmin = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const updates = {};

  const allowedFields = [
    "username",
    "email",
    "fullName",
    "location",
    "role",
    "phoneNumber",
    "bio",
    "avatarUrl",
    "address",
    "employer",
    "incomeRange",
    "customExpenseCategories",
    "customIncomeCategories",
  ];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      updates[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    }
  }

  if (updates.email !== undefined) {
    updates.email = String(updates.email).toLowerCase().trim();
    const { rows } = await query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [
      updates.email,
    ]);
    if (rows[0] && rows[0].id !== userId) {
      return res.status(400).json({ message: "Email already in use" });
    }
  }

  if (updates.username !== undefined) {
    updates.username = String(updates.username).toLowerCase().trim();
    const { rows } = await query(`SELECT id FROM users WHERE lower(username) = $1 LIMIT 1`, [
      updates.username,
    ]);
    if (rows[0] && rows[0].id !== userId) {
      return res.status(400).json({ message: "Username already in use" });
    }
  }

  if (updates.role !== undefined && !["user", "admin"].includes(updates.role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const updated = await updateUserById(userId, updates);
  if (!updated) return res.status(404).json({ message: "User not found" });

  await logActivity({
    userId: req.user.id,
    action: "admin_user_update",
    entityType: "user",
    entityId: userId,
    metadata: { fields: Object.keys(updates), targetUserId: userId },
    req,
  });

  res.json({ user: updated });
});

// ==========================================================
// RECORDS
// ==========================================================
export const listRecordsAdminController = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const queryText = req.query.q ? String(req.query.q).trim() : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;

  const records = await listRecordsAdmin({ userId, queryText, type, limit, offset });
  res.json({ records });
});

export const getRecordAdmin = asyncHandler(async (req, res) => {
  const record = await getRecordByIdAdmin(req.params.id);
  if (!record) return res.status(404).json({ message: "Record not found" });
  res.json({ record });
});

export const updateRecordAdminController = asyncHandler(async (req, res) => {
  const { type, amount, category, date, note } = req.body;

  const existing = await getRecordByIdAdmin(req.params.id);
  if (!existing) return res.status(404).json({ message: "Record not found" });

  if (type !== undefined && !["income", "expense"].includes(type)) {
    return res.status(400).json({ message: "Invalid type" });
  }

  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ message: "Amount must be a number \u2265 0" });
    }
  }

  if (date !== undefined && date !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
  }

  const changes = {};
  if (type !== undefined) changes.type = type;
  if (amount !== undefined) changes.amount = Number(amount);
  if (category !== undefined) changes.category = String(category).trim();
  if (date !== undefined) changes.date = date ? parseDateOnly(date) : existing.date;
  if (note !== undefined) changes.note = String(note);

  const updated = await updateRecordAdmin(req.params.id, changes);

  await logActivity({
    userId: req.user.id,
    action: "admin_record_update",
    entityType: "record",
    entityId: updated?.id || req.params.id,
    metadata: { fields: Object.keys(changes), targetUserId: existing.user_id },
    req,
  });

  res.json({ record: updated });
});

export const deleteRecordAdminController = asyncHandler(async (req, res) => {
  const deleteReceiptFlag = req.query.deleteReceipt === "true";
  const record = await getRecordByIdAdmin(req.params.id);
  if (!record) return res.status(404).json({ message: "Record not found" });

  const linkedReceiptId = record.linked_receipt_id;
  if (linkedReceiptId) {
    if (deleteReceiptFlag) {
      await query(`DELETE FROM receipts WHERE id = $1`, [linkedReceiptId]);
    } else {
      await query(
        `UPDATE receipts
         SET linked_record_id = NULL, updated_at = now()
         WHERE id = $1`,
        [linkedReceiptId]
      );
    }
  }

  await deleteRecordAdmin(req.params.id);

  await logActivity({
    userId: req.user.id,
    action: "admin_record_delete",
    entityType: "record",
    entityId: req.params.id,
    metadata: { deletedReceipt: deleteReceiptFlag, targetUserId: record.user_id },
    req,
  });

  res.json({ message: "Record deleted", deletedReceipt: deleteReceiptFlag });
});

export const getAdminStatsController = asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM records) AS total_records,
      (SELECT COUNT(*)::int FROM receipts) AS total_receipts
    `
  );
  res.json({ stats: rows[0] || { total_users: 0, total_records: 0, total_receipts: 0 } });
});

export const listReceiptsAdminController = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const userId = req.query.userId ? String(req.query.userId) : "";
  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  const { rows } = await query(
    `
    SELECT
      receipts.*,
      users.full_name,
      users.username,
      users.email,
      COALESCE(users.full_name, users.username, users.email) AS user_name
    FROM receipts
    JOIN users ON users.id = receipts.user_id
    WHERE receipts.user_id = $1
    ORDER BY receipts.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  res.json({ receipts: rows });
});

export const listBudgetSheetsAdminController = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  const userId = req.query.userId ? String(req.query.userId) : "";
  const cadence = req.query.cadence ? String(req.query.cadence) : "";
  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  const where = ["user_id = $1"];
  const values = [userId];
  let i = 2;

  if (cadence) {
    where.push(`cadence = $${i++}`);
    values.push(cadence);
  }

  values.push(limit);

  const { rows } = await query(
    `
    SELECT
      id, user_id, cadence, period,
      housing, utilities, groceries, transportation, dining, health, entertainment,
      shopping, membership, miscellaneous, education, giving, savings,
      custom_categories, created_at, updated_at
    FROM budget_sheets
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT $${i}
    `,
    values
  );

  res.json({ budgetSheets: rows });
});
