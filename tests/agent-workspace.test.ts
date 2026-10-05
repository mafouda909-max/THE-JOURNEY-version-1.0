import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agentVerificationState,
  profilePreparation,
  type AgentProfile,
} from "../src/lib/agent-workspace";
import { accountAction } from "../src/lib/account-action";

test("profile preparation does not treat signup placeholders as a completed location", () => {
  const initial: AgentProfile = {
    id: 1,
    displayName: "وكيل جديد",
    latinName: "New Agent",
    bio: "",
    city: "—",
    country: "—",
    licenseType: "individual",
    licenseNumber: null,
    verificationStatus: "pending",
  };
  const preparation = profilePreparation(initial);
  assert.equal(
    preparation.checks.find((item) => item.label === "الدولة والمدينة")?.done,
    false,
  );
  assert.equal(preparation.completed, 2);
  const prepared = {
    ...initial,
    city: "القاهرة",
    country: "مصر",
    bio: "نبذة مهنية مفصلة عن الخدمات والمناطق التي يعمل فيها الوكيل.",
  };
  assert.equal(profilePreparation(prepared).completed, 4);
  assert.equal(prepared.verificationStatus, "pending");
  assert.equal(
    profilePreparation({ ...prepared, licenseType: "agency" }).completed,
    3,
  );
});

test("workspace approval appearance follows actual approval independently of profile completion", () => {
  for (const status of [
    "pending",
    "in_review",
    "rejected",
    "suspended",
    "unknown",
  ])
    assert.notEqual(agentVerificationState(status).tone, "verified");
  assert.equal(agentVerificationState("pending").href, "/account/profile");
  assert.equal(
    agentVerificationState("in_review").href,
    "/account/verification",
  );
  assert.equal(agentVerificationState("verified").href, "/account/offers");
});

test("account actions distinguish server failure and malformed replies from completion", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({ error: "حاول مرة أخرى" }, { status: 503 });
    await assert.rejects(
      accountAction(
        "http://qa.invalid/action",
        { method: "PATCH" },
        "fallback",
      ),
      /حاول مرة أخرى/,
    );
    for (const body of ["not JSON", "null", "[]"]) {
      globalThis.fetch = async () => new Response(body);
      await assert.rejects(
        accountAction(
          "http://qa.invalid/action",
          { method: "PATCH" },
          "fallback",
        ),
        /fallback/,
      );
    }
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal);
      return Response.json({ ok: true });
    };
    assert.deepEqual(
      await accountAction(
        "http://qa.invalid/action",
        { method: "PATCH" },
        "fallback",
      ),
      { ok: true },
    );
  } finally {
    globalThis.fetch = original;
  }
});
