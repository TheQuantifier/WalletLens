// src/middleware/auth.js
import jwt from "jsonwebtoken";

import env from "../config/env.js";
import { findUserById } from "../models/user.model.js";
import { getSessionById, revokeSessionById, updateSessionLastSeen } from "../models/session.model.js";

export default async function auth(req, res, next) {
  try {
    let token = null;

    /* ----------------------------------------------
       1. Prefer secure cookie
    ---------------------------------------------- */
    if (req.cookies?.token) {
      token = req.cookies.token;
    }

    /* ----------------------------------------------
       2. Fallback: Authorization Bearer header
    ---------------------------------------------- */
    if (!token && req.headers.authorization) {
      const [scheme, value] = req.headers.authorization.split(" ");

      if (scheme === "Bearer" && value && value !== "null" && value !== "undefined") {
        token = value.trim();
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
