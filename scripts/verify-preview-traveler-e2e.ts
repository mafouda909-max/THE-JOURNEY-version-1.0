import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { buildPoolConfig, pool } from "../src/db";
import { passwordAuthPost, passwordAuthReadiness } from "../src/lib/password-auth";
import { selectDatabaseUrl } from "../src/lib/database-environment";
import { validatePasswordPilotDatabaseIdentity } from "../src/lib/password-pilot-preparation";
import { GET as listTravelerIntents, POST as createTravelerIntent } from "../src/app/api/traveler/intents/route";
import { SITE_ORIGIN } from "../src/lib/site";

function sessionCookie(response: Response): string {
  const header = response.headers.get("set-cookie");
  assert.ok(header, "Preview traveler signup must issue a session cookie.");
  return header.split(";")[0]!;
}

async function main() {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.SILA_PREVIEW_TRAVELER_E2E_VERIFY_ENABLED !== "true"
  ) {
    return;
  }

  assert.equal(process.env.TRAVELER_WORKSPACE_ENABLED, "true", "Traveler Workspace must be enabled in Preview QA.");
  assert.equal(process.env.PASSWORD_AUTH_ENABLED, "true", "Password auth must be enabled in Preview QA.");

  const connectionString = selectDatabaseUrl();
  const parsed = new URL(connectionString);
  assert.ok(parsed.hostname.endsWith(".neon.tech"), "Preview traveler E2E requires managed Neon.");

  const client = new Client(buildPoolConfig(connectionString));
  const suffix = randomUUID();
  const email = `preview-traveler-${suffix}@example.invalid`;
  const password = "Preview SILA traveler phrase 2026 # safe";
  let accountId: number | null = null;

  await client.connect();
  try {
    const identity = await client.query(
      "SELECT current_setting('neon.project_id', true) AS project, current_setting('neon.branch_id', true) AS branch",
    );
    validatePasswordPilotDatabaseIdentity({
      projectId: String(identity.rows[0]?.project ?? ""),
      branchId: String(identity.rows[0]?.branch ?? ""),
    });

    assert.equal(await passwordAuthReadiness.probe(), true, "Password schema must be ready before Preview E2E.");

    const signup = await passwordAuthPost(
      new Request(`${SITE_ORIGIN}/api/auth/signup`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
          "sec-fetch-site": "same-origin",
          "x-forwarded-for": "127.0.2.102",
        },
        body: JSON.stringify({
          email,
          password,
          role: "traveler",
          name: "SILA Preview QA Traveler",
          city: "Cairo",
        }),
      }),
      "signup",
    );
    assert.equal(signup.status, 201, "Preview traveler signup must succeed.");
    const signupBody = await signup.clone().json() as {
      ok?: boolean;
      role?: string;
      emailVerified?: boolean;
      destination?: string;
    };
    assert.deepEqual(signupBody, {
      ok: true,
      role: "traveler",
      emailVerified: false,
      destination: "/account",
    });

    const account = await client.query("SELECT id,role,agent_id FROM accounts WHERE lower(email)=lower($1)", [email]);
    assert.equal(account.rowCount, 1);
    accountId = Number(account.rows[0]!.id);
    assert.equal(account.rows[0]!.role, "traveler");
    assert.equal(account.rows[0]!.agent_id, null);

    const cookie = sessionCookie(signup);
    const unauthorized = await listTravelerIntents(new Request(`${SITE_ORIGIN}/api/traveler/intents`));
    assert.equal(unauthorized.status, 401, "Traveler intent API must remain owner-gated.");

    const created = await createTravelerIntent(
      new Request(`${SITE_ORIGIN}/api/traveler/intents`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE_ORIGIN,
          "sec-fetch-site": "same-origin",
          cookie,
        },
        body: JSON.stringify({
          label: "QA · Istanbul decision context",
          intent: {
            originCity: "Cairo",
            destinations: ["Istanbul"],
            travelers: { adults: 1, children: 0, infants: 0 },
            tripType: "tourism",
            priorities: [],
            constraints: [],
          },
        }),
      }),
    );
    assert.equal(created.status, 201, "Authenticated traveler must be able to save an intent.");
    const createdBody = await created.json() as {
      intent?: { id?: number; accountId?: number; label?: string; status?: string };
    };
    assert.ok(createdBody.intent?.id);
    assert.equal(createdBody.intent?.accountId, accountId);
    assert.equal(createdBody.intent?.label, "QA · Istanbul decision context");
    assert.equal(createdBody.intent?.status, "active");

    const listed = await listTravelerIntents(
      new Request(`${SITE_ORIGIN}/api/traveler/intents`, { headers: { cookie } }),
    );
    assert.equal(listed.status, 200);
    const listedBody = await listed.json() as { intents?: Array<{ id: number; accountId: number }> };
    const owned = listedBody.intents?.find((intent) => intent.id === createdBody.intent?.id);
    assert.ok(owned, "Saved Preview traveler intent must be readable in the same session.");
    assert.equal(owned.accountId, accountId);

    console.log("Preview traveler signup + owned intent E2E verification completed; synthetic QA data cleaned.");
  } finally {
    try {
      if (accountId !== null) {
        await client.query(
          "DELETE FROM traveler_intent_inquiries WHERE saved_intent_id IN (SELECT id FROM traveler_saved_intents WHERE account_id=$1)",
          [accountId],
        );
        await client.query(
          "DELETE FROM traveler_intent_offers WHERE saved_intent_id IN (SELECT id FROM traveler_saved_intents WHERE account_id=$1)",
          [accountId],
        );
        await client.query("DELETE FROM traveler_saved_intents WHERE account_id=$1", [accountId]);
        await client.query("DELETE FROM auth_password_recovery WHERE account_id=$1", [accountId]);
        await client.query("DELETE FROM sessions WHERE account_id=$1", [accountId]);
        await client.query("DELETE FROM accounts WHERE id=$1", [accountId]);
      }
    } finally {
      await client.end();
      await pool.end().catch(() => undefined);
    }
  }
}

main().catch(() => {
  // Never print database/provider errors: they may contain secrets or user values.
  console.error("Preview traveler E2E verification failed. Release remains blocked.");
  process.exitCode = 1;
});
