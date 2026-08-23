// src/controllers/activity.controller.js
import asyncHandler from "../middleware/async.js";
import { listActivityForUser } from "../models/activity.model.js";

export const getRecent = asyncHandler(async (req, res) => {
  const requestedLimit = Number.parseInt(String(req.query.limit || "20"), 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, requestedLimit))
    : 20;
  const rows = await listActivityForUser(req.user.id, {
    limit,
  });
  res.json(rows);
});
