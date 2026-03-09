// src/middleware/rate_limit.js
// DB-backed rate limiter (shared across instances).

import { query } from "../config/db.js";

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 30,
  keyGenerator = getClientIp,
} = {}) {
  const cleanupIntervalMs = 10 * 60 * 1000;
  let lastCleanupAt = 0;

  return async (req, res, next) => {
    try {
      const now = Date.now();
      const key = String(keyGenerator(req));
      const resetAt = new Date(now + windowMs).toISOString();

      const { rows } = await query(
        `
        INSERT INTO rate_limit_hits (key, count, reset_at, updated_at)
        VALUES ($1, 1, $2::timestamptz, now())
        ON CONFLICT (key) DO UPDATE
        SET
          count = CASE
            WHEN rate_limit_hits.reset_at <= now() THEN 1
            ELSE rate_limit_hits.count + 1
          END,
          reset_at = CASE
            WHEN rate_limit_hits.reset_at <= now() THEN $2::timestamptz
            ELSE rate_limit_hits.reset_at
          END,
          updated_at = now()
        RETURNING
          count,
          GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - now()))))::int AS retry_after_seconds
        `,
        [key, resetAt]
      );

      const current = rows?.[0] || { count: 1, retry_after_seconds: 1 };
      if (Number(current.count) > max) {
        res.set("Retry-After", String(current.retry_after_seconds || 1));
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }

      if (now - lastCleanupAt > cleanupIntervalMs) {
        lastCleanupAt = now;
        query(
          `
          DELETE FROM rate_limit_hits
          WHERE reset_at < now() - interval '1 day'
          `
        ).catch(() => {
          // Best-effort cleanup.
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
