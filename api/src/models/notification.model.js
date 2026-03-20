import { query } from "../config/db.js";

export async function createNotification({
  messageHtml,
  messageText,
  notificationType = "general",
  audience = "all",
  organizationId = null,
  createdBy,
}) {
  const { rows } = await query(
    `
    INSERT INTO notifications (
      message_html,
      message_text,
      notification_type,
      audience,
      organization_id,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      message_html,
      message_text,
      notification_type,
      audience,
      organization_id,
      is_active,
      created_by,
      created_at
    `,
    [messageHtml, messageText, notificationType, audience, organizationId, createdBy || null]
  );
  return rows[0] || null;
}

export async function listNotificationHistory({
  limit = 100,
  notificationType = "",
  isActive = null,
  audience = "",
  organizationId = "",
} = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const params = [];
  const where = [];
  let i = 1;
  if (notificationType) {
    where.push(`n.notification_type = $${i++}`);
    params.push(notificationType);
  }
  if (typeof isActive === "boolean") {
    where.push(`n.is_active = $${i++}`);
    params.push(isActive);
  }
  if (audience) {
    where.push(`n.audience = $${i++}`);
    params.push(audience);
  }
  if (organizationId) {
    where.push(`coalesce(n.organization_id, '') = $${i++}`);
    params.push(organizationId);
  }
  params.push(safeLimit);

  const { rows } = await query(
    `
    SELECT
      n.id,
      n.message_html,
      n.message_text,
      n.notification_type,
      n.audience,
      n.organization_id,
      n.is_active,
      n.created_by,
      n.created_at,
      u.username as created_by_username
    FROM notifications n
    LEFT JOIN users u ON u.id = n.created_by
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY n.created_at DESC
    LIMIT $${i++}
    `,
    params
  );
  return rows || [];
}

export async function getNotificationById(id) {
  const { rows } = await query(
    `
    SELECT
      id,
      message_html,
      message_text,
      notification_type,
      audience,
      organization_id,
      is_active,
      created_by,
      created_at
    FROM notifications
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function updateNotificationById(
  id,
  {
    messageHtml = null,
    messageText = null,
    notificationType = null,
    audience = null,
    organizationId = null,
    isActive = null,
  } = {}
) {
  const { rows } = await query(
    `
    UPDATE notifications
    SET
      message_html = COALESCE($1, message_html),
      message_text = COALESCE($2, message_text),
      notification_type = COALESCE($3, notification_type),
      audience = COALESCE($4, audience),
      organization_id = COALESCE($5, organization_id),
      is_active = COALESCE($6, is_active)
    WHERE id = $7
    RETURNING
      id,
      message_html,
      message_text,
      notification_type,
      audience,
      organization_id,
      is_active,
      created_by,
      created_at
    `,
    [messageHtml, messageText, notificationType, audience, organizationId, isActive, id]
  );
  return rows[0] || null;
}

export async function listActiveNotificationsForUser(userId, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const { rows } = await query(
    `
    SELECT
      n.id,
      n.message_html,
      n.message_text,
      n.notification_type,
      n.audience,
      n.organization_id,
      n.created_at
    FROM notifications n
    JOIN users u ON u.id = $1
    LEFT JOIN user_notification_dismissals d
      ON d.notification_id = n.id
     AND d.user_id = $1
    WHERE n.is_active = true
      AND (
        n.audience = 'all'
        OR (
          n.audience = 'organization'
          AND lower(u.role) = 'org_user'
          AND coalesce(n.organization_id, '') = coalesce(u.organization_id, '')
        )
      )
      AND d.notification_id IS NULL
    ORDER BY n.created_at ASC
    LIMIT $2
    `,
    [userId, safeLimit]
  );
  return rows || [];
}

export async function dismissNotificationForUser(userId, notificationId) {
  const { rows } = await query(
    `
    INSERT INTO user_notification_dismissals (user_id, notification_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, notification_id) DO UPDATE
    SET dismissed_at = now()
    RETURNING user_id, notification_id, dismissed_at
    `,
    [userId, notificationId]
  );
  return rows[0] || null;
}

export async function listPendingWeeklyNotificationsForUser(userId, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const { rows } = await query(
    `
    SELECT
      n.id,
      n.message_html,
      n.message_text,
      n.notification_type,
      n.audience,
      n.organization_id,
      n.created_at
    FROM notifications n
    JOIN users u ON u.id = $1
    LEFT JOIN user_notification_dismissals d
      ON d.notification_id = n.id
     AND d.user_id = $1
    LEFT JOIN user_notification_email_deliveries e
      ON e.notification_id = n.id
     AND e.user_id = $1
    WHERE n.is_active = true
      AND (
        n.audience = 'all'
        OR (
          n.audience = 'organization'
          AND lower(u.role) = 'org_user'
          AND coalesce(n.organization_id, '') = coalesce(u.organization_id, '')
        )
      )
      AND d.notification_id IS NULL
      AND e.notification_id IS NULL
    ORDER BY n.created_at ASC
    LIMIT $2
    `,
    [userId, safeLimit]
  );
  return rows || [];
}

export async function markNotificationEmailDelivered(userId, notificationId) {
  const { rows } = await query(
    `
    INSERT INTO user_notification_email_deliveries (
      user_id,
      notification_id
    )
    VALUES ($1, $2)
    ON CONFLICT (user_id, notification_id) DO NOTHING
    RETURNING user_id, notification_id, delivered_at
    `,
    [userId, notificationId]
  );
  return rows[0] || null;
}
