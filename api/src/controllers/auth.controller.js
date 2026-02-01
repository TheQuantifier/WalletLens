// src/controllers/auth.controller.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import env from "../config/env.js";
import asyncHandler from "../middleware/async.js";
import { query } from "../config/db.js";

import {
  createUser,
  findUserById,
  findUserAuthById,
  findUserAuthByIdentifier,
  updateUserById,
  updateUserPasswordHash,
} from "../models/user.model.js";
import {
  createSession,
  listActiveSessionsForUser,
  revokeAllSessionsForUser,
  revokeSessionById,
} from "../models/session.model.js";
import {
  clearTwoFaCodes,
  createTwoFaCode,
  deleteTwoFaCodeById,
  findValidTwoFaCode,
  getTrustedDevice,
  setTwoFaEnabled,
  touchTrustedDevice,
  upsertTrustedDevice,
  clearTrustedDevices,
} from "../models/twofa.model.js";
import { sendEmail } from "../services/email.service.js";

// If you have an R2 service, we’ll use it to delete objects on account deletion.
// If your service file name differs, adjust the import path accordingly.
import { deleteObject } from "../services/r2.service.js";

function createToken(id, sessionId) {
  return jwt.sign({ id, sid: sessionId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function createTwoFaToken(id, purpose) {
  return jwt.sign({ id, purpose }, env.jwtSecret, { expiresIn: "10m" });
}

function hashCode(code) {
  return crypto
    .createHmac("sha256", env.jwtSecret)
    .update(String(code))
    .digest("hex");
}

function generateSixDigitCode() {
  const n = Math.floor(Math.random() * 1000000);
  return String(n).padStart(6, "0");
}

function setTokenCookie(res, token) {
  const isProd = env.nodeEnv === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd, // secure cookies require HTTPS in production
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function setDeviceCookie(res, deviceId) {
  const isProd = env.nodeEnv === "production";

  res.cookie("device_id", deviceId, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });
}

function clearTokenCookie(res) {
  const isProd = env.nodeEnv === "production";

  res.cookie("token", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    expires: new Date(0),
  });
}

function getRequestIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "";
}

/* =====================================================
   REGISTER — uses fullName consistently
===================================================== */
export const register = asyncHandler(async (req, res) => {
  const { email, password, fullName } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters long" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const usernameBase = normalizedEmail.split("@")[0].toLowerCase().trim();

  // Check if email already in use
  const existing = await findUserAuthByIdentifier(normalizedEmail);
  if (existing && String(existing.email).toLowerCase() === normalizedEmail) {
    return res.status(400).json({ message: "Email already in use" });
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create user
  // (If username collisions happen, you can later add a suffix strategy.)
  const user = await createUser({
    email: normalizedEmail,
    username: usernameBase,
    passwordHash,
    fullName: String(fullName).trim(),
    location: "",
    role: "user",
    phoneNumber: "",
    bio: "",
  });

  const session = await createSession({
    userId: user.id,
    userAgent: req.get("user-agent") || "",
    ipAddress: getRequestIp(req),
  });
  const token = createToken(user.id, session.id);
  setTokenCookie(res, token);

  res.status(201).json({ user, token });
});

/* =====================================================
   LOGIN (email OR username)
===================================================== */
export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: "Missing identifier or password" });
  }

  const user = await findUserAuthByIdentifier(identifier);

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.two_fa_enabled) {
    const deviceId = req.cookies?.device_id || "";

    if (deviceId) {
      const trusted = await getTrustedDevice(user.id, deviceId);
      if (trusted?.last_verified_at) {
        const lastVerifiedMs = new Date(trusted.last_verified_at).getTime();
        const trustedWindowMs = Math.max(0, env.twoFaTrustedDays) * 24 * 60 * 60 * 1000;
        if (Number.isFinite(lastVerifiedMs) && Date.now() - lastVerifiedMs <= trustedWindowMs) {
          await touchTrustedDevice(user.id, deviceId);

          const session = await createSession({
            userId: user.id,
            userAgent: req.get("user-agent") || "",
            ipAddress: getRequestIp(req),
          });
          const token = createToken(user.id, session.id);
          setTokenCookie(res, token);
          setDeviceCookie(res, deviceId);

          const safeUser = await findUserById(user.id);
          return res.json({ user: safeUser, token });
        }
      }
    }

    const code = generateSixDigitCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + env.twoFaCodeMinutes * 60 * 1000);

    await clearTwoFaCodes(user.id, "login");
    await createTwoFaCode({
      userId: user.id,
      purpose: "login",
      codeHash,
      expiresAt,
    });

    await sendEmail({
      to: user.email,
      subject: "Your WiseWallet login code",
      text: `Your login code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
    });

    const twoFaToken = createTwoFaToken(user.id, "login");
    return res.json({ requires2fa: true, twoFactorToken: twoFaToken });
  }

  const session = await createSession({
    userId: user.id,
    userAgent: req.get("user-agent") || "",
    ipAddress: getRequestIp(req),
  });
  const token = createToken(user.id, session.id);
  setTokenCookie(res, token);

  // Return safe user shape (no password_hash)
  const safeUser = await findUserById(user.id);
  res.json({ user: safeUser, token });
});

/* =====================================================
   LOGOUT
===================================================== */
export const logout = asyncHandler(async (req, res) => {
  if (req.sessionId) {
    await revokeSessionById(req.sessionId);
  }
  clearTokenCookie(res);
  res.json({ message: "Logged out" });
});

/* =====================================================
   CURRENT USER
===================================================== */
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

/* =====================================================
   UPDATE PROFILE (fullName, email, username, etc.)
===================================================== */
export const updateMe = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const updates = {};

  const allowedFields = [
    "username",
    "email",
    "fullName",
    "location",
    "role",
    "phoneNumber",
    "bio",
    "avatarUrl",
  ];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      updates[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    }
  }

  // Unique email check
  if (updates.email !== undefined) {
    updates.email = String(updates.email).toLowerCase().trim();

    const { rows } = await query(
      `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`,
      [updates.email]
    );
    if (rows[0] && rows[0].id !== userId) {
      return res.status(400).json({ message: "Email already in use" });
    }
  }

  // Unique username check
  if (updates.username !== undefined) {
    updates.username = String(updates.username).toLowerCase().trim();

    const { rows } = await query(
      `SELECT id FROM users WHERE lower(username) = $1 LIMIT 1`,
      [updates.username]
    );
    if (rows[0] && rows[0].id !== userId) {
      return res.status(400).json({ message: "Username already in use" });
    }
  }

  const updated = await updateUserById(userId, updates);
  res.json({ user: updated });
});

/* =====================================================
   CHANGE PASSWORD
===================================================== */
export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required" });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters long" });
  }

  const user = await findUserAuthById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(String(currentPassword), user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ message: "Current password is incorrect" });
  }

  const salt = await bcrypt.genSalt(12);
  const newHash = await bcrypt.hash(String(newPassword), salt);

  await updateUserPasswordHash(userId, newHash);

  const token = createToken(userId, req.sessionId);
  setTokenCookie(res, token);

  const safeUser = await findUserById(userId);

  res.json({
    message: "Password updated successfully",
    user: safeUser,
    token,
  });
});

/* =====================================================
   2FA: REQUEST ENABLE (email code)
===================================================== */
export const requestTwoFaEnable = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (user.two_fa_enabled) {
    return res.status(400).json({ message: "Two-factor authentication is already enabled" });
  }

  const code = generateSixDigitCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + env.twoFaCodeMinutes * 60 * 1000);

  await clearTwoFaCodes(user.id, "enable");
  await createTwoFaCode({
    userId: user.id,
    purpose: "enable",
    codeHash,
    expiresAt,
  });

  await sendEmail({
    to: user.email,
    subject: "Your WiseWallet verification code",
    text: `Your verification code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
  });

  res.json({ message: "Verification code sent" });
});

