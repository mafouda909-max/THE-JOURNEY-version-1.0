import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isContactStatus,
  canTransitionContact,
  CONTACT_STATUSES,
} from "../src/lib/contact-state";

test("isContactStatus validates the known statuses", () => {
  for (const s of CONTACT_STATUSES) assert.equal(isContactStatus(s), true);
  assert.equal(isContactStatus("deleted"), false);
  assert.equal(isContactStatus(""), false);
});

test("legal transitions are allowed", () => {
  assert.equal(canTransitionContact("new", "viewed"), true);
  assert.equal(canTransitionContact("new", "responded"), true);
  assert.equal(canTransitionContact("new", "closed"), true);
  assert.equal(canTransitionContact("viewed", "responded"), true);
  assert.equal(canTransitionContact("viewed", "closed"), true);
  assert.equal(canTransitionContact("responded", "closed"), true);
});

test("illegal transitions are rejected", () => {
  assert.equal(canTransitionContact("closed", "new"), false);
  assert.equal(canTransitionContact("responded", "viewed"), false);
  assert.equal(canTransitionContact("new", "new"), false);
  assert.equal(canTransitionContact("viewed", "new"), false);
  assert.equal(canTransitionContact("unknown", "closed"), false);
  assert.equal(canTransitionContact("closed", "unknown"), false);
});
