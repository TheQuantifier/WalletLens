import test from "node:test";
import assert from "node:assert/strict";

import { validatePublicSupportPayload } from "../controllers/support.controller.js";

test("validatePublicSupportPayload accepts valid payload", () => {
  const result = validatePublicSupportPayload({
    name: "Jane Doe",
    email: "jane@example.com",
    subject: "Need help",
    message: "I cannot upload a receipt.",
    website: "",
  });
  assert.equal(result.ok, true);
  assert.equal(result.email, "jane@example.com");
});

test("validatePublicSupportPayload rejects honeypot spam", () => {
  const result = validatePublicSupportPayload({
    name: "Jane Doe",
    email: "jane@example.com",
    subject: "Spam",
    message: "Spam",
    website: "https://spam.example",
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /Invalid request/i);
});

test("validatePublicSupportPayload rejects bad email", () => {
  const result = validatePublicSupportPayload({
    name: "Jane Doe",
    email: "jane_at_example.com",
    subject: "Need help",
    message: "Issue",
    website: "",
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /valid email/i);
});