/* =====================================================
   2FA: CONFIRM ENABLE (email code)
===================================================== */
export const confirmTwoFaEnable = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: "Code is required" });

  const codeHash = hashCode(code);
  const match = await findValidTwoFaCode({
    userId: req.user.id,
    purpose: "enable",
    codeHash,
  });

  if (!match) {
    return res.status(401).json({ message: "Invalid or expired code" });
  }

  await deleteTwoFaCodeById(match.id);
  const updated = await setTwoFaEnabled(req.user.id, true);

  res.json({ message: "Two-factor authentication enabled", user: updated });
});

/* =====================================================
   2FA: DISABLE (password required)
===================================================== */
export const disableTwoFa = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: "Password is required" });

  const user = await findUserAuthById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ message: "Password is incorrect" });

  await clearTrustedDevices(req.user.id);
  const updated = await setTwoFaEnabled(req.user.id, false);
  res.json({ message: "Two-factor authentication disabled", user: updated });
});

/* =====================================================
   2FA: VERIFY LOGIN (code + token)
===================================================== */
export const verifyTwoFaLogin = asyncHandler(async (req, res) => {
  const { code, twoFactorToken } = req.body;
  if (!code || !twoFactorToken) {
    return res.status(400).json({ message: "Code and token are required" });
  }

  let payload;
  try {
    payload = jwt.verify(twoFactorToken, env.jwtSecret);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  if (payload?.purpose !== "login") {
    return res.status(401).json({ message: "Invalid token purpose" });
  }

  const codeHash = hashCode(code);
  const match = await findValidTwoFaCode({
    userId: payload.id,
    purpose: "login",
    codeHash,
  });

  if (!match) {
    return res.status(401).json({ message: "Invalid or expired code" });
  }

  await deleteTwoFaCodeById(match.id);

  const deviceId = req.cookies?.device_id || crypto.randomUUID();
  await upsertTrustedDevice({
    userId: payload.id,
    deviceId,
    userAgent: req.get("user-agent") || "",
  });

  const session = await createSession({
    userId: payload.id,
    userAgent: req.get("user-agent") || "",
    ipAddress: getRequestIp(req),
  });
  const token = createToken(payload.id, session.id);
  setTokenCookie(res, token);
  setDeviceCookie(res, deviceId);

  const safeUser = await findUserById(payload.id);
  res.json({ user: safeUser, token });
});

/* =====================================================
   LIST ACTIVE SESSIONS
===================================================== */
export const listSessions = asyncHandler(async (req, res) => {
  const sessions = await listActiveSessionsForUser(req.user.id);

  res.json({
    currentSessionId: req.sessionId,
    sessions: sessions.map((s) => ({
      id: s.id,
      userId: s.user_id,
      userAgent: s.user_agent,
      ipAddress: s.ip_address,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      revokedAt: s.revoked_at,
    })),
  });
});

/* =====================================================
   LOGOUT ALL SESSIONS (password required)
===================================================== */
export const logoutAll = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  const user = await findUserAuthById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) {
    return res.status(401).json({ message: "Password is incorrect" });
  }

  await revokeAllSessionsForUser(userId);
  clearTokenCookie(res);

  res.json({ message: "All sessions have been signed out" });
});

/* =====================================================
   DELETE ACCOUNT — cascade delete
===================================================== */
export const deleteMe = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 1) Fetch receipt object keys so we can delete R2 files (continue on error)
  const { rows: receiptRows } = await query(
    `SELECT id, object_key FROM receipts WHERE user_id = $1`,
    [userId]
  );

  for (const r of receiptRows) {
    try {
      if (r.object_key) {
        await deleteObject({ key: r.object_key });
      }
    } catch (err) {
      console.error("Error deleting R2 object for receipt", r.id, err);
    }
  }

  // 2) Delete the user. records/receipts cascade via FK ON DELETE CASCADE
  await query(`DELETE FROM users WHERE id = $1`, [userId]);

  // 3) Clear auth cookie
  clearTokenCookie(res);

  res.json({ message: "Account and all associated data have been deleted" });
});
