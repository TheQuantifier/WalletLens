import asyncHandler from "../middleware/async.js";
import {
  createNotification,
  getNotificationById,
  dismissNotificationForUser,
  listActiveNotificationsForUser,
  listNotificationHistory,
  updateNotificationById,
} from "../models/notification.model.js";
import { listUsersWithNotificationEmailEnabled } from "../models/user.model.js";
import { sendEmail } from "../services/email.service.js";
import { logActivity } from "../services/activity.service.js";
import { getRuntimeAppSettings } from "../services/app_settings_runtime.service.js";

const ORGANIZATION_AUDIENCE = "organization";
const ALL_AUDIENCE = "all";

function isOrgAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "org_admin";
}

function getActorOrganizationId(req) {
  return String(req.user?.organization_id || req.user?.organizationId || "").trim();
}

function normalizeOrganizationId(rawOrganizationId) {
  const value = String(rawOrganizationId || "").trim();
  return value || "";
}

function normalizeNotificationAudience(rawAudience) {
  const value = String(rawAudience || ALL_AUDIENCE).trim().toLowerCase();
  return value === ORGANIZATION_AUDIENCE ? ORGANIZATION_AUDIENCE : ALL_AUDIENCE;
}

const ALLOWED_NOTIFICATION_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
]);

function sanitizeHref(rawHref) {
  const href = String(rawHref || "").trim();
  if (!href) return "#";
  if (href.startsWith("#") || href.startsWith("/")) return href;
  try {
    const parsed = new URL(href);
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") {
      return parsed.toString();
    }
  } catch {
    return "#";
  }
  return "#";
}

function sanitizeNotificationHtml(rawHtml) {
  const input = String(rawHtml || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const sanitized = input.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tagName, attrs = "") => {
    const tag = String(tagName || "").toLowerCase();
    const isClosing = full.startsWith("</");
    if (!ALLOWED_NOTIFICATION_TAGS.has(tag)) return "";
    if (isClosing) return `</${tag}>`;
    if (tag === "br") return "<br>";
    if (tag !== "a") return `<${tag}>`;

    const hrefMatch = String(attrs).match(
      /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
    );
    const href = sanitizeHref(hrefMatch?.[1] || hrefMatch?.[2] || hrefMatch?.[3] || "");
    return `<a href="${href}" rel="noopener noreferrer" target="_blank">`;
  });

  return sanitized.trim();
}

function stripHtmlToText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeNotificationType(rawType) {
  const value = String(rawType || "general").trim().toLowerCase();
  if (value === "security" || value === "general" || value === "updates") {
    return value;
  }
  return "";
}

async function sendNotificationBlastAsync({
  recipients = [],
  subject,
  text,
  batchSize = 25,
} = {}) {
  const safeRecipients = Array.isArray(recipients) ? recipients : [];
  for (let i = 0; i < safeRecipients.length; i += batchSize) {
    const batch = safeRecipients.slice(i, i + batchSize);
    const outcomes = await Promise.allSettled(
      batch.map((user) =>
        sendEmail({
          to: user.email,
          subject,
          text,
        })
      )
    );
    const failures = outcomes.filter((o) => o.status === "rejected").length;
    if (failures > 0) {
      console.error(`Notification resend batch failed (${failures}/${batch.length})`);
    }
  }
}

export const getMine = asyncHandler(async (req, res) => {
  const runtimeSettings = await getRuntimeAppSettings();
  if (runtimeSettings.pause_all_notifications) {
    return res.json({ notifications: [] });
  }
  const notifications = await listActiveNotificationsForUser(req.user.id, 20);
  res.json({ notifications });
});

export const dismissMine = asyncHandler(async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) {
    return res.status(400).json({ message: "Notification id is required" });
  }
  await dismissNotificationForUser(req.user.id, id);
  await logActivity({
    userId: req.user.id,
    action: "notification_dismiss",
    entityType: "notification",
    entityId: id,
    metadata: {},
    req,
  });
  return res.json({ ok: true });
});

export const listAdmin = asyncHandler(async (req, res) => {
  const rawType = String(req.query?.type || "").trim().toLowerCase();
  const type = normalizeNotificationType(rawType);
  const activeRaw = String(req.query?.active || "").trim().toLowerCase();
  const isActive = activeRaw === "true" ? true : activeRaw === "false" ? false : null;
  const organizationId = getActorOrganizationId(req);
  if (isOrgAdminRole(req.user?.role) && !organizationId) {
    return res.json({ notifications: [] });
  }
  const audience = isOrgAdminRole(req.user?.role)
    ? ORGANIZATION_AUDIENCE
    : req.query?.audience !== undefined
      ? normalizeNotificationAudience(req.query?.audience)
      : "";

  const notifications = await listNotificationHistory({
    limit: 200,
    notificationType: type || "",
    isActive,
    audience,
    organizationId: isOrgAdminRole(req.user?.role) ? organizationId : "",
  });
  res.json({ notifications });
});

