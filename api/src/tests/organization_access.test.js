import test from "node:test";
import assert from "node:assert/strict";

import { getAccountAccessState } from "../services/account_access.service.js";

test("organization users inherit the organization access expiration", () => {
  const result = getAccountAccessState({
    role: "org_user",
    access_expires_at: new Date(Date.now() + 86_400_000),
    organization_subscription_status: "trial",
    organization_access_expires_at: new Date(Date.now() - 1_000),
  });
  assert.equal(result.isExpired, true);
});

test("active organization subscriptions are available without an expiration", () => {
  const result = getAccountAccessState({
    role: "org_admin",
    organization_subscription_status: "active",
    organization_access_expires_at: null,
  });
  assert.equal(result.isExpired, false);
});

test("suspended organizations block member access", () => {
  const result = getAccountAccessState({
    role: "org_user",
    organization_subscription_status: "suspended",
    organization_access_expires_at: new Date(Date.now() + 86_400_000),
  });
  assert.equal(result.isExpired, true);
});

test("platform administrators remain platform-scoped while an organization is active", () => {
  const result = getAccountAccessState({
    role: "org_user",
    platform_role: "admin",
    organization_subscription_status: "suspended",
    access_expires_at: null,
  });
  assert.equal(result.isExpired, false);
});
