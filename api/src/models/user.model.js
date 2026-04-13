// src/models/user.model.js
import { query } from "../config/db.js";
import {
  computeDefaultAccessExpiresAt,
  decorateUserAccessState,
  decorateUserAccessStateList,
} from "../services/account_access.service.js";

/**
 * Expected Postgres table: users
 * Columns:
 * id (uuid), username, email, password_hash (nullable for Google-only users), full_name, location, role, phone_number, bio,
 * avatar_url, custom_expense_categories, custom_income_categories, address, employer, income_range,
 * trial_started_at, access_expires_at, created_at, updated_at
 */

const SAFE_USER_COLUMNS = `
  id, username, email, google_id, (password_hash is not null and password_hash <> '') as has_password,
  full_name, location, role, organization_id, phone_number, bio, avatar_url,
  address, employer, income_range, custom_expense_categories, custom_income_categories,
  two_fa_enabled, two_fa_method, two_fa_confirmed_at,
  trial_started_at, access_expires_at,
  created_at, updated_at
`;

const AUTH_USER_COLUMNS = `
  id, username, email, password_hash, google_id, full_name, location, role, phone_number, bio, avatar_url,
  organization_id,
  address, employer, income_range, custom_expense_categories, custom_income_categories,
  two_fa_enabled, two_fa_method, two_fa_confirmed_at,
  trial_started_at, access_expires_at,
  created_at, updated_at
`;

const LIST_USER_COLUMNS = `
  id, username, email, google_id, (password_hash is not null and password_hash <> '') as has_password,
  full_name, location, role, organization_id, phone_number, bio, avatar_url,
  address, employer, income_range, custom_expense_categories, custom_income_categories,
  trial_started_at, access_expires_at,
  created_at, updated_at
`;

export function normalizeIdentifier(value) {
  return String(value || "").toLowerCase().trim();
}

export async function createUser({
  username,
  email,
  passwordHash,
  googleId = null,
  fullName,
  location = "",
  role = "user",
  organizationId = null,
  phoneNumber = "",
  bio = "",
  avatarUrl = "",
  address = "",
  employer = "",
  incomeRange = "",
  customExpenseCategories = [],
  customIncomeCategories = [],
  trialStartedAt = new Date(),
  accessExpiresAt = computeDefaultAccessExpiresAt(trialStartedAt),
}) {
  const { rows } = await query(
    `
    INSERT INTO users
      (username, email, password_hash, google_id, full_name, location, role, organization_id, phone_number, bio, avatar_url, address, employer, income_range,
       custom_expense_categories, custom_income_categories, trial_started_at, access_expires_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING
      ${LIST_USER_COLUMNS}
    `,
    [
      normalizeIdentifier(username),
      normalizeIdentifier(email),
      passwordHash,
      googleId,
      fullName,
      location,
      role,
      organizationId,
      phoneNumber,
      bio,
      avatarUrl,
      address,
      employer,
      incomeRange,
      customExpenseCategories,
      customIncomeCategories,
      trialStartedAt,
      accessExpiresAt,
    ]
  );
  return decorateUserAccessState(rows[0]);
}

