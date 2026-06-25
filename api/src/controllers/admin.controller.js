// src/controllers/admin.controller.js
import asyncHandler from "../middleware/async.js";
import { query, withTransaction } from "../config/db.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs/promises";
import env from "../config/env.js";
import { sendEmail } from "../services/email.service.js";
import { deleteObject } from "../services/r2.service.js";
import {
  createOrganizationInvitation,
  findOrganizationInvitationById,
  listOrganizationInvitations,
  rotateOrganizationInvitation,
  revokeOrganizationInvitation,
  revokePendingInvitationByEmail,
  updateInvitationDelivery,
} from "../models/organization_invitation.model.js";
import { findOrganizationById, updateOrganizationById } from "../models/organization.model.js";
import { clearActiveOrganization, setActiveOrganization } from "../models/organization_membership.model.js";
import {
  clearTwoFaCodes,
  createTwoFaCode,
  deleteTwoFaCodeById,
  findValidTwoFaCode,
} from "../models/twofa.model.js";
import {
  listUsers,
  findUserById,
  findUserAuthById,
  updateUserById,
} from "../models/user.model.js";
import {
  computeDefaultAccessExpiresAt,
  isAdminRoleType,
} from "../services/account_access.service.js";
import { revokeAllActiveSessions, revokeAllSessionsForUser } from "../models/session.model.js";
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

const ADMIN_SECURITY_CODE_ACTIONS = {
  force_logout_all: {
    purpose: "admin_force_logout_all",
    subject: "Your <AppName> admin sign out code",
    label: "force logout all users",
  },
  system_health_activate: {
    purpose: "admin_system_health_activate",
    subject: "Your <AppName> system health activation code",
    label: "system health activation",
  },
  system_health_deactivate: {
    purpose: "admin_system_health_deactivate",
    subject: "Your <AppName> system health deactivation code",
    label: "system health deactivation",
  },
};

function getAdminSecurityCodeAction(action) {
  return ADMIN_SECURITY_CODE_ACTIONS[String(action || "").trim()] || null;
}

