// src/app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import env from "./config/env.js";
import apiRouter from "./routes/index.js";
import { errorHandler } from "./middleware/error.js";
import securityHeaders from "./middleware/security_headers.js";

const app = express();

// --------------------------------------------------
// Logging
// --------------------------------------------------
if (env.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

// --------------------------------------------------
// JSON + Form Parsing
// --------------------------------------------------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
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
    "http://localhost:5000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
  ])
);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman / curl / server-side

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn("❌ BLOCKED CORS ORIGIN:", origin);
    return callback(new Error("CORS: Not allowed by server"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Main CORS handler
app.use(cors(corsOptions));

// Preflight
app.options("*", cors(corsOptions));

// --------------------------------------------------
// Health Check
// --------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------
app.use("/api", apiRouter);

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------
app.use(errorHandler);

export default app;
