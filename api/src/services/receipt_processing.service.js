import env from "../config/env.js";
import { getAppSettings } from "../models/app_settings.model.js";
import { getReceiptById, updateReceiptParsedData } from "../models/receipt.model.js";
import { createRecord, updateRecord } from "../models/record.model.js";
import { parseReceiptText } from "./ai_parser.service.js";
import { evaluateAchievementsForUser } from "./achievements.service.js";
import { runOcrBuffer } from "./ocr.service.js";
import { presignGet, headObject, deleteObject } from "./r2.service.js";
import {
  assessParsedReceipt,
  buildParsedReceiptPayload,
} from "./receipt_normalization.service.js";
import { isSystemHealthServiceDeactivated } from "./system_health_controls.service.js";

export const RECEIPT_PROCESSING_STAGES = [
  "verifying_upload",
  "extracting_text",
  "parsing_ai",
  "updating_records",
  "completed",
  "failed",
];

export function nextReceiptStage(currentStage, outcome = "success") {
  if (outcome === "failed") return "failed";
  const index = RECEIPT_PROCESSING_STAGES.indexOf(currentStage);
  if (index === -1) return "verifying_upload";
  if (currentStage === "completed" || currentStage === "failed") return currentStage;
  return RECEIPT_PROCESSING_STAGES[Math.min(index + 1, RECEIPT_PROCESSING_STAGES.length - 2)];
}

async function getReceiptKeepFiles() {
  try {
    const settings = await getAppSettings();
    if (typeof settings?.receipt_keep_files === "boolean") {
      return settings.receipt_keep_files;
    }
  } catch {
    // fall back to env below
  }
  return env.keepReceiptFiles;
}

export async function processReceipt({ userId, receiptId }) {
  if (await isSystemHealthServiceDeactivated("ocr_worker")) {
    throw new Error("OCR worker is disconnected by admin.");
  }
  let receipt = await getReceiptById(userId, receiptId);
  if (!receipt) throw new Error("Receipt not found");

  await updateReceiptParsedData(userId, receiptId, {
    processingStatus: "processing",
    processingStage: "verifying_upload",
    processingError: "",
    aiModelVersion: env.aiReceiptModel || env.aiModel || "",
  });

  if (receipt.file_saved !== false) {
    await headObject({ key: receipt.object_key });
  }

  let ocrText = "";
  if (receipt.file_saved === false) {
    ocrText = receipt.ocr_text || "";
  } else {
    await updateReceiptParsedData(userId, receiptId, {
      processingStage: "extracting_text",
    });
    const downloadUrl = await presignGet({ key: receipt.object_key, expiresIn: 60 });
    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      throw new Error("Failed to fetch uploaded file for processing");
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const result = await runOcrBuffer(buffer);
    ocrText = result?.text || "";
  }

  await updateReceiptParsedData(userId, receiptId, {
    ocrText,
    rawOcrText: ocrText,
    processingStage: "parsing_ai",
  });

  const parsedRaw = ocrText.trim().length > 5 ? await parseReceiptText(ocrText) : null;
  const { normalized, confidence, warnings, parsedDate } = assessParsedReceipt(
    parsedRaw || {},
    ocrText
  );
  const parsedPayload = buildParsedReceiptPayload({
    normalized,
    confidence,
    warnings,
    modelVersion: env.aiReceiptModel || env.aiModel || "",
  });

  receipt = await updateReceiptParsedData(userId, receiptId, {
    date: parsedDate,
    source: normalized.source,
    subAmount: normalized.subAmount,
    amount: normalized.amount,
    taxAmount: normalized.taxAmount,
    payMethod: normalized.payMethod,
    items: normalized.items,
    parsedData: parsedPayload,
    aiModelVersion: env.aiReceiptModel || env.aiModel || "",
    parseConfidence: confidence,
    parseWarnings: warnings,
    processingStage: "updating_records",
  });

  let autoRecord = null;
  if (normalized.amount > 0) {
    const recordDate = parsedDate || new Date();
    if (receipt?.linked_record_id) {
      autoRecord = await updateRecord(userId, receipt.linked_record_id, {
        amount: normalized.amount,
        date: recordDate,
        note: normalized.source || "Receipt",
        category: normalized.category || "Other",
      });
    } else {
      autoRecord = await createRecord(userId, {
        type: "expense",
        amount: normalized.amount,
        category: normalized.category || "Other",
        date: recordDate,
        note: normalized.source || "Receipt",
        linkedReceiptId: receiptId,
      });
      receipt = await updateReceiptParsedData(userId, receiptId, {
        linkedRecordId: autoRecord.id,
      });
    }
    await evaluateAchievementsForUser(userId);
  }

  const keepReceiptFiles = await getReceiptKeepFiles();
  if (!keepReceiptFiles && receipt?.file_saved !== false && receipt?.object_key) {
    try {
      await deleteObject({ key: receipt.object_key });
    } catch {
      // non-fatal
    }
  }

  receipt = await updateReceiptParsedData(userId, receiptId, {
    processingStatus: "processed",
    processingStage: "completed",
    processingError: "",
  });

  return { receipt, autoRecord };
}
