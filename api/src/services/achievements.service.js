import { query } from "../config/db.js";
import {
  DEFAULT_ACHIEVEMENTS,
  ACHIEVEMENT_METRICS,
  BOOLEAN_ACHIEVEMENT_METRICS,
} from "../constants/achievements.js";
import { getAppSettings } from "../models/app_settings.model.js";
import {
  listUnlockedAchievementsForUser,
  unlockAchievementsForUser,
} from "../models/achievement.model.js";

const METRIC_SET = new Set(ACHIEVEMENT_METRICS);
const BOOLEAN_METRIC_SET = new Set(BOOLEAN_ACHIEVEMENT_METRICS);

const normalizeKey = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");

const normalizeAchievement = (raw = {}, index = 0) => {
  const key = normalizeKey(raw.key || `achievement_${index + 1}`);
  const title = String(raw.title || "").trim();
  const description = String(raw.description || "").trim();
  const rawMetric = String(raw.metric || "").trim();
  const metric = rawMetric === "account_age_days" ? "account_age_years" : rawMetric;
  const icon = String(raw.icon || "🏆").trim() || "🏆";
  let target = null;
  if (BOOLEAN_METRIC_SET.has(metric)) {
    if (typeof raw.target === "boolean") {
      target = raw.target;
    } else {
      const normalized = String(raw.target || "").trim().toLowerCase();
      if (normalized === "true") target = true;
      if (normalized === "false") target = false;
    }
  } else {
    const targetNum = Number(raw.target);
    target = Number.isFinite(targetNum) && targetNum > 0 ? targetNum : NaN;
  }

  const isValidTarget = BOOLEAN_METRIC_SET.has(metric)
    ? typeof target === "boolean"
    : Number.isFinite(target);
  if (!key || !title || !description || !METRIC_SET.has(metric) || !isValidTarget) {
    return null;
  }

  return {
    key,
    title,
    description,
    icon,
    metric,
    target,
  };
};

export const sanitizeAchievementsCatalog = (catalog) => {
  const source = Array.isArray(catalog) ? catalog : [];
  const output = [];
  const seen = new Set();

  source.forEach((item, idx) => {
    const normalized = normalizeAchievement(item, idx);
    if (!normalized) return;
    if (seen.has(normalized.key)) return;
    seen.add(normalized.key);
    output.push(normalized);
  });

  if (!output.length) {
    return DEFAULT_ACHIEVEMENTS.map((item, idx) => normalizeAchievement(item, idx)).filter(Boolean);
  }

  return output;
};

async function getMetricCounts(userId) {
  const { rows } = await query(
    `
    SELECT
      (SELECT COUNT(*)::int FROM records WHERE user_id = $1) AS records_total,
      (SELECT COUNT(*)::int FROM records WHERE user_id = $1 AND type = 'income') AS records_income,
      (SELECT COUNT(*)::int FROM records WHERE user_id = $1 AND type = 'expense') AS records_expense,
      (SELECT COUNT(*)::int FROM receipts WHERE user_id = $1) AS receipts_total,
      (SELECT COUNT(*)::int FROM budget_sheets WHERE user_id = $1) AS budgets_total,
      (SELECT COUNT(*)::int FROM net_worth_items WHERE user_id = $1) AS net_worth_total,
      (
        SELECT GREATEST(
          0,
          ROUND((EXTRACT(EPOCH FROM (now() - created_at)) / 31557600.0)::numeric, 4)
        )::float8
        FROM users
        WHERE id = $1
        LIMIT 1
      ) AS account_age_years,
      (
        SELECT (password_hash IS NOT NULL AND trim(password_hash) <> '')
        FROM users
        WHERE id = $1
        LIMIT 1
      ) AS has_password_login,
      (
        SELECT (google_id IS NOT NULL AND trim(google_id) <> '')
        FROM users
        WHERE id = $1
        LIMIT 1
      ) AS google_signin_enabled,
      (
        SELECT two_fa_enabled
        FROM users
        WHERE id = $1
        LIMIT 1
      ) AS two_fa_enabled,
      (
        SELECT (avatar_url IS NOT NULL AND trim(avatar_url) <> '')
        FROM users
        WHERE id = $1
        LIMIT 1
      ) AS avatar_selected
    `,
    [userId]
  );
  const data = rows[0] || {};
  const hasPasswordLogin = Boolean(data.has_password_login);
  const hasGoogleSignin = Boolean(data.google_signin_enabled);
  return {
    ...data,
    dual_auth_enabled: hasPasswordLogin && hasGoogleSignin,
    google_signin_enabled: hasGoogleSignin,
    two_fa_enabled: Boolean(data.two_fa_enabled),
    avatar_selected: Boolean(data.avatar_selected),
  };
}

export async function getAchievementCatalog() {
  const settings = await getAppSettings();
  return sanitizeAchievementsCatalog(settings?.achievements_catalog);
}

export async function evaluateAchievementsForUser(userId) {
  const [catalog, metrics, unlockedRows] = await Promise.all([
    getAchievementCatalog(),
    getMetricCounts(userId),
    listUnlockedAchievementsForUser(userId),
  ]);

  const unlockedMap = new Map(
    (unlockedRows || []).map((row) => [String(row.achievement_key), row.unlocked_at])
  );

  const toUnlock = [];
  for (const achievement of catalog) {
    const isBooleanMetric = BOOLEAN_METRIC_SET.has(achievement.metric);
    const progress = isBooleanMetric
      ? Boolean(metrics[achievement.metric])
      : Number(metrics[achievement.metric] || 0);
    const didMeet = isBooleanMetric ? progress === achievement.target : progress >= achievement.target;
    if (didMeet && !unlockedMap.has(achievement.key)) {
      toUnlock.push(achievement.key);
    }
  }

  if (toUnlock.length) {
    const inserted = await unlockAchievementsForUser(userId, toUnlock);
    inserted.forEach((row) => {
      unlockedMap.set(String(row.achievement_key), row.unlocked_at);
    });
  }

  const achievements = catalog.map((achievement) => {
    const isBooleanMetric = BOOLEAN_METRIC_SET.has(achievement.metric);
    const progress = isBooleanMetric
      ? Boolean(metrics[achievement.metric])
      : Number(metrics[achievement.metric] || 0);
    const unlockedAt = unlockedMap.get(achievement.key) || null;

    return {
      ...achievement,
      progress,
      unlocked: Boolean(unlockedAt),
      unlockedAt,
    };
  });

  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  return {
    achievements,
    summary: {
      unlockedCount,
      totalCount: achievements.length,
    },
  };
}

export async function normalizeCatalogForStorage(catalog) {
  return sanitizeAchievementsCatalog(catalog);
}