async function issueAdminSecurityCode({ userId, email, action }) {
  const config = getAdminSecurityCodeAction(action);
  if (!config) return false;
  const code = String(crypto.randomInt(100000, 1000000));
  await clearTwoFaCodes(userId, config.purpose);
  await createTwoFaCode({
    userId,
    purpose: config.purpose,
    codeHash: crypto.createHmac("sha256", env.jwtSecret).update(code).digest("hex"),
    expiresAt: new Date(Date.now() + env.twoFaCodeMinutes * 60 * 1000),
  });
  await sendEmail({
    to: email,
    subject: config.subject,
    text: `Your ${config.label} code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
  });
  return true;
}

async function verifyAdminSensitiveCredential({ userId, action, password, code }) {
  const actor = await findUserAuthById(userId);
  if (!actor) return { ok: false, status: 403, message: "Current administrator could not be verified." };
  if (code && actor.google_id) {
    const config = getAdminSecurityCodeAction(action);
    const match = config
      ? await findValidTwoFaCode({
          userId,
          purpose: config.purpose,
          codeHash: crypto.createHmac("sha256", env.jwtSecret).update(code).digest("hex"),
        })
      : null;
    if (!match) return { ok: false, status: 401, message: "Invalid or expired verification code." };
    await deleteTwoFaCodeById(match.id);
    return { ok: true, method: "email_code", actor };
  }
  if (!actor.password_hash) {
    return {
      ok: false,
      status: 400,
      message: actor.google_id ? "Request an email verification code to continue." : "This account does not have a password set.",
    };
  }
  if (!password) return { ok: false, status: 400, message: "Password is required." };
  const ok = await bcrypt.compare(String(password), actor.password_hash);
  if (!ok) return { ok: false, status: 401, message: "Password is incorrect." };
  return { ok: true, method: "password", actor };
}

function isFullAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "admin";
}

function getActorOrganizationId(req) {
  return String(req.user?.active_organization_id || req.user?.activeOrganizationId || "").trim();
}

function getActorAdminRole(req) {
  const platformRole = String(req.user?.platform_role || "").trim().toLowerCase();
  return platformRole && platformRole !== "user" ? platformRole : String(req.user?.role || "").trim().toLowerCase();
}

const INVITATION_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireOrganizationAdmin(req, res) {
  const organizationId = getActorOrganizationId(req);
  if (!isOrgAdminRole(getActorAdminRole(req)) || !organizationId) {
    res.status(403).json({ message: "Organization administrator access is required." });
    return "";
  }
  return organizationId;
}

function hashInvitationToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function invitationFrontendUrl(req, token) {
  const requestOrigin = String(req.get("origin") || "").trim();
  const fallbackOrigin = env.clientOrigins?.[0] || "http://localhost:5173";
  let origin = fallbackOrigin;
  try {
    const parsed = new URL(requestOrigin);
    if (["http:", "https:"].includes(parsed.protocol)) origin = parsed.origin;
  } catch {
    // Use configured frontend origin.
  }
  const url = new URL("/acceptinvite", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

async function deliverOrganizationInvitation({ req, invitation, token, organizationName }) {
  const acceptUrl = invitationFrontendUrl(req, token);
  const customMessage = String(invitation.custom_message || "").trim();
  const text = [
    `${req.user.full_name || req.user.email} invited you to join ${organizationName} on <AppName>.`,
    customMessage,
    `Accept the invitation: ${acceptUrl}`,
    "This invitation expires in 7 days.",
  ].filter(Boolean).join("\n\n");
  try {
    await sendEmail({ to: invitation.email, subject: `Invitation to join ${organizationName}`, text });
    await updateInvitationDelivery(invitation.id, "sent");
  } catch (error) {
    await updateInvitationDelivery(invitation.id, "failed", String(error?.message || "Email delivery failed").slice(0, 500));
    throw error;
  }
}

function getScopedUserRoleFilter(req) {
  return isOrgAdminRole(getActorAdminRole(req)) ? [ORG_USER_ROLE] : [];
}

function getScopedOrganizationIdFilter(req) {
  return isOrgAdminRole(getActorAdminRole(req)) ? getActorOrganizationId(req) : "";
}

async function assertOrgScopedUserAccess(req, userId) {
  if (!isOrgAdminRole(getActorAdminRole(req))) {
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

  const { rows: membershipRows } = await query(
    `SELECT membership_role FROM organization_memberships
     WHERE organization_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [actorOrganizationId, userId]
  );
  if (membershipRows[0]?.membership_role !== "member") {
    return {
      allowed: false,
      status: 403,
      message: "Org-admin access is limited to org users in the same organization.",
    };
  }

  return { allowed: true, user };
}

async function assertOrgScopedSupportTicketAccess(req, ticketId) {
  if (!isOrgAdminRole(getActorAdminRole(req))) {
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
  if (isOrgAdminRole(getActorAdminRole(_req))) {
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

export const listOrganizationInvitationsAdmin = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const invitations = await listOrganizationInvitations(organizationId);
  res.json({ invitations });
});

export const inviteOrganizationMemberAdmin = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const email = String(req.body?.email || "").toLowerCase().trim();
  const customMessage = String(req.body?.message || "").trim();
  if (!INVITATION_EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (customMessage.length > 1000) {
    return res.status(400).json({ message: "Invitation message cannot exceed 1000 characters." });
  }
  const { rows: existingRows } = await query(
    `SELECT u.id, m.status AS membership_status
     FROM users u LEFT JOIN organization_memberships m
       ON m.user_id = u.id AND m.organization_id = $2
     WHERE lower(u.email) = $1 LIMIT 1`,
    [email, organizationId]
  );
  if (existingRows[0]?.membership_status === "active") {
    return res.status(400).json({ message: "This user is already a member of the organization." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await withTransaction(async (executor) => {
    await revokePendingInvitationByEmail(organizationId, email, executor);
    return createOrganizationInvitation({
      organizationId,
      email,
      tokenHash,
      invitedBy: req.user.id,
      expiresAt,
      customMessage,
      executor,
    });
  });

  const { rows: organizationRows } = await query(`SELECT name FROM organizations WHERE id = $1 LIMIT 1`, [organizationId]);
  const organizationName = organizationRows[0]?.name || "your organization";
  await deliverOrganizationInvitation({ req, invitation, token, organizationName });

  await logActivity({
    userId: req.user.id,
    action: "organization_member_invite",
    entityType: "organization_invitation",
    entityId: invitation.id,
    metadata: { organizationId, email },
    req,
  });
  res.status(201).json({ invitation });
});

export const resendOrganizationInvitationAdmin = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const existing = await findOrganizationInvitationById(req.params.id, organizationId);
  if (!existing || existing.accepted_at) {
    return res.status(404).json({ message: "Invitation is not available for resend." });
  }
  const token = crypto.randomBytes(32).toString("hex");
  const invitation = await rotateOrganizationInvitation(
    existing.id,
    organizationId,
    hashInvitationToken(token),
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const organization = await findOrganizationById(organizationId);
  await deliverOrganizationInvitation({ req, invitation, token, organizationName: organization?.name || "your organization" });
  res.json({ invitation: await findOrganizationInvitationById(invitation.id, organizationId) });
});

export const getOrganizationAdmin = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const organization = await findOrganizationById(organizationId);
  const { rows: members } = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.phone_number, u.avatar_url, u.created_at,
       CASE WHEN m.membership_role = 'admin' THEN 'org_admin' ELSE 'org_user' END AS role
     FROM organization_memberships m JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = $1 AND m.status = 'active'
     ORDER BY CASE WHEN m.membership_role = 'admin' THEN 0 ELSE 1 END, lower(u.full_name), lower(u.email)`,
    [organizationId]
  );
  res.json({ organization, members });
});

export const updateOrganizationAdmin = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const body = req.body || {};
  const text = (key, max = 300) => String(body[key] || "").trim().slice(0, max);
  const fiscalYearStartMonth = Number(body.fiscalYearStartMonth);
  if (!Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
    return res.status(400).json({ message: "Fiscal year start month must be between 1 and 12." });
  }
  const defaultCurrency = text("defaultCurrency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
    return res.status(400).json({ message: "Default currency must be a three-letter currency code." });
  }
  const organization = await updateOrganizationById(organizationId, {
    name: text("name", 200), businessType: text("businessType", 100), industry: text("industry", 100),
    email: text("email", 200).toLowerCase(), phoneNumber: text("phoneNumber", 50),
    website: text("website", 500), address: text("address"), city: text("city", 100),
    region: text("region", 100), postalCode: text("postalCode", 30), country: text("country", 100),
    logoUrl: text("logoUrl", 500), defaultCurrency, timezone: text("timezone", 100) || "UTC",
    fiscalYearStartMonth,
  });
  res.json({ organization });
});

export const removeOrganizationMemberAdmin = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const memberId = String(req.params.id || "").trim();
  const disposition = String(req.body?.disposition || "retain").trim().toLowerCase();
  const transferToUserId = String(req.body?.transferToUserId || "").trim();
  if (!['retain', 'transfer', 'archive'].includes(disposition)) {
    return res.status(400).json({ message: "Invalid member data disposition." });
  }
  const result = await withTransaction(async (executor) => {
    const { rows } = await executor(
      `SELECT u.id, u.username, u.email, u.full_name, u.active_organization_id,
         m.membership_role, m.organization_id
       FROM organization_memberships m JOIN users u ON u.id = m.user_id
       WHERE m.user_id = $1 AND m.organization_id = $2 AND m.status = 'active' FOR UPDATE OF m, u`,
      [memberId, organizationId]
    );
    const member = rows[0];
    if (!member || member.membership_role !== "member") {
      const error = new Error("Organization member not found."); error.status = 404; throw error;
    }
    let ownerUserId = null;
    if (disposition === "transfer") {
      const { rows: targetRows } = await executor(
        `SELECT user_id AS id FROM organization_memberships
         WHERE user_id = $1 AND organization_id = $2 AND status = 'active' LIMIT 1`,
        [transferToUserId, organizationId]
      );
      if (!targetRows[0] || transferToUserId === memberId) {
        const error = new Error("Select another active organization member for the transfer."); error.status = 400; throw error;
      }
      ownerUserId = transferToUserId;
    }
    const resourceTables = ['records', 'receipts', 'budget_sheets', 'rules', 'recurring_schedules', 'plaid_items', 'plaid_accounts', 'net_worth_items', 'net_worth_snapshots', 'receipt_jobs'];
    const operationalResources = new Set(['plaid_items', 'plaid_accounts', 'receipt_jobs']);
    for (const table of resourceTables) {
      await executor(
        `UPDATE ${table} SET organization_owner_user_id = $1 WHERE organization_id = $2 AND organization_owner_user_id = $3`,
        [ownerUserId, organizationId, memberId]
      );
      await executor(
        `UPDATE ${table} SET user_id = $1 WHERE organization_id = $2 AND user_id = $3`,
        [operationalResources.has(table) ? req.user.id : null, organizationId, memberId]
      );
    }
    await executor(
      `INSERT INTO organization_member_archives
       (organization_id, user_id, archived_by, member_snapshot, disposition, transferred_to)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [organizationId, memberId, req.user.id, JSON.stringify(member), disposition, ownerUserId]
    );
    await executor(
      `UPDATE organization_memberships SET status = $1, removed_at = now(), updated_at = now()
       WHERE organization_id = $2 AND user_id = $3`,
      [disposition === "archive" ? "archived" : "removed", organizationId, memberId]
    );
    if (member.active_organization_id === organizationId) {
      const { rows: remaining } = await executor(
        `SELECT organization_id FROM organization_memberships
         WHERE user_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1`,
        [memberId]
      );
      if (remaining[0]) await setActiveOrganization(memberId, remaining[0].organization_id, executor);
      else await clearActiveOrganization(memberId, executor);
    }
    return member;
  });
  await revokeAllSessionsForUser(memberId);
  await logActivity({ userId: req.user.id, action: "organization_member_remove", entityType: "user",
    entityId: memberId, metadata: { organizationId, disposition, transferToUserId: transferToUserId || null }, req });
  res.json({ message: `${result.full_name || result.email} was removed from the organization.` });
});

