import asyncHandler from "../middleware/async.js";

import {
  createRule,
  deleteRule,
  getRuleById,
  listRulesByUser,
  updateRule,
} from "../models/rule.model.js";
import {
  bulkApplyRulesForUser,
  validateRulePayload,
} from "../services/rules.service.js";

export const getAll = asyncHandler(async (req, res) => {
  const rules = await listRulesByUser(req.user.id);
  res.json(rules);
});

export const create = asyncHandler(async (req, res) => {
  const validation = validateRulePayload(req.body || {});
  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const rule = await createRule(req.user.id, validation.value);
  res.status(201).json(rule);
});

export const patch = asyncHandler(async (req, res) => {
  const existing = await getRuleById(req.user.id, req.params.id);
  if (!existing) {
    return res.status(404).json({ message: "Rule not found" });
  }

  const validation = validateRulePayload(req.body || {}, { partial: true });
  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const rule = await updateRule(req.user.id, req.params.id, validation.value);
  res.json(rule);
});

export const remove = asyncHandler(async (req, res) => {
  const deleted = await deleteRule(req.user.id, req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: "Rule not found" });
  }

  res.json({ message: "Rule deleted" });
});

export const applyAll = asyncHandler(async (req, res) => {
  const result = await bulkApplyRulesForUser(req.user.id);
  res.json(result);
});
