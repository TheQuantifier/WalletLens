// src/controllers/receipts.controller.js
import asyncHandler from "../middleware/async.js";

import { parseReceiptText } from "../services/ai_parser.service.js";
import { runOcrBuffer } from "../services/ocr.service.js";
import env from "../config/env.js";
import { getAppSettings } from "../models/app_settings.model.js";
import { getRuntimeAppSettings } from "../services/app_settings_runtime.service.js";
import {
  assessParsedReceipt,
  buildParsedReceiptPayload,
} from "../services/receipt_normalization.service.js";

import { query } from "../config/db.js";
import { logActivity } from "../services/activity.service.js";
import { evaluateAchievementsForUser } from "../services/achievements.service.js";
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

  const runtimeSettings = await getRuntimeAppSettings();
  const keepReceiptFiles = await getReceiptKeepFiles(runtimeSettings);
  if (!keepReceiptFiles) {
    return res.status(403).json({ message: "Saving receipt files is currently disabled" });
  }
  const fileSizeBytes = Number(sizeBytes || 0);
  const maxUploadBytes = Math.max(1, Number(runtimeSettings.max_upload_size_mb || 50)) * 1024 * 1024;
  if (fileSizeBytes > maxUploadBytes) {
    return res.status(400).json({
      message: `File exceeds max upload size of ${runtimeSettings.max_upload_size_mb} MB`,
    });
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
    fileSize: fileSizeBytes,
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
  const runtimeSettings = await getRuntimeAppSettings();

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
    maxAttempts: Math.max(1, Number(runtimeSettings.ocr_retry_limit || 1) + 1),
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

  const runtimeSettings = await getRuntimeAppSettings();
  const maxUploadBytes = Math.max(1, Number(runtimeSettings.max_upload_size_mb || 50)) * 1024 * 1024;
  if (Number(file.size || 0) > maxUploadBytes) {
    return res.status(400).json({
      message: `File exceeds max upload size of ${runtimeSettings.max_upload_size_mb} MB`,
    });
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

  const assessed = assessParsedReceipt(parsed || {}, ocrText);

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
    date: assessed.parsedDate,
    source: assessed.normalized.source || "",
    subAmount: assessed.normalized.subAmount || 0,
    amount: assessed.normalized.amount || 0,
    taxAmount: assessed.normalized.taxAmount || 0,
    payMethod: assessed.normalized.payMethod || "Other",
    items: assessed.normalized.items || [],
    parsedData: buildParsedReceiptPayload({
      normalized: assessed.normalized,
      confidence: assessed.confidence,
      warnings: assessed.warnings,
      modelVersion: env.aiReceiptModel || env.aiModel || "",
    }),
    aiModelVersion: env.aiReceiptModel || env.aiModel || "",
    parseConfidence: assessed.confidence,
    parseWarnings: assessed.warnings,
    fileSaved: false,
    processingStatus: "processed",
    processingStage: "completed",
    processingError: "",
  });

  let autoRecord = null;
  if (assessed.normalized.amount > 0) {
    const recordDate = assessed.parsedDate || new Date();
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
    await evaluateAchievementsForUser(req.user.id);
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
    parsedDate: assessed.parsedDate,
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

  const assessed = assessParsedReceipt(parsed || {}, ocrText);

  updated = await updateReceiptParsedData(req.user.id, receiptId, {
    date: assessed.parsedDate,
    source: assessed.normalized.source || "",
    subAmount: assessed.normalized.subAmount || 0,
    amount: assessed.normalized.amount || 0,
    taxAmount: assessed.normalized.taxAmount || 0,
    payMethod: assessed.normalized.payMethod || "Other",
    items: assessed.normalized.items || [],
    parsedData: buildParsedReceiptPayload({
      normalized: assessed.normalized,
      confidence: assessed.confidence,
      warnings: assessed.warnings,
      modelVersion: env.aiReceiptModel || env.aiModel || "",
    }),
    rawOcrText: ocrText,
    aiModelVersion: env.aiReceiptModel || env.aiModel || "",
    parseConfidence: assessed.confidence,
    parseWarnings: assessed.warnings,
    processingStatus: "processed",
    processingStage: "completed",
    processingError: "",
  });

  let autoRecord = null;
  if (assessed.normalized.amount > 0) {
    const recordDate = assessed.parsedDate || new Date();
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
      await evaluateAchievementsForUser(req.user.id);
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

async function getReceiptKeepFiles(runtimeSettings = null) {
  if (runtimeSettings && typeof runtimeSettings.receipt_keep_files === "boolean") {
    return runtimeSettings.receipt_keep_files;
  }
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
