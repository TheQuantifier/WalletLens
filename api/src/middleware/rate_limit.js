// src/middleware/rate_limit.js
// Lightweight in-memory rate limiter for auth endpoints.

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
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req));
    const bucket = hits.get(key);

    if (!bucket || now >= bucket.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    return next();
  };
}

