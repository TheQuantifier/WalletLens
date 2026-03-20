// src/controllers/admin.controller.js
import asyncHandler from "../middleware/async.js";
import { query } from "../config/db.js";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import env from "../config/env.js";
import {
  listUsers,
  findUserById,
  findUserAuthById,
  updateUserById,
} from "../models/user.model.js";
import { revokeAllActiveSessions } from "../models/session.model.js";
import {
  listRecordsAdmin,
  getRecordByIdAdmin,
  updateRecordAdmin,
  deleteRecordAdmin,
} from "../models/record.model.js";
import { logActivity } from "../services/activity.service.js";
import { parseDateOnly } from "./records.controller.js";
import { getAppSettings } from "../models/app_settings.model.js";
import {
  listSupportTickets,
  updateSupportTicket,
} from "../models/support_ticket.model.js";
import {
  buildEffectiveRolePermissionsMap,
  sanitizeRolePermissionOverrides,
} from "../services/admin_permissions.service.js";
import {
  getSystemHealthControls,
  setSystemHealthServiceDeactivated,
  SYSTEM_HEALTH_SERVICE_IDS,
} from "../services/system_health_controls.service.js";
import {
  getDatabaseEmergencyState,
  isDatabaseEmergencyDeactivated,
  setDatabaseEmergencyDeactivated,
} from "../services/system_health_runtime.service.js";

const ORG_USER_ROLE = "org_user";
const ORG_ADMIN_ROLE = "org_admin";

function isOrgAdminRole(role) {
  return String(role || "").trim().toLowerCase() === ORG_ADMIN_ROLE;
}

function isOrgUserRole(role) {
  return String(role || "").trim().toLowerCase() === ORG_USER_ROLE;
}

function isOrganizationScopedRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === ORG_USER_ROLE || normalized === ORG_ADMIN_ROLE;
}

function getActorOrganizationId(req) {
  return String(req.user?.organization_id || req.user?.organizationId || "").trim();
}

function getScopedUserRoleFilter(req) {
  return isOrgAdminRole(req.user?.role) ? [ORG_USER_ROLE] : [];
}

function getScopedOrganizationIdFilter(req) {
  return isOrgAdminRole(req.user?.role) ? getActorOrganizationId(req) : "";
}

async function assertOrgScopedUserAccess(req, userId) {
  if (!isOrgAdminRole(req.user?.role)) {
    return { allowed: true, user: null };
  }

  const actorOrganizationId = getActorOrganizationId(req);
  if (!actorOrganizationId) {
    return {
      allowed: false,
      status: 403,
      message: "Org-admin access requires an organization ID.",
    };
  }

  const user = await findUserById(userId);
  if (!user) {
    return { allowed: false, status: 404, message: "User not found" };
  }

  if (!isOrgUserRole(user.role) || String(user.organization_id || "").trim() !== actorOrganizationId) {
    return {
      allowed: false,
      status: 403,
      message: "Org-admin access is limited to org users in the same organization.",
    };
  }

  return { allowed: true, user };
}

async function assertOrgScopedSupportTicketAccess(req, ticketId) {
  if (!isOrgAdminRole(req.user?.role)) {
    return { allowed: true };
  }

  const actorOrganizationId = getActorOrganizationId(req);
  if (!actorOrganizationId) {
    return {
      allowed: false,
      status: 403,
      message: "Org-admin access requires an organization ID.",
    };
  }

  const { rows } = await query(
    `
    SELECT
      t.id,
      t.user_id,
      u.role as user_role,
      u.organization_id
    FROM support_tickets t
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.id = $1
    LIMIT 1
    `,
    [ticketId]
  );
  const ticket = rows[0] || null;
  if (!ticket) {
    return { allowed: false, status: 404, message: "Ticket not found" };
  }
  if (
    !ticket.user_id ||
    !isOrgUserRole(ticket.user_role) ||
    String(ticket.organization_id || "").trim() !== actorOrganizationId
  ) {
    return {
      allowed: false,
      status: 403,
      message: "Org-admin access is limited to support tickets from org users in the same organization.",
    };
  }
  return { allowed: true, ticket };
}

