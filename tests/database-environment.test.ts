import assert from "node:assert/strict";
import { test } from "node:test";
import { databaseIdentity, selectDatabaseUrl } from "../src/lib/database-environment";

const production = "postgresql://prod:private@ep-production.neon.tech/neondb?sslmode=require";
const preview = "postgresql://preview:private@ep-preview-pooler.neon.tech/neondb?sslmode=require";

test("production and local runs retain their ordinary database configuration", () => {
  assert.equal(selectDatabaseUrl({ DATABASE_URL: production, SILA_PREVIEW_DATABASE_URL: preview, VERCEL_ENV: "production" }), production);
  assert.equal(selectDatabaseUrl({ POSTGRES_URL: production }), production);
  assert.throws(() => selectDatabaseUrl({}), /required/);
});
test("Vercel previews require an explicit isolated database instead of inheriting production", () => {
  assert.throws(() => selectDatabaseUrl({ DATABASE_URL: production, VERCEL_ENV: "preview" }), /isolation is not configured/);
  assert.throws(() => selectDatabaseUrl({ DATABASE_URL: production, SILA_PREVIEW_DATABASE_URL: production, VERCEL_ENV: "preview" }), /cannot use/);
  assert.equal(selectDatabaseUrl({ DATABASE_URL: production, SILA_PREVIEW_DATABASE_URL: preview, VERCEL_ENV: "preview" }), preview);
});
test("database identity ignores credentials and normalizes Neon pooler aliases", () => {
  const alternativeRole = "postgres://reader:different@ep-production-pooler.neon.tech:5432/neondb?application_name=preview";
  assert.equal(databaseIdentity(production), databaseIdentity(alternativeRole));
  assert.throws(() => selectDatabaseUrl({ DATABASE_URL: production, SILA_PREVIEW_DATABASE_URL: alternativeRole, VERCEL_ENV: "preview" }), /cannot use/);
  assert.notEqual(databaseIdentity(production), databaseIdentity("postgresql://user:pass@ep-production.neon.tech/isolated_db"));
});
test("preview database configuration rejects invalid protocols and incomplete identities", () => {
  for (const value of ["not-a-url", "https://example.test/db", "postgresql://host.test/"]) {
    assert.throws(() => selectDatabaseUrl({ DATABASE_URL: production, SILA_PREVIEW_DATABASE_URL: value, VERCEL_ENV: "preview" }));
  }
});
