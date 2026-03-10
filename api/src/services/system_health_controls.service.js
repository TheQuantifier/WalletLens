import { getAppSettings, updateAppSettings } from "../models/app_settings.model.js";
import { isDatabaseEmergencyDeactivated } from "./system_health_runtime.service.js";

const CACHE_TTL_MS = 10000;
let controlsCache = null;
let controlsCacheExpiresAt = 0;

export const SYSTEM_HEALTH_SERVICE_IDS = new Set([
  "database_connection",
  "brevo_api",
  "ratesdb_api",
  "google_oauth_api",
  "smtp_connection",
  "object_storage_connection",
  "ai_provider",
  "walterlens_service",
  "parser_service",
  "ocr_worker",
  "turnstile",
  "weekly_notification_worker",
]);

export function sanitizeSystemHealthControls(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next = {};
  for (const [serviceId, value] of Object.entries(raw)) {
    if (!SYSTEM_HEALTH_SERVICE_IDS.has(serviceId)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const deactivated = Boolean(value.deactivated);
    next[serviceId] = {
      deactivated,
      deactivatedAt: value.deactivatedAt ? String(value.deactivatedAt) : null,
      deactivatedBy: value.deactivatedBy ? String(value.deactivatedBy) : null,
    };
  }
  return next;
}

export async function getSystemHealthControls({ useCache = true } = {}) {
  const now = Date.now();
  if (useCache && controlsCache && now < controlsCacheExpiresAt) {
    return controlsCache;
  }
  try {
    const settings = await getAppSettings();
    controlsCache = sanitizeSystemHealthControls(settings?.system_health_controls);
    controlsCacheExpiresAt = now + CACHE_TTL_MS;
    return controlsCache;
  } catch (err) {
    if (controlsCache) return controlsCache;
    if (isDatabaseEmergencyDeactivated()) {
      controlsCache = {};
      controlsCacheExpiresAt = now + CACHE_TTL_MS;
      return controlsCache;
    }
    throw err;
  }
}

export async function isSystemHealthServiceDeactivated(serviceId) {
  if (String(serviceId || "").trim() === "database_connection") {
    return isDatabaseEmergencyDeactivated();
  }
  const controls = await getSystemHealthControls();
  return Boolean(controls?.[serviceId]?.deactivated);
}

export async function setSystemHealthServiceDeactivated({
  serviceId,
  deactivated,
  actorUserId,
}) {
  if (!SYSTEM_HEALTH_SERVICE_IDS.has(serviceId)) {
    throw new Error("Invalid system health service id");
  }
  const current = await getSystemHealthControls({ useCache: false });
  const next = { ...current };
  if (deactivated) {
    next[serviceId] = {
      deactivated: true,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: actorUserId || null,
    };
  } else {
    delete next[serviceId];
  }
  await updateAppSettings({
    systemHealthControls: next,
    updatedBy: actorUserId || null,
  });
  controlsCache = sanitizeSystemHealthControls(next);
  controlsCacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return controlsCache;
}
