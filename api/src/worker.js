import { connectDb, closeDb } from "./config/db.js";
import env from "./config/env.js";
import { runMigrations } from "./db/runMigrations.js";
import { startReceiptJobWorker, stopReceiptJobWorker } from "./jobs/receiptJobWorker.js";

const start = async () => {
  try {
    await connectDb();
    if (env.autoRunMigrations) {
      await runMigrations();
    }
    startReceiptJobWorker();
    console.log("🚀 Receipt worker started.");
  } catch (err) {
    console.error("❌ Failed to start receipt worker:", err);
    process.exit(1);
  }
};

start();

process.on("SIGINT", async () => {
  console.log("🛑 Worker SIGINT received. Shutting down...");
  stopReceiptJobWorker();
  await closeDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🛑 Worker SIGTERM received. Shutting down...");
  stopReceiptJobWorker();
  await closeDb();
  process.exit(0);
});
