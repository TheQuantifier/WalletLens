// src/controllers/app_settings.controller.js
import asyncHandler from "../middleware/async.js";
import { getAppSettings, updateAppSettings } from "../models/app_settings.model.js";
import {
  listAchievementsCatalog,
  replaceAchievementsCatalog,
} from "../models/achievements_catalog.model.js";
import { logActivity } from "../services/activity.service.js";
import {
  sanitizeAchievementsCatalog,
} from "../services/achievements.service.js";
import { ACHIEVEMENT_METRICS } from "../constants/achievements.js";
import {
  buildEffectiveRolePermissionsMap,
  sanitizeRolePermissionOverrides,
} from "../services/admin_permissions.service.js";
import { sanitizeSystemHealthControls } from "../services/system_health_controls.service.js";
import { clearRuntimeAppSettingsCache } from "../services/app_settings_runtime.service.js";

export const getPublic = asyncHandler(async (_req, res) => {
  const settings = await getAppSettings();
  const timeout = Number(settings?.session_timeout_minutes);
  const maintenanceModeEnabled = Boolean(settings?.maintenance_mode_enabled);
  const maintenanceModeBannerText = String(settings?.maintenance_mode_banner_text || "").trim();
  const defaultDataExportFormat = String(settings?.default_data_export_format || "csv").toLowerCase() === "json"
    ? "json"
    : "csv";
  res.json({
    appName: settings?.app_name || "<AppName>",
    sessionTimeoutMinutes: Number.isFinite(timeout) ? timeout : 15,
    maintenanceModeEnabled,
    maintenanceModeBannerText,
    defaultDataExportFormat,
  });
});

export const getAdmin = asyncHandler(async (_req, res) => {
  const settings = await getAppSettings();
  if (settings) {
    const catalogRows = await listAchievementsCatalog();
    settings.achievements_catalog = sanitizeAchievementsCatalog(catalogRows);
    settings.admin_role_permissions = sanitizeRolePermissionOverrides(settings.admin_role_permissions);
    settings.system_health_controls = sanitizeSystemHealthControls(settings.system_health_controls);
    const effective = buildEffectiveRolePermissionsMap(settings.admin_role_permissions);
    settings.admin_role_permissions_effective = Object.fromEntries(
      Object.entries(effective).map(([role, permissions]) => [role, [...permissions]])
    );
  }
  res.json({ settings });
});

