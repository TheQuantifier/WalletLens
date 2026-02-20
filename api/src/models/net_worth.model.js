// src/models/net_worth.model.js
import { query } from "../config/db.js";

/**
 * Expected Postgres table: net_worth_items
 * Columns:
 * id (uuid), user_id (uuid),
 * type ('asset'|'liability'),
 * name (text),
 * amount (numeric),
 * created_at, updated_at
 */

export async function createNetWorthItem(userId, { type, name, amount }) {
  const { rows } = await query(
    `
    INSERT INTO net_worth_items
      (user_id, type, name, amount)
    VALUES
      ($1, $2, $3, $4)
    RETURNING *
    `,
    [userId, type, name, amount]
  );
  return rows[0];
}

export async function listNetWorthItems(userId) {
  const { rows } = await query(
    `
    SELECT *
    FROM net_worth_items
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );
  return rows;
}

export async function updateNetWorthItem(userId, id, { name, amount }) {
  const sets = [];
  const values = [id, userId];
  let i = 3;

  if (name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(name);
  }
  if (amount !== undefined) {
    sets.push(`amount = $${i++}`);
    values.push(amount);
  }

  if (!sets.length) return getNetWorthItemById(userId, id);

  const { rows } = await query(
    `
    UPDATE net_worth_items
    SET ${sets.join(", ")}, updated_at = now()
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    values
  );
  return rows[0] || null;
}

export async function deleteNetWorthItem(userId, id) {
  const { rows } = await query(
    `
    DELETE FROM net_worth_items
    WHERE id = $1 AND user_id = $2
    RETURNING *
    `,
    [id, userId]
  );
  return rows[0] || null;
}

export async function getNetWorthItemById(userId, id) {
  const { rows } = await query(
    `
    SELECT *
    FROM net_worth_items
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [id, userId]
  );
  return rows[0] || null;
}
