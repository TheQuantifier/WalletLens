// src/services/email.service.js
import nodemailer from "nodemailer";

import env from "../config/env.js";
import { getAppSettings } from "../models/app_settings.model.js";

const hasSmtpConfig =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_PORT &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS;

const hasBrevoApiKey = !!process.env.BREVO_API_KEY;

let transporter = null;
const APP_NAME_PLACEHOLDER = "<AppName>";

function getTransporter() {
  if (transporter) return transporter;

  if (hasSmtpConfig) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  // Fallback: log emails to the console (no SMTP configured)
  transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });

  return transporter;
}

export async function sendEmail({ to, subject, text, replyTo, from }) {
  const needsAppName = [subject, text, replyTo, from].some(
    (value) => typeof value === "string" && value.includes(APP_NAME_PLACEHOLDER)
  );

  let appName = null;
  if (needsAppName) {
    try {
      const settings = await getAppSettings();
      appName = settings?.app_name || APP_NAME_PLACEHOLDER;
    } catch {
      appName = APP_NAME_PLACEHOLDER;
    }
  }

  const replaceAppName = (value) => {
    if (!value || !appName || !String(value).includes(APP_NAME_PLACEHOLDER)) return value;
    return String(value).split(APP_NAME_PLACEHOLDER).join(appName);
  };

  const resolvedFrom = replaceAppName(
    from || process.env.EMAIL_FROM || "no-reply@wisewallet.local"
  );
  const resolvedSubject = replaceAppName(subject);
  const resolvedText = replaceAppName(text);
  const resolvedReplyTo = replaceAppName(replyTo);

  if (hasBrevoApiKey) {
    await sendViaBrevoApi({
      to,
      subject: resolvedSubject,
      text: resolvedText,
      replyTo: resolvedReplyTo,
      from: resolvedFrom,
    });
    return;
  }

  const transport = getTransporter();

  let info;
  try {
    info = await transport.sendMail({
      from: resolvedFrom,
      to,
      subject: resolvedSubject,
      text: resolvedText,
      ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
    });
  } catch (err) {
    console.error("EMAIL SEND ERROR:", err);
    const error = new Error("Email delivery failed. Check SMTP settings.");
    error.status = 502;
    throw error;
  }

  if (!hasSmtpConfig && info?.message) {
    console.log("EMAIL (dev):\n" + info.message.toString());
  }
}

function parseSender(fromValue) {
  const defaultName = "<AppName> Support";
  if (!fromValue) return { name: defaultName, email: "no-reply@wisewallet.local" };

  const match = String(fromValue).match(/^\s*\"?([^"]*)\"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1]?.trim() || defaultName;
    const email = match[2]?.trim() || "";
    return { name, email };
  }

  return { name: defaultName, email: String(fromValue).trim() };
}

async function sendViaBrevoApi({ to, subject, text, replyTo, from }) {
  const apiKey = process.env.BREVO_API_KEY;
  const apiUrl = process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email";
  const sender = parseSender(from);

  const payload = {
    sender,
    to: [{ email: to }],
    subject,
    textContent: text,
    ...(replyTo ? { replyTo: { email: replyTo } } : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("BREVO API ERROR:", res.status, text);
      const error = new Error("Email delivery failed. Check SMTP settings.");
      error.status = 502;
      throw error;
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      console.error("BREVO API ERROR: timeout");
      const error = new Error("Email delivery failed. Check SMTP settings.");
      error.status = 502;
      throw error;
    }
    console.error("BREVO API ERROR:", err);
    const error = new Error("Email delivery failed. Check SMTP settings.");
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