export const updateAdmin = asyncHandler(async (req, res) => {
  const {
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
    achievementsCatalog,
  } = req.body;
  const hasAppName = appName !== undefined;
  const hasReceiptKeepFiles = receiptKeepFiles !== undefined;
  const hasSessionTimeoutMinutes = sessionTimeoutMinutes !== undefined;
  const hasMaxConcurrentSessionsPerUser = maxConcurrentSessionsPerUser !== undefined;
  const hasRequire2faForAdminRoles = require2faForAdminRoles !== undefined;
  const hasWeeklyDigestDayOfWeek = weeklyDigestDayOfWeek !== undefined;
  const hasWeeklyDigestTime = weeklyDigestTime !== undefined;
  const hasWeeklyDigestTimezone = weeklyDigestTimezone !== undefined;
  const hasPauseNonSecurityEmails = pauseNonSecurityEmails !== undefined;
  const hasPauseAllNotifications = pauseAllNotifications !== undefined;
  const hasMaxUploadSizeMb = maxUploadSizeMb !== undefined;
  const hasOcrTimeoutSeconds = ocrTimeoutSeconds !== undefined;
  const hasOcrRetryLimit = ocrRetryLimit !== undefined;
  const hasDefaultDataExportFormat = defaultDataExportFormat !== undefined;
  const hasMaintenanceModeEnabled = maintenanceModeEnabled !== undefined;
  const hasMaintenanceModeBannerText = maintenanceModeBannerText !== undefined;
  const hasAdminRolePermissions = adminRolePermissions !== undefined;
  const hasSystemHealthControls = systemHealthControls !== undefined;
  const hasAchievementsCatalog = achievementsCatalog !== undefined;

  if (
    !hasAppName &&
    !hasReceiptKeepFiles &&
    !hasSessionTimeoutMinutes &&
    !hasMaxConcurrentSessionsPerUser &&
    !hasRequire2faForAdminRoles &&
    !hasWeeklyDigestDayOfWeek &&
    !hasWeeklyDigestTime &&
    !hasWeeklyDigestTimezone &&
    !hasPauseNonSecurityEmails &&
    !hasPauseAllNotifications &&
    !hasMaxUploadSizeMb &&
    !hasOcrTimeoutSeconds &&
    !hasOcrRetryLimit &&
    !hasDefaultDataExportFormat &&
    !hasMaintenanceModeEnabled &&
    !hasMaintenanceModeBannerText &&
    !hasAdminRolePermissions &&
    !hasSystemHealthControls &&
    !hasAchievementsCatalog
  ) {
    return res.status(400).json({ message: "At least one setting is required" });
  }

  let normalizedAdminRolePermissions = null;
  if (hasAdminRolePermissions) {
    if (
      !adminRolePermissions ||
      typeof adminRolePermissions !== "object" ||
      Array.isArray(adminRolePermissions)
    ) {
      return res.status(400).json({ message: "adminRolePermissions must be an object keyed by role" });
    }
    normalizedAdminRolePermissions = sanitizeRolePermissionOverrides(adminRolePermissions);
  }
  let normalizedSystemHealthControls = null;
  if (hasSystemHealthControls) {
    if (
      !systemHealthControls ||
      typeof systemHealthControls !== "object" ||
      Array.isArray(systemHealthControls)
    ) {
      return res.status(400).json({ message: "systemHealthControls must be an object keyed by service id" });
    }
    normalizedSystemHealthControls = sanitizeSystemHealthControls(systemHealthControls);
  }

  if (hasAppName && !String(appName).trim()) {
    return res.status(400).json({ message: "appName must be a non-empty string" });
  }

  if (hasReceiptKeepFiles && typeof receiptKeepFiles !== "boolean") {
    return res.status(400).json({ message: "receiptKeepFiles must be a boolean" });
  }

  if (hasSessionTimeoutMinutes) {
    const timeout = Number(sessionTimeoutMinutes);
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 60 || !Number.isInteger(timeout)) {
      return res.status(400).json({ message: "sessionTimeoutMinutes must be an integer between 1 and 60" });
    }
  }

  if (hasMaxConcurrentSessionsPerUser) {
    const maxSessions = Number(maxConcurrentSessionsPerUser);
    if (!Number.isInteger(maxSessions) || maxSessions < 0 || maxSessions > 1000) {
      return res.status(400).json({
        message: "maxConcurrentSessionsPerUser must be an integer between 0 and 1000",
      });
    }
  }

  if (hasRequire2faForAdminRoles && typeof require2faForAdminRoles !== "boolean") {
    return res.status(400).json({ message: "require2faForAdminRoles must be a boolean" });
  }

  if (hasWeeklyDigestDayOfWeek) {
    const day = Number(weeklyDigestDayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return res.status(400).json({
        message: "weeklyDigestDayOfWeek must be an integer between 0 and 6",
      });
    }
  }

  if (hasWeeklyDigestTime) {
    const value = String(weeklyDigestTime || "").trim();
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      return res.status(400).json({ message: "weeklyDigestTime must be in HH:MM format" });
    }
  }

  if (hasWeeklyDigestTimezone) {
    const tz = String(weeklyDigestTimezone || "").trim();
    if (!tz) {
      return res.status(400).json({ message: "weeklyDigestTimezone must be a non-empty string" });
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      return res.status(400).json({ message: "weeklyDigestTimezone must be a valid IANA timezone" });
    }
  }

  if (hasPauseNonSecurityEmails && typeof pauseNonSecurityEmails !== "boolean") {
    return res.status(400).json({ message: "pauseNonSecurityEmails must be a boolean" });
  }

  if (hasPauseAllNotifications && typeof pauseAllNotifications !== "boolean") {
    return res.status(400).json({ message: "pauseAllNotifications must be a boolean" });
  }

  if (hasMaxUploadSizeMb) {
    const maxUpload = Number(maxUploadSizeMb);
    if (!Number.isInteger(maxUpload) || maxUpload < 1 || maxUpload > 250) {
      return res.status(400).json({
        message: "maxUploadSizeMb must be an integer between 1 and 250",
      });
    }
  }

  if (hasOcrTimeoutSeconds) {
    const timeout = Number(ocrTimeoutSeconds);
    if (!Number.isInteger(timeout) || timeout < 5 || timeout > 300) {
      return res.status(400).json({
        message: "ocrTimeoutSeconds must be an integer between 5 and 300",
      });
    }
  }

  if (hasOcrRetryLimit) {
    const retry = Number(ocrRetryLimit);
    if (!Number.isInteger(retry) || retry < 0 || retry > 5) {
      return res.status(400).json({
        message: "ocrRetryLimit must be an integer between 0 and 5",
      });
    }
  }

  if (hasDefaultDataExportFormat) {
    const format = String(defaultDataExportFormat || "").trim().toLowerCase();
    if (!["csv", "json"].includes(format)) {
      return res.status(400).json({
        message: "defaultDataExportFormat must be either csv or json",
      });
    }
  }

  if (hasMaintenanceModeEnabled && typeof maintenanceModeEnabled !== "boolean") {
    return res.status(400).json({ message: "maintenanceModeEnabled must be a boolean" });
  }

  if (hasMaintenanceModeBannerText) {
    const text = String(maintenanceModeBannerText || "");
    if (text.length > 500) {
      return res.status(400).json({
        message: "maintenanceModeBannerText cannot exceed 500 characters",
      });
    }
  }

  let normalizedCatalog = null;
  if (hasAchievementsCatalog) {
    if (!Array.isArray(achievementsCatalog)) {
      return res.status(400).json({
        message:
          "achievementsCatalog must be an array of {key, title, description, icon, metric, target}",
      });
    }
    normalizedCatalog = sanitizeAchievementsCatalog(achievementsCatalog);
    if (!normalizedCatalog.length) {
      return res.status(400).json({
        message: "achievementsCatalog must include at least one valid achievement",
      });
    }
  }

  if (hasAchievementsCatalog) {
    await replaceAchievementsCatalog(normalizedCatalog, req.user.id);
  }

  const needsAppSettingsUpdate =
    hasAppName ||
    hasReceiptKeepFiles ||
    hasSessionTimeoutMinutes ||
    hasMaxConcurrentSessionsPerUser ||
    hasRequire2faForAdminRoles ||
    hasWeeklyDigestDayOfWeek ||
    hasWeeklyDigestTime ||
    hasWeeklyDigestTimezone ||
    hasPauseNonSecurityEmails ||
    hasPauseAllNotifications ||
    hasMaxUploadSizeMb ||
    hasOcrTimeoutSeconds ||
    hasOcrRetryLimit ||
    hasDefaultDataExportFormat ||
    hasMaintenanceModeEnabled ||
    hasMaintenanceModeBannerText ||
    hasAdminRolePermissions ||
    hasSystemHealthControls;
  const updated = needsAppSettingsUpdate
    ? await updateAppSettings({
        appName: hasAppName ? String(appName).trim() : null,
        receiptKeepFiles: hasReceiptKeepFiles ? receiptKeepFiles : null,
        sessionTimeoutMinutes: hasSessionTimeoutMinutes ? Number(sessionTimeoutMinutes) : null,
        maxConcurrentSessionsPerUser: hasMaxConcurrentSessionsPerUser
          ? Number(maxConcurrentSessionsPerUser)
          : null,
        require2faForAdminRoles: hasRequire2faForAdminRoles ? require2faForAdminRoles : null,
        weeklyDigestDayOfWeek: hasWeeklyDigestDayOfWeek ? Number(weeklyDigestDayOfWeek) : null,
        weeklyDigestTime: hasWeeklyDigestTime ? String(weeklyDigestTime).trim() : null,
        weeklyDigestTimezone: hasWeeklyDigestTimezone ? String(weeklyDigestTimezone).trim() : null,
        pauseNonSecurityEmails: hasPauseNonSecurityEmails ? pauseNonSecurityEmails : null,
        pauseAllNotifications: hasPauseAllNotifications ? pauseAllNotifications : null,
        maxUploadSizeMb: hasMaxUploadSizeMb ? Number(maxUploadSizeMb) : null,
        ocrTimeoutSeconds: hasOcrTimeoutSeconds ? Number(ocrTimeoutSeconds) : null,
        ocrRetryLimit: hasOcrRetryLimit ? Number(ocrRetryLimit) : null,
        defaultDataExportFormat: hasDefaultDataExportFormat
          ? String(defaultDataExportFormat).trim().toLowerCase()
          : null,
        maintenanceModeEnabled: hasMaintenanceModeEnabled ? maintenanceModeEnabled : null,
        maintenanceModeBannerText: hasMaintenanceModeBannerText
          ? String(maintenanceModeBannerText)
          : null,
        adminRolePermissions: hasAdminRolePermissions ? normalizedAdminRolePermissions : null,
        systemHealthControls: hasSystemHealthControls ? normalizedSystemHealthControls : null,
        updatedBy: req.user.id,
      })
    : await getAppSettings();

  const catalogRows = await listAchievementsCatalog();
  const achievementsCatalogSanitized = sanitizeAchievementsCatalog(catalogRows);
  clearRuntimeAppSettingsCache();
  if (updated) {
    updated.achievements_catalog = achievementsCatalogSanitized;
    updated.admin_role_permissions = sanitizeRolePermissionOverrides(updated.admin_role_permissions);
    updated.system_health_controls = sanitizeSystemHealthControls(updated.system_health_controls);
    const effective = buildEffectiveRolePermissionsMap(updated.admin_role_permissions);
    updated.admin_role_permissions_effective = Object.fromEntries(
      Object.entries(effective).map(([role, permissions]) => [role, [...permissions]])
    );
  }

  await logActivity({
    userId: req.user.id,
    action: "app_settings_update",
    entityType: "app_settings",
    entityId: updated?.id || null,
    metadata: {
      appName: updated?.app_name,
      receiptKeepFiles: updated?.receipt_keep_files,
      sessionTimeoutMinutes: updated?.session_timeout_minutes,
      maxConcurrentSessionsPerUser: updated?.max_concurrent_sessions_per_user,
      require2faForAdminRoles: updated?.require_2fa_for_admin_roles,
      weeklyDigestDayOfWeek: updated?.weekly_digest_day_of_week,
      weeklyDigestTime: updated?.weekly_digest_time,
      weeklyDigestTimezone: updated?.weekly_digest_timezone,
      pauseNonSecurityEmails: updated?.pause_non_security_emails,
      pauseAllNotifications: updated?.pause_all_notifications,
      maxUploadSizeMb: updated?.max_upload_size_mb,
      ocrTimeoutSeconds: updated?.ocr_timeout_seconds,
      ocrRetryLimit: updated?.ocr_retry_limit,
      defaultDataExportFormat: updated?.default_data_export_format,
      maintenanceModeEnabled: updated?.maintenance_mode_enabled,
      maintenanceModeBannerText: updated?.maintenance_mode_banner_text,
      adminRolePermissions: updated?.admin_role_permissions,
      systemHealthControls: updated?.system_health_controls,
      achievementsCatalogCount: Array.isArray(achievementsCatalogSanitized)
        ? achievementsCatalogSanitized.length
        : null,
      achievementMetrics: ACHIEVEMENT_METRICS,
    },
    req,
  });

  res.json({ settings: updated });
});
