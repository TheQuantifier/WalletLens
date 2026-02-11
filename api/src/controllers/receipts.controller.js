// src/controllers/receipts.controller.js
import asyncHandler from "../middleware/async.js";

import { parseReceiptText } from "../services/ai_parser.service.js";
import { runOcrBuffer } from "../services/ocr.service.js";
import env from "../config/env.js";
import { parseDateOnly } from "./records.controller.js";
import { getAppSettings } from "../models/app_settings.model.js";

import { query } from "../config/db.js";
import { logActivity } from "../services/activity.service.js";
import { enqueueReceiptJob } from "../models/receipt_job.model.js";

import {
  createReceiptPending,
  listReceipts,
  getReceiptById,
  updateReceiptParsedData,
  deleteReceipt,
} from "../models/receipt.model.js";

import { createRecord, updateRecord } from "../models/record.model.js";

import {
  makeObjectKey,
  presignPut,
  presignGet,
  headObject,
  deleteObject,
} from "../services/r2.service.js";

const ALLOWED_PAY_METHODS = new Set([
  "Cash",
  "Check",
  "Credit Card",
  "Debit Card",
  "Gift Card",
  "Multiple",
  "Other",
]);

const ALLOWED_CATEGORIES = new Set([
  "Housing",
  "Utilities",
  "Groceries",
  "Transportation",
  "Dining",
  "Health",
  "Entertainment",
  "Shopping",
  "Membership",
  "Miscellaneous",
  "Education",
  "Giving",
  "Savings",
  "Other",
]);

function toNumberSafe(raw, warnings, fieldName) {
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    warnings.push(`${fieldName}_not_numeric`);
    return 0;
  }
  if (num < 0) {
    warnings.push(`${fieldName}_negative`);
    return 0;
  }
  return Number(num.toFixed(2));
}

function normalizeParsedForStorage(parsed, ocrText) {
  const warnings = [];
  const hasText = String(ocrText || "").trim().length > 5;
  if (!hasText) warnings.push("ocr_text_too_short");

  const payMethod = ALLOWED_PAY_METHODS.has(parsed?.payMethod) ? parsed.payMethod : "Other";
  const category = ALLOWED_CATEGORIES.has(parsed?.category) ? parsed.category : "Other";
  if (!ALLOWED_PAY_METHODS.has(parsed?.payMethod)) warnings.push("pay_method_unknown");
  if (!ALLOWED_CATEGORIES.has(parsed?.category)) warnings.push("category_unknown");

  const normalized = {
    date: parsed?.date || "",
    source: String(parsed?.source || "").trim(),
    subAmount: toNumberSafe(parsed?.subAmount ?? 0, warnings, "sub_amount"),
    amount: toNumberSafe(parsed?.amount ?? 0, warnings, "amount"),
    taxAmount: toNumberSafe(parsed?.taxAmount ?? 0, warnings, "tax_amount"),
    payMethod,
    category,
    items: Array.isArray(parsed?.items) ? parsed.items : [],
  };

  if (normalized.amount === 0) warnings.push("amount_zero");
  if (normalized.subAmount > normalized.amount && normalized.amount > 0) warnings.push("subtotal_gt_total");
  if (normalized.taxAmount > normalized.amount && normalized.amount > 0) warnings.push("tax_gt_total");

  const confidence = Math.max(0.2, Math.min(0.99, Number((0.9 - warnings.length * 0.1).toFixed(4))));
  return { normalized, warnings: Array.from(new Set(warnings)), confidence };
}

/* ============================================================
   POST /api/receipts/presign
   Create pending receipt row + return presigned PUT URL (R2)
   Body: { filename, contentType, sizeBytes }
   ============================================================ */
