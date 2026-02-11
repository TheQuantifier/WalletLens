// src/models/record.model.js
import { query } from "../config/db.js";

/**
 * Expected Postgres table: records
 * Mirrors your Mongo Record schema.
 *
 * Columns:
 * id (uuid), user_id (uuid),
 * type ('income'|'expense'),
 * amount (numeric),
 * category (text),
 * date (timestamptz),
 * note (text),
 * linked_receipt_id (uuid, nullable),
 * created_at, updated_at
 */

export async function createRecord(userId, data) {
  const { type, amount, category, date, note = "", linkedReceiptId = null } = data;

  // keep your old behavior: store as UTC noon to avoid timezone shifting
  const dt = date ? new Date(date) : new Date();
  const utcNoon = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 12, 0, 0)
  );

  const { rows } = await query(
    `
    INSERT INTO records
      (user_id, type, amount, category, date, note, linked_receipt_id)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [userId, type, amount, category, utcNoon.toISOString(), note, linkedReceiptId]
  );

  return rows[0];
}

export async function listRecords(userId, { type, limit = 200, offset = 0 } = {}) {
  const where = ["user_id = $1"];
  const params = [userId];
  let i = 2;

  if (type) {
    where.push(`type = $${i++}`);
    params.push(type);
  }

  params.push(limit);
  params.push(offset);

  const { rows } = await query(
    `
    SELECT *
    FROM records
    WHERE ${where.join(" AND ")}
    ORDER BY date DESC, created_at DESC
    LIMIT $${i++} OFFSET $${i++}
    `,
    params
  );

  return rows;
}

export async function getRecordById(userId, id) {
  const { rows } = await query(
    `
    SELECT *
    FROM records
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [id, userId]
  );
  return rows[0] || null;
}

export async function updateRecord(userId, id, changes = {}) {
  const allowed = {
    type: "type",
    amount: "amount",
    category: "category",
    note: "note",
    linkedReceiptId: "linked_receipt_id",
  };

  const sets = [];
  const values = [];
  let i = 1;

  for (const [key, col] of Object.entries(allowed)) {
    if (changes[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      values.push(changes[key]);
    }
  }

  if (changes.date !== undefined) {
    const dt = changes.date ? new Date(changes.date) : new Date();
    const utcNoon = new Date(
      Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 12, 0, 0)
    );
    sets.push(`date = $${i++}`);
    values.push(utcNoon.toISOString());
  }

  if (sets.length === 0) return getRecordById(userId, id);

  values.push(id, userId);

  const { rows } = await query(
    `
    UPDATE records
    SET ${sets.join(", ")},
        updated_at = now()
    WHERE id = $${i++} AND user_id = $${i++}
    RETURNING *
    `,
    values
  );

  return rows[0] || null;
}

export async function deleteRecord(userId, id) {
  const { rows } = await query(
    `
    DELETE FROM records
    WHERE id = $1 AND user_id = $2
    RETURNING id
    `,
    [id, userId]
  );
  return rows[0] || null;
}

export async function countRecordsByUser(userId) {
  const { rows } = await query(
    `
    SELECT COUNT(*)::int AS total
    FROM records
    WHERE user_id = $1
    `,
    [userId]
  );
  return rows[0]?.total ?? 0;
}

export async function listRecordsAdmin({
  userId,
  queryText,
  type,
  limit = 200,
  offset = 0,
} = {}) {
  const where = [];
  const params = [];
  let i = 1;

  if (userId) {
    where.push(`user_id = $${i++}`);
    params.push(userId);
  }

  if (type) {
    where.push(`type = $${i++}`);
    params.push(type);
  }

  if (queryText) {
    const like = `%${queryText.toLowerCase()}%`;
    where.push(
      `(lower(users.full_name) LIKE $${i} OR lower(users.username) LIKE $${i} OR lower(users.email) LIKE $${i})`
    );
    params.push(like);
    i += 1;
  }

  params.push(limit);
  params.push(offset);

  const { rows } = await query(
    `
    SELECT
      records.*,
      users.full_name,
      users.username,
      users.email,
      COALESCE(users.full_name, users.username, users.email) AS user_name
    FROM records
    JOIN users ON users.id = records.user_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY date DESC, created_at DESC
    LIMIT $${i++} OFFSET $${i++}
    `,
    params
  );

  return rows;
}

export async function getRecordByIdAdmin(id) {
  const { rows } = await query(
    `
    SELECT *
    FROM records
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function updateRecordAdmin(id, changes = {}) {
  const allowed = {
    type: "type",
    amount: "amount",
    category: "category",
    note: "note",
    linkedReceiptId: "linked_receipt_id",
  };

  const sets = [];
  const values = [];
  let i = 1;

  for (const [key, col] of Object.entries(allowed)) {
    if (changes[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      values.push(changes[key]);
    }
  }

  if (changes.date !== undefined) {
    const dt = changes.date ? new Date(changes.date) : new Date();
    const utcNoon = new Date(
      Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 12, 0, 0)
    );
    sets.push(`date = $${i++}`);
    values.push(utcNoon.toISOString());
  }

  if (sets.length === 0) return getRecordByIdAdmin(id);

  values.push(id);

  const { rows } = await query(
    `
    UPDATE records
    SET ${sets.join(", ")},
        updated_at = now()
    WHERE id = $${i++}
    RETURNING *
    `,
    values
  );

  return rows[0] || null;
}

export async function deleteRecordAdmin(id) {
  const { rows } = await query(
    `
    DELETE FROM records
    WHERE id = $1
    RETURNING id
    `,
    [id]
  );
  return rows[0] || null;
}