const SYSTEM_HEALTH_SERVICES = [
  {
    id: "database_connection",
    label: "Neon PostgreSql DB",
    type: "api",
    deactivatable: true,
    purpose: "Stores users, records, app settings, notifications, and admin controls.",
  },
  {
    id: "brevo_api",
    label: "Brevo",
    type: "api",
    deactivatable: true,
    purpose: "Delivers transactional emails such as notifications and account messages.",
  },
  {
    id: "ratesdb_api",
    label: "RatesDB",
    type: "api",
    deactivatable: true,
    purpose: "Fetches currency exchange rates used by budgeting and records.",
  },
  {
    id: "google_oauth_api",
    label: "Google OAuth",
    type: "api",
    deactivatable: true,
    purpose: "Handles Google sign-in and account linking authentication flows.",
  },
  {
    id: "smtp_connection",
    label: "SMTP Connection",
    type: "connection",
    deactivatable: true,
    purpose: "Provides SMTP transport for outbound email delivery.",
  },
  {
    id: "object_storage_connection",
    label: "Object Storage Connection",
    type: "connection",
    deactivatable: true,
    purpose: "Stores uploaded receipt files and related assets.",
  },
  {
    id: "ai_provider",
    label: "Gemini AI",
    type: "api",
    deactivatable: true,
    purpose: "Powers AI parsing/assistant features used in receipt and finance workflows.",
  },
  {
    id: "walterlens_service",
    label: "WalterLens",
    type: "service",
    deactivatable: true,
    purpose: "Runs the in-app assistant orchestration for finance chat and guided actions.",
  },
  {
    id: "parser_service",
    label: "Receipt Parser Service",
    type: "service",
    deactivatable: true,
    purpose: "Validates and normalizes parsed OCR text into structured receipt data.",
  },
  {
    id: "ocr_worker",
    label: "OCR Worker",
    type: "service",
    deactivatable: true,
    purpose: "Extracts text from uploaded receipt images for record automation.",
  },
  {
    id: "turnstile",
    label: "Turnstile Verification",
    type: "service",
    deactivatable: true,
    purpose: "Protects forms from bots using human-verification checks.",
  },
  {
    id: "weekly_notification_worker",
    label: "Weekly Notification Worker",
    type: "service",
    deactivatable: true,
    purpose: "Schedules and sends weekly digest-style notification emails.",
  },
];

