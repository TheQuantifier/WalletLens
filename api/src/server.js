// src/server.js
import http from "http";
import app from "./app.js";
import env from "./config/env.js";
import { connectDb, closeDb } from "./config/db.js";
import { startReceiptJobWorker, stopReceiptJobWorker } from "./jobs/receipt_job_worker.js";
import { runMigrations } from "./db/run_migrations.js";

const server = http.createServer(app);

const start = async () => {
  try {
    await connectDb();
    if (env.autoRunMigrations) {
      await runMigrations();
    }

    server.listen(env.port, () => {
      console.log(`🚀 API server listening on port ${env.port}`);
      if (env.runReceiptWorkerInApi) {
        startReceiptJobWorker();
      }
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

start();

// --------------------------------------------------
// Global Safety Nets
// --------------------------------------------------
process.on("unhandledRejection", async (err) => {
  console.error("UNHANDLED REJECTION:", err);
  try {
    server.close(async () => {
      await closeDb();
      process.exit(1);
    });
  } catch {
    process.exit(1);
  }
});

process.on("uncaughtException", async (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  try {
    await closeDb();
  } finally {
    process.exit(1);
  }
});

// Optional: graceful shutdown (Ctrl+C / Render stop)
process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received. Shutting down...");
  stopReceiptJobWorker();
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received. Shutting down...");
  stopReceiptJobWorker();
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
});
