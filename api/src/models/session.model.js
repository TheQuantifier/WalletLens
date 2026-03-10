// src/models/session.model.js
import { query } from "../config/db.js";

export async function createSession({ userId, userAgent = "", ipAddress = "" }) {
  // Reuse active session for the same user + IP to avoid duplicates.
  const existing = await query(
    `
    SELECT id
    FROM user_sessions
    WHERE user_id = $1 AND ip_address = $2 AND revoked_at IS NULL
    ORDER BY last_seen_at DESC
    LIMIT 1
    `,
    [userId, ipAddress]
  );

  if (existing.rows?.length) {
    const { rows } = await query(
      `
      UPDATE user_sessions
      SET last_seen_at = now(),
          user_agent = $2
      WHERE id = $1
      RETURNING
        id, user_id, user_agent, ip_address, created_at, last_seen_at, revoked_at
      `,
      [existing.rows[0].id, userAgent]
    );
    return rows[0];
  }

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

export async function revokeAllActiveSessions() {
  const { rows } = await query(
    `
    UPDATE user_sessions
    SET revoked_at = now()
    WHERE revoked_at IS NULL
    RETURNING id
    `
  );
  return rows?.length || 0;
}

export async function listActiveSessionsForUser(userId) {
  const { rows } = await query(
    `
    SELECT
      id, user_id, user_agent, ip_address, created_at, last_seen_at, revoked_at
    FROM user_sessions
    WHERE user_id = $1 AND revoked_at IS NULL
    ORDER BY ip_address, last_seen_at DESC
    `,
    [userId]
  );
  // Deduplicate by IP, keeping the most recent session per IP.
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    if (seen.has(row.ip_address)) continue;
    seen.add(row.ip_address);
    deduped.push(row);
  }
  return deduped;
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

export async function enforceMaxActiveSessionsForUser({
  userId,
  maxConcurrentSessions = 0,
  keepSessionId = null,
}) {
  const limit = Number(maxConcurrentSessions);
  if (!Number.isInteger(limit) || limit <= 0) return 0;

  const { rows } = await query(
    `
    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (
          ORDER BY
            CASE WHEN id = $3 THEN 0 ELSE 1 END ASC,
            last_seen_at DESC,
            created_at DESC
        ) AS rn
      FROM user_sessions
      WHERE user_id = $1
        AND revoked_at IS NULL
    )
    UPDATE user_sessions s
    SET revoked_at = now()
    FROM ranked r
    WHERE s.id = r.id
      AND r.rn > $2
    RETURNING s.id
    `,
    [userId, limit, keepSessionId]
  );
  return rows?.length || 0;
}
