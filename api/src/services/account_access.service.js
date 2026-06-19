const DEFAULT_FREE_TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getDefaultFreeTrialDays() {
  return DEFAULT_FREE_TRIAL_DAYS;
}

export function isAdminRoleType(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "org_admin" ||
    normalized === "support_admin" ||
    normalized === "analyst"
  );
}

export function computeDefaultAccessExpiresAt(startedAt = new Date()) {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  return new Date(start.getTime() + DEFAULT_FREE_TRIAL_DAYS * DAY_MS);
}

export function getAccountAccessState(userLike = {}) {
  const platformRole = String(userLike?.platform_role || userLike?.platformRole || "").trim().toLowerCase();
  const role = platformRole && platformRole !== "user"
    ? platformRole
    : String(userLike?.role || "").trim().toLowerCase();
  const organizationScoped = role === "org_user" || role === "org_admin";
  const subscriptionStatus = String(
    userLike?.organization_subscription_status || userLike?.organizationSubscriptionStatus || ""
  ).trim().toLowerCase();
  const expiresAt = organizationScoped
    ? userLike?.organization_access_expires_at || userLike?.organizationAccessExpiresAt || null
    : userLike?.access_expires_at || userLike?.accessExpiresAt || null;
  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const hasExpiry = Number.isFinite(expiresMs);
  const accessRemainingMs = hasExpiry ? Math.max(0, expiresMs - Date.now()) : null;
  const subscriptionBlocked = organizationScoped && ["suspended", "canceled"].includes(subscriptionStatus);
  const accountStatus = subscriptionBlocked || (hasExpiry && expiresMs <= Date.now()) ? "expired" : "active";

  return {
    accountStatus,
    accessRemainingMs,
    isExpired: accountStatus === "expired",
  };
}

export function decorateUserAccessState(userLike) {
  if (!userLike) return userLike;
  const state = getAccountAccessState(userLike);
  return {
    ...userLike,
    account_status: state.accountStatus,
    access_remaining_ms: state.accessRemainingMs,
  };
}

export function decorateUserAccessStateList(rows = []) {
  return Array.isArray(rows) ? rows.map((row) => decorateUserAccessState(row)) : [];
}
