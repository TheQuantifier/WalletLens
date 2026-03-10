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
      max_concurrent_sessions_per_user,
      require_2fa_for_admin_roles,
      weekly_digest_day_of_week,
      weekly_digest_time,
      weekly_digest_timezone,
      pause_non_security_emails,
      pause_all_notifications,
      max_upload_size_mb,
      ocr_timeout_seconds,
      ocr_retry_limit,
      default_data_export_format,
      maintenance_mode_enabled,
      maintenance_mode_banner_text,
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
  maxConcurrentSessionsPerUser,
  require2faForAdminRoles,
  weeklyDigestDayOfWeek,
  weeklyDigestTime,
  weeklyDigestTimezone,
  pauseNonSecurityEmails,
  pauseAllNotifications,
  maxUploadSizeMb,
  ocrTimeoutSeconds,
  ocrRetryLimit,
  defaultDataExportFormat,
  maintenanceModeEnabled,
  maintenanceModeBannerText,
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
        max_concurrent_sessions_per_user = COALESCE($4, max_concurrent_sessions_per_user),
        require_2fa_for_admin_roles = COALESCE($5, require_2fa_for_admin_roles),
        weekly_digest_day_of_week = COALESCE($6, weekly_digest_day_of_week),
        weekly_digest_time = COALESCE($7, weekly_digest_time),
        weekly_digest_timezone = COALESCE($8, weekly_digest_timezone),
        pause_non_security_emails = COALESCE($9, pause_non_security_emails),
        pause_all_notifications = COALESCE($10, pause_all_notifications),
        max_upload_size_mb = COALESCE($11, max_upload_size_mb),
        ocr_timeout_seconds = COALESCE($12, ocr_timeout_seconds),
        ocr_retry_limit = COALESCE($13, ocr_retry_limit),
        default_data_export_format = COALESCE($14, default_data_export_format),
        maintenance_mode_enabled = COALESCE($15, maintenance_mode_enabled),
        maintenance_mode_banner_text = COALESCE($16, maintenance_mode_banner_text),
        admin_role_permissions = COALESCE($17, admin_role_permissions),
        system_health_controls = COALESCE($18, system_health_controls),
        updated_by = $19,
        updated_at = now()
    WHERE id = (
      SELECT id FROM app_settings ORDER BY created_at ASC LIMIT 1
    )
    RETURNING
      id,
      app_name,
      receipt_keep_files,
      session_timeout_minutes,
      max_concurrent_sessions_per_user,
      require_2fa_for_admin_roles,
      weekly_digest_day_of_week,
      weekly_digest_time,
      weekly_digest_timezone,
      pause_non_security_emails,
      pause_all_notifications,
      max_upload_size_mb,
      ocr_timeout_seconds,
      ocr_retry_limit,
      default_data_export_format,
      maintenance_mode_enabled,
      maintenance_mode_banner_text,
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
      maxConcurrentSessionsPerUser ?? null,
      require2faForAdminRoles ?? null,
      weeklyDigestDayOfWeek ?? null,
      weeklyDigestTime ?? null,
      weeklyDigestTimezone ?? null,
      pauseNonSecurityEmails ?? null,
      pauseAllNotifications ?? null,
      maxUploadSizeMb ?? null,
      ocrTimeoutSeconds ?? null,
      ocrRetryLimit ?? null,
      defaultDataExportFormat ?? null,
      maintenanceModeEnabled ?? null,
      maintenanceModeBannerText ?? null,
      adminRolePermissions ?? null,
      systemHealthControls ?? null,
      updatedBy || null,
    ]
  );
  return rows[0] || null;
}