export const presignUpload = asyncHandler(async (req, res) => {
  const { filename, contentType, sizeBytes } = req.body;

  if (!filename || !contentType) {
    return res.status(400).json({ message: "filename and contentType are required" });
  }

  const keepReceiptFiles = await getReceiptKeepFiles();
  if (!keepReceiptFiles) {
    return res.status(403).json({ message: "Saving receipt files is currently disabled" });
  }

  const allowedExt = new Set(["pdf", "png", "jpg", "jpeg", "heic", "heif", "tif", "tiff", "bmp", "webp"]);
  const allowedMime = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/heic",
    "image/heif",
    "image/tiff",
    "image/bmp",
    "image/webp",
  ]);
  const ext = String(filename).split(".").pop().toLowerCase();
  const isImage = String(contentType).startsWith("image/");
  if (!allowedMime.has(contentType) && !(isImage && allowedExt.has(ext))) {
    return res.status(400).json({ message: "Unsupported file type" });
  }

  // Create a DB row first (source of truth)
  // Then create an object key based on the receipt id
  const tempId = cryptoRandomIdFallback(); // see helper below
  const objectKey = makeObjectKey({
    userId: req.user.id,
    fileId: tempId,
    filename,
  });

  const receipt = await createReceiptPending({
    userId: req.user.id,
    originalFilename: filename,
    objectKey,
    fileType: contentType,
    fileSize: Number(sizeBytes || 0),
    fileSaved: true,
  });

  const uploadUrl = await presignPut({
    key: receipt.object_key,
    contentType,
    expiresIn: 60,
  });

  await logActivity({
    userId: req.user.id,
    action: "receipt_upload_start",
    entityType: "receipt",
    entityId: receipt.id,
    metadata: { filename, contentType, sizeBytes: Number(sizeBytes || 0) },
    req,
  });
  res.json({
    id: receipt.id,
    objectKey: receipt.object_key,
    uploadUrl,
  });
});

/* ============================================================
   POST /api/receipts/:id/confirm
   Confirm upload → OCR → AI parse → update receipt → auto-record
   ============================================================ */
export const confirmUpload = asyncHandler(async (req, res) => {
  const receiptId = req.params.id;

  const receipt = await getReceiptById(req.user.id, receiptId);
  if (!receipt) return res.status(404).json({ message: "Receipt not found" });

  // 1) Verify object exists in R2 (fail fast if client never uploaded)
  try {
    await headObject({ key: receipt.object_key });
  } catch {
    return res.status(400).json({ message: "Upload not found in object storage" });
  }

  await updateReceiptParsedData(req.user.id, receiptId, {
    processingStatus: "queued",
    processingStage: "queued",
    processingError: "",
  });
  const job = await enqueueReceiptJob({
    userId: req.user.id,
    receiptId,
    jobType: "process_receipt",
    maxAttempts: 3,
  });

  await logActivity({
    userId: req.user.id,
    action: "receipt_upload_confirm",
    entityType: "receipt",
    entityId: receiptId,
    metadata: { jobId: job?.id || null, status: "queued" },
    req,
  });
  res.status(202).json({
    receiptId,
    jobId: job?.id || null,
    status: "processing",
  });
});

/* ============================================================
   POST /api/receipts/scan
   Upload a file directly to the API for OCR + AI parse only
   (no object storage, no DB persistence)
   ============================================================ */
