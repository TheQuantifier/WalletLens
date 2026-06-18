// src/config/db.js
import env from "./env.js";
import { pool, query as pgQuery } from "./postgres.js";

/**
 * App-facing query function.
 * Keeps the rest of the codebase importing from db.js instead of postgres.js.
 */
export async function query(text, params = []) {
  const provider = (env.dbProvider || "postgres").toLowerCase();
  if (provider !== "postgres") {
    throw new Error(`Unsupported DB provider: ${provider}`);
  }
  return pgQuery(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work((text, params = []) => client.query(text, params));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Connect/init the configured database.
 * Mirrors old connectMongo() pattern.
 */
export async function connectDb() {
  const provider = (env.dbProvider || "postgres").toLowerCase();

  if (provider !== "postgres") {
    throw new Error(`Unsupported DB provider: ${provider}`);
  }

  try {
    await pool.query("SELECT 1");
    console.log("✅ Connected to PostgreSQL");
  } catch (err) {
    console.error("❌ PostgreSQL connection error:", err);
    // Either exit hard (current behavior)...
    process.exit(1);
    // ...or: throw err; (if you want the caller to decide)
  }
}

/**
 * Optional: graceful shutdown helper
 */
export async function closeDb() {
  try {
    await pool.end();
    console.log("🛑 PostgreSQL pool closed.");
  } catch (err) {
    console.error("❌ Error closing PostgreSQL pool:", err);
  }
}
