import { query } from "../config/db.js";

const SELECT_FIELDS = `
  id, user_id, organization_id, organization_owner_user_id, data, created_at, updated_at
`;

export async function getPlanningSheet(userId) {
  const { rows } = await query(
    `
    SELECT ${SELECT_FIELDS}
    FROM planning_sheets
    WHERE can_access_organization_resource(user_id, organization_id, $1)
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [userId]
  );
  return rows[0] || null;
}

export async function upsertPlanningSheet(userId, data) {
  const existing = await getPlanningSheet(userId);
  if (existing) {
    const { rows } = await query(
      `
      UPDATE planning_sheets
      SET data = $1,
          updated_at = now()
      WHERE id = $2 AND can_access_organization_resource(user_id, organization_id, $3)
      RETURNING ${SELECT_FIELDS}
      `,
      [JSON.stringify(data || {}), existing.id, userId]
    );
    return rows[0] || null;
  }

  const { rows } = await query(
    `
    INSERT INTO planning_sheets (user_id, data)
    VALUES ($1, $2)
    RETURNING ${SELECT_FIELDS}
    `,
    [userId, JSON.stringify(data || {})]
  );
  return rows[0] || null;
}
