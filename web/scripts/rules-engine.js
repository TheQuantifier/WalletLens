const RULES_STORAGE_KEY = "rules_v1";

const normalizeText = (value) => String(value || "").toLowerCase().trim();

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const matchString = (fieldValue, op, expected) => {
  const hay = normalizeText(fieldValue);
  const needle = normalizeText(expected);
  if (!needle) return true;
  switch (op) {
    case "equals":
      return hay === needle;
    case "starts_with":
      return hay.startsWith(needle);
    case "ends_with":
      return hay.endsWith(needle);
    case "contains":
    default:
      return hay.includes(needle);
  }
};

const matchNumber = (fieldValue, op, expected) => {
  const actual = toNumber(fieldValue);
  if (actual === null) return false;
  if (op === "between") {
    const min = toNumber(expected?.min);
    const max = toNumber(expected?.max);
    if (min !== null && actual < min) return false;
    if (max !== null && actual > max) return false;
    return true;
  }
  if (op === "gte") return actual >= toNumber(expected);
  if (op === "lte") return actual <= toNumber(expected);
  if (op === "gt") return actual > toNumber(expected);
  if (op === "lt") return actual < toNumber(expected);
  return false;
};

const matchCondition = (record, cond) => {
  if (!cond || !cond.field) return false;
  const value = cond.value;
  switch (cond.field) {
    case "type":
    case "category":
    case "note":
    case "origin":
      return matchString(record[cond.field], cond.op || "contains", value);
    case "amount":
      return matchNumber(record.amount, cond.op || "between", value);
    default:
      return false;
  }
};

export const loadRules = () => {
  const raw = localStorage.getItem(RULES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveRules = (rules) => {
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules || []));
};

export const applyRulesToRecord = (record, rules, context = {}) => {
  const base = { ...(record || {}) };
  const origin =
    context.origin ||
    record?.origin ||
    (record?.linkedReceiptId || record?.linked_receipt_id
      ? "receipt"
      : record?.linkedRecurringId || record?.linked_recurring_id
        ? "recurring"
        : record?.linkedPlaidAccountId || record?.linked_plaid_account_id
          ? "plaid"
        : "manual");

  const candidate = {
    ...base,
    origin,
    note: base.note || "",
    category: base.category || "",
    type: base.type || "",
  };

  const sorted = (rules || [])
    .filter((r) => r && r.enabled !== false)
    .sort((a, b) => Number(b?.priority || 0) - Number(a?.priority || 0));

  for (const rule of sorted) {
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    const matches = conditions.every((c) => matchCondition(candidate, c));
    if (!matches) continue;

    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    actions.forEach((action) => {
      if (!action || !action.type) return;
      if (action.type === "setCategory" && action.value) {
        candidate.category = action.value;
      }
      if (action.type === "setType" && action.value) {
        candidate.type = action.value;
      }
      if (action.type === "appendNote" && action.value) {
        const tag = String(action.value).trim();
        if (!tag) return;
        const note = String(candidate.note || "").trim();
        candidate.note = note ? `${note} ${tag}` : tag;
      }
      if (action.type === "setNote" && action.value) {
        candidate.note = String(action.value);
      }
    });

    if (rule.applyMode === "first") break;
  }

  return candidate;
};

export const summarizeRule = (rule) => {
  if (!rule) return "";
  const parts = [];
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  const actions = Array.isArray(rule.actions) ? rule.actions : [];

  if (conditions.length) {
    const condText = conditions.map((c) => {
      if (c.field === "amount") {
        const min = c.value?.min ?? "";
        const max = c.value?.max ?? "";
        if (c.op === "between") return `amount ${min || "−∞"} to ${max || "∞"}`;
        return `amount ${c.op} ${c.value}`;
      }
      return `${c.field} ${c.op} ${c.value}`;
    });
    parts.push(`If ${condText.join(" and ")}`);
  }

  if (actions.length) {
    const actText = actions.map((a) => {
      if (a.type === "setCategory") return `set category to ${a.value}`;
      if (a.type === "setType") return `set type to ${a.value}`;
      if (a.type === "appendNote") return `add tag ${a.value}`;
      if (a.type === "setNote") return `set note`;
      return a.type;
    });
    parts.push(`then ${actText.join(", ")}`);
  }

  return parts.join(". ");
};
