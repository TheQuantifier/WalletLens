import test from "node:test";
import assert from "node:assert/strict";

import { nextReceiptStage } from "../services/receipt_processing.service.js";

test("receipt stages progress in order", () => {
  assert.equal(nextReceiptStage("verifying_upload"), "extracting_text");
  assert.equal(nextReceiptStage("extracting_text"), "parsing_ai");
  assert.equal(nextReceiptStage("parsing_ai"), "updating_records");
  assert.equal(nextReceiptStage("updating_records"), "completed");
});

test("receipt failure transition is terminal", () => {
  assert.equal(nextReceiptStage("parsing_ai", "failed"), "failed");
  assert.equal(nextReceiptStage("failed"), "failed");
  assert.equal(nextReceiptStage("completed"), "completed");
});

test("unknown stages recover to verifying_upload", () => {
  assert.equal(nextReceiptStage("unknown_stage"), "verifying_upload");
});
