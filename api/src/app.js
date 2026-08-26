// src/app.js
import express from "express";
import crypto from "crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import env from "./config/env.js";
import apiRouter from "./routes/index.js";
import { errorHandler } from "./middleware/error.js";
import securityHeaders from "./middleware/security_headers.js";
import { query } from "./config/db.js";

const app = express();
app.disable("x-powered-by");
if (env.trustProxyHops > 0) {
  app.set("trust proxy", env.trustProxyHops);
}

app.use((req, res, next) => {
  const suppliedId = String(req.get("x-request-id") || "").trim();
  const requestId = /^[a-zA-Z0-9._:-]{1,64}$/.test(suppliedId)
    ? suppliedId
    : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

// --------------------------------------------------
// Logging
// --------------------------------------------------
if (env.nodeEnv !== "test") {
  app.use(
    morgan("dev", {
      skip: (req, res) => res.statusCode < 400,
    })
  );
}

// --------------------------------------------------
// JSON + Form Parsing
// --------------------------------------------------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => {
  // Express 4 exposed an empty object when no body parser matched the request.
  // Preserve that contract for controllers that destructure req.body.
  if (req.body === undefined) req.body = {};
  next();
});
app.use(securityHeaders);

// --------------------------------------------------
// Cookies
// --------------------------------------------------
app.use(cookieParser());

// --------------------------------------------------
// CORS CONFIG — REQUIRED FOR RENDER + FRONTENDS
// --------------------------------------------------

// Combine env-configured origins + your hardcoded production/dev list.
// De-duped to avoid repeats.
const allowedOrigins = Array.from(
  new Set([
    ...(env.clientOrigins || []),

    // Your live frontend(s)
    "https://app.thequantifier.com",
    "https://thequantifier.com",
    "https://www.thequantifier.com",
    "https://wisewallet.manuswebworks.org",

    // Local dev
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
  ])
);

function isAllowedLocalDevOrigin(origin) {
  try {
    const url = new URL(String(origin));
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman / curl / server-side

    if (allowedOrigins.includes(origin) || isAllowedLocalDevOrigin(origin)) {
      return callback(null, true);
    }

    console.warn("❌ BLOCKED CORS ORIGIN:", origin);
    return callback(new Error("CORS: Not allowed by server"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"],
};

// Main CORS handler
app.use(cors(corsOptions));

// Preflight
app.options("/{*splat}", cors(corsOptions));

// --------------------------------------------------
// Health Check
// --------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/ready", async (req, res) => {
  try {
    await query("SELECT 1");
    return res.json({ status: "ready", requestId: req.requestId });
  } catch (error) {
    console.error("Readiness check failed", { requestId: req.requestId, error });
    return res.status(503).json({ status: "unavailable", requestId: req.requestId });
  }
});

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------
app.use("/api", apiRouter);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found", requestId: req.requestId });
});

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------
app.use(errorHandler);

export default app;
