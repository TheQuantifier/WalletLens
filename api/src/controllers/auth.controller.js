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
  findUserAuthByGoogleId,
  findUserAuthByIdentifier,
  linkUserGoogleId,
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
import { logActivity } from "../services/activity.service.js";

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

function isLoopbackHost(hostname) {
  const normalized = String(hostname || "").toLowerCase().trim();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function getRequestOrigin(req) {
  if (!req) return "";
  const forwardedProto = String(req.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.headers?.["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host") || "";
  if (!host) return "";
  return `${protocol}://${host}`;
}

function getGoogleRedirectUri(req) {
  const configured = String(env.googleRedirectUri || "").trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (!isLoopbackHost(parsed.hostname)) {
        return parsed.toString();
      }
    } catch {
      // fall through to request-derived URI
    }
  }

  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) return configured;
  return new URL("/api/auth/google/callback", requestOrigin).toString();
}

function isGoogleAuthConfigured(req) {
  return Boolean(env.googleClientId && env.googleClientSecret && getGoogleRedirectUri(req));
}

function getDefaultFrontendAuthUrl(mode = "login") {
  const fallbackOrigin = env.clientOrigins?.[0] || "http://localhost:5500";
  const page = mode === "register" ? "register.html" : "login.html";
  return new URL(`/${page}`, fallbackOrigin).toString();
}

function sanitizeReturnTo(raw, mode = "login", req, enforceAllowedOrigins = true) {
  const fallback = getDefaultFrontendAuthUrl(mode);
  if (!raw) return fallback;
  try {
    const parsed = new URL(String(raw));
    if (!["http:", "https:"].includes(parsed.protocol)) return fallback;
    if (enforceAllowedOrigins) {
      const allowedOrigins = new Set(env.clientOrigins || []);
      const originHeader = String(req?.headers?.origin || "").trim();
      const refererHeader = String(req?.headers?.referer || "").trim();
      if (originHeader) allowedOrigins.add(originHeader);
      if (refererHeader) {
        try {
          allowedOrigins.add(new URL(refererHeader).origin);
        } catch {
          // ignore invalid referer
        }
      }
      if (allowedOrigins.size > 0 && !allowedOrigins.has(parsed.origin)) return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function appendUrlParams(url, params = {}) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    target.searchParams.set(key, String(value));
  }
  return target.toString();
}

function setOauthStateCookie(res, value) {
  const isProd = env.nodeEnv === "production";
  res.cookie("oauth_state", value, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });
}

function clearOauthStateCookie(res) {
  const isProd = env.nodeEnv === "production";
  res.cookie("oauth_state", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    expires: new Date(0),
  });
}

