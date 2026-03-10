import { getAppSettings } from "../models/app_settings.model.js";

const CACHE_TTL_MS = 10000;
let cache = null;
let cacheExpiresAt = 0;

const DEFAULTS = Object.freeze({
  app_name: "<AppName>",
  receipt_keep_files: true,
  session_timeout_minutes: 15,
  max_concurrent_sessions_per_user: 0,
  require_2fa_for_admin_roles: false,
  weekly_digest_day_of_week: 1,
  weekly_digest_time: "09:00",
  weekly_digest_timezone: "America/Chicago",
  pause_non_security_emails: false,
  pause_all_notifications: false,
  max_upload_size_mb: 50,
  ocr_timeout_seconds: 25,
  ocr_retry_limit: 1,
  default_data_export_format: "csv",
  maintenance_mode_enabled: false,
  maintenance_mode_banner_text: "",
});

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeWeeklyDigestTime(value) {
  const raw = String(value || "").trim();
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(raw) ? raw : DEFAULTS.weekly_digest_time;
}

function sanitizeTimezone(value) {
  const tz = String(value || "").trim();
  if (!tz) return DEFAULTS.weekly_digest_timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULTS.weekly_digest_timezone;
  }
}

export function normalizeRuntimeAppSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  const format = String(source.default_data_export_format || DEFAULTS.default_data_export_format)
    .trim()
    .toLowerCase();

  return {
    ...DEFAULTS,
    app_name: String(source.app_name || DEFAULTS.app_name),
    receipt_keep_files: Boolean(source.receipt_keep_files ?? DEFAULTS.receipt_keep_files),
    session_timeout_minutes: clampInt(
      source.session_timeout_minutes,
      DEFAULTS.session_timeout_minutes,
      1,
      60
    ),
    max_concurrent_sessions_per_user: clampInt(
      source.max_concurrent_sessions_per_user,
      DEFAULTS.max_concurrent_sessions_per_user,
      0,
      1000
    ),
    require_2fa_for_admin_roles: Boolean(
      source.require_2fa_for_admin_roles ?? DEFAULTS.require_2fa_for_admin_roles
    ),
    weekly_digest_day_of_week: clampInt(
      source.weekly_digest_day_of_week,
      DEFAULTS.weekly_digest_day_of_week,
      0,
      6
    ),
    weekly_digest_time: sanitizeWeeklyDigestTime(source.weekly_digest_time),
    weekly_digest_timezone: sanitizeTimezone(source.weekly_digest_timezone),
    pause_non_security_emails: Boolean(
      source.pause_non_security_emails ?? DEFAULTS.pause_non_security_emails
    ),
    pause_all_notifications: Boolean(
      source.pause_all_notifications ?? DEFAULTS.pause_all_notifications
    ),
    max_upload_size_mb: clampInt(source.max_upload_size_mb, DEFAULTS.max_upload_size_mb, 1, 250),
    ocr_timeout_seconds: clampInt(source.ocr_timeout_seconds, DEFAULTS.ocr_timeout_seconds, 5, 300),
    ocr_retry_limit: clampInt(source.ocr_retry_limit, DEFAULTS.ocr_retry_limit, 0, 5),
    default_data_export_format: format === "json" ? "json" : "csv",
    maintenance_mode_enabled: Boolean(
      source.maintenance_mode_enabled ?? DEFAULTS.maintenance_mode_enabled
    ),
    maintenance_mode_banner_text: String(
      source.maintenance_mode_banner_text || DEFAULTS.maintenance_mode_banner_text
    ).slice(0, 500),
  };
}

export async function getRuntimeAppSettings({ useCache = true } = {}) {
  const now = Date.now();
  if (useCache && cache && now < cacheExpiresAt) {
    return cache;
  }
  try {
    const settings = await getAppSettings();
    cache = normalizeRuntimeAppSettings(settings);
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cache;
  } catch {
    if (cache) return cache;
    cache = { ...DEFAULTS };
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cache;
  }
}

export function clearRuntimeAppSettingsCache() {
  cache = null;
  cacheExpiresAt = 0;
}
