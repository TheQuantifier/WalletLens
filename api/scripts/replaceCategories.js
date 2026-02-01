// scripts/replaceCategories.js
import { connectDb, closeDb, query } from "../src/config/db.js";

function isString(value) {
  return typeof value === "string";
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export async function replaceCategory(x, y) {
  const xIsStr = isString(x);
  const yIsStr = isString(y);
  const xIsArr = isStringArray(x);
  const yIsArr = isStringArray(y);

  if (!xIsStr && !xIsArr) {
    throw new Error("replaceCategory: x must be a string or array of strings.");
  }
  if (!yIsStr && !yIsArr) {
    throw new Error("replaceCategory: y must be a string or array of strings.");
  }

  if (xIsArr && yIsArr && x.length !== y.length) {
    throw new Error("replaceCategory: when x and y are arrays, they must be the same length.");
  }

  if (xIsStr && yIsArr) {
    throw new Error("replaceCategory: invalid types (x string, y array).");
  }

  let total = 0;

  await query("BEGIN");
  try {
    if (xIsStr && yIsStr) {
      const res = await query(
        `UPDATE records SET category = $2 WHERE category = $1`,
        [x, y]
      );
      total += res.rowCount || 0;
    } else if (xIsArr && yIsArr) {
      for (let i = 0; i < x.length; i += 1) {
        const from = x[i];
        const to = y[i];
        const res = await query(
          `UPDATE records SET category = $2 WHERE category = $1`,
          [from, to]
        );
        total += res.rowCount || 0;
      }
    } else if (xIsArr && yIsStr) {
      const res = await query(
        `UPDATE records SET category = $2 WHERE category = ANY($1::text[])`,
        [x, y]
      );
      total += res.rowCount || 0;
    }

    await query("COMMIT");
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }

  return { updated: total };
}

async function run() {
  const [, , xArg, yArg] = process.argv;
  if (!xArg || !yArg) {
    console.error("Usage: node scripts/replaceCategories.js <x> <y>");
    console.error("Examples:");
    console.error('  node scripts/replaceCategories.js "Food" "Dining"');
    console.error('  node scripts/replaceCategories.js "[\\"Food\\",\\"Gas\\"]" "Other"');
    console.error('  node scripts/replaceCategories.js "[\\"Food\\",\\"Gas\\"]" "[\\"Dining\\",\\"Transportation\\"]"');
    process.exit(1);
  }

  let x;
  let y;
  try {
    x = JSON.parse(xArg);
  } catch {
    x = xArg;
  }
  try {
    y = JSON.parse(yArg);
  } catch {
    y = yArg;
  }

  await connectDb();
  try {
    const result = await replaceCategory(x, y);
    console.log(`Updated ${result.updated} record(s).`);
  } finally {
    await closeDb();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error("Error:", err.message || err);
    process.exit(1);
  });
}