export const revokeOrganizationInvitationAdmin = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const revoked = await revokeOrganizationInvitation(req.params.id, organizationId);
  if (!revoked) return res.status(404).json({ message: "Pending invitation not found." });
  res.json({ message: "Invitation revoked." });
});

export const transferOrganizationAdmin = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const targetUserId = String(req.body?.targetUserId || "").trim();
  if (!targetUserId || targetUserId === req.user.id) {
    return res.status(400).json({ message: "Select another organization member." });
  }

  const actorAuth = await findUserAuthById(req.user.id);
  const credential = String(req.body?.credential || "").trim();
  if (!actorAuth) return res.status(403).json({ message: "Current administrator could not be verified." });
  if (actorAuth.two_fa_enabled || actorAuth.google_id) {
    const match = credential ? await findValidTwoFaCode({
      userId: req.user.id,
      purpose: "organization_admin_transfer",
      codeHash: crypto.createHmac("sha256", env.jwtSecret).update(credential).digest("hex"),
    }) : null;
    if (match) {
      await deleteTwoFaCodeById(match.id);
    } else if (actorAuth.two_fa_enabled || !actorAuth.password_hash) {
      return res.status(400).json({ message: "Enter the valid administrator transfer code." });
    } else if (!credential || !(await bcrypt.compare(credential, actorAuth.password_hash))) {
      return res.status(400).json({ message: "Enter your current password or a valid administrator transfer code." });
    }
  } else if (actorAuth.password_hash) {
    if (!credential || !(await bcrypt.compare(credential, actorAuth.password_hash))) {
      return res.status(400).json({ message: "Enter your current password to reassign the administrator." });
    }
  } else {
    return res.status(400).json({ message: "Enable two-factor authentication before reassigning the administrator." });
  }

  const result = await withTransaction(async (executor) => {
    const { rows } = await executor(
      `SELECT m.user_id AS id, m.membership_role, m.organization_id, u.email, u.full_name,
         u.active_organization_id
       FROM organization_memberships m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1 AND m.user_id = ANY($2::uuid[]) AND m.status = 'active'
       FOR UPDATE OF m, u`,
      [organizationId, [req.user.id, targetUserId]]
    );
    const actor = rows.find((row) => row.id === req.user.id);
    const target = rows.find((row) => row.id === targetUserId);
    if (!actor || actor.membership_role !== "admin") {
      const error = new Error("Current organization administrator could not be verified.");
      error.status = 403;
      throw error;
    }
    if (!target || target.membership_role !== "member") {
      const error = new Error("The new administrator must be a member of the same organization.");
      error.status = 400;
      throw error;
    }
    await executor(`UPDATE organization_memberships SET membership_role = 'member', updated_at = now() WHERE organization_id = $1 AND user_id = $2`, [organizationId, req.user.id]);
    await executor(`UPDATE organization_memberships SET membership_role = 'admin', updated_at = now() WHERE organization_id = $1 AND user_id = $2`, [organizationId, targetUserId]);
    if (actor.active_organization_id === organizationId) {
      await executor(`UPDATE users SET role = 'org_user', updated_at = now() WHERE id = $1`, [req.user.id]);
    }
    if (target.active_organization_id === organizationId) {
      await executor(`UPDATE users SET role = 'org_admin', updated_at = now() WHERE id = $1`, [targetUserId]);
    }
    return { targetUserId, target };
  });

  const organization = await findOrganizationById(organizationId);
  const organizationName = organization?.name || "your organization";
  await Promise.allSettled([
    sendEmail({ to: actorAuth.email, subject: `Administrator changed for ${organizationName}`, text: `You reassigned the administrator role for ${organizationName} to ${result.target.full_name || result.target.email}. You remain a member of the organization.` }),
    sendEmail({ to: result.target.email, subject: `You are now the administrator for ${organizationName}`, text: `You are now the organization administrator for ${organizationName}.` }),
  ]);

  await logActivity({
    userId: req.user.id,
    action: "organization_admin_transfer",
    entityType: "user",
    entityId: result.targetUserId,
    metadata: { organizationId, previousAdminUserId: req.user.id },
    req,
  });
  res.json({ message: "Organization administrator reassigned.", targetUserId: result.targetUserId });
});

