// src/controllers/receipts.controller.js
import asyncHandler from "../middleware/async.js";

import { parseReceiptText } from "../services/aiParser.service.js";
import { runOcrBuffer } from "../services/ocr.service.js";
import env from "../config/env.js";
import { parseDateOnly } from "./records.controller.js";

import { query } from "../config/db.js";

import {
  createReceiptPending,
  listReceipts,
  getReceiptById,
  updateReceiptParsedData,
  deleteReceipt,
} from "../models/receipt.model.js";

import { createRecord } from "../models/record.model.js";

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

  if (!env.keepReceiptFiles) {
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

  // 2) Download the file (server-side) for OCR + AI parsing
  //    Note: This uses a short-lived presigned GET.
  const downloadUrl = await presignGet({ key: receipt.object_key, expiresIn: 60 });

  const fileRes = await fetch(downloadUrl);
  if (!fileRes.ok) {
    return res.status(400).json({ message: "Failed to fetch uploaded file for processing" });
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  // 3) OCR extraction
  let ocrText = "";
  try {
    const result = await runOcrBuffer(buffer);
    ocrText = result?.text || "";
  } catch (err) {
    console.error("❌ OCR failed:", err);
  }

  // 4) AI parsing (Gemini)
  let parsed = null;
  if (ocrText.trim().length > 5) {
    parsed = await parseReceiptText(ocrText);
  }

  const parsedDate = parsed?.date ? parseDateOnly(parsed.date) : null;

  // 5) Update receipt metadata
  let updatedReceipt = await updateReceiptParsedData(req.user.id, receiptId, {
    ocrText,
    date: parsedDate,
    source: parsed?.source || "",
    subAmount: parsed?.subAmount || 0,
    amount: parsed?.amount || 0,
    taxAmount: parsed?.taxAmount || 0,
    payMethod: parsed?.payMethod || "Other",
    items: parsed?.items || [],
    parsedData: parsed || {},
  });

  // 6) Auto-create Record if amount found
  let autoRecord = null;

  if (parsed && parsed.amount && Number(parsed.amount) > 0) {
    const recordDate =
      parsedDate ||
      (() => {
        console.log("⚠️ Invalid AI date → using today.");
        return new Date();
      })();

    autoRecord = await createRecord(req.user.id, {
      type: "expense",
      amount: Number(parsed.amount),
      category: "Uncategorized",
      date: recordDate,
      note: parsed?.source || "Receipt",
      linkedReceiptId: receiptId,
    });

    // Cross-link record back to receipt
    updatedReceipt = await updateReceiptParsedData(req.user.id, receiptId, {
      linkedRecordId: autoRecord.id,
    });
  }

  // 7) Optional: remove uploaded file after processing (useful for testing)
  if (!env.keepReceiptFiles) {
    try {
      if (receipt.object_key) {
        await deleteObject({ key: receipt.object_key });
      }
    } catch (err) {
      console.error("Error deleting R2 object after OCR", receipt.id, err);
    }
  }

  res.status(200).json({
    receipt: updatedReceipt,
    autoRecord,
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

  const parsedDate = parsed?.date ? parseDateOnly(parsed.date) : null;

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
    date: parsedDate,
    source: parsed?.source || "",
    subAmount: parsed?.subAmount || 0,
    amount: parsed?.amount || 0,
    taxAmount: parsed?.taxAmount || 0,
    payMethod: parsed?.payMethod || "Other",
    items: parsed?.items || [],
    parsedData: parsed || {},
    fileSaved: false,
  });

  let autoRecord = null;
  if (parsed && parsed.amount && Number(parsed.amount) > 0) {
    const recordDate = parsedDate || new Date();
    autoRecord = await createRecord(req.user.id, {
      type: "expense",
      amount: Number(parsed.amount),
      category: "Uncategorized",
      date: recordDate,
      note: parsed?.source || "Receipt",
      linkedReceiptId: receipt.id,
    });

    receipt = await updateReceiptParsedData(req.user.id, receipt.id, {
      linkedRecordId: autoRecord.id,
    });
  }

  res.status(200).json({
    ocrText,
    parsed: parsed || {},
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

  const updated = await updateReceiptParsedData(req.user.id, receiptId, {
    ocrText,
  });

  res.json({ receipt: updated });
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
