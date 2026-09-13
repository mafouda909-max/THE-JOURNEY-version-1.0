import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  parseMembershipCreateInput,
  parseWorkspaceCreateInput,
  positiveAgencyId,
  sanitizeAgencyEventPayload,
} from "../src/lib/agency-policy";

test("Agency runtime input validation rejects identity and role impersonation fields", () => {
  assert.equal(parseWorkspaceCreateInput({}).ok, true);
  assert.equal(parseWorkspaceCreateInput({ agentId: 99 }).ok, false);
  assert.equal(parseWorkspaceCreateInput({ ownerAccountId: 99 }).ok, false);

  const valid = parseMembershipCreateInput({ accountId: 7, role: "member" });
  assert.equal(valid.ok, true);
  assert.equal(parseMembershipCreateInput({ accountId: 7, role: "owner" }).ok, false);
  assert.equal(parseMembershipCreateInput({ accountId: 7, role: "admin" }).ok, false);
  assert.equal(parseMembershipCreateInput({ accountId: 7, role: "member", actorAccountId: 4 }).ok, false);
  assert.equal(parseMembershipCreateInput({ accountId: 7, role: "member", password: "x" }).ok, false);
  assert.equal(positiveAgencyId("1"), 1);
  for (const value of ["0", "-1", "x", "1.2"]) assert.equal(positiveAgencyId(value), null);
});

test("Agency event payload sanitizer removes secret and direct-contact fields", () => {
  const safe = sanitizeAgencyEventPayload({
    membershipId: 4,
    accountId: 9,
    role: "member",
    password: "do-not-store",
    apiKey: "do-not-store",
    accessToken: "do-not-store",
    email: "private@example.com",
    nested: { phone: "+201234", reason: "added" },
  });
  const serialized = JSON.stringify(safe);
  assert.match(serialized, /membershipId/);
  assert.match(serialized, /reason/);
  assert.doesNotMatch(serialized, /do-not-store|private@example|201234/);
});

test("Agency migration contains DB-enforced ownership, uniqueness, roles and append-only events", () => {
  const migration = readFileSync("db/phase1_agency_foundation.sql", "utf8");
  assert.match(migration, /agency_workspaces/);
  assert.match(migration, /agency_memberships/);
  assert.match(migration, /agency_domain_events/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS agency_memberships_workspace_account_uidx/i);
  assert.match(migration, /CHECK \(role IN \('owner', 'member'\)\)/i);
  assert.match(migration, /REFERENCES accounts\(id\)/i);
  assert.match(migration, /agency_domain_events_append_only/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON agency_domain_events/i);
});

test("Agency events have no client-writable API surface", () => {
  assert.equal(existsSync("src/app/api/agency/events/route.ts"), false);
  const workspaceRoute = readFileSync("src/app/api/agency/workspaces/route.ts", "utf8");
  const membershipRoute = readFileSync("src/app/api/agency/workspaces/[id]/memberships/route.ts", "utf8");
  assert.match(workspaceRoute, /actorAccountId: account\.id/);
  assert.match(membershipRoute, /actorAccountId: account\.id/);
  assert.doesNotMatch(workspaceRoute, /data\.actorAccountId/);
  assert.doesNotMatch(membershipRoute, /parsed\.value\.actorAccountId/);
});
