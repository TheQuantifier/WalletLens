const PERMISSION_KEYS = [
  "users.read",
  "users.write",
  "records.read",
  "records.write",
  "settings.read",
  "settings.write",
  "notifications.read",
  "notifications.write",
  "support.read",
  "support.write",
  "audit.read",
  "health.read",
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    "users.read",
    "users.write",
    "records.read",
    "records.write",
    "settings.read",
    "settings.write",
    "notifications.read",
    "notifications.write",
    "support.read",
    "support.write",
    "audit.read",
    "health.read",
  ],
  support_admin: [
    "users.read",
    "notifications.read",
    "notifications.write",
    "support.read",
    "support.write",
    "audit.read",
    "health.read",
  ],
  analyst: [
    "users.read",
    "records.read",
    "notifications.read",
    "support.read",
    "audit.read",
    "health.read",
  ],
  user: [],
};

const CONFIGURABLE_ROLES = ["user", "analyst", "support_admin"];

function normalizePermission(value) {
  return String(value || "").trim().toLowerCase();
}

export function getPermissionKeys() {
  return [...PERMISSION_KEYS];
}

export function getDefaultRolePermissions() {
  return Object.fromEntries(
    Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, permissions]) => [role, [...permissions]])
  );
}

export function sanitizeRolePermissionOverrides(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const allowedPermissions = new Set(PERMISSION_KEYS);
  const sanitized = {};
  for (const role of CONFIGURABLE_ROLES) {
    const raw = input[role];
    if (!Array.isArray(raw)) continue;
    const next = [...new Set(raw.map(normalizePermission).filter((permission) => allowedPermissions.has(permission)))];
    sanitized[role] = next;
  }
  return sanitized;
}

export function buildEffectiveRolePermissionsMap(overridesInput) {
  const defaults = getDefaultRolePermissions();
  const sanitizedOverrides = sanitizeRolePermissionOverrides(overridesInput);

  const effective = {};
  for (const [role, permissions] of Object.entries(defaults)) {
    effective[role] = new Set(permissions);
  }
  for (const role of CONFIGURABLE_ROLES) {
    if (!Array.isArray(sanitizedOverrides[role])) continue;
    effective[role] = new Set(sanitizedOverrides[role]);
  }
  // Admin role is always full access, never overridden.
  effective.admin = new Set(defaults.admin);
  return effective;
}