async function testSystemHealthService(serviceId) {
  const id = String(serviceId || "").trim();
  if (!SYSTEM_HEALTH_SERVICE_IDS.has(id)) {
    return { passed: false, detail: "Unknown service." };
  }

  if (id === "database_connection") {
    const probe = await query("SELECT now() as now");
    return {
      passed: Boolean(probe?.rows?.[0]?.now),
      detail: probe?.rows?.[0]?.now ? "Database responded successfully." : "Database probe failed.",
    };
  }

  if (id === "brevo_api") {
    const hasKey = Boolean(process.env.BREVO_API_KEY);
    return {
      passed: hasKey,
      detail: hasKey ? "BREVO_API_KEY is configured." : "BREVO_API_KEY is missing.",
    };
  }

  if (id === "ratesdb_api") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch("https://free.ratesdb.com/v1/rates?from=USD", {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        return {
          passed: false,
          detail: `RatesDB request failed (status ${res.status}).`,
        };
      }
      return {
        passed: true,
        detail: "RatesDB provider responded successfully.",
      };
    } catch (err) {
      clearTimeout(timeout);
      return {
        passed: false,
        detail: err?.name === "AbortError"
          ? "RatesDB request timed out."
          : "RatesDB provider request failed.",
      };
    }
  }

  if (id === "google_oauth_api") {
    const hasGoogleOauth =
      Boolean(env.googleClientId) &&
      Boolean(env.googleClientSecret) &&
      Boolean(env.googleRedirectUri);
    return {
      passed: hasGoogleOauth,
      detail: hasGoogleOauth
        ? "Google OAuth credentials are configured."
        : "Google OAuth credentials are missing.",
    };
  }

  if (id === "smtp_connection") {
    const hasSmtp =
      Boolean(process.env.SMTP_HOST) &&
      Boolean(process.env.SMTP_PORT) &&
      Boolean(process.env.SMTP_USER) &&
      Boolean(process.env.SMTP_PASS);
    return {
      passed: hasSmtp,
      detail: hasSmtp ? "SMTP credentials are configured." : "SMTP credentials are missing.",
    };
  }

  if (id === "ai_provider") {
    const hasAi = Boolean(env.aiApiKey);
    const provider = String(env.aiProvider || "unknown");
    return {
      passed: hasAi,
      detail: hasAi ? `AI provider configured (${provider}).` : "AI API key is missing.",
    };
  }

  if (id === "walterlens_service") {
    const hasAi = Boolean(env.aiApiKey);
    const provider = String(env.aiProvider || "unknown");
    return {
      passed: hasAi,
      detail: hasAi ? `WalterLens runtime available (${provider}).` : "WalterLens requires AI API key configuration.",
    };
  }

  if (id === "parser_service") {
    try {
      const parserModule = await import("../services/ai_parser.service.js");
      const hasParserFn = typeof parserModule?.parseReceiptText === "function";
      return {
        passed: hasParserFn,
        detail: hasParserFn ? "Receipt parser module is available." : "Receipt parser module is missing.",
      };
    } catch {
      return {
        passed: false,
        detail: "Receipt parser module failed to load.",
      };
    }
  }

  if (id === "ocr_worker") {
    if (!env.ocrEnabled) {
      return { passed: false, detail: "OCR is disabled by configuration." };
    }
    try {
      await fs.access(env.ocrWorkerScript);
      return { passed: true, detail: "OCR worker script is available." };
    } catch {
      return { passed: false, detail: "OCR worker script is missing." };
    }
  }

  if (id === "turnstile") {
    const hasKey = Boolean(env.turnstileSecretKey);
    return {
      passed: hasKey,
      detail: hasKey ? "Turnstile secret key is configured." : "Turnstile secret key is missing.",
    };
  }

  if (id === "object_storage_connection") {
    try {
      const [{ r2 }, { HeadObjectCommand }] = await Promise.all([
        import("../services/r2.service.js"),
        import("@aws-sdk/client-s3"),
      ]);
      const key = `_healthcheck/${Date.now()}-${Math.random().toString(16).slice(2)}.txt`;
      await r2.send(new HeadObjectCommand({
        Bucket: env.objectStore.bucket,
        Key: key,
      }));
      return {
        passed: true,
        detail: "Object storage responded successfully.",
      };
    } catch (err) {
      const statusCode = Number(err?.$metadata?.httpStatusCode || 0);
      if (statusCode === 404) {
        return {
          passed: true,
          detail: "Object storage responded successfully.",
        };
      }
      return {
        passed: false,
        detail: statusCode
          ? `Object storage request failed (status ${statusCode}).`
          : "Object storage request failed.",
      };
    }
  }

  if (id === "weekly_notification_worker") {
    const enabled = Boolean(env.runWeeklyNotificationWorkerInApi);
    return {
      passed: enabled,
      detail: enabled ? "Weekly worker is enabled in API process." : "Weekly worker is disabled in API process.",
    };
  }

  return { passed: false, detail: "Unknown service." };
}

async function buildSystemHealthServicesSnapshot() {
  await getSystemHealthControls();
  const services = [];
  for (const service of SYSTEM_HEALTH_SERVICES) {
    const testResult = await testSystemHealthService(service.id);
    let state = testResult.passed ? "active" : "down";
    if (!testResult.passed && String(testResult.detail || "").toLowerCase().includes("missing")) {
      state = "unconfigured";
    }
    services.push({
      id: service.id,
      label: service.label,
      type: service.type,
      state,
      deactivatable: false,
      deactivated: false,
      detail: service.purpose || testResult.detail,
      testedAt: new Date().toISOString(),
      deactivatedAt: null,
      deactivatedBy: null,
    });
  }
  return services;
}

// ==========================================================
// USERS
// ==========================================================
export const listUsersAdmin = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const queryText = String(req.query.q || "").trim();
  const roleFilter = getScopedUserRoleFilter(req);
  const organizationIdFilter = getScopedOrganizationIdFilter(req);

  const { users, total } = await listUsers({
    limit,
    offset,
    queryText,
    roleFilter,
    organizationIdFilter,
  });
  res.json({ users, total });
});

