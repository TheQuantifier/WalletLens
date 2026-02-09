// src/controllers/support.controller.js
import asyncHandler from "../middleware/async.js";
import { sendEmail } from "../services/email.service.js";
import env from "../config/env.js";

const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL || "support.wisewallet@manuswebworks.org";

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_NAME_LENGTH = 120;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validatePublicSupportPayload(payload = {}) {
  const subject = normalizeString(payload?.subject);
  const message = normalizeString(payload?.message);
  const name = normalizeString(payload?.name);
  const email = normalizeString(payload?.email).toLowerCase();
  const website = normalizeString(payload?.website);

  if (website) return { ok: false, message: "Invalid request." };
  if (!name || !subject || !message || !email) {
    return { ok: false, message: "Name, email, subject, and message are required." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, message: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, message: "Please provide a valid email address." };
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return { ok: false, message: `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.` };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
  }

  return { ok: true, subject, message, name, email };
}

async function verifyTurnstile(token, remoteip) {
  if (!env.turnstileSecretKey) return { ok: true };
  if (!token) {
    return { ok: false, message: "Captcha token is required." };
  }

  const body = new URLSearchParams({
    secret: env.turnstileSecretKey,
    response: String(token),
    remoteip: String(remoteip || ""),
  });

  const res = await fetch(env.turnstileVerifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    return { ok: false, message: "Captcha verification failed." };
  }
  return { ok: true };
}

export const contactSupport = asyncHandler(async (req, res) => {
  const subject = normalizeString(req.body?.subject);
  const message = normalizeString(req.body?.message);
  const name = normalizeString(req.body?.name);
  const email = normalizeString(req.user?.email);

  if (!email) {
    return res.status(401).json({ message: "You must be logged in to contact support." });
  }

  if (!subject || !message) {
    return res
      .status(400)
      .json({ message: "Subject and message are required." });
  }

  if (subject.length > MAX_SUBJECT_LENGTH) {
    return res.status(400).json({
      message: `Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.`,
    });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    });
  }

  const metaLines = [
    name ? `Name: ${name}` : null,
    email ? `Email: ${email}` : null,
    req.user?.email ? `Account: ${req.user.email}` : null,
    req.user?.id ? `User ID: ${req.user.id}` : null,
    `IP: ${req.ip}`,
    req.get("user-agent") ? `User-Agent: ${req.get("user-agent")}` : null,
    `URL: ${req.get("referer") || "unknown"}`,
  ].filter(Boolean);

  const body = [
    "Support request",
    "----------------",
    ...metaLines,
    "",
    "Message",
    "----------------",
    message,
  ].join("\n");

  const defaultFrom = process.env.EMAIL_FROM || "no-reply@wisewallet.local";
  const safeFromName = (name || email || "Customer").replace(/"/g, "'");
  const from = email ? `"${safeFromName}" <${defaultFrom}>` : defaultFrom;

  await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `[Support] ${subject}`,
    text: body,
    replyTo: email || undefined,
    from,
  });

  res.json({ ok: true });
});

export const contactSupportPublic = asyncHandler(async (req, res) => {
  const validation = validatePublicSupportPayload(req.body || {});
  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }
  const { subject, message, name, email } = validation;
  const captchaToken = normalizeString(req.body?.captchaToken || req.body?.turnstileToken);
  const captcha = await verifyTurnstile(captchaToken, req.ip);
  if (!captcha.ok) {
    return res.status(400).json({ message: captcha.message });
  }

  const metaLines = [
    `Name: ${name}`,
    `Email: ${email}`,
    `IP: ${req.ip}`,
    req.get("user-agent") ? `User-Agent: ${req.get("user-agent")}` : null,
    `URL: ${req.get("referer") || "unknown"}`,
  ].filter(Boolean);

  const body = [
    "Public support request",
    "----------------",
    ...metaLines,
    "",
    "Message",
    "----------------",
    message,
  ].join("\n");

  const defaultFrom = process.env.EMAIL_FROM || "no-reply@wisewallet.local";
  const safeFromName = (name || email || "Customer").replace(/"/g, "'");
  const from = `"${safeFromName}" <${defaultFrom}>`;

  await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `[Public Support] ${subject}`,
    text: body,
    replyTo: email,
    from,
  });

  res.json({ ok: true });
});
