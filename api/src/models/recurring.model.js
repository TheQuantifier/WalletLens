import { query } from "../config/db.js";

export async function listRecurringSchedules(userId, { active } = {}) {
  const where = ["user_id = $1"];
  const params = [userId];

  if (active !== undefined) {
    where.push(`active = $${params.length + 1}`);
    params.push(Boolean(active));
  }

  const { rows } = await query(
    `
    SELECT *
    FROM recurring_schedules
    WHERE ${where.join(" AND ")}
    ORDER BY active DESC, created_at DESC
    `,
    params
  );

  return rows;
}

export async function getRecurringScheduleById(userId, id) {
  const { rows } = await query(
    `
    SELECT *
    FROM recurring_schedules
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [id, userId]
  );
  return rows[0] || null;
}

export async function createRecurringSchedule(userId, data) {
  const { rows } = await query(
    `
    INSERT INTO recurring_schedules (
      user_id,
      name,
      type,
      amount,
      category,
      note,
      frequency,
      day_of_month,
      start_date,
      end_date,
      active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
    `,
    [
      userId,
      data.name,
      data.type,
      data.amount,
      data.category,
      data.note ?? "",
      data.frequency,
      data.dayOfMonth ?? null,
      data.startDate,
      data.endDate ?? null,
      data.active !== false,
    ]
  );

  return rows[0];
}

export async function updateRecurringSchedule(userId, id, changes = {}) {
  const allowed = {
    name: "name",
    type: "type",
    amount: "amount",
    category: "category",
    note: "note",
    frequency: "frequency",
    dayOfMonth: "day_of_month",
    startDate: "start_date",
    endDate: "end_date",
    active: "active",
  };

  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(allowed)) {
    if (changes[key] === undefined) continue;
    sets.push(`${column} = $${params.length + 1}`);
    params.push(changes[key]);
  }

  if (!sets.length) {
    return getRecurringScheduleById(userId, id);
  }

  params.push(id, userId);

  const { rows } = await query(
    `
    UPDATE recurring_schedules
    SET ${sets.join(", ")},
        updated_at = now()
    WHERE id = $${params.length - 1} AND user_id = $${params.length}
    RETURNING *
    `,
    params
  );

  return rows[0] || null;
}

export async function deleteRecurringSchedule(userId, id) {
  const { rows } = await query(
    `
    DELETE FROM recurring_schedules
    WHERE id = $1 AND user_id = $2
    RETURNING id
    `,
    [id, userId]
  );
  return rows[0] || null;
}
