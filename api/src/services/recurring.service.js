const VALID_FREQUENCIES = new Set(["weekly", "biweekly", "monthly", "yearly"]);

export function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = parseDateOnly(value);
  return formatDateOnly(date) === value;
}

export function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function formatDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date, months, preferredDay) {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const targetDay = Math.min(
    Number(preferredDay) || date.getUTCDate(),
    daysInMonth(targetYear, targetMonth)
  );
  return new Date(Date.UTC(targetYear, targetMonth, targetDay, 12, 0, 0));
}

export function advanceOccurrence(date, schedule) {
  const frequency = String(schedule?.frequency || "").toLowerCase();
  const startDate = parseDateOnly(schedule?.startDate ?? schedule?.start_date);
  const preferredDay =
    Number(schedule?.dayOfMonth ?? schedule?.day_of_month) ||
    startDate?.getUTCDate() ||
    date.getUTCDate();

  if (frequency === "weekly") return addDays(date, 7);
  if (frequency === "biweekly") return addDays(date, 14);
  if (frequency === "monthly") return addMonths(date, 1, preferredDay);
  if (frequency === "yearly") return addMonths(date, 12, preferredDay);
  throw new Error(`Unsupported recurring frequency: ${frequency}`);
}

export function getOccurrenceDatesInRange(schedule, { from, to, limit = 100 } = {}) {
  const frequency = String(schedule?.frequency || "").toLowerCase();
  if (!VALID_FREQUENCIES.has(frequency)) return [];

  const startDate = parseDateOnly(schedule?.startDate ?? schedule?.start_date);
  const endDate = parseDateOnly(schedule?.endDate ?? schedule?.end_date);
  const fromDate = parseDateOnly(from || formatDateOnly(new Date()));
  const toDate = parseDateOnly(to || from || formatDateOnly(new Date()));

  if (!startDate || !fromDate || !toDate || startDate > toDate || limit <= 0) return [];

  const dates = [];
  let cursor = startDate;
  let guard = 0;

  while (cursor && cursor <= toDate && guard < 1000 && dates.length < limit) {
    if (cursor >= fromDate && (!endDate || cursor <= endDate)) {
      dates.push(formatDateOnly(cursor));
    }
    if (endDate && cursor >= endDate) break;
    cursor = advanceOccurrence(cursor, schedule);
    guard += 1;
  }

  return dates;
}

export function getNextOccurrenceDate(schedule, { from = formatDateOnly(new Date()) } = {}) {
  const frequency = String(schedule?.frequency || "").toLowerCase();
  if (!VALID_FREQUENCIES.has(frequency)) return null;

  const startDate = parseDateOnly(schedule?.startDate ?? schedule?.start_date);
  const endDate = parseDateOnly(schedule?.endDate ?? schedule?.end_date);
  const fromDate = parseDateOnly(from);
  if (!startDate || !fromDate) return null;
  if (endDate && endDate < fromDate) return null;

  let cursor = startDate;
  let guard = 0;

  while (cursor && guard < 5000) {
    if (cursor >= fromDate && (!endDate || cursor <= endDate)) {
      return formatDateOnly(cursor);
    }
    if (endDate && cursor >= endDate) return null;
    cursor = advanceOccurrence(cursor, schedule);
    guard += 1;
  }

  return null;
}

