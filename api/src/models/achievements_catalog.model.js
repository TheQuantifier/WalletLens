import { pool } from "../config/postgres.js";
import { query } from "../config/db.js";

const BASE_SELECT = `
  SELECT
    key,
    title,
    description,
    icon,
    metric,
    target,
    sort_order
  FROM achievements_catalog
`;

export async function listAchievementsCatalog() {
  const { rows } = await query(
    `
    ${BASE_SELECT}
    ORDER BY sort_order ASC, key ASC
    `
  );
  return rows || [];
}

export async function replaceAchievementsCatalog(catalog, updatedBy = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM achievements_catalog");

    for (let idx = 0; idx < catalog.length; idx += 1) {
      const item = catalog[idx];
      await client.query(
        `
        INSERT INTO achievements_catalog (
          key,
          title,
          description,
          icon,
          metric,
          target,
          sort_order,
          updated_by,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, now())
        `,
        [
          item.key,
          item.title,
          item.description,
          item.icon,
          item.metric,
          JSON.stringify(item.target),
          idx,
          updatedBy || null,
        ]
      );
    }

    const { rows } = await client.query(
      `
      ${BASE_SELECT}
      ORDER BY sort_order ASC, key ASC
      `
    );
    await client.query("COMMIT");
    return rows || [];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
