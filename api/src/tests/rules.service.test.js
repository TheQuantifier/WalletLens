import test from "node:test";
import assert from "node:assert/strict";

import { applyRulesToRecord, validateRulePayload } from "../services/rules.service.js";

test("validateRulePayload normalizes a valid rule", () => {
  const result = validateRulePayload({
    name: " Coffee to Dining ",
    enabled: true,
    priority: "150",
    applyMode: "first",
    conditions: [
      { field: "note", op: "contains", value: "Coffee" },
      { field: "amount", op: "between", value: { min: "3.5", max: "9.5" } },
    ],
    actions: [{ type: "setCategory", value: "Dining" }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Coffee to Dining");
  assert.equal(result.value.priority, 150);
  assert.deepEqual(result.value.conditions[1], {
    field: "amount",
    op: "between",
    value: { min: 3.5, max: 9.5 },
  });
});

test("validateRulePayload rejects empty rule actions", () => {
  const result = validateRulePayload({
    name: "Invalid",
    conditions: [{ field: "type", op: "equals", value: "expense" }],
    actions: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /at least one action/i);
});

test("applyRulesToRecord applies priority order and stops on first-match rules", () => {
  const result = applyRulesToRecord(
    {
      type: "expense",
      amount: 4.75,
      category: "Other",
      note: "Morning coffee",
    },
    [
      {
        id: "low-priority",
        enabled: true,
        priority: 50,
        applyMode: "all",
        conditions: [{ field: "note", op: "contains", value: "coffee" }],
        actions: [{ type: "appendNote", value: "#beverage" }],
      },
      {
        id: "high-priority",
        enabled: true,
        priority: 200,
        applyMode: "first",
        conditions: [{ field: "note", op: "contains", value: "coffee" }],
        actions: [{ type: "setCategory", value: "Dining" }],
      },
    ]
  );

  assert.equal(result.record.category, "Dining");
  assert.equal(result.record.note, "Morning coffee");
  assert.deepEqual(result.matchedRuleIds, ["high-priority"]);
});
