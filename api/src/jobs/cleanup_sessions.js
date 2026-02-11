// src/jobs/cleanup_sessions.js
import env from "../config/env.js";
import { connectDb, closeDb } from "../config/db.js";
import { cleanupOldSessions } from "../models/session.model.js";

const run = async () => {
  try {
    await connectDb();
    const removed = await cleanupOldSessions({ cutoffDays: env.sessionCleanupDays });
    console.log(`✅ Session cleanup removed ${removed} session(s).`);
  } catch (err) {
    console.error("❌ Session cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
};

run();
