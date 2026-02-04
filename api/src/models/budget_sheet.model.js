// src/models/budget_sheet.model.js
import { query } from "../config/db.js";

export const CATEGORY_COLUMNS = [
  "housing",
  "utilities",
  "groceries",
  "transportation",
  "dining",
  "health",
  "entertainment",
  "shopping",
  "membership",
  "miscellaneous",
  "education",
  "giving",
  "savings",
];

const SELECT_FIELDS = `
  id, user_id, cadence, period,
  housing, utilities, groceries, transportation, dining, health, entertainment,
  shopping, membership, miscellaneous, education, giving, savings,
  custom_categories, created_at, updated_at
`;

function normalizeCategories(categories = {}) {
  const normalized = {};
  CATEGORY_COLUMNS.forEach((col) => {
    const raw = categories[col];
    if (raw === null || raw === undefined || raw === "") {
      normalized[col] = null;
      return;
    }
    const num = Number(raw);
    normalized[col] = Number.isFinite(num) ? num : null;
  });
  return normalized;
}

export async function createBudgetSheet(userId, { cadence, period, categories, customCategories }) {
  const normalized = normalizeCategories(categories);
  const cols = ["user_id", "cadence", "period", ...CATEGORY_COLUMNS, "custom_categories"];
  const values = [
    userId,
    cadence,
    period,
    ...CATEGORY_COLUMNS.map((c) => normalized[c]),
    JSON.stringify(customCategories || []),
  ];

  const params = values.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await query(
    `
    INSERT INTO budget_sheets (${cols.join(", ")})
    VALUES (${params})
    RETURNING ${SELECT_FIELDS}
    `,
    values
  );
  return rows[0];
}

export async function updateBudgetSheet(userId, id, { cadence, period, categories, customCategories }) {
  const normalized = normalizeCategories(categories);
  const sets = [];
  const values = [];
  let i = 1;

  if (cadence !== undefined) {
    sets.push(`cadence = $${i++}`);
    values.push(cadence);
  }
  if (period !== undefined) {
    sets.push(`period = $${i++}`);
    values.push(period);
  }

  CATEGORY_COLUMNS.forEach((col) => {
    if (categories && Object.prototype.hasOwnProperty.call(categories, col)) {
      sets.push(`${col} = $${i++}`);
      values.push(normalized[col]);
    }
  });

  if (customCategories !== undefined) {
    sets.push(`custom_categories = $${i++}`);
    values.push(JSON.stringify(customCategories || []));
  }

  if (sets.length === 0) return getBudgetSheetById(userId, id);

  values.push(userId, id);

  const { rows } = await query(
    `
    UPDATE budget_sheets
    SET ${sets.join(", ")},
        updated_at = now()
    WHERE user_id = $${i++} AND id = $${i}
    RETURNING ${SELECT_FIELDS}
    `,
    values
  );
  return rows[0] || null;
}

export async function getBudgetSheetById(userId, id) {
  const { rows } = await query(
    `
    SELECT ${SELECT_FIELDS}
    FROM budget_sheets
    WHERE user_id = $1 AND id = $2
    LIMIT 1
    `,
    [userId, id]
  );
  return rows[0] || null;
}

export async function findBudgetSheetByCadencePeriod(userId, cadence, period) {
  const { rows } = await query(
    `
    SELECT ${SELECT_FIELDS}
    FROM budget_sheets
    WHERE user_id = $1 AND cadence = $2 AND period = $3
    LIMIT 1
    `,
    [userId, cadence, period]
  );
  return rows[0] || null;
}

export async function listBudgetSheets(userId, { cadence, period, limit = 50 } = {}) {
  const filters = ["user_id = $1"];
  const values = [userId];
  let i = 2;

  if (cadence) {
    filters.push(`cadence = $${i++}`);
    values.push(cadence);
  }
  if (period) {
    filters.push(`period = $${i++}`);
    values.push(period);
  }

  values.push(limit);

  const { rows } = await query(
    `
    SELECT ${SELECT_FIELDS}
    FROM budget_sheets
    WHERE ${filters.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT $${i}
    `,
    values
  );
  return rows;
}

export async function deleteBudgetSheet(userId, id) {
  const { rows } = await query(
    `
    DELETE FROM budget_sheets
    WHERE user_id = $1 AND id = $2
    RETURNING ${SELECT_FIELDS}
    `,
    [userId, id]
  );
  return rows[0] || null;
}
