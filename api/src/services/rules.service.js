import { listAllRecordsForUser, updateRecord } from "../models/record.model.js";
import { listRulesByUser } from "../models/rule.model.js";

const STRING_FIELDS = new Set(["type", "category", "note", "origin"]);
const STRING_OPS = new Set(["equals", "contains", "starts_with", "ends_with"]);
const AMOUNT_OPS = new Set(["between", "gte", "lte", "gt", "lt"]);
const ACTION_TYPES = new Set(["setCategory", "appendNote", "setType", "setNote"]);
const APPLY_MODES = new Set(["first", "all"]);
const RECORD_TYPES = new Set(["income", "expense"]);
const ORIGINS = new Set(["manual", "receipt"]);

const normalizeText = (value) => String(value || "").trim();
const normalizeTextLower = (value) => normalizeText(value).toLowerCase();
const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export function validateRulePayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, message: "Rule payload must be an object." };
  }

  const normalized = {};

  if (payload.name !== undefined) {
    const name = normalizeText(payload.name);
    if (!name) {
      return { ok: false, message: "Rule name is required." };
    }
    normalized.name = name;
  } else if (!partial) {
    return { ok: false, message: "Rule name is required." };
  }

  if (payload.enabled !== undefined) {
    if (typeof payload.enabled !== "boolean") {
      return { ok: false, message: "enabled must be a boolean." };
    }
    normalized.enabled = payload.enabled;
  } else if (!partial) {
    normalized.enabled = true;
  }

  if (payload.priority !== undefined) {
    const priority = Number.parseInt(String(payload.priority), 10);
    if (!Number.isFinite(priority)) {
      return { ok: false, message: "priority must be an integer." };
    }
    normalized.priority = priority;
  } else if (!partial) {
    normalized.priority = 100;
  }

  if (payload.applyMode !== undefined) {
    const applyMode = String(payload.applyMode || "").trim();
    if (!APPLY_MODES.has(applyMode)) {
      return { ok: false, message: "applyMode must be 'first' or 'all'." };
    }
    normalized.applyMode = applyMode;
  } else if (!partial) {
    normalized.applyMode = "first";
  }

  if (payload.conditions !== undefined) {
    const conditions = normalizeConditions(payload.conditions);
    if (!conditions.ok) return conditions;
    normalized.conditions = conditions.value;
  } else if (!partial) {
    return { ok: false, message: "At least one condition is required." };
  }

  if (payload.actions !== undefined) {
    const actions = normalizeActions(payload.actions);
    if (!actions.ok) return actions;
    normalized.actions = actions.value;
  } else if (!partial) {
    return { ok: false, message: "At least one action is required." };
  }

  return { ok: true, value: normalized };
}

function normalizeConditions(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, message: "At least one condition is required." };
  }

  const conditions = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, message: "Each condition must be an object." };
    }

    const field = String(raw.field || "").trim();
    const op = String(raw.op || "").trim();

    if (field === "amount") {
      if (!AMOUNT_OPS.has(op)) {
        return { ok: false, message: "Invalid amount condition operator." };
      }

      if (op === "between") {
        const min = raw.value?.min === "" || raw.value?.min === undefined
          ? null
          : toFiniteNumber(raw.value?.min);
        const max = raw.value?.max === "" || raw.value?.max === undefined
          ? null
          : toFiniteNumber(raw.value?.max);
        if (min === null && max === null) {
          return { ok: false, message: "Amount range must include a min or max." };
        }
        if (min !== null && min < 0) {
          return { ok: false, message: "Amount range min must be 0 or greater." };
        }
        if (max !== null && max < 0) {
          return { ok: false, message: "Amount range max must be 0 or greater." };
        }
        conditions.push({
          field,
          op,
          value: {
            ...(min !== null ? { min } : {}),
            ...(max !== null ? { max } : {}),
          },
        });
        continue;
      }

      const value = toFiniteNumber(raw.value);
      if (value === null || value < 0) {
        return { ok: false, message: "Amount condition value must be a number >= 0." };
      }
      conditions.push({ field, op, value });
      continue;
    }

    if (!STRING_FIELDS.has(field)) {
      return { ok: false, message: "Invalid condition field." };
    }
    if (!STRING_OPS.has(op)) {
      return { ok: false, message: "Invalid string condition operator." };
    }

    const value = normalizeText(raw.value);
    if (!value) {
      return { ok: false, message: "Condition value is required." };
    }
    if (field === "type" && !RECORD_TYPES.has(value)) {
      return { ok: false, message: "type condition must be income or expense." };
    }
    if (field === "origin" && !ORIGINS.has(value)) {
      return { ok: false, message: "origin condition must be manual or receipt." };
    }

    conditions.push({ field, op, value });
  }

  return { ok: true, value: conditions };
}

