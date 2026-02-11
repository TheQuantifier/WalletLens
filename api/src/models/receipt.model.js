// src/models/receipt.model.js
import { query } from "../config/db.js";

/**
 * Expected Postgres table: receipts
 * Mirrors your Mongo Receipt schema, but for R2 object storage.
 *
 * Suggested columns:
 * id (uuid), user_id (uuid),
 * original_filename (text),
 * object_key (text),              -- R2 key (replaces storedFileId/GridFS)
 * file_type (text),
 * file_size (bigint),
 * ocr_text (text),
 * date (timestamptz),
 * date_added (timestamptz),
 * source (text),
 * sub_amount (numeric),
 * amount (numeric),
 * tax_amount (numeric),
 * pay_method (text),
 * items (jsonb),                  -- [{name, price}]
 * parsed_data (jsonb),
 * linked_record_id (uuid, nullable),
 * created_at, updated_at
 */

export async function createReceiptPending({
  userId,
  originalFilename,
  objectKey,
  fileType = "",
  fileSize = 0,
  fileSaved = true,
}) {
  const { rows } = await query(
    `
    INSERT INTO receipts (
      user_id, original_filename, object_key, file_type, file_size, file_saved,
      ocr_text, date, date_added, source, sub_amount, amount, tax_amount,
      pay_method, items, parsed_data, linked_record_id
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      '', NULL, now(), '', 0, 0, 0,
      'Other', '[]'::jsonb, '{}'::jsonb, NULL
    )
    RETURNING *
    `,
    [userId, originalFilename, objectKey, fileType, fileSize, fileSaved]
  );

  return rows[0];
}

export async function listReceipts(userId, { limit = 200, offset = 0 } = {}) {
  const { rows } = await query(
    `
    SELECT *
    FROM receipts
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );
  return rows;
}

export async function getReceiptById(userId, id) {
  const { rows } = await query(
    `
    SELECT *
    FROM receipts
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [id, userId]
  );
  return rows[0] || null;
}

export async function updateReceiptParsedData(userId, id, patch = {}) {
  // patch keys mirror your Mongo schema names
  const {
    ocrText,
    date,
    source,
    subAmount,
    amount,
    taxAmount,
    payMethod,
    items,
    parsedData,
    linkedRecordId,
    fileSaved,
    processingStatus,
    processingStage,
    processingError,
    rawOcrText,
    aiModelVersion,
    parseConfidence,
    parseWarnings,
  } = patch;

  const sets = [];
  const values = [];
  let i = 1;

  const push = (sql, val) => {
    sets.push(sql.replace("?", `$${i++}`));
    values.push(val);
  };

  if (ocrText !== undefined) push("ocr_text = ?", ocrText);
  if (date !== undefined) push("date = ?", date ? new Date(date).toISOString() : null);
  if (source !== undefined) push("source = ?", source);
  if (subAmount !== undefined) push("sub_amount = ?", subAmount);
  if (amount !== undefined) push("amount = ?", amount);
  if (taxAmount !== undefined) push("tax_amount = ?", taxAmount);
  if (payMethod !== undefined) push("pay_method = ?", payMethod);

  if (items !== undefined) push("items = ?", JSON.stringify(items || []));
  if (parsedData !== undefined) push("parsed_data = ?", JSON.stringify(parsedData || {}));

  if (linkedRecordId !== undefined) push("linked_record_id = ?", linkedRecordId);
  if (fileSaved !== undefined) push("file_saved = ?", fileSaved);
  if (processingStatus !== undefined) push("processing_status = ?", processingStatus);
  if (processingStage !== undefined) push("processing_stage = ?", processingStage);
  if (processingError !== undefined) push("processing_error = ?", processingError);
  if (rawOcrText !== undefined) push("raw_ocr_text = ?", rawOcrText);
  if (aiModelVersion !== undefined) push("ai_model_version = ?", aiModelVersion);
  if (parseConfidence !== undefined) push("parse_confidence = ?", parseConfidence);
  if (parseWarnings !== undefined) push("parse_warnings = ?", JSON.stringify(parseWarnings || []));

  if (sets.length === 0) return getReceiptById(userId, id);

  values.push(id, userId);

  const { rows } = await query(
    `
    UPDATE receipts
    SET ${sets.join(", ")},
        updated_at = now()
    WHERE id = $${i++} AND user_id = $${i++}
    RETURNING *
    `,
    values
  );

  return rows[0] || null;
}

export async function setReceiptLinkedRecord(userId, receiptId, recordId) {
  const { rows } = await query(
    `
    UPDATE receipts
    SET linked_record_id = $1,
        updated_at = now()
    WHERE id = $2 AND user_id = $3
    RETURNING *
    `,
    [recordId, receiptId, userId]
  );
  return rows[0] || null;
}

export async function deleteReceipt(userId, id) {
  // IMPORTANT: Return object_key so controller can delete R2 object
  const { rows } = await query(
    `
    DELETE FROM receipts
    WHERE id = $1 AND user_id = $2
    RETURNING id, object_key, linked_record_id
    `,
    [id, userId]
  );
  return rows[0] || null;
}
