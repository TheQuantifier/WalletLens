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
  let customTotal = 0;

  await query("BEGIN");
  try {
    const updateCustomLists = async (from, to) => {
      const expRes = await query(
        `
        UPDATE users
        SET custom_expense_categories =
          ARRAY(
            SELECT CASE WHEN trim(lower(c)) = trim(lower($1)) THEN $2 ELSE c END
            FROM unnest(custom_expense_categories) AS c
          )
        WHERE EXISTS (
          SELECT 1
          FROM unnest(custom_expense_categories) AS c
          WHERE trim(lower(c)) = trim(lower($1))
        )
        `,
        [from, to]
      );
      const incRes = await query(
        `
        UPDATE users
        SET custom_income_categories =
          ARRAY(
            SELECT CASE WHEN trim(lower(c)) = trim(lower($1)) THEN $2 ELSE c END
            FROM unnest(custom_income_categories) AS c
          )
        WHERE EXISTS (
          SELECT 1
          FROM unnest(custom_income_categories) AS c
          WHERE trim(lower(c)) = trim(lower($1))
        )
        `,
        [from, to]
      );
      customTotal += (expRes.rowCount || 0) + (incRes.rowCount || 0);
    };

    const updateRecords = async (from, to) => {
      const res = await query(
        `UPDATE records SET category = $2 WHERE trim(lower(category)) = trim(lower($1))`,
        [from, to]
      );
      total += res.rowCount || 0;
    };

    if (xIsStr && yIsStr) {
      await updateRecords(x, y);
      await updateCustomLists(x, y);
    } else if (xIsArr && yIsArr) {
      for (let i = 0; i < x.length; i += 1) {
        const from = x[i];
        const to = y[i];
        await updateRecords(from, to);
        await updateCustomLists(from, to);
      }
    } else if (xIsArr && yIsStr) {
      const res = await query(
        `UPDATE records SET category = $2 WHERE trim(lower(category)) = ANY(
          SELECT trim(lower(x)) FROM unnest($1::text[]) AS x
        )`,
        [x, y]
      );
      total += res.rowCount || 0;
      for (const from of x) {
        await updateCustomLists(from, y);
      }
    }

    await query("COMMIT");
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }

  return { updatedRecords: total, updatedUsers: customTotal };
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
    console.log(
      `Updated ${result.updatedRecords} record(s) and ${result.updatedUsers} user custom list(s).`
    );
  } finally {
    await closeDb();
  }
}

const isDirectRun = process.argv[1] && process.argv[1].includes("replaceCategories.js");
if (isDirectRun) {
  run().catch((err) => {
    console.error("Error:", err.message || err);
    process.exit(1);
  });
}
