import { query } from "../config/db.js";

function mapRuleRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    enabled: row.enabled,
    priority: row.priority,
    applyMode: row.apply_mode,
    conditions: Array.isArray(row.conditions) ? row.conditions : [],
    actions: Array.isArray(row.actions) ? row.actions : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRulesByUser(userId, { enabledOnly = false } = {}) {
  const params = [userId];
  let where = "user_id = $1";
  if (enabledOnly) {
    where += " AND enabled = true";
  }

  const { rows } = await query(
    `
    SELECT *
    FROM rules
    WHERE ${where}
    ORDER BY priority DESC, created_at ASC
    `,
    params
  );

  return rows.map(mapRuleRow);
}

export async function getRuleById(userId, id) {
  const { rows } = await query(
    `
    SELECT *
    FROM rules
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [id, userId]
  );

  return mapRuleRow(rows[0] || null);
}

export async function createRule(userId, data) {
  const { name, enabled, priority, applyMode, conditions, actions } = data;
  const { rows } = await query(
    `
    INSERT INTO rules
      (user_id, name, enabled, priority, apply_mode, conditions, actions)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [userId, name, enabled, priority, applyMode, conditions, actions]
  );

  return mapRuleRow(rows[0] || null);
}

export async function updateRule(userId, id, changes = {}) {
  const allowed = {
    name: "name",
    enabled: "enabled",
    priority: "priority",
    applyMode: "apply_mode",
    conditions: "conditions",
    actions: "actions",
  };

  const sets = [];
  const values = [];
  let i = 1;

  for (const [key, column] of Object.entries(allowed)) {
    if (changes[key] !== undefined) {
      sets.push(`${column} = $${i++}`);
      values.push(changes[key]);
    }
  }

  if (sets.length === 0) {
    return getRuleById(userId, id);
  }

  values.push(id, userId);

  const { rows } = await query(
    `
    UPDATE rules
    SET ${sets.join(", ")},
        updated_at = now()
    WHERE id = $${i++} AND user_id = $${i++}
    RETURNING *
    `,
    values
  );

  return mapRuleRow(rows[0] || null);
}

export async function deleteRule(userId, id) {
  const { rows } = await query(
    `
    DELETE FROM rules
    WHERE id = $1 AND user_id = $2
    RETURNING id
    `,
    [id, userId]
  );

  return rows[0] || null;
}
