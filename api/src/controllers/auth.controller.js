// src/controllers/auth.controller.js
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import env from "../config/env.js";
import asyncHandler from "../middleware/async.js";
import { query, withTransaction } from "../config/db.js";

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
import { createOrganization, updateOrganizationById } from "../models/organization.model.js";
import {
  acceptOrganizationInvitation,
  findInvitationByTokenHash,
} from "../models/organization_invitation.model.js";
import {
  clearActiveOrganization,
  listUserOrganizations,
  setActiveOrganization,
  upsertOrganizationMembership,
} from "../models/organization_membership.model.js";
import {
  createSession,
  enforceMaxActiveSessionsForUser,
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
import { isSystemHealthServiceDeactivated } from "../services/system_health_controls.service.js";
import { getRuntimeAppSettings } from "../services/app_settings_runtime.service.js";

// If you have an R2 service, we’ll use it to delete objects on account deletion.
// If your service file name differs, adjust the import path accordingly.
import { deleteObject } from "../services/r2.service.js";

function createToken(id, sessionId) {
  return jwt.sign({ id, sid: sessionId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function createTwoFaToken(id, purpose) {
  return jwt.sign({ id, purpose }, env.jwtSecret, { expiresIn: "10m" });
}

function createPasswordResetToken(id) {
  return jwt.sign({ id, purpose: "password_reset" }, env.jwtSecret, { expiresIn: "15m" });
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

async function sendCodeEmail({ to, subject, text }) {
  if (!to) return;
  await sendEmail({ to, subject, text });
}

async function issueLoginCode({ userId, email, purpose, subject, text }) {
  const code = generateSixDigitCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + env.twoFaCodeMinutes * 60 * 1000);

  await clearTwoFaCodes(userId, purpose);
  await createTwoFaCode({
    userId,
    purpose,
    codeHash,
    expiresAt,
  });

  await sendCodeEmail({
    to: email,
    subject,
    text: text(code),
  });
}

function isAdminRoleType(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "org_admin" ||
    normalized === "support_admin" ||
    normalized === "analyst"
  );
}

async function createSessionWithPolicy({ userId, userAgent = "", ipAddress = "" }) {
  const runtimeSettings = await getRuntimeAppSettings();
  const session = await createSession({ userId, userAgent, ipAddress });
  await enforceMaxActiveSessionsForUser({
    userId,
    maxConcurrentSessions: Number(runtimeSettings.max_concurrent_sessions_per_user || 0),
    keepSessionId: session.id,
  });
  return { session, runtimeSettings };
}

async function sendSecurityNoticeEmail({ to, subject, text }) {
  if (!to) return;
  try {
    await sendEmail({ to, subject, text });
  } catch (err) {
    console.error("Failed to send security notice email:", err);
  }
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
      const allowLoopback = isLoopbackHost(parsed.hostname);
      if (!allowLoopback && (allowedOrigins.size === 0 || !allowedOrigins.has(parsed.origin))) {
        return fallback;
      }
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

function appendUrlHashParams(url, params = {}) {
  const target = new URL(url);
  const hashParams = new URLSearchParams(target.hash.startsWith("#") ? target.hash.slice(1) : "");
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    hashParams.set(key, String(value));
  }
  target.hash = hashParams.toString();
  return target.toString();
}

function signOauthStatePayload(payloadB64) {
  return crypto.createHmac("sha256", env.jwtSecret).update(payloadB64).digest("base64url");
}

function createOauthState({ nonce, mode, returnTo }) {
  const payload = Buffer.from(
    JSON.stringify({
      nonce: String(nonce || ""),
      mode: mode === "register" ? "register" : "login",
      returnTo: String(returnTo || ""),
    }),
    "utf8"
  ).toString("base64url");
  const sig = signOauthStatePayload(payload);
  return `${payload}.${sig}`;
}

function parseOauthState(rawState) {
  const raw = String(rawState || "");
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;

  const expectedSig = signOauthStatePayload(payload);
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function useSecureOauthCookie(req) {
  try {
    return new URL(getRequestOrigin(req)).protocol === "https:";
  } catch {
    return Boolean(req?.secure);
  }
}

function setOauthStateCookie(req, res, value) {
  res.cookie("oauth_state", value, {
    httpOnly: true,
    secure: useSecureOauthCookie(req),
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 10 * 60 * 1000,
  });
}

function clearOauthStateCookie(req, res) {
  res.cookie("oauth_state", "", {
    httpOnly: true,
    secure: useSecureOauthCookie(req),
    sameSite: "lax",
    path: "/api/auth/google",
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
  const deactivated = await isSystemHealthServiceDeactivated("google_oauth_api");
  res.json({
    enabled: !deactivated && isGoogleAuthConfigured(_req),
    clientId: env.googleClientId || "",
  });
});

export const googleStart = asyncHandler(async (req, res) => {
  if (await isSystemHealthServiceDeactivated("google_oauth_api")) {
    return res.status(503).json({ message: "Google login is disconnected by admin." });
  }
  const googleRedirectUri = getGoogleRedirectUri(req);
  if (!isGoogleAuthConfigured(req)) {
    return res.status(503).json({ message: "Google login is not configured" });
  }

  const mode = req.query?.mode === "register" ? "register" : "login";
  const returnTo = sanitizeReturnTo(req.query?.returnTo, mode, req, true);
  const nonce = crypto.randomUUID();
  const state = createOauthState({ nonce, mode, returnTo });

  setOauthStateCookie(req, res, nonce);

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
  const decodedState = parseOauthState(req.query?.state) || {
    nonce: "",
    mode: "login",
    returnTo: getDefaultFrontendAuthUrl("login"),
  };

  const mode = decodedState.mode === "register" ? "register" : "login";
  const returnTo = sanitizeReturnTo(decodedState.returnTo, mode, req, true);
  const failRedirect = (message) => res.redirect(appendUrlHashParams(returnTo, { auth_error: message }));
  const googleRedirectUri = getGoogleRedirectUri(req);

  if (await isSystemHealthServiceDeactivated("google_oauth_api")) {
    return failRedirect("Google login is disconnected by admin.");
  }

  if (!isGoogleAuthConfigured(req)) {
    return failRedirect("Google login is not configured");
  }

  if (req.query?.error) {
    return failRedirect(req.query.error_description || String(req.query.error));
  }

  const nonceFromCookie = String(req.cookies?.oauth_state || "");
  clearOauthStateCookie(req, res);

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

    const runtimeSettings = await getRuntimeAppSettings();
    if (runtimeSettings.require_2fa_for_admin_roles && isAdminRoleType(user.role) && !user.two_fa_enabled) {
      return failRedirect("Two-factor authentication is required for admin accounts.");
    }

    const { session } = await createSessionWithPolicy({
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

    return res.redirect(appendUrlHashParams(returnTo, {
      auth_success: "1",
      auth_mode: mode,
      auth_token: token,
    }));
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

  const { session } = await createSessionWithPolicy({
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
  const runtimeSettings = await getRuntimeAppSettings();
  if (runtimeSettings.require_2fa_for_admin_roles && isAdminRoleType(user.role) && !user.two_fa_enabled) {
    return res.status(403).json({
      message: "Two-factor authentication is required for admin accounts.",
    });
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

          const { session } = await createSessionWithPolicy({
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

    await issueLoginCode({
      userId: user.id,
      email: user.email,
      purpose: "login",
      subject: "Your <AppName> login code",
      text: (code) => `Your login code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
    });

    const twoFaToken = createTwoFaToken(user.id, "login");
    return res.json({ requires2fa: true, twoFactorToken: twoFaToken });
  }

  const { session } = await createSessionWithPolicy({
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateBusinessDetails(body = {}) {
  const value = (key, max = 200) => String(body[key] || "").trim().slice(0, max);
  const data = {
    businessName: value("businessName"),
    businessType: value("businessType", 100),
    industry: value("industry", 100),
    businessEmail: value("businessEmail").toLowerCase(),
    businessPhone: value("businessPhone", 50),
    website: value("website", 500),
    address: value("address", 300),
    city: value("city", 100),
    region: value("region", 100),
    postalCode: value("postalCode", 30),
    country: value("country", 100),
  };
  if (!data.businessName || !data.businessEmail) {
    return { ok: false, message: "Business name and business email are required" };
  }
  if (!EMAIL_PATTERN.test(data.businessEmail)) {
    return { ok: false, message: "Enter a valid business email address" };
  }
  if (data.website) {
    try {
      const url = new URL(data.website);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      data.website = url.toString();
    } catch {
      return { ok: false, message: "Website must be a valid http or https URL" };
    }
  }
  return { ok: true, data };
}

export function validateBusinessRegistration(body = {}) {
  const businessValidation = validateBusinessDetails(body);
  if (!businessValidation.ok) return businessValidation;
  const value = (key, max = 200) => String(body[key] || "").trim().slice(0, max);
  const data = {
    ...businessValidation.data,
    adminFullName: value("adminFullName"),
    adminEmail: value("adminEmail").toLowerCase(),
    password: String(body.password || ""),
  };

  if (!data.adminFullName || !data.adminEmail || !data.password) {
    return { ok: false, message: "Administrator details and password are required" };
  }
  if (!EMAIL_PATTERN.test(data.adminEmail)) {
    return { ok: false, message: "Enter a valid administrator email address" };
  }
  if (data.password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters long" };
  }
  return { ok: true, data };
}

async function createUniqueUsernameWithExecutor(base, executor) {
  const normalizedBase = String(base || "user")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24) || "user";
  let candidate = normalizedBase;
  let suffix = 1;
  while (true) {
    const { rows } = await executor(`SELECT 1 FROM users WHERE lower(username) = $1 LIMIT 1`, [candidate]);
    if (!rows.length) return candidate;
    suffix += 1;
    candidate = `${normalizedBase}${suffix}`;
  }
}

function invitationTokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function isInvitationAvailable(invitation) {
  return Boolean(
    invitation &&
    !invitation.accepted_at &&
    !invitation.revoked_at &&
    new Date(invitation.expires_at).getTime() > Date.now()
  );
}

export const registerBusiness = asyncHandler(async (req, res) => {
  const validation = validateBusinessRegistration(req.body);
  if (!validation.ok) return res.status(400).json({ message: validation.message });
  const data = validation.data;

  const existing = await findUserAuthByIdentifier(data.adminEmail);
  if (existing && String(existing.email).toLowerCase() === data.adminEmail) {
    return res.status(400).json({ message: "Administrator email already in use" });
  }

  const passwordHash = await bcrypt.hash(data.password, await bcrypt.genSalt(12));
  const username = await createUniqueUsername(data.adminEmail.split("@")[0]);

  const { organization, user } = await withTransaction(async (executor) => {
    const organization = await createOrganization({
      name: data.businessName,
      businessType: data.businessType,
      industry: data.industry,
      email: data.businessEmail,
      phoneNumber: data.businessPhone,
      website: data.website,
      address: data.address,
      city: data.city,
      region: data.region,
      postalCode: data.postalCode,
      country: data.country,
      executor,
    });
    const user = await createUser({
      email: data.adminEmail,
      username,
      passwordHash,
      fullName: data.adminFullName,
      role: "org_admin",
      organizationId: organization.id,
      executor,
    });
    await upsertOrganizationMembership({
      organizationId: organization.id,
      userId: user.id,
      membershipRole: "admin",
      invitedBy: user.id,
      executor,
    });
    await setActiveOrganization(user.id, organization.id, executor);
    return { organization, user };
  });

  const { session } = await createSessionWithPolicy({
    userId: user.id,
    userAgent: req.get("user-agent") || "",
    ipAddress: getRequestIp(req),
  });
  const token = createToken(user.id, session.id);
  setTokenCookie(res, token);
  res.status(201).json({ organization, user, token });
});

export const createAdditionalBusiness = asyncHandler(async (req, res) => {
  const validation = validateBusinessDetails(req.body);
  if (!validation.ok) return res.status(400).json({ message: validation.message });
  const data = validation.data;
  const organization = await withTransaction(async (executor) => {
    const organization = await createOrganization({
      name: data.businessName,
      businessType: data.businessType,
      industry: data.industry,
      email: data.businessEmail,
      phoneNumber: data.businessPhone,
      website: data.website,
      address: data.address,
      city: data.city,
      region: data.region,
      postalCode: data.postalCode,
      country: data.country,
      executor,
    });
    await upsertOrganizationMembership({
      organizationId: organization.id,
      userId: req.user.id,
      membershipRole: "admin",
      invitedBy: req.user.id,
      executor,
    });
    await setActiveOrganization(req.user.id, organization.id, executor);
    return organization;
  });
  await logActivity({
    userId: req.user.id,
    action: "organization_create",
    entityType: "organization",
    entityId: organization.id,
    metadata: { organizationName: organization.name },
    req,
  });
  const user = await findUserById(req.user.id);
  res.status(201).json({ organization, user });
});

export const getOrganizationInvitation = asyncHandler(async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(404).json({ message: "Invitation not found." });
  }
  const invitation = await findInvitationByTokenHash(invitationTokenHash(token));
  if (!isInvitationAvailable(invitation)) {
    return res.status(410).json({ message: "This invitation is invalid, expired, or no longer available." });
  }
  const { rows: existingUsers } = await query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [String(invitation.email).toLowerCase()]);
  res.json({
    invitation: {
      email: invitation.email,
      organizationName: invitation.organization_name,
      expiresAt: invitation.expires_at,
      hasExistingAccount: Boolean(existingUsers[0]),
    },
  });
});

export const acceptOrganizationMemberInvitation = asyncHandler(async (req, res) => {
  const token = String(req.params.token || "").trim();
  const fullName = String(req.body?.fullName || "").trim();
  const password = String(req.body?.password || "");
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(404).json({ message: "Invitation not found." });
  }
  if (!fullName || fullName.length > 200) {
    return res.status(400).json({ message: "Full name is required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters long." });
  }
  const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(12));
  const tokenHash = invitationTokenHash(token);

  const { user, invitation } = await withTransaction(async (executor) => {
    const invitation = await findInvitationByTokenHash(tokenHash, executor, { forUpdate: true });
    if (!isInvitationAvailable(invitation)) {
      const error = new Error("This invitation is invalid, expired, or no longer available.");
      error.status = 410;
      throw error;
    }
    const { rows: existingRows } = await executor(
      `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`,
      [String(invitation.email).toLowerCase()]
    );
    if (existingRows[0]) {
      const error = new Error("An account with this email already exists.");
      error.status = 400;
      throw error;
    }
    const username = await createUniqueUsernameWithExecutor(
      String(invitation.email).split("@")[0],
      executor
    );
    const user = await createUser({
      email: invitation.email,
      username,
      passwordHash,
      fullName,
      role: "org_user",
      organizationId: invitation.organization_id,
      executor,
    });
    await upsertOrganizationMembership({
      organizationId: invitation.organization_id,
      userId: user.id,
      membershipRole: "member",
      invitedBy: invitation.invited_by,
      executor,
    });
    await setActiveOrganization(user.id, invitation.organization_id, executor);
    await acceptOrganizationInvitation(invitation.id, executor);
    return { user, invitation };
  });

  const { session } = await createSessionWithPolicy({
    userId: user.id,
    userAgent: req.get("user-agent") || "",
    ipAddress: getRequestIp(req),
  });
  const authToken = createToken(user.id, session.id);
  setTokenCookie(res, authToken);
  await logActivity({
    userId: user.id,
    action: "organization_invitation_accept",
    entityType: "organization_invitation",
    entityId: invitation.id,
    metadata: { organizationId: invitation.organization_id },
    req,
  });
  res.status(201).json({ user, token: authToken });
});

export const acceptExistingOrganizationInvitation = asyncHandler(async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ message: "Invitation not found." });
  const invitation = await withTransaction(async (executor) => {
    const invitation = await findInvitationByTokenHash(invitationTokenHash(token), executor, { forUpdate: true });
    if (!isInvitationAvailable(invitation)) {
      const error = new Error("This invitation is invalid, expired, or no longer available."); error.status = 410; throw error;
    }
    if (String(invitation.email).toLowerCase() !== String(req.user.email).toLowerCase()) {
      const error = new Error("Sign in with the email address that received this invitation."); error.status = 403; throw error;
    }
    await upsertOrganizationMembership({ organizationId: invitation.organization_id, userId: req.user.id,
      membershipRole: "member", invitedBy: invitation.invited_by, executor });
    await setActiveOrganization(req.user.id, invitation.organization_id, executor);
    await acceptOrganizationInvitation(invitation.id, executor);
    return invitation;
  });
  const user = await findUserById(req.user.id);
  res.json({ user, organizationId: invitation.organization_id });
});

export const listMyOrganizations = asyncHandler(async (req, res) => {
  const organizations = await listUserOrganizations(req.user.id);
  res.json({ organizations, activeOrganizationId: req.user.active_organization_id || req.user.organization_id || null });
});

export const switchActiveOrganization = asyncHandler(async (req, res) => {
  const organizationId = String(req.body?.organizationId || "").trim();
  if (!organizationId) {
    await clearActiveOrganization(req.user.id);
    const user = await findUserById(req.user.id);
    return res.json({ user, active: { organizationId: null, membershipRole: null, effectiveRole: user.platform_role || "user" } });
  }
  const active = await setActiveOrganization(req.user.id, organizationId);
  if (!active) return res.status(404).json({ message: "Active organization membership not found." });
  const user = await findUserById(req.user.id);
  res.json({ user, active });
});

/* =====================================================
   FORGOT PASSWORD: REQUEST EMAIL CODE
===================================================== */
export const requestPasswordResetLogin = asyncHandler(async (req, res) => {
  const identifier = String(req.body?.identifier || "").trim();
  if (!identifier) {
    return res.status(400).json({ message: "Email or username is required" });
  }

  const user = await findUserAuthByIdentifier(identifier);
  const genericMessage =
    "If that account exists and supports password login, a verification code has been emailed.";

  if (!user?.id || !user?.password_hash || !user?.email) {
    return res.json({ message: genericMessage });
  }

  await issueLoginCode({
    userId: user.id,
    email: user.email,
    purpose: "password_reset_login",
    subject: "Your <AppName> password reset code",
    text: (code) =>
      `Your password reset code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
  });

  const resetLoginToken = createTwoFaToken(user.id, "password_reset_login");
  res.json({
    message: genericMessage,
    requiresResetCode: true,
    twoFactorToken: resetLoginToken,
  });
});

/* =====================================================
   FORGOT PASSWORD: VERIFY CODE + LOGIN
===================================================== */
export const verifyPasswordResetLogin = asyncHandler(async (req, res) => {
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

  if (payload?.purpose !== "password_reset_login") {
    return res.status(401).json({ message: "Invalid token purpose" });
  }

  const codeHash = hashCode(code);
  const match = await findValidTwoFaCode({
    userId: payload.id,
    purpose: "password_reset_login",
    codeHash,
  });

  if (!match) {
    return res.status(401).json({ message: "Invalid or expired code" });
  }

  await deleteTwoFaCodeById(match.id);

  const safeUser = await findUserById(payload.id);
  const { session } = await createSessionWithPolicy({
    userId: payload.id,
    userAgent: req.get("user-agent") || "",
    ipAddress: getRequestIp(req),
  });
  const token = createToken(payload.id, session.id);
  const passwordResetToken = createPasswordResetToken(payload.id);
  setTokenCookie(res, token);

  await logActivity({
    userId: payload.id,
    action: "login",
    entityType: "session",
    entityId: session.id,
    metadata: { method: "password_reset_code" },
    req,
  });

  res.json({
    user: safeUser,
    token,
    passwordResetRequired: true,
    passwordResetToken,
  });
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

  const organizationCategoryUpdates = {};
  if (req.user.organization_id) {
    if (updates.customExpenseCategories !== undefined) {
      organizationCategoryUpdates.customExpenseCategories = updates.customExpenseCategories;
      delete updates.customExpenseCategories;
    }
    if (updates.customIncomeCategories !== undefined) {
      organizationCategoryUpdates.customIncomeCategories = updates.customIncomeCategories;
      delete updates.customIncomeCategories;
    }
    if (Object.keys(organizationCategoryUpdates).length) {
      await updateOrganizationById(req.user.organization_id, organizationCategoryUpdates);
    }
  }
  await updateUserById(userId, updates);
  const updated = await findUserById(userId);
  await logActivity({
    userId,
    action: "profile_update",
    entityType: "user",
    entityId: userId,
    metadata: { fields: [...Object.keys(updates), ...Object.keys(organizationCategoryUpdates)] },
    req,
  });
  res.json({ user: updated });
});

/* =====================================================
   CHANGE PASSWORD
===================================================== */
export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword, twoFaCode, passwordResetToken } = req.body;

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

  let usingPasswordResetToken = false;
  if (passwordResetToken) {
    let payload;
    try {
      payload = jwt.verify(passwordResetToken, env.jwtSecret);
    } catch {
      return res.status(401).json({ message: "Invalid or expired password reset token" });
    }

    if (payload?.purpose !== "password_reset" || payload?.id !== userId) {
      return res.status(401).json({ message: "Invalid password reset token" });
    }
    usingPasswordResetToken = true;
  }

  if (!usingPasswordResetToken && !currentPassword) {
    return res.status(400).json({ message: "Current password is required" });
  }

  if (user.two_fa_enabled && !usingPasswordResetToken) {
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

  if (!usingPasswordResetToken) {
    const isMatch = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
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

  await sendSecurityNoticeEmail({
    to: safeUser?.email || user?.email,
    subject: "Your <AppName> password was changed",
    text: "Your password was successfully changed. If you did not do this, contact support immediately.",
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

  await issueLoginCode({
    userId: user.id,
    email: user.email,
    purpose: "password_change",
    subject: "Your <AppName> password change code",
    text: (code) =>
      `Your password change code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
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

  await issueLoginCode({
    userId: user.id,
    email: user.email,
    purpose: "enable",
    subject: "Your <AppName> verification code",
    text: (code) => `Your verification code is ${code}. It expires in ${env.twoFaCodeMinutes} minutes.`,
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

  await sendSecurityNoticeEmail({
    to: updated?.email,
    subject: "<AppName> two-factor authentication enabled",
    text: "Two-factor authentication was enabled on your account. If this was not you, contact support immediately.",
  });

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

  const safeUser = await findUserById(payload.id);
  const { session } = await createSessionWithPolicy({
    userId: payload.id,
    userAgent: req.get("user-agent") || "",
    ipAddress: getRequestIp(req),
  });
  const token = createToken(payload.id, session.id);
  setTokenCookie(res, token);
  setDeviceCookie(res, deviceId);

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
  const { rows: membershipRows } = await query(
    `SELECT membership_role, count(*)::int AS membership_count
     FROM organization_memberships WHERE user_id = $1 AND status = 'active'
     GROUP BY membership_role`,
    [userId]
  );
  const activeMembershipCount = membershipRows.reduce((total, row) => total + Number(row.membership_count || 0), 0);
  const administeredOrganizationCount = membershipRows
    .filter((row) => row.membership_role === "admin")
    .reduce((total, row) => total + Number(row.membership_count || 0), 0);
  if (activeMembershipCount > 0) {
    return res.status(400).json({
      message: administeredOrganizationCount > 0
        ? "Transfer or delete every organization you administer before deleting your account. An administrator must also remove any remaining memberships."
        : "An organization administrator must remove your memberships before you can delete your account.",
    });
  }

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

  // 2) Write the deletion audit while the user still exists. The user reference is
  // anonymized by ON DELETE SET NULL when the account is removed.
  await logActivity({
    userId,
    action: "account_delete",
    entityType: "user",
    metadata: { method: "self_service" },
    req,
  });

  // 3) Delete the user. Personal records/receipts cascade via FK ON DELETE CASCADE.
  await query(`DELETE FROM users WHERE id = $1`, [userId]);

  // 4) Clear auth cookie
  clearTokenCookie(res);
  res.json({ message: "Account and all associated data have been deleted" });
});
