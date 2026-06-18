import test from "node:test";
import assert from "node:assert/strict";

import { validateBusinessRegistration } from "../controllers/auth.controller.js";

const validPayload = {
  businessName: "Acme Studio",
  businessEmail: "hello@acme.example",
  adminFullName: "Alex Smith",
  adminEmail: "alex@acme.example",
  password: "password123",
};

test("business registration validation accepts the required fields", () => {
  const result = validateBusinessRegistration(validPayload);
  assert.equal(result.ok, true);
  assert.equal(result.data.businessName, "Acme Studio");
  assert.equal(result.data.adminEmail, "alex@acme.example");
});

test("business registration validation rejects an invalid website", () => {
  const result = validateBusinessRegistration({ ...validPayload, website: "not-a-url" });
  assert.equal(result.ok, false);
  assert.match(result.message, /website/i);
});

test("business registration validation rejects short passwords", () => {
  const result = validateBusinessRegistration({ ...validPayload, password: "short" });
  assert.equal(result.ok, false);
  assert.match(result.message, /8 characters/i);
});
