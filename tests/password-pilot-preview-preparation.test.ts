import assert from "node:assert/strict";
import test from "node:test";
import {
  passwordPilotPreparationMode,
  validatePasswordPilotDatabaseIdentity,
} from "../src/lib/password-pilot-preparation";

test("password pilot preparation is independently gated for production and isolated preview", () => {
  assert.equal(passwordPilotPreparationMode({ VERCEL_ENV: "production", PASSWORD_PILOT_PREPARE_ENABLED: "true" }), "production");
  assert.equal(passwordPilotPreparationMode({ VERCEL_ENV: "preview", PASSWORD_PILOT_PREVIEW_PREPARE_ENABLED: "true" }), "preview");
  assert.equal(passwordPilotPreparationMode({ VERCEL_ENV: "preview", PASSWORD_PILOT_PREPARE_ENABLED: "true" }), null);
  assert.equal(passwordPilotPreparationMode({ VERCEL_ENV: "production", PASSWORD_PILOT_PREVIEW_PREPARE_ENABLED: "true" }), null);
  assert.equal(passwordPilotPreparationMode({ VERCEL_ENV: "preview" }), null);
});

test("password pilot preparation rejects unknown and legacy managed database identity", () => {
  assert.throws(
    () => validatePasswordPilotDatabaseIdentity({ projectId: "", branchId: "br-preview" }),
    /unknown/i,
  );
  assert.throws(
    () => validatePasswordPilotDatabaseIdentity({ projectId: "late-mountain-20124572", branchId: "br-preview" }),
    /legacy/i,
  );
  assert.throws(
    () => validatePasswordPilotDatabaseIdentity({ projectId: "owned-project", branchId: "" }),
    /unknown/i,
  );
  assert.doesNotThrow(
    () => validatePasswordPilotDatabaseIdentity({ projectId: "owned-project", branchId: "br-preview" }),
  );
});
