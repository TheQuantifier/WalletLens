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
import { clearAdminPermissionsCache } from "../middleware/require_admin_permission.js";
import { getCachedTaxRates } from "../services/tax_data_provider.service.js";

const MAINTENANCE_PAGE_IDS = Object.freeze([
  "index",
  "login",
  "register",
  "registerwho",
  "registerbusiness",
  "acceptinvite",
  "home",
  "upload",
  "records",
  "recurring",
  "rules",
  "planning",
  "budgeting",
  "reports",
  "profile",
  "settings",
  "admin",
  "team",
  "about",
  "careers",
  "help",
  "privacy",
  "terms",
  "timeout",
  "expired",
]);
const MAINTENANCE_PAGE_ID_SET = new Set(MAINTENANCE_PAGE_IDS);
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const DEFAULT_TAX_DATA = Object.freeze({
  version: 1,
  year: 2025,
  filingStatus: "single",
  federalIncomeTax: {
    standardDeduction: 15750,
    brackets: [
      { over: 0, upTo: 11925, rate: 0.10 },
      { over: 11925, upTo: 48475, rate: 0.12 },
      { over: 48475, upTo: 103350, rate: 0.22 },
      { over: 103350, upTo: 197300, rate: 0.24 },
      { over: 197300, upTo: 250525, rate: 0.32 },
      { over: 250525, upTo: 626350, rate: 0.35 },
      { over: 626350, upTo: null, rate: 0.37 },
    ],
  },
  fica: {
    socialSecurity: { rate: 0.062, wageBase: 176100 },
    medicare: { rate: 0.0145, wageBase: null },
  },
});

function sanitizeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function sanitizeTaxData(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const federal = source.federalIncomeTax && typeof source.federalIncomeTax === "object"
    ? source.federalIncomeTax
    : {};
  const brackets = Array.isArray(federal.brackets) && federal.brackets.length
    ? federal.brackets
    : DEFAULT_TAX_DATA.federalIncomeTax.brackets;
  const fica = source.fica && typeof source.fica === "object" ? source.fica : {};
  const socialSecurity = fica.socialSecurity && typeof fica.socialSecurity === "object" ? fica.socialSecurity : {};
  const medicare = fica.medicare && typeof fica.medicare === "object" ? fica.medicare : {};
  const stateIncomeTax =
    source.stateIncomeTax && typeof source.stateIncomeTax === "object" && !Array.isArray(source.stateIncomeTax)
      ? source.stateIncomeTax
      : {};
  return {
    version: 1,
    provider: String(source.provider || "").trim().slice(0, 80) || undefined,
    source: String(source.source || "").trim().slice(0, 160) || undefined,
    fetchedAt: String(source.fetchedAt || "").trim().slice(0, 80) || undefined,
    country: String(source.country || "US").trim().toUpperCase().slice(0, 4) || "US",
    year: Math.max(2000, Math.min(2100, Math.trunc(sanitizeNumber(source.year, DEFAULT_TAX_DATA.year)))),
    filingStatus: String(source.filingStatus || DEFAULT_TAX_DATA.filingStatus).trim().slice(0, 80) || DEFAULT_TAX_DATA.filingStatus,
    federalIncomeTax: {
      standardDeduction: Math.max(0, sanitizeNumber(federal.standardDeduction, DEFAULT_TAX_DATA.federalIncomeTax.standardDeduction)),
      brackets: brackets
        .map((bracket) => ({
          over: Math.max(0, sanitizeNumber(bracket?.over, 0)),
          upTo: bracket?.upTo === null || bracket?.upTo === "" || bracket?.upTo === undefined
            ? null
            : Math.max(0, sanitizeNumber(bracket?.upTo, 0)),
          rate: Math.max(0, Math.min(1, sanitizeNumber(bracket?.rate, 0))),
        }))
        .filter((bracket) => bracket.rate > 0)
        .sort((a, b) => a.over - b.over)
        .slice(0, 20),
    },
    fica: {
      socialSecurity: {
        rate: Math.max(0, Math.min(1, sanitizeNumber(socialSecurity.rate, DEFAULT_TAX_DATA.fica.socialSecurity.rate))),
        wageBase: socialSecurity.wageBase === null
          ? null
          : Math.max(0, sanitizeNumber(socialSecurity.wageBase, DEFAULT_TAX_DATA.fica.socialSecurity.wageBase)),
      },
      medicare: {
        rate: Math.max(0, Math.min(1, sanitizeNumber(medicare.rate, DEFAULT_TAX_DATA.fica.medicare.rate))),
        wageBase: medicare.wageBase === null || medicare.wageBase === undefined
          ? null
          : Math.max(0, sanitizeNumber(medicare.wageBase, DEFAULT_TAX_DATA.fica.medicare.wageBase || 0)),
      },
    },
    stateIncomeTax,
  };
}