export const scanOnly = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file?.buffer) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const allowedExt = new Set(["pdf", "png", "jpg", "jpeg", "heic", "heif", "tif", "tiff", "bmp", "webp"]);
  const allowedMime = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/heic",
    "image/heif",
    "image/tiff",
    "image/bmp",
    "image/webp",
  ]);
  const ext = String(file.originalname || "").split(".").pop().toLowerCase();
  const isImage = String(file.mimetype || "").startsWith("image/");
  if (!allowedMime.has(file.mimetype) && !(isImage && allowedExt.has(ext))) {
    return res.status(400).json({ message: "Unsupported file type" });
  }

  let ocrText = "";
  try {
    const result = await runOcrBuffer(file.buffer);
    ocrText = result?.text || "";
  } catch (err) {
    console.error("❌ OCR failed:", err);
  }

  let parsed = null;
  if (ocrText.trim().length > 5) {
    parsed = await parseReceiptText(ocrText);
  }

  const assessed = normalizeParsedForStorage(parsed || {}, ocrText);
  const parsedDate = assessed.normalized.date ? parseDateOnly(assessed.normalized.date) : null;

  // Create receipt metadata row without saving the file
  const scanObjectKey = `scan-only/${req.user.id}/${cryptoRandomIdFallback()}`;
  let receipt = await createReceiptPending({
    userId: req.user.id,
    originalFilename: file.originalname || "scan",
    objectKey: scanObjectKey,
    fileType: file.mimetype || "",
    fileSize: Number(file.size || 0),
    fileSaved: false,
  });

  receipt = await updateReceiptParsedData(req.user.id, receipt.id, {
    ocrText,
    rawOcrText: ocrText,
    date: parsedDate,
    source: assessed.normalized.source || "",
    subAmount: assessed.normalized.subAmount || 0,
    amount: assessed.normalized.amount || 0,
    taxAmount: assessed.normalized.taxAmount || 0,
    payMethod: assessed.normalized.payMethod || "Other",
    items: assessed.normalized.items || [],
    parsedData: {
      ...assessed.normalized,
      _meta: {
        modelVersion: env.aiModel || "",
        parseConfidence: assessed.confidence,
        parseWarnings: assessed.warnings,
      },
    },
    aiModelVersion: env.aiModel || "",
    parseConfidence: assessed.confidence,
    parseWarnings: assessed.warnings,
    fileSaved: false,
    processingStatus: "processed",
    processingStage: "completed",
    processingError: "",
  });

  let autoRecord = null;
  if (assessed.normalized.amount > 0) {
    const recordDate = parsedDate || new Date();
    autoRecord = await createRecord(req.user.id, {
      type: "expense",
      amount: Number(assessed.normalized.amount),
      category: assessed.normalized.category || "Other",
      date: recordDate,
      note: assessed.normalized.source || "Receipt",
      linkedReceiptId: receipt.id,
    });

    receipt = await updateReceiptParsedData(req.user.id, receipt.id, {
      linkedRecordId: autoRecord.id,
    });
  }

  await logActivity({
    userId: req.user.id,
    action: "receipt_scan",
    entityType: "receipt",
    entityId: receipt.id,
    metadata: { fileSaved: false },
    req,
  });
  res.status(200).json({
    ocrText,
    parsed: assessed.normalized || {},
    parsedDate,
    receipt,
    autoRecord,
  });
});

/* ============================================================
   PATCH /api/receipts/:id/ocr
   Update OCR text (manual correction)
   ============================================================ */
export const updateOcrText = asyncHandler(async (req, res) => {
  const receiptId = req.params.id;
  const { ocrText } = req.body || {};

  if (typeof ocrText !== "string") {
    return res.status(400).json({ message: "ocrText must be a string" });
  }

  const receipt = await getReceiptById(req.user.id, receiptId);
  if (!receipt) return res.status(404).json({ message: "Receipt not found" });

  let updated = await updateReceiptParsedData(req.user.id, receiptId, {
    ocrText,
  });

  // Re-run parser on corrected text
  let parsed = null;
  if (ocrText.trim().length > 5) {
    parsed = await parseReceiptText(ocrText);
  }

  const assessed = normalizeParsedForStorage(parsed || {}, ocrText);
  const parsedDate = assessed.normalized.date ? parseDateOnly(assessed.normalized.date) : null;

  updated = await updateReceiptParsedData(req.user.id, receiptId, {
    date: parsedDate,
    source: assessed.normalized.source || "",
    subAmount: assessed.normalized.subAmount || 0,
    amount: assessed.normalized.amount || 0,
    taxAmount: assessed.normalized.taxAmount || 0,
    payMethod: assessed.normalized.payMethod || "Other",
    items: assessed.normalized.items || [],
    parsedData: {
      ...assessed.normalized,
      _meta: {
        modelVersion: env.aiModel || "",
        parseConfidence: assessed.confidence,
        parseWarnings: assessed.warnings,
      },
    },
    rawOcrText: ocrText,
    aiModelVersion: env.aiModel || "",
    parseConfidence: assessed.confidence,
    parseWarnings: assessed.warnings,
    processingStatus: "processed",
    processingStage: "completed",
    processingError: "",
  });

  let autoRecord = null;
  if (assessed.normalized.amount > 0) {
    const recordDate = parsedDate || new Date();
    if (updated?.linked_record_id) {
      autoRecord = await updateRecord(req.user.id, updated.linked_record_id, {
        amount: Number(assessed.normalized.amount),
        date: recordDate,
        note: assessed.normalized.source || "Receipt",
        category: assessed.normalized.category || "Other",
      });
    } else {
      autoRecord = await createRecord(req.user.id, {
        type: "expense",
        amount: Number(assessed.normalized.amount),
        category: assessed.normalized.category || "Other",
        date: recordDate,
        note: assessed.normalized.source || "Receipt",
        linkedReceiptId: receiptId,
      });
      updated = await updateReceiptParsedData(req.user.id, receiptId, {
        linkedRecordId: autoRecord.id,
      });
    }
  }

  await logActivity({
    userId: req.user.id,
    action: "receipt_ocr_edit",
    entityType: "receipt",
    entityId: receiptId,
    req,
  });
  res.json({ receipt: updated, autoRecord, parsed: assessed.normalized || {} });
});

