import asyncHandler from "../middleware/async.js";
import {
  createRecurringSchedule,
  deleteRecurringSchedule,
  getRecurringScheduleById,
  listRecurringSchedules,
  updateRecurringSchedule,
} from "../models/recurring.model.js";
import {
  buildUpcomingOccurrences,
  formatDateOnly,
  normalizeRecurringPayload,
  serializeRecurringSchedule,
  validateRecurringPayload,
} from "../services/recurring.service.js";

export const list = asyncHandler(async (req, res) => {
  const active =
    req.query.active === undefined ? undefined : String(req.query.active) === "true";
  const rows = await listRecurringSchedules(req.user.id, { active });
  res.json(rows.map(serializeRecurringSchedule));
});

export const create = asyncHandler(async (req, res) => {
  const payload = normalizeRecurringPayload(req.body);
  const validationError = validateRecurringPayload(payload);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const row = await createRecurringSchedule(req.user.id, payload);
  res.status(201).json(serializeRecurringSchedule(row));
});

export const update = asyncHandler(async (req, res) => {
  const existing = await getRecurringScheduleById(req.user.id, req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Recurring schedule not found" });
  }

  const payload = normalizeRecurringPayload(req.body, { partial: true });
  const merged = {
    ...serializeRecurringSchedule(existing),
    ...payload,
  };
  const validationError = validateRecurringPayload(merged);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const row = await updateRecurringSchedule(req.user.id, req.params.id, payload);
  res.json(serializeRecurringSchedule(row));
});

export const remove = asyncHandler(async (req, res) => {
  const deleted = await deleteRecurringSchedule(req.user.id, req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: "Recurring schedule not found" });
  }
  res.json({ message: "Recurring schedule deleted" });
});

export const upcoming = asyncHandler(async (req, res) => {
  const parsedDays = Number.parseInt(String(req.query.days ?? "30"), 10);
  const days = Number.isFinite(parsedDays) ? Math.min(Math.max(parsedDays, 1), 365) : 30;
  const from = formatDateOnly(new Date());
  const to = formatDateOnly(new Date(Date.now() + (days - 1) * 24 * 60 * 60 * 1000));

  const rows = await listRecurringSchedules(req.user.id, { active: true });
  const items = buildUpcomingOccurrences(rows, { from, to, limit: 250 });
  res.json(items);
});
