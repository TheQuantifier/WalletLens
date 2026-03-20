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

export async function upsertNetWorthSnapshot(
  userId,
  { snapshotDate, assetsTotal, liabilitiesTotal, netWorth, currency = "USD" }
) {
  const { rows } = await query(
    `
    insert into net_worth_snapshots
      (user_id, snapshot_date, assets_total, liabilities_total, net_worth, currency)
    values
      ($1, $2, $3, $4, $5, $6)
    on conflict (user_id, snapshot_date)
    do update set
      assets_total = excluded.assets_total,
      liabilities_total = excluded.liabilities_total,
      net_worth = excluded.net_worth,
      currency = excluded.currency,
      updated_at = now()
    returning *
    `,
    [userId, snapshotDate, assetsTotal, liabilitiesTotal, netWorth, currency]
  );
  return rows[0] || null;
}

export async function listNetWorthSnapshots(userId, { days = 365 } = {}) {
  const safeDays = Number.isFinite(Number(days)) ? Math.max(1, Math.min(3650, Number(days))) : 365;
  const { rows } = await query(
    `
    select *
    from net_worth_snapshots
    where user_id = $1
      and snapshot_date >= current_date - ($2::int - 1)
    order by snapshot_date asc
    `,
    [userId, safeDays]
  );
  return rows;
}

export async function deleteNetWorthSnapshotsByUser(userId) {
  const { rowCount } = await query(
    `
    delete from net_worth_snapshots
    where user_id = $1
    `,
    [userId]
  );
  return rowCount || 0;
}