/* ============================================================
   GET /api/receipts
   ============================================================ */
export const getAll = asyncHandler(async (req, res) => {
  const receipts = await listReceipts(req.user.id);
  res.json(receipts);
});

/* ============================================================
   GET /api/receipts/:id
   ============================================================ */
export const getOne = asyncHandler(async (req, res) => {
  const receipt = await getReceiptById(req.user.id, req.params.id);
  if (!receipt) return res.status(404).json({ message: "Receipt not found" });
  res.json(receipt);
});

/* ============================================================
   GET /api/receipts/:id/download
   Returns a presigned GET URL
   ============================================================ */
export const download = asyncHandler(async (req, res) => {
  const receipt = await getReceiptById(req.user.id, req.params.id);
  if (!receipt) return res.status(404).json({ message: "Receipt not found" });
  if (receipt.file_saved === false) {
    return res.status(400).json({ message: "Receipt file was not saved" });
  }

  const downloadUrl = await presignGet({ key: receipt.object_key, expiresIn: 60 });
  res.json({ downloadUrl });
});

/* ============================================================
   DELETE /api/receipts/:id
   Query: ?deleteRecord=true|false
   Deletes receipt row + R2 file, and handles linked record.
   ============================================================ */
export const remove = asyncHandler(async (req, res) => {
  const deleteRecordFlag = req.query.deleteRecord === "true";

  // deleteReceipt returns { id, object_key, linked_record_id } so we can delete R2 object
  const deleted = await deleteReceipt(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ message: "Receipt not found" });

  // 1) Delete R2 object (continue on error)
  try {
    if (deleted.object_key) {
      await deleteObject({ key: deleted.object_key });
    }
  } catch (err) {
    console.error("Error deleting R2 object for receipt", deleted.id, err);
  }

  // 2) Record cleanup logic
  if (deleted.linked_record_id) {
    if (deleteRecordFlag) {
      await query(
        `DELETE FROM records WHERE id = $1 AND user_id = $2`,
        [deleted.linked_record_id, req.user.id]
      );
    } else {
      await query(
        `UPDATE records SET linked_receipt_id = NULL, updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [deleted.linked_record_id, req.user.id]
      );
    }
  }

  await logActivity({
    userId: req.user.id,
    action: "receipt_delete",
    entityType: "receipt",
    entityId: req.params.id,
    metadata: { deletedRecord: deleteRecordFlag },
    req,
  });

  res.json({
    message: "Receipt deleted",
    deletedRecord: deleteRecordFlag,
  });
});

/* ============================================================
   Small helper: avoid bringing in uuid lib just for presign.
   Your DB row ID is the true receipt id; this is only used
   to create a reasonably unique key prefix before insert returns.
   ============================================================ */
function cryptoRandomIdFallback() {
  // Node 20 has crypto.randomUUID, but keep it safe if polyfilled environments occur.
  try {
    // eslint-disable-next-line no-undef
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

async function getReceiptKeepFiles() {
  try {
    const settings = await getAppSettings();
    if (typeof settings?.receipt_keep_files === "boolean") {
      return settings.receipt_keep_files;
    }
  } catch (err) {
    console.error("Failed to load app settings for receipt files", err);
  }
  return env.keepReceiptFiles;
}
