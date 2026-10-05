import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { accounts, agents, linkedIdentities } from "../src/db/schema";
import { hashPassword, passwordLoginAvailable } from "../src/lib/identity";
import {
  consumeMagicChallenge,
  createMagicChallenge,
  provisionVerifiedIdentity,
} from "../src/lib/passwordless-auth";
import { POST as legacyAuth } from "../src/app/api/auth/[action]/route";
import { POST as requestMagicLink } from "../src/app/api/auth/magic/request/route";
import { GET as consumeMagicLink } from "../src/app/api/auth/magic/consume/route";
import { emailProvider, type EmailParams, type EmailProbeResult, type EmailResult } from "../src/lib/providers/email";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;

function authRequest(body: Record<string, unknown>) {
  return new Request("http://local.test/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.77" },
    body: JSON.stringify(body),
  });
}

test("passwordless auth preserves legacy roles and blocks privilege creation", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();
  const authEnvironment = ["NODE_ENV", "AUTH_ORIGIN", "MAGIC_LINK_ENABLED"];
  const previousAuthEnvironment = authEnvironment.map((key) => process.env[key]);

  try {
    const manifest = JSON.parse(readFileSync("db/release_manifest.json", "utf8")) as {
      baseSchema: string;
      existingDatabaseMigrations: string[];
    };
    await client.query(readFileSync(manifest.baseSchema, "utf8"));
    for (const migration of manifest.existingDatabaseMigrations) {
      await client.query(readFileSync(migration, "utf8"));
    }

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const travelerEmail = `legacy-traveler-${suffix}@example.invalid`;
    const agentEmail = `legacy-agent-${suffix}@example.invalid`;
    const adminEmail = `legacy-admin-${suffix}@example.invalid`;

    const traveler = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,$2,'traveler','Legacy Traveler') RETURNING id`,
      [travelerEmail, hashPassword("TravelerPass2026!")],
    );

    const agent = await client.query<{ id: number }>(
      `INSERT INTO agents
        (display_name,latin_name,bio,photo_url,city,country,license_type,verification_status,
         specialty_tags,languages,response_rate,avg_response_hours,total_trips)
       VALUES ('Legacy Agent','Legacy Agent','','https://example.invalid/a','Cairo','Egypt','agency','pending',
         '{}','{Arabic}',0,0,0) RETURNING id`,
    );
    const agentAccount = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name,agent_id)
       VALUES ($1,$2,'agent','Legacy Agent',$3) RETURNING id`,
      [agentEmail, hashPassword("AgentPass2026!"), agent.rows[0]!.id],
    );
    const admin = await client.query<{ id: number }>(
      `INSERT INTO accounts (email,password_hash,role,display_name)
       VALUES ($1,$2,'admin','Existing Admin') RETURNING id`,
      [adminEmail, hashPassword("AdminPass2026!")],
    );

    const travelerGoogle = await provisionVerifiedIdentity({
      provider: "google",
      providerSubject: `google-traveler-${suffix}`,
      email: travelerEmail,
      displayName: "Different Name",
      requestedRole: "agent",
      intent: "signup",
    });
    assert.equal(travelerGoogle.ok, true);
    if (!travelerGoogle.ok) throw new Error("traveler Google link failed");
    assert.equal(travelerGoogle.account.id, traveler.rows[0]!.id);
    assert.equal(travelerGoogle.account.role, "traveler");

    const agentGoogle = await provisionVerifiedIdentity({
      provider: "google",
      providerSubject: `google-agent-${suffix}`,
      email: agentEmail,
      displayName: "Different Agent",
      requestedRole: "traveler",
      intent: "signup",
    });
    assert.equal(agentGoogle.ok, true);
    if (!agentGoogle.ok) throw new Error("agent Google link failed");
    assert.equal(agentGoogle.account.id, agentAccount.rows[0]!.id);
    assert.equal(agentGoogle.account.role, "agent");
    assert.equal(agentGoogle.account.agentId, agent.rows[0]!.id);

    delete process.env.GOOGLE_ADMIN_EMAIL_ALLOWLIST;
    const deniedAdmin = await provisionVerifiedIdentity({
      provider: "google",
      providerSubject: `google-admin-${suffix}`,
      email: adminEmail,
      displayName: "Existing Admin",
      requestedRole: "traveler",
      intent: "login",
    });
    assert.equal(deniedAdmin.ok, false);
    if (deniedAdmin.ok) throw new Error("admin link unexpectedly allowed");
    assert.equal(deniedAdmin.code, "ADMIN_GOOGLE_LINK_NOT_ALLOWED");

    process.env.GOOGLE_ADMIN_EMAIL_ALLOWLIST = adminEmail;
    const allowedAdmin = await provisionVerifiedIdentity({
      provider: "google",
      providerSubject: `google-admin-${suffix}`,
      email: adminEmail,
      displayName: "Existing Admin",
      requestedRole: "traveler",
      intent: "login",
    });
    assert.equal(allowedAdmin.ok, true);
    if (!allowedAdmin.ok) throw new Error("admin Google link failed");
    assert.equal(allowedAdmin.account.id, admin.rows[0]!.id);
    assert.equal(allowedAdmin.account.role, "admin");

    delete process.env.GOOGLE_ADMIN_EMAIL_ALLOWLIST;
    const revokedAdmin = await provisionVerifiedIdentity({
      provider: "google",
      providerSubject: `google-admin-${suffix}`,
      email: adminEmail,
      requestedRole: "traveler",
      intent: "login",
    });
    assert.equal(revokedAdmin.ok, false);
    if (revokedAdmin.ok) throw new Error("revoked admin link unexpectedly accepted");
    assert.equal(revokedAdmin.code, "ADMIN_GOOGLE_LINK_NOT_ALLOWED");
    process.env.GOOGLE_ADMIN_EMAIL_ALLOWLIST = adminEmail;
    const changedAdminEmail = await provisionVerifiedIdentity({
      provider: "google",
      providerSubject: `google-admin-${suffix}`,
      email: `different-admin-${suffix}@example.invalid`,
      requestedRole: "traveler",
      intent: "login",
    });
    assert.equal(changedAdminEmail.ok, false);
    if (changedAdminEmail.ok) throw new Error("changed admin email unexpectedly accepted");
    assert.equal(changedAdminEmail.code, "ADMIN_GOOGLE_LINK_NOT_ALLOWED");

    await client.query(
      "INSERT INTO linked_identities (account_id,provider,provider_subject,email) VALUES ($1,'email',$2,$2)",
      [admin.rows[0]!.id, adminEmail],
    );

    const adminMagic = await provisionVerifiedIdentity({
      provider: "email",
      providerSubject: adminEmail,
      email: adminEmail,
      displayName: "Existing Admin",
      requestedRole: "traveler",
      intent: "login",
    });
    assert.equal(adminMagic.ok, false);
    if (adminMagic.ok) throw new Error("admin magic link unexpectedly allowed");
    assert.equal(adminMagic.code, "ADMIN_MAGIC_LINK_DISABLED");

    const craftedAdmin = await provisionVerifiedIdentity({
      provider: "google",
      providerSubject: `crafted-admin-${suffix}`,
      email: `crafted-admin-${suffix}@example.invalid`,
      displayName: "Crafted Admin",
      requestedRole: "admin" as never,
      intent: "signup",
    });
    assert.equal(craftedAdmin.ok, false);
    if (craftedAdmin.ok) throw new Error("runtime admin self-signup unexpectedly allowed");
    assert.equal(craftedAdmin.code, "INVALID_IDENTITY");

    const newTraveler = await provisionVerifiedIdentity({
      provider: "google",
      providerSubject: `new-traveler-${suffix}`,
      email: `new-traveler-${suffix}@example.invalid`,
      displayName: "New Traveler",
      requestedRole: "traveler",
      intent: "signup",
    });
    assert.equal(newTraveler.ok, true);
    if (!newTraveler.ok) throw new Error("new traveler provisioning failed");
    assert.equal(newTraveler.account.role, "traveler");
    assert.equal(passwordLoginAvailable(newTraveler.account.passwordHash), false);

    const newAgent = await provisionVerifiedIdentity({
      provider: "email",
      providerSubject: `new-agent-${suffix}@example.invalid`,
      email: `new-agent-${suffix}@example.invalid`,
      displayName: "New Agent",
      requestedRole: "agent",
      intent: "signup",
      city: "Tanta",
    });
    assert.equal(newAgent.ok, true);
    if (!newAgent.ok) throw new Error("new agent provisioning failed");
    assert.equal(newAgent.account.role, "agent");
    assert.ok(newAgent.account.agentId);

    const newAgentProfile = await client.query<{ verification_status: string }>(
      `SELECT verification_status FROM agents WHERE id=$1`,
      [newAgent.account.agentId],
    );
    assert.equal(newAgentProfile.rows[0]!.verification_status, "pending");

    const magic = await createMagicChallenge({
      email: `magic-${suffix}@example.invalid`,
      requestedRole: "traveler",
      intent: "signup",
      displayName: "Magic Traveler",
    });
    const firstConsume = await consumeMagicChallenge(magic.token);
    const secondConsume = await consumeMagicChallenge(magic.token);
    assert.ok(firstConsume);
    assert.equal(secondConsume, null);

    await assert.rejects(
      client.query(
        `INSERT INTO linked_identities (account_id,provider,provider_subject,email)
         VALUES ($1,'google',$2,$3)`,
        [newTraveler.account.id, `google-traveler-${suffix}`, newTraveler.account.email],
      ),
      (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505"),
    );

    const signupDisabled = await legacyAuth(
      authRequest({ email: `new-password-${suffix}@example.invalid`, password: "Password2026!" }),
      { params: Promise.resolve({ action: "signup" }) },
    );
    assert.equal(signupDisabled.status, 410);

    delete process.env.LEGACY_PASSWORD_LOGIN_ENABLED;
    const legacyDisabled = await legacyAuth(
      authRequest({ email: travelerEmail, password: "TravelerPass2026!" }),
      { params: Promise.resolve({ action: "login" }) },
    );
    assert.equal(legacyDisabled.status, 410);

    process.env.LEGACY_PASSWORD_LOGIN_ENABLED = "true";
    const travelerLegacy = await legacyAuth(
      authRequest({ email: travelerEmail, password: "TravelerPass2026!" }),
      { params: Promise.resolve({ action: "login" }) },
    );
    assert.equal(travelerLegacy.status, 200);

    delete process.env.LEGACY_ADMIN_PASSWORD_LOGIN_ENABLED;
    const adminLegacyDenied = await legacyAuth(
      authRequest({ email: adminEmail, password: "AdminPass2026!" }),
      { params: Promise.resolve({ action: "login" }) },
    );
    assert.equal(adminLegacyDenied.status, 401);

    process.env.LEGACY_ADMIN_PASSWORD_LOGIN_ENABLED = "true";
    const adminLegacyAllowed = await legacyAuth(
      authRequest({ email: adminEmail, password: "AdminPass2026!" }),
      { params: Promise.resolve({ action: "login" }) },
    );
    assert.equal(adminLegacyAllowed.status, 200);

    // Exercise the request -> mail -> one-time consume -> pending agent/session
    // path against the isolated test database. Mail delivery is simulated.
    Object.assign(process.env, { NODE_ENV: "test", AUTH_ORIGIN: "http://127.0.0.1:3000", MAGIC_LINK_ENABLED: "true" });
    mock.method(emailProvider, "probe", async (): Promise<EmailProbeResult> => ({ status: "CONNECTED", latencyMs: 0 }));
    let outbound: EmailParams | undefined;
    const send = mock.method(emailProvider, "sendEmail", async (params: EmailParams): Promise<EmailResult> => {
      outbound = params;
      return { sent: true, status: "QUEUED", id: "synthetic-auth-message" };
    });
    const routeAgentEmail = `route-agent-${suffix}@example.invalid`;
    const requested = await requestMagicLink(new Request("http://127.0.0.1:3000/api/auth/magic/request", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.92" },
      body: JSON.stringify({ email: routeAgentEmail, role: "agent", intent: "signup", name: "Synthetic Route Agent", city: "Test City" }),
    }));
    assert.equal(requested.status, 202);
    assert.equal((await client.query("SELECT id FROM accounts WHERE email=$1", [routeAgentEmail])).rows.length, 0);
    assert.equal(outbound?.to, routeAgentEmail);
    assert.match(outbound!.idempotencyKey!, /^magic-link-[a-f0-9]{64}$/);
    const magicUrl = outbound!.text!.match(/http:\/\/127\.0\.0\.1:3000\/[^\s]+/)![0];
    const completed = await consumeMagicLink(new Request(magicUrl));
    assert.equal(completed.status, 307);
    assert.equal(completed.headers.get("location"), "http://127.0.0.1:3000/account");
    assert.match(completed.headers.get("set-cookie")!, /tj_sess=.*HttpOnly/i);
    const routeAccount = await client.query<{ role: string; verification_status: string; sessions: string }>(
      `SELECT a.role, g.verification_status, count(s.token)::text AS sessions
         FROM accounts a JOIN agents g ON g.id=a.agent_id
         LEFT JOIN sessions s ON s.account_id=a.id
        WHERE a.email=$1 GROUP BY a.role,g.verification_status`,
      [routeAgentEmail],
    );
    assert.deepEqual(routeAccount.rows, [{ role: "agent", verification_status: "pending", sessions: "1" }]);
    const replay = await consumeMagicLink(new Request(magicUrl));
    assert.match(replay.headers.get("location")!, /magic_link_expired_or_used/);
    assert.equal(replay.headers.get("set-cookie"), null);

    send.mock.restore();
    mock.method(emailProvider, "sendEmail", async (params: EmailParams): Promise<EmailResult> => {
      outbound = params;
      return { sent: false, status: "FAILED" };
    });
    const failedEmail = `route-failed-${suffix}@example.invalid`;
    const failed = await requestMagicLink(new Request("http://127.0.0.1:3000/api/auth/magic/request", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.93" },
      body: JSON.stringify({ email: failedEmail, role: "agent", intent: "signup", name: "Synthetic Failed Agent" }),
    }));
    assert.equal(failed.status, 503);
    const invalidatedUrl = outbound!.text!.match(/http:\/\/127\.0\.0\.1:3000\/[^\s]+/)![0];
    assert.match((await consumeMagicLink(new Request(invalidatedUrl))).headers.get("location")!, /magic_link_expired_or_used/);
    assert.equal((await client.query("SELECT id FROM accounts WHERE email=$1", [failedEmail])).rows.length, 0);

    const linked = await client.query<{ provider: string; role: string }>(
      `SELECT li.provider, a.role
         FROM linked_identities li
         JOIN accounts a ON a.id=li.account_id
        WHERE a.id = ANY($1::integer[])
        ORDER BY a.id, li.provider`,
      [[traveler.rows[0]!.id, agentAccount.rows[0]!.id, admin.rows[0]!.id]],
    );
    assert.ok(linked.rows.some((row) => row.provider === "google" && row.role === "traveler"));
    assert.ok(linked.rows.some((row) => row.provider === "google" && row.role === "agent"));
    assert.ok(linked.rows.some((row) => row.provider === "google" && row.role === "admin"));
  } finally {
    mock.restoreAll();
    authEnvironment.forEach((key, i) => {
      if (previousAuthEnvironment[i] === undefined) delete process.env[key];
      else process.env[key] = previousAuthEnvironment[i];
    });
    delete process.env.GOOGLE_ADMIN_EMAIL_ALLOWLIST;
    delete process.env.LEGACY_PASSWORD_LOGIN_ENABLED;
    delete process.env.LEGACY_ADMIN_PASSWORD_LOGIN_ENABLED;
    await pool.end().catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