export const listUserOptionsAdmin = asyncHandler(async (_req, res) => {
  const params = [];
  const where = [];
  let i = 1;
  if (isOrgAdminRole(_req.user?.role)) {
    const actorOrganizationId = getActorOrganizationId(_req);
    if (!actorOrganizationId) {
      return res.json({ users: [] });
    }
    where.push(`lower(role) = $${i++}`);
    params.push(ORG_USER_ROLE);
    where.push(`organization_id = $${i++}`);
    params.push(actorOrganizationId);
  }
  const { rows } = await query(
    `
    SELECT
      id,
      username,
      email,
      full_name,
      COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(username), ''), email) AS display_name
    FROM users
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY lower(COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(username), ''), email)) ASC
    `,
    params
  );
  res.json({ users: rows });
});

export const getUserAdmin = asyncHandler(async (req, res) => {
  const access = await assertOrgScopedUserAccess(req, req.params.id);
  if (!access.allowed) return res.status(access.status).json({ message: access.message });
  const user = access.user || await findUserById(req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
});

export const updateUserAdmin = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const access = await assertOrgScopedUserAccess(req, userId);
  if (!access.allowed) return res.status(access.status).json({ message: access.message });
  const currentUser = access.user || await findUserById(userId);
  if (!currentUser) return res.status(404).json({ message: "User not found" });
  const updates = {};

  const allowedFields = [
    "username",
    "email",
    "fullName",
    "location",
    "role",
    "organizationId",
    "phoneNumber",
    "bio",
    "avatarUrl",
    "address",
    "employer",
    "incomeRange",
    "customExpenseCategories",
    "customIncomeCategories",
  ];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      updates[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    }
  }

  if (updates.email !== undefined) {
    updates.email = String(updates.email).toLowerCase().trim();
    const { rows } = await query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [
      updates.email,
    ]);
    if (rows[0] && rows[0].id !== userId) {
      return res.status(400).json({ message: "Email already in use" });
    }
  }

  if (updates.username !== undefined) {
    updates.username = String(updates.username).toLowerCase().trim();
    const { rows } = await query(`SELECT id FROM users WHERE lower(username) = $1 LIMIT 1`, [
      updates.username,
    ]);
    if (rows[0] && rows[0].id !== userId) {
      return res.status(400).json({ message: "Username already in use" });
    }
  }

  if (
    updates.role !== undefined &&
    !["user", "org_user", "admin", "org_admin", "support_admin", "analyst"].includes(updates.role)
  ) {
    return res.status(400).json({ message: "Invalid role" });
  }

  if (isOrgAdminRole(req.user?.role) && updates.role !== undefined && updates.role !== ORG_USER_ROLE) {
    return res.status(403).json({
      message: "Org-admin can only manage users with role org_user.",
    });
  }
  if (isOrgAdminRole(req.user?.role)) {
    const actorOrganizationId = getActorOrganizationId(req);
    if (!actorOrganizationId) {
      return res.status(403).json({ message: "Org-admin access requires an organization ID." });
    }
    if (updates.organizationId !== undefined && String(updates.organizationId || "").trim() !== actorOrganizationId) {
      return res.status(403).json({
        message: "Org-admin can only manage users in the same organization.",
      });
    }
    updates.organizationId = actorOrganizationId;
  }

  const effectiveRole = String(updates.role ?? currentUser.role ?? "").trim().toLowerCase();
  const effectiveOrganizationId = String(
    updates.organizationId !== undefined
      ? updates.organizationId
      : currentUser.organization_id ?? currentUser.organizationId ?? ""
  ).trim();

  if (isOrganizationScopedRole(effectiveRole) && !effectiveOrganizationId) {
    return res.status(400).json({
      message: "organizationId is required for org_user and org_admin roles.",
    });
  }

  if (!isOrganizationScopedRole(effectiveRole) && (updates.role !== undefined || updates.organizationId !== undefined)) {
    updates.organizationId = null;
  }

  const updated = await updateUserById(userId, updates);
  if (!updated) return res.status(404).json({ message: "User not found" });

  await logActivity({
    userId: req.user.id,
    action: "admin_user_update",
    entityType: "user",
    entityId: userId,
    metadata: { fields: Object.keys(updates), targetUserId: userId },
    req,
  });

  res.json({ user: updated });
});

