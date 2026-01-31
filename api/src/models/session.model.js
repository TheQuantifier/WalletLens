// src/models/session.model.js
import { query } from "../config/db.js";

export async function createSession({ userId, userAgent = "", ipAddress = "" }) {
  const { rows } = await query(
    `
    INSERT INTO user_sessions
      (user_id, user_agent, ip_address)
    VALUES
      ($1, $2, $3)
    RETURNING
      id, user_id, user_agent, ip_address, created_at, last_seen_at, revoked_at
    `,
    [userId, userAgent, ipAddress]
  );
  return rows[0];
}

export async function getSessionById(id) {
  const { rows } = await query(
    `
    SELECT
      id, user_id, user_agent, ip_address, created_at, last_seen_at, revoked_at
    FROM user_sessions
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function updateSessionLastSeen(id) {
  await query(
    `
    UPDATE user_sessions
    SET last_seen_at = now()
    WHERE id = $1 AND revoked_at IS NULL
    `,
    [id]
  );
}

export async function revokeSessionById(id) {
  await query(
    `
    UPDATE user_sessions
    SET revoked_at = now()
    WHERE id = $1 AND revoked_at IS NULL
    `,
    [id]
  );
}

export async function revokeAllSessionsForUser(userId) {
  await query(
    `
    UPDATE user_sessions
    SET revoked_at = now()
    WHERE user_id = $1 AND revoked_at IS NULL
    `,
    [userId]
  );
}

export async function listActiveSessionsForUser(userId) {
  const { rows } = await query(
    `
    SELECT
      id, user_id, user_agent, ip_address, created_at, last_seen_at, revoked_at
    FROM user_sessions
    WHERE user_id = $1 AND revoked_at IS NULL
    ORDER BY last_seen_at DESC
    `,
    [userId]
  );
  return rows;
}

export async function cleanupOldSessions({ cutoffDays = 30 } = {}) {
  const days = Number(cutoffDays);
  const safeDays = Number.isFinite(days) && days >= 0 ? days : 30;

  const { rows } = await query(
    `
    DELETE FROM user_sessions
    WHERE revoked_at IS NOT NULL
       OR last_seen_at < now() - ($1::text || ' days')::interval
    RETURNING id
    `,
    [safeDays]
  );

  return rows?.length || 0;
}