export const requestOrganizationAdminTransferVerification = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const actor = await findUserAuthById(req.user.id);
  if (!actor) return res.status(403).json({ message: "Current administrator could not be verified." });
  if (!actor.two_fa_enabled && !actor.google_id) {
    return res.json({ method: "password", message: "Enter your current password to continue." });
  }
  const code = String(crypto.randomInt(100000, 1000000));
  const purpose = "organization_admin_transfer";
  await clearTwoFaCodes(req.user.id, purpose);
  await createTwoFaCode({
    userId: req.user.id,
    purpose,
    codeHash: crypto.createHmac("sha256", env.jwtSecret).update(code).digest("hex"),
    expiresAt: new Date(Date.now() + env.twoFaCodeMinutes * 60 * 1000),
  });
  await sendEmail({
    to: actor.email,
    subject: "Verify administrator reassignment",
    text: `Your administrator reassignment code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
  });
  res.json({
    method: actor.password_hash ? "password_or_email" : "two_factor",
    message: actor.password_hash
      ? "Enter your current password or use the verification code sent to your email."
      : "A verification code was sent to your email.",
  });
});

export const requestOrganizationDeletionVerification = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const actor = await findUserAuthById(req.user.id);
  if (!actor) return res.status(403).json({ message: "Current administrator could not be verified." });
  if (!actor.two_fa_enabled && !actor.google_id) {
    return res.json({ method: "password", message: "Enter your current password to continue." });
  }
  const code = String(crypto.randomInt(100000, 1000000));
  const purpose = "organization_delete";
  await clearTwoFaCodes(req.user.id, purpose);
  await createTwoFaCode({
    userId: req.user.id,
    purpose,
    codeHash: crypto.createHmac("sha256", env.jwtSecret).update(code).digest("hex"),
    expiresAt: new Date(Date.now() + env.twoFaCodeMinutes * 60 * 1000),
  });
  await sendEmail({
    to: actor.email,
    subject: "Verify organization deletion",
    text: `Your organization deletion code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
  });
  res.json({
    method: actor.password_hash ? "password_or_email" : "two_factor",
    message: actor.password_hash
      ? "Enter your current password or use the verification code sent to your email."
      : "A verification code was sent to your email.",
  });
});