function normalizeMaintenanceColor(value, fallback) {
  const color = String(value || "").trim();
  return HEX_COLOR_RE.test(color) ? color.toLowerCase() : fallback;
}

function normalizeMaintenancePageIds(value) {
  if (!Array.isArray(value)) return [...MAINTENANCE_PAGE_IDS];
  const cleaned = value
    .map((id) => String(id || "").trim().toLowerCase())
    .filter((id) => MAINTENANCE_PAGE_ID_SET.has(id));
  return cleaned.length ? Array.from(new Set(cleaned)) : [...MAINTENANCE_PAGE_IDS];
}

function sanitizeMaintenanceMessages(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((item) => {
      const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
      const id = String(source.id || "").trim().slice(0, 80);
      const text = String(source.text || "").trim();
      if (!id || !text || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        title: String(source.title || "Maintenance message").trim().slice(0, 80) || "Maintenance message",
        text: text.slice(0, 500),
        backgroundColor: normalizeMaintenanceColor(source.backgroundColor, "#ff8a00"),
        textColor: normalizeMaintenanceColor(source.textColor, "#ffffff"),
        pageIds: normalizeMaintenancePageIds(source.pageIds),
      };
    })
    .filter(Boolean)
    .slice(0, 25);
}

function getSelectedMaintenanceMessage(settings) {
  const messages = sanitizeMaintenanceMessages(settings?.maintenance_mode_messages);
  const defaultId = String(settings?.maintenance_mode_default_message_id || "").trim();
  const selected = messages.find((message) => message.id === defaultId) || messages[0] || null;
  if (selected) return selected;

  const legacyText = String(settings?.maintenance_mode_banner_text || "").trim();
  if (!legacyText) return null;
  return {
    id: "legacy",
    title: "Maintenance message",
    text: legacyText.slice(0, 500),
    backgroundColor: "#ff8a00",
    textColor: "#ffffff",
    pageIds: [...MAINTENANCE_PAGE_IDS],
  };
}

export const getPublic = asyncHandler(async (_req, res) => {
  const settings = await getAppSettings();
  const timeout = Number(settings?.session_timeout_minutes);
  const maintenanceModeEnabled = Boolean(settings?.maintenance_mode_enabled);
  const selectedMaintenanceMessage = getSelectedMaintenanceMessage(settings);
  const maintenanceModeBannerText = String(selectedMaintenanceMessage?.text || "").trim();
  const maintenanceModePageIds = normalizeMaintenancePageIds(selectedMaintenanceMessage?.pageIds);
  const maintenanceModeBackgroundColor = normalizeMaintenanceColor(selectedMaintenanceMessage?.backgroundColor, "#ff8a00");
  const maintenanceModeTextColor = normalizeMaintenanceColor(selectedMaintenanceMessage?.textColor, "#ffffff");
  const defaultDataExportFormat = String(settings?.default_data_export_format || "csv").toLowerCase() === "json"
    ? "json"
    : "csv";
  let taxData = sanitizeTaxData(settings?.tax_data);
  try {
    const cachedTaxRates = await getCachedTaxRates({
      year: new Date().getFullYear(),
      filingStatus: taxData.filingStatus || "single",
      existingTaxData: taxData,
    });
    taxData = sanitizeTaxData(cachedTaxRates?.data || taxData);
  } catch (err) {
    // Keep public settings resilient if the tax provider is not configured or temporarily unavailable.
    taxData = sanitizeTaxData(settings?.tax_data);
  }
  res.json({
    appName: settings?.app_name || "WalletLens",
    sessionTimeoutMinutes: Number.isFinite(timeout) ? timeout : 15,
    maintenanceModeEnabled,
    maintenanceModeBannerText,
    maintenanceModePageIds,
    maintenanceModeBackgroundColor,
    maintenanceModeTextColor,
    defaultDataExportFormat,
    taxData,
    supportEmail: process.env.SUPPORT_EMAIL || "support.wisewallet@manuswebworks.org",
  });
});

