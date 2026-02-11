import env from "../config/env.js";
import { getAppSettings } from "../models/app_settings.model.js";
import { getReceiptById, updateReceiptParsedData } from "../models/receipt.model.js";
import { createRecord, updateRecord } from "../models/record.model.js";
import { parseReceiptText } from "./ai_parser.service.js";
import { runOcrBuffer } from "./ocr.service.js";
import { presignGet, headObject, deleteObject } from "./r2.service.js";

const ALLOWED_PAY_METHODS = new Set([
  "Cash",
  "Check",
  "Credit Card",
  "Debit Card",
  "Gift Card",
  "Multiple",
  "Other",
]);

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

function parseDateOnly(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return null;
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value, maxLen = 240) {
  return String(value || "").trim().slice(0, maxLen);
}

function parseAmountWithWarnings(raw, field, warnings) {
  if (raw === null || raw === undefined || raw === "") return 0;
  const num = Number(String(raw).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(num)) {
    warnings.push(`${field}_not_numeric`);
    return 0;
  }
  if (num < 0) {
    warnings.push(`${field}_negative`);
    return 0;
  }
  return Number(num.toFixed(2));
}

function normalizeParsed(parsed, rawOcrText) {
  const warnings = [];
  const source = normalizeText(parsed?.source || "", 140);
  const payMethod = ALLOWED_PAY_METHODS.has(parsed?.payMethod) ? parsed.payMethod : "Other";
  const category = ALLOWED_CATEGORIES.has(parsed?.category) ? parsed.category : "Other";

  if (!source) warnings.push("source_missing");
  if (!ALLOWED_PAY_METHODS.has(parsed?.payMethod)) warnings.push("pay_method_unknown");
  if (!ALLOWED_CATEGORIES.has(parsed?.category)) warnings.push("category_unknown");

  const subAmount = parseAmountWithWarnings(parsed?.subAmount, "sub_amount", warnings);
  const amount = parseAmountWithWarnings(parsed?.amount, "amount", warnings);
  const taxAmount = parseAmountWithWarnings(parsed?.taxAmount, "tax_amount", warnings);

  if (amount === 0) warnings.push("amount_zero");
  if (subAmount > amount && amount > 0) warnings.push("subtotal_gt_total");
  if (taxAmount > amount && amount > 0) warnings.push("tax_gt_total");

  const parsedDate = parseDateOnly(parsed?.date);
  const now = Date.now();
  const minDate = Date.UTC(2000, 0, 1);
  const maxDate = now + 366 * 24 * 60 * 60 * 1000;
  if (parsed?.date && !parsedDate) warnings.push("date_invalid_format");
  if (parsedDate) {
    const ts = parsedDate.getTime();
    if (ts < minDate || ts > maxDate) warnings.push("date_out_of_range");
  }

  const items = Array.isArray(parsed?.items)
    ? parsed.items
        .map((entry) => ({
          name: normalizeText(entry?.name || "", 120),
          price: parseAmountWithWarnings(entry?.price, "item_price", warnings),
        }))
        .filter((entry) => entry.name || entry.price > 0)
    : [];

  const hasText = normalizeText(rawOcrText || "").length > 5;
  if (!hasText) warnings.push("ocr_text_too_short");

  const warningCount = new Set(warnings).size;
  const confidence = clamp(Number((0.96 - warningCount * 0.1).toFixed(4)), 0.2, 0.99);

  return {
    normalized: {
      date: parsedDate ? parsedDate.toISOString().slice(0, 10) : "",
      source,
      subAmount,
      amount,
      taxAmount,
      payMethod,
      category,
      items,
    },
    confidence,
    warnings: Array.from(new Set(warnings)),
  };
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
  let receipt = await getReceiptById(userId, receiptId);
  if (!receipt) throw new Error("Receipt not found");

  await updateReceiptParsedData(userId, receiptId, {
    processingStatus: "processing",
    processingStage: "verifying_upload",
    processingError: "",
    aiModelVersion: env.aiModel || "",
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
  const { normalized, confidence, warnings } = normalizeParsed(parsedRaw || {}, ocrText);
  const parsedDate = normalized.date ? parseDateOnly(normalized.date) : null;

  const parsedPayload = {
    ...normalized,
    _meta: {
      modelVersion: env.aiModel || "",
      parseConfidence: confidence,
      parseWarnings: warnings,
      parsedAt: new Date().toISOString(),
    },
  };

  receipt = await updateReceiptParsedData(userId, receiptId, {
    date: parsedDate,
    source: normalized.source,
    subAmount: normalized.subAmount,
    amount: normalized.amount,
    taxAmount: normalized.taxAmount,
    payMethod: normalized.payMethod,
    items: normalized.items,
    parsedData: parsedPayload,
    aiModelVersion: env.aiModel || "",
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
