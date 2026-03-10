// src/config/postgres.js
import pg from "pg";
import env from "./env.js";
import { isDatabaseEmergencyDeactivated } from "../services/system_health_runtime.service.js";

const { Pool } = pg;

if (!env.dbUrl) {
  throw new Error("DB_URL is missing (PostgreSQL connection string).");
}

export const pool = new Pool({
  connectionString: env.dbUrl,
  ssl: env.dbSsl
    ? { rejectUnauthorized: !env.dbSslAllowInvalidCerts }
    : false,
});

/**
 * Convenience query helper
 * @param {string} text
 * @param {any[]} params
 */
export async function query(text, params = []) {
  if (isDatabaseEmergencyDeactivated()) {
    const err = new Error("Database connection is disconnected by admin emergency control.");
    err.status = 503;
    err.code = "DB_EMERGENCY_DEACTIVATED";
    throw err;
  }
  const res = await pool.query(text, params);
  return res;
}
