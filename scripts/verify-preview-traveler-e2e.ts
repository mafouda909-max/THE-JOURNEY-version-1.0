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

let verificationStage = "gate";

async function main() {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.SILA_PREVIEW_TRAVELER_E2E_VERIFY_ENABLED !== "true"
  ) {
    return;
  }

  assert.equal(process.env.TRAVELER_WORKSPACE_ENABLED, "true", "Traveler Workspace must be enabled in Preview QA.");
  assert.equal(process.env.PASSWORD_AUTH_ENABLED, "true", "Password auth must be enabled in Preview QA.");

  verificationStage = "database_selection";
  const connectionString = selectDatabaseUrl();
  const parsed = new URL(connectionString);
  assert.ok(parsed.hostname.endsWith(".neon.tech"), "Preview traveler E2E requires managed Neon.");

  const client = new Client(buildPoolConfig(connectionString));
  const suffix = randomUUID();
  const email = `preview-traveler-${suffix}@example.invalid`;
  const password = "Preview SILA traveler phrase 2026 # safe";
  let accountId: number | null = null;

  verificationStage = "database_connect";
  await client.connect();
  try {
    verificationStage = "identity";
    const identity = await client.query(
      "SELECT current_setting('neon.project_id', true) AS project, current_setting('neon.branch_id', true) AS branch",
    );
    validatePasswordPilotDatabaseIdentity({
      projectId: String(identity.rows[0]?.project ?? ""),
      branchId: String(identity.rows[0]?.branch ?? ""),
    });

    verificationStage = "password_readiness";
    assert.equal(await passwordAuthReadiness.probe(), true, "Password schema must be ready before Preview E2E.");

    verificationStage = "stale_qa_cleanup";
    const staleQaAccounts = await client.query(
      "SELECT id FROM accounts WHERE email LIKE 'preview-traveler-%@example.invalid'",
    );
    for (const row of staleQaAccounts.rows) {
      await cleanupSyntheticTraveler(client, Number(row.id));
    }
    if (staleQaAccounts.rowCount) {
      console.log(`Preview traveler E2E removed ${staleQaAccounts.rowCount} stale synthetic QA account(s).`);
    }

    verificationStage = "signup";
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
    verificationStage = `signup_status_${signup.status}`;
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
      destination: "/account/travel",
    });

    verificationStage = "account_proof";
    const account = await client.query("SELECT id,role,agent_id FROM accounts WHERE lower(email)=lower($1)", [email]);
    assert.equal(account.rowCount, 1);
    accountId = Number(account.rows[0]!.id);
    assert.equal(account.rows[0]!.role, "traveler");
    assert.equal(account.rows[0]!.agent_id, null);

    verificationStage = "ownership_gate";
    const cookie = sessionCookie(signup);
    const unauthorized = await listTravelerIntents(new Request(`${SITE_ORIGIN}/api/traveler/intents`));
    assert.equal(unauthorized.status, 401, "Traveler intent API must remain owner-gated.");

    verificationStage = "intent_create";
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

    verificationStage = "intent_read";
    const listed = await listTravelerIntents(
      new Request(`${SITE_ORIGIN}/api/traveler/intents`, { headers: { cookie } }),
    );
    assert.equal(listed.status, 200);
    const listedBody = await listed.json() as { intents?: Array<{ id: number; accountId: number }> };
    const owned = listedBody.intents?.find((intent) => intent.id === createdBody.intent?.id);
    assert.ok(owned, "Saved Preview traveler intent must be readable in the same session.");
    assert.equal(owned.accountId, accountId);

    verificationStage = "cleanup";
  } finally {
    try {
      if (accountId === null) {
        const createdAccount = await client.query(
          "SELECT id FROM accounts WHERE lower(email)=lower($1)",
          [email],
        );
        if (createdAccount.rowCount === 1) accountId = Number(createdAccount.rows[0]!.id);
      }
      if (accountId !== null) await cleanupSyntheticTraveler(client, accountId);
    } finally {
      await client.end();
      await pool.end().catch(() => undefined);
      if (verificationStage === "cleanup") {
        console.log("Preview traveler signup + owned intent E2E verification completed; synthetic QA data cleaned.");
      }
    }
  }
}

main().catch(() => {
  // Never print database/provider errors: they may contain secrets or user values.
  console.error(`Preview traveler E2E verification failed at stage=${verificationStage}. Release remains blocked.`);
  process.exitCode = 1;
});
