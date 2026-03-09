// src/config/postgres.js
import pg from "pg";
import env from "./env.js";

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
  const res = await pool.query(text, params);
  return res;
}
