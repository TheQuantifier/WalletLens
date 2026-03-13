import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUpcomingOccurrences,
  getNextOccurrenceDate,
  getOccurrenceDatesInRange,
} from "../services/recurring.service.js";

test("monthly recurrence clamps to last valid day of month", () => {
  const schedule = {
    id: "sched-1",
    name: "Rent",
    type: "expense",
    amount: 1000,
    category: "Housing",
    frequency: "monthly",
    dayOfMonth: 31,
    startDate: "2026-01-31",
    active: true,
  };

  assert.deepEqual(getOccurrenceDatesInRange(schedule, {
    from: "2026-01-01",
    to: "2026-04-30",
  }), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
});

test("yearly recurrence honors leap-day fallback and future next run", () => {
  const schedule = {
    frequency: "yearly",
    dayOfMonth: 29,
    startDate: "2024-02-29",
    endDate: null,
    active: true,
  };

  assert.equal(getNextOccurrenceDate(schedule, { from: "2025-01-01" }), "2025-02-28");
  assert.equal(getNextOccurrenceDate(schedule, { from: "2028-01-01" }), "2028-02-29");
});

test("upcoming occurrences are flattened and sorted across schedules", () => {
  const rows = [
    {
      id: "b",
      name: "Gym",
      type: "expense",
      amount: "25.00",
      category: "Health",
      note: "",
      frequency: "monthly",
      day_of_month: 5,
      start_date: "2026-01-05",
      end_date: null,
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "a",
      name: "Paycheck",
      type: "income",
      amount: "1200.00",
      category: "Salary / Wages",
      note: "",
      frequency: "biweekly",
      day_of_month: null,
      start_date: "2026-01-02",
      end_date: null,
      active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  const items = buildUpcomingOccurrences(rows, {
    from: "2026-01-01",
    to: "2026-01-31",
    limit: 10,
  });

  assert.deepEqual(
    items.map((item) => `${item.date}:${item.name}`),
    [
      "2026-01-02:Paycheck",
      "2026-01-05:Gym",
      "2026-01-16:Paycheck",
      "2026-01-30:Paycheck",
    ]
  );
});
