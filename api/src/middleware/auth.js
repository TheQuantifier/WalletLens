// src/middleware/auth.js
import jwt from "jsonwebtoken";

import env from "../config/env.js";
import { findUserById } from "../models/user.model.js";
import { getSessionById, revokeSessionById, updateSessionLastSeen } from "../models/session.model.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TRUSTED_ORIGINS = new Set(
  [
    ...(env.clientOrigins || []),
    "https://wisewallet.manuswebworks.org",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "http://localhost:5000",
  ].filter(Boolean)
);

function isTrustedOriginValue(raw) {
  if (!raw) return false;
  try {
    return TRUSTED_ORIGINS.has(new URL(String(raw)).origin);
  } catch {
    return false;
  }
}

export default async function auth(req, res, next) {
  try {
    let token = null;
    let authSource = "";

    /* ----------------------------------------------
       1. Prefer secure cookie
    ---------------------------------------------- */
    if (req.cookies?.token) {
      token = req.cookies.token;
      authSource = "cookie";
    }

    /* ----------------------------------------------
       2. Fallback: Authorization Bearer header
    ---------------------------------------------- */
    if (!token && req.headers.authorization) {
      const [scheme, value] = req.headers.authorization.split(" ");

      if (scheme === "Bearer" && value && value !== "null" && value !== "undefined") {
        token = value.trim();
        authSource = "bearer";
      }
    }

    // CSRF guard for cookie-authenticated mutating requests.
    if (
      token &&
      authSource === "cookie" &&
      !SAFE_METHODS.has(req.method)
    ) {
      const origin = req.headers.origin;
      const referer = req.headers.referer;
      const trusted = isTrustedOriginValue(origin) || isTrustedOriginValue(referer);
      if (!trusted) {
        return res.status(403).json({ message: "CSRF protection: untrusted request origin" });
      }
    }

    /* ----------------------------------------------
       3. Missing token → reject
    ---------------------------------------------- */
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    /* ----------------------------------------------
       4. Verify token
    ---------------------------------------------- */
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    /* ----------------------------------------------
       5. Validate session
    ---------------------------------------------- */
    if (!payload?.sid) {
      return res.status(401).json({ message: "Session required" });
    }

    const session = await getSessionById(payload.sid);
    if (!session || session.revoked_at || session.user_id !== payload.id) {
      return res.status(401).json({ message: "Session expired" });
    }

    const idleMs = Math.max(0, env.sessionIdleDays) * 24 * 60 * 60 * 1000;
    if (idleMs > 0 && session.last_seen_at) {
      const lastSeenMs = new Date(session.last_seen_at).getTime();
      if (Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs > idleMs) {
        await revokeSessionById(session.id);
        return res.status(401).json({ message: "Session expired" });
      }
    }

    await updateSessionLastSeen(session.id);

    /* ----------------------------------------------
       6. Fetch user from Postgres (safe fields only)
    ---------------------------------------------- */
    const user = await findUserById(payload.id);

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    /* ----------------------------------------------
       7. Attach safe user to req
    ---------------------------------------------- */
    req.user = user;
    req.sessionId = session.id;

    return next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    return res.status(500).json({ message: "Authentication server error" });
  }
}