export const getAdmin = asyncHandler(async (_req, res) => {
  const settings = await getAppSettings();
  if (settings) {
    const catalogRows = await listAchievementsCatalog();
    settings.achievements_catalog = sanitizeAchievementsCatalog(catalogRows);
    settings.admin_role_permissions = sanitizeRolePermissionOverrides(settings.admin_role_permissions);
    settings.system_health_controls = sanitizeSystemHealthControls(settings.system_health_controls);
    settings.maintenance_mode_messages = sanitizeMaintenanceMessages(settings.maintenance_mode_messages);
    settings.tax_data = sanitizeTaxData(settings.tax_data);
    try {
      const cachedTaxRates = await getCachedTaxRates({
        year: new Date().getFullYear(),
        filingStatus: settings.tax_data.filingStatus || "single",
        existingTaxData: settings.tax_data,
      });
      settings.tax_data = sanitizeTaxData(cachedTaxRates?.data || settings.tax_data);
    } catch {
      settings.tax_data = sanitizeTaxData(settings.tax_data);
    }
    const selectedMaintenanceMessage = getSelectedMaintenanceMessage(settings);
    settings.maintenance_mode_default_message_id = selectedMaintenanceMessage?.id || "";
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
    maintenanceModeMessages,
    maintenanceModeDefaultMessageId,
    taxData,
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
  const hasMaintenanceModeMessages = maintenanceModeMessages !== undefined;
  const hasMaintenanceModeDefaultMessageId = maintenanceModeDefaultMessageId !== undefined;
  const hasTaxData = taxData !== undefined;
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
    !hasMaintenanceModeMessages &&
    !hasMaintenanceModeDefaultMessageId &&
    !hasTaxData &&
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

  let normalizedMaintenanceMessages = null;
  if (hasMaintenanceModeMessages) {
    if (!Array.isArray(maintenanceModeMessages)) {
      return res.status(400).json({ message: "maintenanceModeMessages must be an array" });
    }
    normalizedMaintenanceMessages = sanitizeMaintenanceMessages(maintenanceModeMessages);
    if (maintenanceModeMessages.length && !normalizedMaintenanceMessages.length) {
      return res.status(400).json({
        message: "maintenanceModeMessages must include at least one valid message",
      });
    }
  }

  let normalizedMaintenanceDefaultMessageId = null;
  let selectedMaintenanceText = null;
  if (hasMaintenanceModeMessages || hasMaintenanceModeDefaultMessageId) {
    const currentSettings = hasMaintenanceModeMessages ? null : await getAppSettings();
    const effectiveMessages = hasMaintenanceModeMessages
      ? normalizedMaintenanceMessages
      : sanitizeMaintenanceMessages(currentSettings?.maintenance_mode_messages);
    normalizedMaintenanceDefaultMessageId = String(maintenanceModeDefaultMessageId || "").trim();
    if (!normalizedMaintenanceDefaultMessageId && effectiveMessages.length) {
      normalizedMaintenanceDefaultMessageId = effectiveMessages[0].id;
    }
    const selected = effectiveMessages.find((message) => message.id === normalizedMaintenanceDefaultMessageId);
    if (effectiveMessages.length && !selected) {
      return res.status(400).json({
        message: "maintenanceModeDefaultMessageId must match a saved maintenance message",
      });
    }
    selectedMaintenanceText = selected?.text || "";
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

  let normalizedTaxData = null;
  if (hasTaxData) {
    if (!taxData || typeof taxData !== "object" || Array.isArray(taxData)) {
      return res.status(400).json({ message: "taxData must be an object" });
    }
    normalizedTaxData = sanitizeTaxData(taxData);
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
    hasMaintenanceModeMessages ||
    hasMaintenanceModeDefaultMessageId ||
    hasTaxData ||
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
        maintenanceModeBannerText: selectedMaintenanceText !== null
          ? selectedMaintenanceText
          : hasMaintenanceModeBannerText
          ? String(maintenanceModeBannerText)
          : null,
        maintenanceModeMessages: hasMaintenanceModeMessages ? normalizedMaintenanceMessages : undefined,
        maintenanceModeDefaultMessageId:
          hasMaintenanceModeMessages || hasMaintenanceModeDefaultMessageId
            ? normalizedMaintenanceDefaultMessageId
            : null,
        taxData: hasTaxData ? normalizedTaxData : undefined,
        adminRolePermissions: hasAdminRolePermissions ? normalizedAdminRolePermissions : null,
        systemHealthControls: hasSystemHealthControls ? normalizedSystemHealthControls : null,
        updatedBy: req.user.id,
      })
    : await getAppSettings();

  const catalogRows = await listAchievementsCatalog();
  const achievementsCatalogSanitized = sanitizeAchievementsCatalog(catalogRows);
  clearRuntimeAppSettingsCache();
  if (hasAdminRolePermissions) {
    clearAdminPermissionsCache();
  }
  if (updated) {
    updated.achievements_catalog = achievementsCatalogSanitized;
    updated.admin_role_permissions = sanitizeRolePermissionOverrides(updated.admin_role_permissions);
    updated.system_health_controls = sanitizeSystemHealthControls(updated.system_health_controls);
    updated.maintenance_mode_messages = sanitizeMaintenanceMessages(updated.maintenance_mode_messages);
    updated.tax_data = sanitizeTaxData(updated.tax_data);
    const selectedMaintenanceMessage = getSelectedMaintenanceMessage(updated);
    updated.maintenance_mode_default_message_id = selectedMaintenanceMessage?.id || "";
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
      maintenanceModeDefaultMessageId: updated?.maintenance_mode_default_message_id,
      maintenanceModeMessageCount: Array.isArray(updated?.maintenance_mode_messages)
        ? updated.maintenance_mode_messages.length
        : null,
      taxDataYear: updated?.tax_data?.year,
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

export const syncTaxDataAdmin = asyncHandler(async (req, res) => {
  const currentSettings = await getAppSettings();
  const currentTaxData = sanitizeTaxData(currentSettings?.tax_data);
  const year = Number(req.body?.year || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ message: "year must be an integer between 2000 and 2100" });
  }
  const filingStatus = String(req.body?.filingStatus || currentTaxData.filingStatus || "single").trim() || "single";
  const cachedTaxRates = await getCachedTaxRates({
    year,
    filingStatus,
    existingTaxData: currentTaxData,
    forceRefresh: true,
  });
  const syncedTaxData = cachedTaxRates?.data || currentTaxData;
  const syncResult = cachedTaxRates?.syncResult || null;
  const updated = await updateAppSettings({
    taxData: sanitizeTaxData(syncedTaxData),
    updatedBy: req.user.id,
  });
  clearRuntimeAppSettingsCache();
  if (updated) {
    updated.maintenance_mode_messages = sanitizeMaintenanceMessages(updated.maintenance_mode_messages);
    updated.tax_data = sanitizeTaxData(updated.tax_data);
    updated.admin_role_permissions = sanitizeRolePermissionOverrides(updated.admin_role_permissions);
    updated.system_health_controls = sanitizeSystemHealthControls(updated.system_health_controls);
  }
  await logActivity({
    userId: req.user.id,
    action: "tax_data_sync",
    entityType: "app_settings",
    entityId: updated?.id || null,
    metadata: {
      provider: "gemini",
      year,
      regions: "all",
      filingStatus,
      syncResult,
    },
    req,
  });
  res.json({ settings: updated, syncResult });
});