export const deleteOrganizationAdmin = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationAdmin(req, res);
  if (!organizationId) return;
  const credential = String(req.body?.credential || "").trim();
  const confirmationName = String(req.body?.confirmationName || "").trim();
  const actor = await findUserAuthById(req.user.id);
  const organization = await findOrganizationById(organizationId);
  if (!actor || !organization) return res.status(404).json({ message: "Organization not found." });
  if (confirmationName !== organization.name) {
    return res.status(400).json({ message: "Enter the organization name exactly as shown." });
  }
  if (actor.two_fa_enabled || actor.google_id) {
    const match = credential ? await findValidTwoFaCode({
      userId: req.user.id,
      purpose: "organization_delete",
      codeHash: crypto.createHmac("sha256", env.jwtSecret).update(credential).digest("hex"),
    }) : null;
    if (match) {
      await deleteTwoFaCodeById(match.id);
    } else if (actor.two_fa_enabled || !actor.password_hash) {
      return res.status(400).json({ message: "Enter the valid organization deletion code." });
    } else if (!credential || !(await bcrypt.compare(credential, actor.password_hash))) {
      return res.status(400).json({ message: "Enter your current password or a valid organization deletion code." });
    }
  } else if (actor.password_hash) {
    if (!credential || !(await bcrypt.compare(credential, actor.password_hash))) {
      return res.status(400).json({ message: "Enter your current password to delete the organization." });
    }
  } else {
    return res.status(400).json({ message: "Enable two-factor authentication before deleting the organization." });
  }

  const deletion = await withTransaction(async (executor) => {
    const { rows: adminRows } = await executor(
      `SELECT membership_role FROM organization_memberships
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE`,
      [organizationId, req.user.id]
    );
    if (adminRows[0]?.membership_role !== "admin") {
      const error = new Error("Only the current organization administrator can delete this organization.");
      error.status = 403;
      throw error;
    }
    const { rows: affectedUsers } = await executor(
      `SELECT u.id, u.active_organization_id
       FROM users u LEFT JOIN organization_memberships m
         ON m.user_id = u.id AND m.organization_id = $1
       WHERE u.organization_id = $1 OR u.active_organization_id = $1 OR m.user_id IS NOT NULL
       FOR UPDATE OF u`,
      [organizationId]
    );
    for (const affectedUser of affectedUsers) {
      if (affectedUser.active_organization_id === organizationId) {
        const { rows: fallbackRows } = await executor(
          `SELECT organization_id FROM organization_memberships
           WHERE user_id = $1 AND organization_id <> $2 AND status = 'active'
           ORDER BY created_at LIMIT 1`,
          [affectedUser.id, organizationId]
        );
        if (fallbackRows[0]) await setActiveOrganization(affectedUser.id, fallbackRows[0].organization_id, executor);
        else await clearActiveOrganization(affectedUser.id, executor);
      } else {
        const restored = affectedUser.active_organization_id
          ? await setActiveOrganization(affectedUser.id, affectedUser.active_organization_id, executor)
          : null;
        if (!restored) await clearActiveOrganization(affectedUser.id, executor);
      }
    }
    const { rows: receiptRows } = await executor(
      `SELECT object_key FROM receipts WHERE organization_id = $1 AND object_key IS NOT NULL`,
      [organizationId]
    );
    const resourceTables = [
      "receipt_jobs", "receipts", "records", "budget_sheets", "rules", "recurring_schedules",
      "plaid_accounts", "plaid_items", "net_worth_items", "net_worth_snapshots",
    ];
    for (const table of resourceTables) {
      await executor(`DELETE FROM ${table} WHERE organization_id = $1`, [organizationId]);
    }
    const { rowCount } = await executor(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    if (!rowCount) {
      const error = new Error("Organization not found."); error.status = 404; throw error;
    }
    return { objectKeys: receiptRows.map((row) => row.object_key), affectedUserIds: affectedUsers.map((user) => user.id) };
  });

  await Promise.allSettled(deletion.objectKeys.map((key) => deleteObject({ key })));
  await logActivity({
    userId: req.user.id,
    action: "organization_delete",
    entityType: "organization",
    entityId: organizationId,
    metadata: { organizationName: organization.name, affectedUsers: deletion.affectedUserIds.length },
    req,
  });
  const user = await findUserById(req.user.id);
  res.json({ message: `${organization.name} was permanently deleted.`, user });
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

  if (isFullAdminRole(getActorAdminRole(req))) {
    allowedFields.push("accessExpiresAt");
  }

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

  if (req.body?.accessExpiresAt !== undefined && !isFullAdminRole(getActorAdminRole(req))) {
    return res.status(403).json({ message: "Only full admins can change account expiry." });
  }

  if (updates.accessExpiresAt !== undefined) {
    if (updates.accessExpiresAt === null) {
      // Timerless access for admin-type roles.
    } else {
    const rawValue = String(updates.accessExpiresAt || "").trim();
    const parsed = new Date(rawValue);
    if (!rawValue || Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ message: "accessExpiresAt must be a valid date/time." });
    }
    updates.accessExpiresAt = parsed.toISOString();
    }
  }

  if (isOrgAdminRole(getActorAdminRole(req)) && updates.role !== undefined && updates.role !== ORG_USER_ROLE) {
    return res.status(403).json({
      message: "Org-admin can only manage users with role org_user.",
    });
  }
  if (isOrgAdminRole(getActorAdminRole(req))) {
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

  if (isFullAdminRole(getActorAdminRole(req)) && updates.role !== undefined) {
    if (isOrganizationScopedRole(updates.role)) {
      return res.status(400).json({ message: "Organization roles must be changed from Team & Organization." });
    }
    updates.platformRole = updates.role;
    if (currentUser.active_organization_id || currentUser.organization_id) {
      delete updates.role;
    }
  }

  const effectiveRole = String(updates.role ?? currentUser.role ?? "").trim().toLowerCase();
  const effectiveOrganizationId = String(
    updates.organizationId !== undefined
      ? updates.organizationId
      : currentUser.organization_id ?? currentUser.organizationId ?? ""
  ).trim();

  if (isAdminRoleType(effectiveRole)) {
    updates.accessExpiresAt = null;
  } else if (
    isAdminRoleType(currentUser.role) &&
    updates.accessExpiresAt === undefined &&
    !currentUser.access_expires_at &&
    !currentUser.accessExpiresAt
  ) {
    updates.accessExpiresAt = computeDefaultAccessExpiresAt(new Date()).toISOString();
  }

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
  const verification = await verifyAdminSensitiveCredential({
    userId: req.user.id,
    action: "force_logout_all",
    password: String(req.body?.password || ""),
    code: String(req.body?.code || ""),
  });
  if (!verification.ok) {
    return res.status(verification.status).json({ message: verification.message });
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

export const requestAdminSecurityCode = asyncHandler(async (req, res) => {
  const action = String(req.body?.action || "").trim();
  const config = getAdminSecurityCodeAction(action);
  if (!config) return res.status(400).json({ message: "Unknown security action." });

  const actor = await findUserAuthById(req.user.id);
  if (!actor) return res.status(403).json({ message: "Current administrator could not be verified." });
  if (!actor.google_id) {
    return res.json({ method: "password", message: "Enter your current password to continue." });
  }

  await issueAdminSecurityCode({ userId: req.user.id, email: actor.email, action });
  res.json({ method: "email_code", message: "A verification code was sent to your email." });
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
  const scopedToOrganization = isOrgAdminRole(getActorAdminRole(_req)) && organizationId;
  if (isOrgAdminRole(getActorAdminRole(_req)) && !organizationId) {
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
  const role = getActorAdminRole(req);
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
  if (isOrgAdminRole(getActorAdminRole(req))) {
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

  const verification = await verifyAdminSensitiveCredential({
    userId: req.user.id,
    action: "system_health_deactivate",
    password: String(req.body?.password || ""),
    code: String(req.body?.code || ""),
  });
  if (!verification.ok) {
    return res.status(verification.status).json({ message: verification.message });
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

  const verification = await verifyAdminSensitiveCredential({
    userId: req.user.id,
    action: "system_health_activate",
    password: String(req.body?.password || ""),
    code: String(req.body?.code || ""),
  });
  if (!verification.ok) {
    return res.status(verification.status).json({ message: verification.message });
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