export const createAdmin = asyncHandler(async (req, res) => {
  const rawHtml = String(req.body?.messageHtml || "").trim();
  const notificationType = normalizeNotificationType(req.body?.notificationType);
  const html = sanitizeNotificationHtml(rawHtml);
  const text = stripHtmlToText(html);
  if (!html || !text) {
    return res.status(400).json({ message: "Notification text is required" });
  }
  if (!notificationType) {
    return res
      .status(400)
      .json({ message: "notificationType must be one of: security, general, updates" });
  }
  const organizationId = getActorOrganizationId(req);
  if (isOrgAdminRole(req.user?.role) && !organizationId) {
    return res.status(403).json({ message: "Org-admin access requires an organization ID." });
  }
  const audience = isOrgAdminRole(req.user?.role)
    ? ORGANIZATION_AUDIENCE
    : normalizeNotificationAudience(req.body?.audience);
  const targetOrganizationId = isOrgAdminRole(req.user?.role)
    ? organizationId
    : normalizeOrganizationId(req.body?.organizationId);
  if (audience === ORGANIZATION_AUDIENCE && !targetOrganizationId) {
    return res.status(400).json({ message: "organizationId is required for organization notifications." });
  }

  const notification = await createNotification({
    messageHtml: html,
    messageText: text,
    notificationType,
    audience,
    organizationId: audience === ORGANIZATION_AUDIENCE ? targetOrganizationId : null,
    createdBy: req.user.id,
  });
  res.status(201).json({
    notification,
    emailDelivery: "queued_for_weekly_monday",
  });
});

export const updateAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Notification id is required" });
  const existing = await getNotificationById(id);
  if (!existing) {
    return res.status(404).json({ message: "Notification not found" });
  }
  const actorOrganizationId = getActorOrganizationId(req);
  if (
    isOrgAdminRole(req.user?.role) &&
    (
      existing.audience !== ORGANIZATION_AUDIENCE ||
      String(existing.organization_id || "").trim() !== actorOrganizationId
    )
  ) {
    return res.status(403).json({ message: "Org-admin can only manage organization notifications for the same organization." });
  }

  const hasHtml = req.body?.messageHtml !== undefined;
  const hasType = req.body?.notificationType !== undefined;
  const hasActive = req.body?.isActive !== undefined;
  const hasAudience = req.body?.audience !== undefined;
  const hasOrganizationId = req.body?.organizationId !== undefined;
  if (!hasHtml && !hasType && !hasActive && !hasAudience && !hasOrganizationId) {
    return res.status(400).json({ message: "No notification updates provided" });
  }

  let html = null;
  let text = null;
  if (hasHtml) {
    html = sanitizeNotificationHtml(String(req.body?.messageHtml || "").trim());
    text = stripHtmlToText(html);
    if (!html || !text) {
      return res.status(400).json({ message: "Notification text is required" });
    }
  }

  let notificationType = null;
  if (hasType) {
    notificationType = normalizeNotificationType(req.body?.notificationType);
    if (!notificationType) {
      return res
        .status(400)
        .json({ message: "notificationType must be one of: security, general, updates" });
    }
  }
  let audience = null;
  if (hasAudience) {
    audience = isOrgAdminRole(req.user?.role)
      ? ORGANIZATION_AUDIENCE
      : normalizeNotificationAudience(req.body?.audience);
  }
  const nextAudience = audience || String(existing.audience || ALL_AUDIENCE).trim().toLowerCase();
  let nextOrganizationId = null;
  if (nextAudience === ORGANIZATION_AUDIENCE) {
    nextOrganizationId = isOrgAdminRole(req.user?.role)
      ? actorOrganizationId
      : normalizeOrganizationId(
          hasOrganizationId ? req.body?.organizationId : existing.organization_id
        );
    if (!nextOrganizationId) {
      return res.status(400).json({ message: "organizationId is required for organization notifications." });
    }
  }

  let isActive = null;
  if (hasActive) {
    isActive = Boolean(req.body?.isActive);
  }

  const notification = await updateNotificationById(id, {
    messageHtml: html,
    messageText: text,
    notificationType,
    audience,
    organizationId: nextAudience === ORGANIZATION_AUDIENCE ? nextOrganizationId : null,
    isActive,
  });
  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  return res.json({ notification });
});

export const resendAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "Notification id is required" });

  const notification = await getNotificationById(id);
  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }
  const actorOrganizationId = getActorOrganizationId(req);
  if (
    isOrgAdminRole(req.user?.role) &&
    (
      notification.audience !== ORGANIZATION_AUDIENCE ||
      String(notification.organization_id || "").trim() !== actorOrganizationId
    )
  ) {
    return res.status(403).json({ message: "Org-admin can only resend organization notifications for the same organization." });
  }
  if (!notification.is_active) {
    return res.status(400).json({ message: "Cannot resend an inactive notification" });
  }

  const runtimeSettings = await getRuntimeAppSettings();
  if (runtimeSettings.pause_all_notifications) {
    return res.status(409).json({ message: "Notification delivery is paused in app settings." });
  }
  if (
    runtimeSettings.pause_non_security_emails &&
    String(notification.notification_type || "").toLowerCase() !== "security"
  ) {
    return res.status(409).json({ message: "Non-security email delivery is paused in app settings." });
  }

  const recipients = await listUsersWithNotificationEmailEnabled({
    roleFilter: notification.audience === ORGANIZATION_AUDIENCE ? ["org_user"] : [],
    organizationIdFilter: notification.audience === ORGANIZATION_AUDIENCE
      ? String(notification.organization_id || "").trim()
      : "",
  });
  const subject = notification.notification_type === "security"
    ? "<AppName> Security Notification"
    : "<AppName> Notification";
  const text = String(notification.message_text || "").trim();
  const body = `${text}\n\nThis message was sent from <AppName>.`;
  const recipientCount = recipients.length;

  setImmediate(() => {
    sendNotificationBlastAsync({
      recipients,
      subject,
      text: body,
      batchSize: 25,
    }).catch((err) => {
      console.error("Async notification resend failed:", err);
    });
  });

  res.status(202).json({ queued: true, recipientCount });
});
