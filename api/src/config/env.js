// src/config/env.js
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "..", "..", ".env"),
});

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const boolFromEnv = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),

  // Database (switchable)
  dbProvider: (process.env.DB_PROVIDER || "postgres").toLowerCase(),
  dbUrl: required("DB_URL"),
  dbSsl: boolFromEnv(process.env.DB_SSL, true),

  // Authentication
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  sessionIdleDays: Number(process.env.SESSION_IDLE_DAYS || 1),
  sessionCleanupDays: Number(process.env.SESSION_CLEANUP_DAYS || 30),
  twoFaCodeMinutes: Number(process.env.TWO_FA_CODE_MINUTES || 10),
  twoFaTrustedDays: Number(process.env.TWO_FA_TRUSTED_DAYS || 10),
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "",

  // CORS
  clientOrigins: (process.env.CORS_ORIGIN || "http://localhost:5500")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // OCR
  ocrEnabled: boolFromEnv(process.env.OCR_ENABLED, true),
  ocrWorkerScript: process.env.OCR_WORKER_SCRIPT
    ? path.resolve(process.env.OCR_WORKER_SCRIPT)
    : path.resolve(__dirname, "..", "..", "worker", "ocr_demo.py"),
  pythonBin: process.env.PYTHON_BIN || null,
  keepReceiptFiles: boolFromEnv(process.env.RECEIPT_KEEP_FILES, true),

  // AI Parser
  aiProvider: (process.env.AI_PROVIDER || "gemini").toLowerCase(),
  aiApiKey: required("AI_API_KEY"),
  aiModel: process.env.AI_MODEL || "models/gemma-3-4b-it",
  aiMaxChars: Number(process.env.AI_MAX_CHARS || 5000),

  // Object Storage
  objectStore: {
    provider: (process.env.OBJECT_STORE_PROVIDER || "r2").toLowerCase(),
    bucket: required("OBJECT_STORE_BUCKET"),
    endpoint: required("OBJECT_STORE_ENDPOINT"),
    accessKeyId: required("OBJECT_STORE_ACCESS_KEY_ID"),
    secretAccessKey: required("OBJECT_STORE_SECRET_ACCESS_KEY"),
    region: process.env.OBJECT_STORE_REGION || "auto",
    forcePathStyle: boolFromEnv(process.env.OBJECT_STORE_FORCE_PATH_STYLE, true),
  },
};

export default env;
