import { getAppSettings } from "../models/app_settings.model.js";
import { buildEffectiveRolePermissionsMap } from "../services/admin_permissions.service.js";

let permissionsCache = null;
let permissionsCacheExpiresAt = 0;
const CACHE_TTL_MS = 15000;

export function clearAdminPermissionsCache() {
  permissionsCache = null;
  permissionsCacheExpiresAt = 0;
}

async function getEffectivePermissionsMap() {
  const now = Date.now();
  if (permissionsCache && now < permissionsCacheExpiresAt) {
    return permissionsCache;
  }
  try {
    const settings = await getAppSettings();
    permissionsCache = buildEffectiveRolePermissionsMap(settings?.admin_role_permissions);
    permissionsCacheExpiresAt = now + CACHE_TTL_MS;
    return permissionsCache;
  } catch (err) {
    console.error("Failed to load admin role permissions, using defaults", err);
    permissionsCache = buildEffectiveRolePermissionsMap(null);
    permissionsCacheExpiresAt = now + CACHE_TTL_MS;
    return permissionsCache;
  }
}

export default function requireAdminPermission(permission) {
  return async function requirePermission(req, res, next) {
    const role = String(req.user?.role || "").trim();
    const permissionsMap = await getEffectivePermissionsMap();
    const allowed = permissionsMap[role];
    if (!allowed || !allowed.has(permission)) {
      return res.status(403).json({ message: "Permission denied" });
    }
    return next();
  };
}