function normalizeActions(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, message: "At least one action is required." };
  }

  const actions = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, message: "Each action must be an object." };
    }

    const type = String(raw.type || "").trim();
    if (!ACTION_TYPES.has(type)) {
      return { ok: false, message: "Invalid action type." };
    }

    if (type === "setType") {
      const value = normalizeText(raw.value);
      if (!RECORD_TYPES.has(value)) {
        return { ok: false, message: "setType value must be income or expense." };
      }
      actions.push({ type, value });
      continue;
    }

    const value = normalizeText(raw.value);
    if (!value) {
      return { ok: false, message: "Action value is required." };
    }
    actions.push({ type, value });
  }

  return { ok: true, value: actions };
}

function matchString(fieldValue, op, expected) {
  const haystack = normalizeTextLower(fieldValue);
  const needle = normalizeTextLower(expected);
  if (!needle) return true;

  switch (op) {
    case "equals":
      return haystack === needle;
    case "starts_with":
      return haystack.startsWith(needle);
    case "ends_with":
      return haystack.endsWith(needle);
    case "contains":
    default:
      return haystack.includes(needle);
  }
}

function matchNumber(fieldValue, op, expected) {
  const actual = toFiniteNumber(fieldValue);
  if (actual === null) return false;

  if (op === "between") {
    const min = toFiniteNumber(expected?.min);
    const max = toFiniteNumber(expected?.max);
    if (min !== null && actual < min) return false;
    if (max !== null && actual > max) return false;
    return true;
  }

  const target = toFiniteNumber(expected);
  if (target === null) return false;
  if (op === "gte") return actual >= target;
  if (op === "lte") return actual <= target;
  if (op === "gt") return actual > target;
  if (op === "lt") return actual < target;
  return false;
}

export function applyRulesToRecord(record, rules, context = {}) {
  const base = { ...(record || {}) };
  const origin =
    context.origin ||
    (base.linkedReceiptId || base.linked_receipt_id ? "receipt" : "manual");

  const candidate = {
    ...base,
    origin,
    note: base.note || "",
    category: base.category || "",
    type: base.type || "",
  };

  const matchedRuleIds = [];
  const activeRules = (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule && rule.enabled !== false)
    .sort((a, b) => {
      const priorityDiff = Number(b?.priority || 0) - Number(a?.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return String(a?.createdAt || a?.created_at || "").localeCompare(
        String(b?.createdAt || b?.created_at || "")
      );
    });

  for (const rule of activeRules) {
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    const matches = conditions.every((condition) =>
      matchCondition(candidate, condition)
    );
    if (!matches) continue;

    matchedRuleIds.push(rule.id);
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    actions.forEach((action) => applyAction(candidate, action));

    if (rule.applyMode === "first") {
      break;
    }
  }

  return { record: candidate, matchedRuleIds };
}

function matchCondition(record, condition) {
  if (!condition?.field) return false;
  if (condition.field === "amount") {
    return matchNumber(record.amount, condition.op || "between", condition.value);
  }
  if (STRING_FIELDS.has(condition.field)) {
    return matchString(record[condition.field], condition.op || "contains", condition.value);
  }
  return false;
}

function applyAction(record, action) {
  if (!action?.type) return;

  if (action.type === "setCategory" && action.value) {
    record.category = action.value;
  }
  if (action.type === "setType" && action.value) {
    record.type = action.value;
  }
  if (action.type === "appendNote" && action.value) {
    const tag = normalizeText(action.value);
    if (!tag) return;
    const note = normalizeText(record.note);
    record.note = note ? `${note} ${tag}` : tag;
  }
  if (action.type === "setNote" && action.value) {
    record.note = String(action.value);
  }
}

export async function applyStoredRulesToRecordInput(userId, record, context = {}) {
  const rules = await listRulesByUser(userId, { enabledOnly: true });
  if (!rules.length) {
    return { record: { ...(record || {}) }, matchedRuleIds: [] };
  }

  return applyRulesToRecord(record, rules, context);
}

export async function bulkApplyRulesForUser(userId) {
  const rules = await listRulesByUser(userId, { enabledOnly: true });
  if (!rules.length) {
    return { updatedCount: 0 };
  }

  const records = await listAllRecordsForUser(userId);
  let updatedCount = 0;

  for (const record of records) {
    const { record: next } = applyRulesToRecord(record, rules, {
      origin: record.linked_receipt_id ? "receipt" : "manual",
    });
    const changes = {};

    if ((record.category || "") !== (next.category || "")) {
      changes.category = next.category || "";
    }
    if ((record.note || "") !== (next.note || "")) {
      changes.note = next.note || "";
    }
    if ((record.type || "") !== (next.type || "")) {
      changes.type = next.type || "";
    }

    if (Object.keys(changes).length === 0) continue;

    await updateRecord(userId, record.id, changes);
    updatedCount += 1;
  }

  return { updatedCount };
}
