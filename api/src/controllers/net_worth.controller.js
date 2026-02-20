// src/controllers/net_worth.controller.js
import asyncHandler from "../middleware/async.js";
import {
  createNetWorthItem,
  listNetWorthItems,
  updateNetWorthItem,
  deleteNetWorthItem,
} from "../models/net_worth.model.js";

const VALID_TYPES = new Set(["asset", "liability"]);

const parseAmount = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
};

export const list = asyncHandler(async (req, res) => {
  const items = await listNetWorthItems(req.user.id);
  res.json({ items });
});

export const create = asyncHandler(async (req, res) => {
  const { type, name, amount } = req.body || {};
  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ message: "Invalid type. Use asset or liability." });
  }
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return res.status(400).json({ message: "Name is required." });
  }
  const parsedAmount = parseAmount(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number." });
  }

  const item = await createNetWorthItem(req.user.id, {
    type,
    name: trimmed,
    amount: parsedAmount,
  });
  res.status(201).json({ item });
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, amount } = req.body || {};
  const updates = {};

  if (name !== undefined) {
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      return res.status(400).json({ message: "Name cannot be empty." });
    }
    updates.name = trimmed;
  }

  if (amount !== undefined) {
    const parsedAmount = parseAmount(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number." });
    }
    updates.amount = parsedAmount;
  }

  const item = await updateNetWorthItem(req.user.id, id, updates);
  if (!item) {
    return res.status(404).json({ message: "Net worth item not found." });
  }
  res.json({ item });
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const item = await deleteNetWorthItem(req.user.id, id);
  if (!item) {
    return res.status(404).json({ message: "Net worth item not found." });
  }
  res.json({ item });
});
