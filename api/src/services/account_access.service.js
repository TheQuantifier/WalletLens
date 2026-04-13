const DEFAULT_FREE_TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getDefaultFreeTrialDays() {
  return DEFAULT_FREE_TRIAL_DAYS;
}

export function computeDefaultAccessExpiresAt(startedAt = new Date()) {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  return new Date(start.getTime() + DEFAULT_FREE_TRIAL_DAYS * DAY_MS);
}

export function getAccountAccessState(userLike = {}) {
  const expiresAt = userLike?.access_expires_at || userLike?.accessExpiresAt || null;
  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  const hasExpiry = Number.isFinite(expiresMs);
  const accessRemainingMs = hasExpiry ? Math.max(0, expiresMs - Date.now()) : null;
  const accountStatus = hasExpiry && expiresMs <= Date.now() ? "expired" : "active";

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
