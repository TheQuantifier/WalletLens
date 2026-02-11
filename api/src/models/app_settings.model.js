// src/models/app_settings.model.js
import { query } from "../config/db.js";

export async function getAppSettings() {
  const { rows } = await query(
    `
    SELECT id, app_name, receipt_keep_files, updated_by, created_at, updated_at
    FROM app_settings
    ORDER BY created_at ASC
    LIMIT 1
    `
  );
  return rows[0] || null;
}

export async function updateAppSettings({ appName, receiptKeepFiles, updatedBy }) {
  const { rows } = await query(
    `
    UPDATE app_settings
    SET app_name = COALESCE($1, app_name),
        receipt_keep_files = COALESCE($2, receipt_keep_files),
        updated_by = $3,
        updated_at = now()
    WHERE id = (
      SELECT id FROM app_settings ORDER BY created_at ASC LIMIT 1
    )
    RETURNING id, app_name, receipt_keep_files, updated_by, created_at, updated_at
    `,
    [appName ?? null, receiptKeepFiles ?? null, updatedBy || null]
  );
  return rows[0] || null;
}
