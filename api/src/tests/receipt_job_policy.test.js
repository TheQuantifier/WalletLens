import test from "node:test";
import assert from "node:assert/strict";

import { computeRetryDecision } from "../models/receipt_job.model.js";

test("computeRetryDecision queues when attempts are below max", () => {
  assert.equal(computeRetryDecision({ attempts: 1, maxAttempts: 3 }), "queued");
});

test("computeRetryDecision fails when attempts reach max", () => {
  assert.equal(computeRetryDecision({ attempts: 3, maxAttempts: 3 }), "failed");
});

test("computeRetryDecision handles invalid numbers safely", () => {
  assert.equal(computeRetryDecision({ attempts: "bad", maxAttempts: 2 }), "queued");
  assert.equal(computeRetryDecision({ attempts: 2, maxAttempts: "bad" }), "failed");
});
