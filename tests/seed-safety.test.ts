import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLocalDatabaseUrl,
  assertSeedCanDestructure,
  SeedDestructionBlockedError,
} from "../src/lib/seed-safety";

test("isLocalDatabaseUrl recognises local hosts", () => {
  assert.equal(isLocalDatabaseUrl("postgres://u:p@localhost:5432/db"), true);
  assert.equal(isLocalDatabaseUrl("postgres://u:p@127.0.0.1:5432/db"), true);
  assert.equal(isLocalDatabaseUrl("postgres://u:p@[::1]:5432/db"), true);
});

test("isLocalDatabaseUrl rejects remote/hosted hosts", () => {
  assert.equal(isLocalDatabaseUrl("postgres://u:p@neon.tech:5432/db"), false);
  assert.equal(isLocalDatabaseUrl("postgres://u:p@db.example.com:5432/db"), false);
  assert.equal(isLocalDatabaseUrl(undefined), false);
  assert.equal(isLocalDatabaseUrl("not-a-url"), false);
});

test("production is always blocked, even with the override flag", () => {
  assert.throws(
    () =>
      assertSeedCanDestructure({
        nodeEnv: "production",
        databaseUrl: "postgres://u:p@neon.tech:5432/db",
        allowDestructiveSeed: "1",
      }),
    SeedDestructionBlockedError,
  );
});

test("remote database is blocked without explicit opt-in", () => {
  assert.throws(
    () =>
      assertSeedCanDestructure({
        nodeEnv: "staging",
        databaseUrl: "postgres://u:p@db.example.com:5432/db",
      }),
    SeedDestructionBlockedError,
  );
});

test("local development database is permitted", () => {
  assert.doesNotThrow(() =>
    assertSeedCanDestructure({
      nodeEnv: "development",
      databaseUrl: "postgres://u:p@localhost:5432/db",
    }),
  );
});

test("remote staging with explicit opt-in is permitted", () => {
  assert.doesNotThrow(() =>
    assertSeedCanDestructure({
      nodeEnv: "staging",
      databaseUrl: "postgres://u:p@db.example.com:5432/db",
      allowDestructiveSeed: "1",
    }),
  );
});