export function normalizeRecurringPayload(input = {}, { partial = false } = {}) {
  const out = {};

  if (!partial || input.name !== undefined) out.name = String(input.name || "").trim();
  if (!partial || input.type !== undefined) out.type = String(input.type || "").trim().toLowerCase();
  if (!partial || input.amount !== undefined) out.amount = Number(input.amount);
  if (!partial || input.category !== undefined) out.category = String(input.category || "").trim();
  if (!partial || input.note !== undefined) out.note = String(input.note || "").trim();
  if (!partial || input.frequency !== undefined) {
    out.frequency = String(input.frequency || "").trim().toLowerCase();
  }
  if (!partial || input.dayOfMonth !== undefined || input.day_of_month !== undefined) {
    const raw = input.dayOfMonth ?? input.day_of_month;
    out.dayOfMonth =
      raw === null || raw === "" || raw === undefined ? null : Number.parseInt(String(raw), 10);
  }
  if (!partial || input.startDate !== undefined || input.start_date !== undefined) {
    out.startDate = String(input.startDate ?? input.start_date ?? "").trim();
  }
  if (!partial || input.endDate !== undefined || input.end_date !== undefined) {
    const raw = input.endDate ?? input.end_date;
    out.endDate = raw === null || raw === "" || raw === undefined ? null : String(raw).trim();
  }
  if (!partial || input.active !== undefined) out.active = Boolean(input.active);

  return out;
}

export function validateRecurringPayload(payload, { partial = false } = {}) {
  if (!partial || payload.name !== undefined) {
    if (!payload.name) return "Name is required";
  }

  if (!partial || payload.type !== undefined) {
    if (!["income", "expense"].includes(payload.type)) return "Type must be income or expense";
  }

  if (!partial || payload.amount !== undefined) {
    if (!Number.isFinite(payload.amount) || payload.amount < 0) {
      return "Amount must be a number greater than or equal to 0";
    }
  }

  if (!partial || payload.category !== undefined) {
    if (!payload.category) return "Category is required";
  }

  if (!partial || payload.frequency !== undefined) {
    if (!VALID_FREQUENCIES.has(payload.frequency)) {
      return "Frequency must be weekly, biweekly, monthly, or yearly";
    }
  }

  if (!partial || payload.dayOfMonth !== undefined) {
    if (
      payload.dayOfMonth !== null &&
      (!Number.isInteger(payload.dayOfMonth) ||
        payload.dayOfMonth < 1 ||
        payload.dayOfMonth > 31)
    ) {
      return "Day of month must be between 1 and 31";
    }
  }

  if (!partial || payload.startDate !== undefined) {
    if (!payload.startDate || !isValidDateOnly(payload.startDate)) {
      return "Start date must use YYYY-MM-DD";
    }
  }

  if (!partial || payload.endDate !== undefined) {
    if (payload.endDate !== null && !isValidDateOnly(payload.endDate)) {
      return "End date must use YYYY-MM-DD";
    }
  }

  const startDate = payload.startDate ? parseDateOnly(payload.startDate) : null;
  const endDate = payload.endDate ? parseDateOnly(payload.endDate) : null;
  if (startDate && endDate && endDate < startDate) {
    return "End date must be on or after start date";
  }

  return null;
}

export function serializeRecurringSchedule(row) {
  const schedule = {
    id: row.id,
    name: row.name,
    type: row.type,
    amount: Number(row.amount || 0),
    category: row.category,
    note: row.note || "",
    frequency: row.frequency,
    dayOfMonth: row.day_of_month,
    startDate: formatDateOnly(row.start_date),
    endDate: formatDateOnly(row.end_date),
    active: row.active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  schedule.nextRun =
    schedule.active === false ? null : getNextOccurrenceDate(schedule);

  return schedule;
}

export function buildUpcomingOccurrences(rows, { from, to, limit = 100 } = {}) {
  const items = [];

  rows.forEach((row) => {
    const schedule = serializeRecurringSchedule(row);
    if (!schedule.active) return;

    const dates = getOccurrenceDatesInRange(schedule, { from, to, limit });
    dates.forEach((date) => {
      items.push({
        id: `${schedule.id}:${date}`,
        scheduleId: schedule.id,
        name: schedule.name,
        type: schedule.type,
        amount: schedule.amount,
        category: schedule.category,
        note: schedule.note,
        frequency: schedule.frequency,
        date,
        nextRun: date,
      });
    });
  });

  items.sort((a, b) => {
    if (a.date === b.date) return a.name.localeCompare(b.name);
    return a.date.localeCompare(b.date);
  });

  return items.slice(0, Math.max(0, limit));
}
