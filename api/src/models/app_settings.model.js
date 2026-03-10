// src/models/app_settings.model.js
import { query } from "../config/db.js";

export async function getAppSettings() {
  const { rows } = await query(
    `
    SELECT
      id,
      app_name,
      receipt_keep_files,
      session_timeout_minutes,
      admin_role_permissions,
      system_health_controls,
      updated_by,
      created_at,
      updated_at
    FROM app_settings
    ORDER BY created_at ASC
    LIMIT 1
    `
  );
  return rows[0] || null;
}

export async function updateAppSettings({
  appName,
  receiptKeepFiles,
  sessionTimeoutMinutes,
  adminRolePermissions,
  systemHealthControls,
  updatedBy,
}) {
  const { rows } = await query(
    `
    UPDATE app_settings
    SET app_name = COALESCE($1, app_name),
        receipt_keep_files = COALESCE($2, receipt_keep_files),
        session_timeout_minutes = COALESCE($3, session_timeout_minutes),
        admin_role_permissions = COALESCE($4, admin_role_permissions),
        system_health_controls = COALESCE($5, system_health_controls),
        updated_by = $6,
        updated_at = now()
    WHERE id = (
      SELECT id FROM app_settings ORDER BY created_at ASC LIMIT 1
    )
    RETURNING
      id,
      app_name,
      receipt_keep_files,
      session_timeout_minutes,
      admin_role_permissions,
      system_health_controls,
      updated_by,
      created_at,
      updated_at
    `,
    [
      appName ?? null,
      receiptKeepFiles ?? null,
      sessionTimeoutMinutes ?? null,
      adminRolePermissions ?? null,
      systemHealthControls ?? null,
      updatedBy || null,
    ]
  );
  return rows[0] || null;
}