export async function findUserById(id) {
  const { rows } = await query(
    `
    SELECT
      ${SAFE_USER_COLUMNS}
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return decorateUserAccessState(rows[0] || null);
}

export async function findUserAuthById(id) {
  const { rows } = await query(
    `
    SELECT
      ${AUTH_USER_COLUMNS}
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return decorateUserAccessState(rows[0] || null);
}

export async function findUserAuthByIdentifier(identifier) {
  const ident = normalizeIdentifier(identifier);

  const { rows } = await query(
    `
    SELECT
      ${AUTH_USER_COLUMNS}
    FROM users
    WHERE lower(username) = $1 OR lower(email) = $1
    LIMIT 1
    `,
    [ident]
  );
  return decorateUserAccessState(rows[0] || null);
}

export async function findUserAuthByGoogleId(googleId) {
  const { rows } = await query(
    `
    SELECT
      ${AUTH_USER_COLUMNS}
    FROM users
    WHERE google_id = $1
    LIMIT 1
    `,
    [googleId]
  );
  return decorateUserAccessState(rows[0] || null);
}

export async function linkUserGoogleId(id, googleId) {
  const { rows } = await query(
    `
    UPDATE users
    SET google_id = $1,
        updated_at = now()
    WHERE id = $2
    RETURNING
      ${AUTH_USER_COLUMNS}
    `,
    [googleId, id]
  );
  return decorateUserAccessState(rows[0] || null);
}

export async function updateUserById(id, changes = {}) {
  const allowed = {
    username: "username",
    email: "email",
    fullName: "full_name",
    location: "location",
    role: "role",
    organizationId: "organization_id",
    phoneNumber: "phone_number",
    bio: "bio",
    avatarUrl: "avatar_url",
    address: "address",
    employer: "employer",
    incomeRange: "income_range",
    customExpenseCategories: "custom_expense_categories",
    customIncomeCategories: "custom_income_categories",
    trialStartedAt: "trial_started_at",
    accessExpiresAt: "access_expires_at",
  };

  const sets = [];
  const values = [];
  let i = 1;

  for (const [key, col] of Object.entries(allowed)) {
    if (changes[key] !== undefined) {
      const value =
        key === "username" || key === "email" ? normalizeIdentifier(changes[key]) : changes[key];
      sets.push(`${col} = $${i++}`);
      values.push(value);
    }
  }

  if (sets.length === 0) return findUserById(id);

  values.push(id);

  const { rows } = await query(
    `
    UPDATE users
    SET ${sets.join(", ")},
        updated_at = now()
    WHERE id = $${i}
    RETURNING
      ${LIST_USER_COLUMNS}
    `,
    values
  );

  return decorateUserAccessState(rows[0] || null);
}

export async function updateUserPasswordHash(id, passwordHash) {
  const { rows } = await query(
    `
    UPDATE users
    SET password_hash = $1,
        updated_at = now()
    WHERE id = $2
    RETURNING id
    `,
    [passwordHash, id]
  );
  return rows[0] || null;
}

export async function deleteUserById(id) {
  const { rows } = await query(
    `
    DELETE FROM users
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );
  return rows[0] || null;
}

export async function getUserNotificationSettings(userId) {
  const { rows } = await query(
    `
    SELECT
      notification_email_enabled,
      notification_sms_enabled
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );
  return rows[0] || null;
}

export async function updateUserNotificationSettings(
  userId,
  { notificationEmailEnabled = null, notificationSmsEnabled = null } = {}
) {
  const { rows } = await query(
    `
    UPDATE users
    SET
      notification_email_enabled = COALESCE($1, notification_email_enabled),
      notification_sms_enabled = COALESCE($2, notification_sms_enabled),
      updated_at = now()
    WHERE id = $3
    RETURNING
      notification_email_enabled,
      notification_sms_enabled
    `,
    [notificationEmailEnabled, notificationSmsEnabled, userId]
  );
  return rows[0] || null;
}

export async function listUsersWithNotificationEmailEnabled({
  roleFilter = [],
  organizationIdFilter = "",
} = {}) {
  const roles = Array.isArray(roleFilter)
    ? roleFilter.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const params = [];
  const where = [
    `notification_email_enabled = true`,
    `email IS NOT NULL`,
    `trim(email) <> ''`,
  ];
  let i = 1;

  if (roles.length) {
    where.push(`lower(role) = ANY($${i++}::text[])`);
    params.push(roles);
  }
  const organizationId = String(organizationIdFilter || "").trim();
  if (organizationId) {
    where.push(`organization_id = $${i++}`);
    params.push(organizationId);
  }

  const { rows } = await query(
    `
    SELECT
      id,
      email,
      full_name
    FROM users
    WHERE ${where.join(" AND ")}
    `,
    params
  );
  return rows || [];
}

export async function listUsers({
  limit = 50,
  offset = 0,
  queryText = "",
  roleFilter = [],
  organizationIdFilter = "",
} = {}) {
  const params = [];
  const where = [];
  let i = 1;

  const roles = Array.isArray(roleFilter)
    ? roleFilter.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean)
    : [];

  if (roles.length) {
    where.push(`lower(role) = ANY($${i++}::text[])`);
    params.push(roles);
  }

  const organizationId = String(organizationIdFilter || "").trim();
  if (organizationId) {
    where.push(`organization_id = $${i++}`);
    params.push(organizationId);
  }

  if (queryText) {
    where.push(`(
      username ILIKE $${i}
      OR email ILIKE $${i}
      OR full_name ILIKE $${i}
    )`);
    params.push(`%${queryText}%`);
    i += 1;
  }

  const countParams = [...params];
  const { rows: countRows } = await query(
    `
    SELECT COUNT(*)::int AS total
    FROM users
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    `,
    countParams
  );

  params.push(limit);
  params.push(offset);

  const { rows } = await query(
    `
    SELECT
      ${LIST_USER_COLUMNS}
    FROM users
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC
    LIMIT $${i++} OFFSET $${i++}
    `,
    params
  );
  return {
    users: decorateUserAccessStateList(rows),
    total: Number(countRows?.[0]?.total || 0),
  };
}