export const forceLogoutAllUsersAdmin = asyncHandler(async (req, res) => {
  const password = String(req.body?.password || "");
  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }
  const actor = await findUserAuthById(req.user.id);
  if (!actor?.password_hash) {
    return res.status(400).json({ message: "This account does not have a password set." });
  }
  const ok = await bcrypt.compare(password, actor.password_hash);
  if (!ok) {
    return res.status(401).json({ message: "Password is incorrect." });
  }

  const revokedSessions = await revokeAllActiveSessions();
  await logActivity({
    userId: req.user.id,
    action: "admin_force_logout_all_users",
    entityType: "session",
    entityId: null,
    metadata: { revokedSessions },
    req,
  });

  res.json({
    ok: true,
    revokedSessions,
    message: `Revoked ${revokedSessions} active session(s).`,
  });
});

// ==========================================================
// RECORDS
// ==========================================================
export const listRecordsAdminController = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const userId = req.query.userId ? String(req.query.userId) : undefined;
  const queryText = req.query.q ? String(req.query.q).trim() : undefined;
  const type = req.query.type ? String(req.query.type) : undefined;
  const roleFilter = getScopedUserRoleFilter(req);
  const organizationIdFilter = getScopedOrganizationIdFilter(req);

  if (userId) {
    const access = await assertOrgScopedUserAccess(req, userId);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });
  }

  const records = await listRecordsAdmin({
    userId,
    queryText,
    type,
    limit,
    offset,
    roleFilter,
    organizationIdFilter,
  });
  res.json({ records });
});

export const getRecordAdmin = asyncHandler(async (req, res) => {
  const record = await getRecordByIdAdmin(req.params.id);
  if (!record) return res.status(404).json({ message: "Record not found" });
  const access = await assertOrgScopedUserAccess(req, record.user_id);
  if (!access.allowed) return res.status(access.status).json({ message: access.message });
  res.json({ record });
});

export const updateRecordAdminController = asyncHandler(async (req, res) => {
  const { type, amount, category, date, note } = req.body;

  const existing = await getRecordByIdAdmin(req.params.id);
  if (!existing) return res.status(404).json({ message: "Record not found" });
  const access = await assertOrgScopedUserAccess(req, existing.user_id);
  if (!access.allowed) return res.status(access.status).json({ message: access.message });

  if (type !== undefined && !["income", "expense"].includes(type)) {
    return res.status(400).json({ message: "Invalid type" });
  }

  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ message: "Amount must be a number \u2265 0" });
    }
  }

  if (date !== undefined && date !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
  }

  const changes = {};
  if (type !== undefined) changes.type = type;
  if (amount !== undefined) changes.amount = Number(amount);
  if (category !== undefined) changes.category = String(category).trim();
  if (date !== undefined) changes.date = date ? parseDateOnly(date) : existing.date;
  if (note !== undefined) changes.note = String(note);

  const updated = await updateRecordAdmin(req.params.id, changes);

  await logActivity({
    userId: req.user.id,
    action: "admin_record_update",
    entityType: "record",
    entityId: updated?.id || req.params.id,
    metadata: { fields: Object.keys(changes), targetUserId: existing.user_id },
    req,
  });

  res.json({ record: updated });
});

export const deleteRecordAdminController = asyncHandler(async (req, res) => {
  const deleteReceiptFlag = req.query.deleteReceipt === "true";
  const record = await getRecordByIdAdmin(req.params.id);
  if (!record) return res.status(404).json({ message: "Record not found" });
  const access = await assertOrgScopedUserAccess(req, record.user_id);
  if (!access.allowed) return res.status(access.status).json({ message: access.message });

  const linkedReceiptId = record.linked_receipt_id;
  if (linkedReceiptId) {
    if (deleteReceiptFlag) {
      await query(`DELETE FROM receipts WHERE id = $1`, [linkedReceiptId]);
    } else {
      await query(
        `UPDATE receipts
         SET linked_record_id = NULL, updated_at = now()
         WHERE id = $1`,
        [linkedReceiptId]
      );
    }
  }

  await deleteRecordAdmin(req.params.id);

  await logActivity({
    userId: req.user.id,
    action: "admin_record_delete",
    entityType: "record",
    entityId: req.params.id,
    metadata: { deletedReceipt: deleteReceiptFlag, targetUserId: record.user_id },
    req,
  });

  res.json({ message: "Record deleted", deletedReceipt: deleteReceiptFlag });
});