async function verifyGoogleIdToken(idToken) {
  const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
    String(idToken || "")
  )}`;
  const verifyRes = await fetch(verifyUrl, { method: "GET" });
  if (!verifyRes.ok) {
    throw new Error("Google ID token verification failed");
  }

  const payload = await verifyRes.json().catch(() => ({}));
  const allowedIssuers = new Set(["https://accounts.google.com", "accounts.google.com"]);

  if (payload?.aud !== env.googleClientId) {
    throw new Error("Google token audience mismatch");
  }
  if (!allowedIssuers.has(String(payload?.iss || ""))) {
    throw new Error("Google token issuer mismatch");
  }
  if (!payload?.sub || !payload?.email) {
    throw new Error("Google profile is missing required fields");
  }
  if (!(payload?.email_verified === "true" || payload?.email_verified === true)) {
    throw new Error("Google email is not verified");
  }

  const exp = Number(payload?.exp || 0);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Google ID token is expired");
  }

  return payload;
}

async function createUniqueUsername(base) {
  const normalizedBase = String(base || "user")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24) || "user";

  let candidate = normalizedBase;
  let suffix = 1;

  while (true) {
    const { rows } = await query(`SELECT 1 FROM users WHERE lower(username) = $1 LIMIT 1`, [candidate]);
    if (!rows.length) return candidate;
    suffix += 1;
    candidate = `${normalizedBase}${suffix}`;
  }
}

async function exchangeGoogleCodeForProfile(code, redirectUri) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(code || ""),
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData?.id_token) {
    throw new Error("Google token exchange failed");
  }

  const payload = await verifyGoogleIdToken(tokenData.id_token);

  return {
    googleId: String(payload.sub),
    email: String(payload.email).toLowerCase().trim(),
    fullName: String(payload.name || payload.email).trim(),
  };
}

async function resolveGoogleUser({ googleId, email, fullName, mode = "login" }) {
  let user = await findUserAuthByGoogleId(googleId);
  if (user) return user;

  const existingByEmail = await findUserAuthByIdentifier(email);

  if (existingByEmail) {
    if (existingByEmail.google_id && existingByEmail.google_id !== googleId) {
      throw new Error("That email is linked to a different Google account");
    }
    user = await linkUserGoogleId(existingByEmail.id, googleId);
    return user;
  }

  if (mode === "login") {
    throw new Error("No account found for this Google user. Please register first.");
  }

  const usernameBase = email.split("@")[0];
  const username = await createUniqueUsername(usernameBase);

  user = await createUser({
    username,
    email,
    passwordHash: null,
    googleId,
    fullName,
    location: "",
    role: "user",
    phoneNumber: "",
    bio: "",
  });
  return user;
}

/* =====================================================
   GOOGLE AUTH: CONFIG + START + CALLBACK
===================================================== */
export const googleConfig = asyncHandler(async (_req, res) => {
  res.json({
    enabled: isGoogleAuthConfigured(_req),
    clientId: env.googleClientId || "",
  });
});

export const googleStart = asyncHandler(async (req, res) => {
  const googleRedirectUri = getGoogleRedirectUri(req);
  if (!isGoogleAuthConfigured(req)) {
    return res.status(503).json({ message: "Google login is not configured" });
  }

  const mode = req.query?.mode === "register" ? "register" : "login";
  const returnTo = sanitizeReturnTo(req.query?.returnTo, mode, req, true);
  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ nonce, mode, returnTo }), "utf8").toString("base64url");

  setOauthStateCookie(res, nonce);

  const authUrl = appendUrlParams("https://accounts.google.com/o/oauth2/v2/auth", {
    client_id: env.googleClientId,
    redirect_uri: googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });

  return res.redirect(authUrl);
});

export const googleCallback = asyncHandler(async (req, res) => {
  const rawState = String(req.query?.state || "");

  let decodedState = { nonce: "", mode: "login", returnTo: getDefaultFrontendAuthUrl("login") };
  if (rawState) {
    try {
      decodedState = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8"));
    } catch {
      // keep fallback defaults
    }
  }

  const mode = decodedState.mode === "register" ? "register" : "login";
  const returnTo = sanitizeReturnTo(decodedState.returnTo, mode, req, false);
  const failRedirect = (message) => res.redirect(appendUrlParams(returnTo, { auth_error: message }));
  const googleRedirectUri = getGoogleRedirectUri(req);

  if (!isGoogleAuthConfigured(req)) {
    return failRedirect("Google login is not configured");
  }

  if (req.query?.error) {
    return failRedirect(req.query.error_description || String(req.query.error));
  }

  const nonceFromCookie = String(req.cookies?.oauth_state || "");
  clearOauthStateCookie(res);

  if (!decodedState?.nonce || !nonceFromCookie || decodedState.nonce !== nonceFromCookie) {
    return failRedirect("OAuth state mismatch. Please try again.");
  }

  if (!req.query?.code) {
    return failRedirect("Missing Google authorization code");
  }

  try {
    const profile = await exchangeGoogleCodeForProfile(req.query.code, googleRedirectUri);
    const user = await resolveGoogleUser({
      googleId: profile.googleId,
      email: profile.email,
      fullName: profile.fullName,
      mode,
    });

    const session = await createSession({
      userId: user.id,
      userAgent: req.get("user-agent") || "",
      ipAddress: getRequestIp(req),
    });
    const token = createToken(user.id, session.id);
    setTokenCookie(res, token);

    await logActivity({
      userId: user.id,
      action: "login",
      entityType: "session",
      entityId: session.id,
      metadata: { method: "google", mode },
      req,
    });

    return res.redirect(
      appendUrlParams(returnTo, {
        auth_success: "1",
        auth_mode: mode,
        auth_token: token,
      })
    );
  } catch (err) {
    console.error("Google auth callback failed:", err);
    return failRedirect(err?.message || "Google authentication failed");
  }
});

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
  const username = await createUniqueUsername(usernameBase);

  // Create user
  // (If username collisions happen, you can later add a suffix strategy.)
  const user = await createUser({
    email: normalizedEmail,
    username,
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

  if (!user.password_hash) {
    return res.status(400).json({
      message: "This account uses Google sign-in. Please use Login with Google.",
    });
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
          await logActivity({
            userId: user.id,
            action: "login",
            entityType: "session",
            entityId: session.id,
            metadata: { method: "password", twoFactor: "trusted_device" },
            req,
          });
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
      subject: "Your <AppName> login code",
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
  await logActivity({
    userId: user.id,
    action: "login",
    entityType: "session",
    entityId: session.id,
    metadata: { method: "password", twoFactor: false },
    req,
  });
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
  await logActivity({
    userId: req.user.id,
    action: "logout",
    entityType: "session",
    entityId: req.sessionId || null,
    req,
  });
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
    "phoneNumber",
    "bio",
    "avatarUrl",
    "address",
    "employer",
    "incomeRange",
    "customExpenseCategories",
    "customIncomeCategories",
  ];

  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      updates[key] = typeof req.body[key] === "string" ? req.body[key].trim() : req.body[key];
    }
  }

  const normalizeCategoryList = (value) => {
    const raw = Array.isArray(value) ? value : [];
    const seen = new Set();
    return raw
      .map((c) => String(c || "").trim())
      .filter((c) => {
        if (!c) return false;
        const key = c.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  if (updates.customExpenseCategories !== undefined) {
    updates.customExpenseCategories = normalizeCategoryList(updates.customExpenseCategories);
  }

  if (updates.customIncomeCategories !== undefined) {
    updates.customIncomeCategories = normalizeCategoryList(updates.customIncomeCategories);
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
  await logActivity({
    userId,
    action: "profile_update",
    entityType: "user",
    entityId: userId,
    metadata: { fields: Object.keys(updates) },
    req,
  });
  res.json({ user: updated });
});

/* =====================================================
   CHANGE PASSWORD
===================================================== */
export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword, twoFaCode } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required" });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters long" });
  }

  const user = await findUserAuthById(userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (!user.password_hash) {
    return res.status(400).json({
      message: "No password is set for this account. Connect password login first.",
    });
  }

  if (user.two_fa_enabled) {
    if (!twoFaCode) {
      return res.status(400).json({ message: "Two-factor code is required" });
    }

    const codeHash = hashCode(twoFaCode);
    const match = await findValidTwoFaCode({
      userId,
      purpose: "password_change",
      codeHash,
    });

    if (!match) {
      return res.status(401).json({ message: "Invalid or expired two-factor code" });
    }

    await deleteTwoFaCodeById(match.id);
  }

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

  await logActivity({
    userId,
    action: "password_change",
    entityType: "user",
    entityId: userId,
    req,
  });
  res.json({
    message: "Password updated successfully",
    user: safeUser,
    token,
  });
});

/* =====================================================
   2FA: REQUEST PASSWORD CHANGE (email code)
===================================================== */
export const requestTwoFaPasswordChange = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  if (!user.two_fa_enabled) {
    return res.status(400).json({ message: "Two-factor authentication is not enabled" });
  }

  const code = generateSixDigitCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + env.twoFaCodeMinutes * 60 * 1000);

  await clearTwoFaCodes(user.id, "password_change");
  await createTwoFaCode({
    userId: user.id,
    purpose: "password_change",
    codeHash,
    expiresAt,
  });

  await sendEmail({
    to: user.email,
    subject: "Your <AppName> password change code",
    text: `Your password change code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
  });

  res.json({ message: "Verification code sent" });
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
    subject: "Your <AppName> verification code",
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
  if (!user.password_hash) {
    return res.status(400).json({ message: "Password is not set for this account" });
  }

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
  await logActivity({
    userId: payload.id,
    action: "login",
    entityType: "session",
    entityId: session.id,
    metadata: { method: "2fa" },
    req,
  });
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
  if (!user.password_hash) {
    return res.status(400).json({ message: "Password is not set for this account" });
  }

  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) {
    return res.status(401).json({ message: "Password is incorrect" });
  }

  await revokeAllSessionsForUser(userId);
  clearTokenCookie(res);

  await logActivity({
    userId,
    action: "logout_all",
    entityType: "session",
    req,
  });
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

  await logActivity({
    userId,
    action: "account_delete",
    entityType: "user",
    entityId: userId,
    req,
  });
  res.json({ message: "Account and all associated data have been deleted" });
});
