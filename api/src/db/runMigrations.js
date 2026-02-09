import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/postgres.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrationSet(client) {
  const { rows } = await client.query(`SELECT filename FROM schema_migrations`);
  return new Set(rows.map((row) => String(row.filename)));
}

async function readMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

export async function runMigrations({ logger = console } = {}) {
  const client = await pool.connect();
  let appliedCount = 0;
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrationSet(client);
    const files = await readMigrationFiles();

    for (const filename of files) {
      if (applied.has(filename)) continue;
      const fullPath = path.join(MIGRATIONS_DIR, filename);
      const sql = await fs.readFile(fullPath, "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename) VALUES ($1)`,
          [filename]
        );
        await client.query("COMMIT");
        appliedCount += 1;
        logger.log(`✅ Applied migration: ${filename}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    if (appliedCount === 0) {
      logger.log("ℹ️ No pending migrations.");
    }
    return { appliedCount };
  } finally {
    client.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runMigrations()
    .then(() => pool.end())
    .catch(async (err) => {
      console.error("❌ Migration run failed:", err);
      await pool.end();
      process.exit(1);
    });
}