export const getAdminStatsController = asyncHandler(async (_req, res) => {
  const organizationId = getScopedOrganizationIdFilter(_req);
  const scopedToOrganization = isOrgAdminRole(_req.user?.role) && organizationId;
  if (isOrgAdminRole(_req.user?.role) && !organizationId) {
    return res.json({ stats: { total_users: 0, total_records: 0, total_receipts: 0 } });
  }
  const { rows } = await query(
    scopedToOrganization
      ? `
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE lower(role) = 'org_user' AND organization_id = $1) AS total_users,
          (
            SELECT COUNT(*)::int
            FROM records r
            JOIN users u ON u.id = r.user_id
            WHERE lower(u.role) = 'org_user'
              AND u.organization_id = $1
          ) AS total_records,
          (
            SELECT COUNT(*)::int
            FROM receipts r
            JOIN users u ON u.id = r.user_id
            WHERE lower(u.role) = 'org_user'
              AND u.organization_id = $1
          ) AS total_receipts
        `
      : `
        SELECT
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM records) AS total_records,
          (SELECT COUNT(*)::int FROM receipts) AS total_receipts
        `,
    scopedToOrganization ? [organizationId] : []
  );
  res.json({ stats: rows[0] || { total_users: 0, total_records: 0, total_receipts: 0 } });
});

export const getAdminPermissionsController = asyncHandler(async (req, res) => {
  const role = String(req.user?.role || "").trim();
  const settings = await getAppSettings();
  const overrides = sanitizeRolePermissionOverrides(settings?.admin_role_permissions);
  const effective = buildEffectiveRolePermissionsMap(overrides);
  const rolePermissions = effective[role] ? [...effective[role]] : [];
  res.json({
    role,
    permissions: rolePermissions,
    matrix: role === "admin"
      ? Object.fromEntries(
          Object.entries(effective).map(([r, permissionsSet]) => [r, [...permissionsSet]])
        )
      : null,
    overrides,
  });
});

