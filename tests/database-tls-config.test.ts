import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPoolConfig } from "../src/db";

test("remote database connections enforce certificate verification independent of URI sslmode", () => {
  const config = buildPoolConfig(
    "postgresql://user:pass@example.neon.tech/neondb?sslmode=require&sslrootcert=ignored.pem&application_name=journey",
  );

  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(typeof config.connectionString, "string");

  const normalized = new URL(String(config.connectionString));
  assert.equal(normalized.searchParams.has("sslmode"), false);
  assert.equal(normalized.searchParams.has("sslrootcert"), false);
  assert.equal(normalized.searchParams.get("application_name"), "journey");
});

test("local test databases do not force TLS", () => {
  const original = "postgresql://postgres:test@127.0.0.1:5432/journey?application_name=ci";
  const config = buildPoolConfig(original);

  assert.equal(config.ssl, undefined);
  assert.equal(config.connectionString, original);
});
