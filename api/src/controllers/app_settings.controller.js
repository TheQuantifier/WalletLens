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

export const getPublic = asyncHandler(async (_req, res) => {
  const settings = await getAppSettings();
  const timeout = Number(settings?.session_timeout_minutes);
  res.json({
    appName: settings?.app_name || "<AppName>",
    sessionTimeoutMinutes: Number.isFinite(timeout) ? timeout : 15,
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
    adminRolePermissions,
    systemHealthControls,
    achievementsCatalog,
  } = req.body;
  const hasAppName = appName !== undefined;
  const hasReceiptKeepFiles = receiptKeepFiles !== undefined;
  const hasSessionTimeoutMinutes = sessionTimeoutMinutes !== undefined;
  const hasAdminRolePermissions = adminRolePermissions !== undefined;
  const hasSystemHealthControls = systemHealthControls !== undefined;
  const hasAchievementsCatalog = achievementsCatalog !== undefined;

  if (
    !hasAppName &&
    !hasReceiptKeepFiles &&
    !hasSessionTimeoutMinutes &&
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
    hasAdminRolePermissions ||
    hasSystemHealthControls;
  const updated = needsAppSettingsUpdate
    ? await updateAppSettings({
        appName: hasAppName ? String(appName).trim() : null,
        receiptKeepFiles: hasReceiptKeepFiles ? receiptKeepFiles : null,
        sessionTimeoutMinutes: hasSessionTimeoutMinutes ? Number(sessionTimeoutMinutes) : null,
        adminRolePermissions: hasAdminRolePermissions ? normalizedAdminRolePermissions : null,
        systemHealthControls: hasSystemHealthControls ? normalizedSystemHealthControls : null,
        updatedBy: req.user.id,
      })
    : await getAppSettings();

  const catalogRows = await listAchievementsCatalog();
  const achievementsCatalogSanitized = sanitizeAchievementsCatalog(catalogRows);
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