export const listReceiptsAdminController = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const userId = req.query.userId ? String(req.query.userId) : "";
  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }
  const access = await assertOrgScopedUserAccess(req, userId);
  if (!access.allowed) return res.status(access.status).json({ message: access.message });

  const { rows } = await query(
    `
    SELECT
      receipts.*,
      users.full_name,
      users.username,
      users.email,
      COALESCE(users.full_name, users.username, users.email) AS user_name
    FROM receipts
    JOIN users ON users.id = receipts.user_id
    WHERE receipts.user_id = $1
    ORDER BY receipts.created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );

  res.json({ receipts: rows });
});

export const listBudgetSheetsAdminController = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  const userId = req.query.userId ? String(req.query.userId) : "";
  const cadence = req.query.cadence ? String(req.query.cadence) : "";
  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }
  const access = await assertOrgScopedUserAccess(req, userId);
  if (!access.allowed) return res.status(access.status).json({ message: access.message });

  const where = ["user_id = $1"];
  const values = [userId];
  let i = 2;

  if (cadence) {
    where.push(`cadence = $${i++}`);
    values.push(cadence);
  }

  values.push(limit);

  const { rows } = await query(
    `
    SELECT
      id, user_id, cadence, period,
      housing, utilities, groceries, transportation, dining, health, entertainment,
      shopping, membership, miscellaneous, education, giving, savings,
      custom_categories, created_at, updated_at
    FROM budget_sheets
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT $${i}
    `,
    values
  );

  res.json({ budgetSheets: rows });
});

// ==========================================================
// AUDIT LOG
// ==========================================================
export const listAuditLogAdmin = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const action = String(req.query.action || "").trim();
  const queryText = String(req.query.q || "").trim();
  const scope = String(req.query.scope || "all").trim().toLowerCase();
  const params = [];
  const where = [];
  let i = 1;

  if (action) {
    where.push(`a.action = $${i++}`);
    params.push(action);
  }
  if (queryText) {
    where.push(`(
      u.username ILIKE $${i}
      OR u.email ILIKE $${i}
      OR u.full_name ILIKE $${i}
      OR a.action ILIKE $${i}
    )`);
    params.push(`%${queryText}%`);
    i += 1;
  }
  if (scope === "admins") {
    where.push(`u.role IN ('admin', 'org_admin', 'support_admin', 'analyst')`);
  } else if (scope === "users") {
    where.push(`u.role IN ('user', 'org_user')`);
  }
  if (isOrgAdminRole(req.user?.role)) {
    const actorOrganizationId = getActorOrganizationId(req);
    if (!actorOrganizationId) {
      return res.json({ auditLog: [] });
    }
    where.push(`u.role = 'org_user'`);
    where.push(`u.organization_id = $${i++}`);
    params.push(actorOrganizationId);
  }
  params.push(limit);

  const { rows } = await query(
    `
    SELECT
      a.id,
      a.user_id,
      a.action,
      a.entity_type,
      a.entity_id,
      a.metadata,
      a.ip_address,
      a.user_agent,
      a.created_at,
      u.username,
      u.email,
      u.full_name,
      u.role
    FROM activity_log a
    LEFT JOIN users u ON u.id = a.user_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY a.created_at DESC
    LIMIT $${i++}
    `,
    params
  );

  res.json({ auditLog: rows });
});

// ==========================================================
// SUPPORT INBOX
// ==========================================================
export const listSupportTicketsAdmin = asyncHandler(async (req, res) => {
  const status = String(req.query.status || "").trim().toLowerCase();
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const tickets = await listSupportTickets({
    status,
    queryText: q,
    limit,
    offset,
    roleFilter: getScopedUserRoleFilter(req),
    organizationIdFilter: getScopedOrganizationIdFilter(req),
  });
  res.json({ tickets });
});

export const updateSupportTicketAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Ticket id is required" });
  const access = await assertOrgScopedSupportTicketAccess(req, id);
  if (!access.allowed) return res.status(access.status).json({ message: access.message });

  const hasStatus = req.body?.status !== undefined;
  const hasAdminNote = req.body?.adminNote !== undefined;
  if (!hasStatus && !hasAdminNote) {
    return res.status(400).json({ message: "status or adminNote is required" });
  }

  let status = null;
  if (hasStatus) {
    status = String(req.body.status || "").trim().toLowerCase();
    if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
  }

  const adminNote = hasAdminNote ? String(req.body.adminNote || "") : null;
  const ticket = await updateSupportTicket(id, { status, adminNote });
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });

  await logActivity({
    userId: req.user.id,
    action: "admin_support_ticket_update",
    entityType: "support_ticket",
    entityId: ticket.id,
    metadata: {
      status: ticket.status,
    },
    req,
  });

  res.json({ ticket });
});

// ==========================================================
// SYSTEM HEALTH
// ==========================================================
export const getSystemHealthAdmin = asyncHandler(async (_req, res) => {
  const services = await buildSystemHealthServicesSnapshot();
  res.json({ health: { services, checkedAt: new Date().toISOString() } });
});

export const testSystemHealthServiceAdmin = asyncHandler(async (req, res) => {
  const serviceId = String(req.params.serviceId || "").trim();
  if (!SYSTEM_HEALTH_SERVICE_IDS.has(serviceId)) {
    return res.status(404).json({ message: "Unknown system health service" });
  }
  const result = await testSystemHealthService(serviceId);
  const services = await buildSystemHealthServicesSnapshot();
  const service = services.find((item) => item.id === serviceId) || null;
  res.json({
    ok: Boolean(result.passed),
    message: result.passed ? "Connection test passed." : "Connection test failed.",
    result,
    service,
  });
});

export const deactivateSystemHealthServiceAdmin = asyncHandler(async (req, res) => {
  const serviceId = String(req.params.serviceId || "").trim();
  if (!SYSTEM_HEALTH_SERVICE_IDS.has(serviceId)) {
    return res.status(404).json({ message: "Unknown system health service" });
  }
  const serviceMeta = SYSTEM_HEALTH_SERVICES.find((item) => item.id === serviceId);
  if (!serviceMeta?.deactivatable) {
    return res.status(400).json({ message: "This service cannot be deactivated." });
  }

  const password = String(req.body?.password || "");
  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }
  const actor = await findUserAuthById(req.user.id);
  if (!actor?.password_hash) {
    return res.status(400).json({ message: "This account does not have a password set." });
  }
  const ok = await bcrypt.compare(password, actor.password_hash);
  if (!ok) {
    return res.status(401).json({ message: "Password is incorrect." });
  }

  if (serviceId === "database_connection") {
    await logActivity({
      userId: req.user.id,
      action: "admin_system_health_service_deactivate",
      entityType: "system_health_service",
      entityId: serviceId,
      metadata: { serviceId, mode: "runtime_emergency_toggle" },
      req,
    });
    const runtimeState = setDatabaseEmergencyDeactivated({
      deactivated: true,
      actorUserId: req.user.id,
    });
    return res.json({
      ok: true,
      message:
        "Database disconnected. If admin auth becomes unavailable, use /api/admin/system-health/database_connection/emergency-activate with the emergency code.",
      service: {
        id: serviceId,
        label: serviceMeta.label,
        type: serviceMeta.type,
        state: "deactivated",
        deactivatable: true,
        deactivated: true,
        detail: "Database is disconnected by admin.",
        testedAt: new Date().toISOString(),
        deactivatedAt: runtimeState?.deactivatedAt || null,
        deactivatedBy: runtimeState?.deactivatedBy || null,
      },
    });
  }

  await setSystemHealthServiceDeactivated({
    serviceId,
    deactivated: true,
    actorUserId: req.user.id,
  });

  await logActivity({
    userId: req.user.id,
    action: "admin_system_health_service_deactivate",
    entityType: "system_health_service",
    entityId: serviceId,
    metadata: { serviceId },
    req,
  });

  const services = await buildSystemHealthServicesSnapshot();
  const service = services.find((item) => item.id === serviceId) || null;
  res.json({
    ok: true,
    message: `${serviceMeta.label} disconnected.`,
    service,
  });
});

export const activateSystemHealthServiceAdmin = asyncHandler(async (req, res) => {
  const serviceId = String(req.params.serviceId || "").trim();
  if (!SYSTEM_HEALTH_SERVICE_IDS.has(serviceId)) {
    return res.status(404).json({ message: "Unknown system health service" });
  }
  const serviceMeta = SYSTEM_HEALTH_SERVICES.find((item) => item.id === serviceId);
  if (!serviceMeta?.deactivatable) {
    return res.status(400).json({ message: "This service cannot be activated." });
  }

  const password = String(req.body?.password || "");
  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }
  const actor = await findUserAuthById(req.user.id);
  if (!actor?.password_hash) {
    return res.status(400).json({ message: "This account does not have a password set." });
  }
  const ok = await bcrypt.compare(password, actor.password_hash);
  if (!ok) {
    return res.status(401).json({ message: "Password is incorrect." });
  }

  if (serviceId === "database_connection") {
    const runtimeState = setDatabaseEmergencyDeactivated({
      deactivated: false,
      actorUserId: req.user.id,
    });
    return res.json({
      ok: true,
      message: `${serviceMeta.label} activated.`,
      service: {
        id: serviceId,
        label: serviceMeta.label,
        type: serviceMeta.type,
        state: "active",
        deactivatable: true,
        deactivated: false,
        detail: "Database emergency disconnect cleared.",
        testedAt: new Date().toISOString(),
        deactivatedAt: runtimeState?.deactivatedAt || null,
        deactivatedBy: runtimeState?.deactivatedBy || null,
      },
    });
  }

  await setSystemHealthServiceDeactivated({
    serviceId,
    deactivated: false,
    actorUserId: req.user.id,
  });

  await logActivity({
    userId: req.user.id,
    action: "admin_system_health_service_activate",
    entityType: "system_health_service",
    entityId: serviceId,
    metadata: { serviceId },
    req,
  });

  const services = await buildSystemHealthServicesSnapshot();
  const service = services.find((item) => item.id === serviceId) || null;
  res.json({
    ok: true,
    message: `${serviceMeta.label} activated.`,
    service,
  });
});

export const emergencyActivateDatabaseConnectionAdmin = asyncHandler(async (req, res) => {
  const code = String(req.body?.code || "").trim();
  if (!env.systemHealthEmergencyCode) {
    return res.status(503).json({ message: "Emergency activation code is not configured." });
  }
  if (!code || code !== String(env.systemHealthEmergencyCode)) {
    return res.status(401).json({ message: "Invalid emergency activation code." });
  }
  setDatabaseEmergencyDeactivated({ deactivated: false, actorUserId: null });
  res.json({
    ok: true,
    message: "Database emergency disconnect cleared.",
    activatedAt: new Date().toISOString(),
  });
});
