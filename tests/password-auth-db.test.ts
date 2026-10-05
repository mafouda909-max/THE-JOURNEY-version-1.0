import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { pool } from "../src/db";
import { POST, GET } from "../src/app/api/auth/[action]/route";
import { POST as createOffer } from "../src/app/api/offers/route";
import { GET as listAgents } from "../src/app/api/agents/route";
import { SITE_ORIGIN } from "../src/lib/site";
import { provisionVerifiedIdentity } from "../src/lib/passwordless-auth";
import { hashPilotPassword, pilotPasswordHash } from "../src/lib/password-credentials";
import { consumePasswordBudget, passwordAuthReadiness } from "../src/lib/password-auth";
import { InvalidRecoveryTokenError, recoveryTokenHash, resetPasswordWithToken } from "../src/lib/password-recovery";
import { POST as changePassword } from "../src/app/api/auth/password/change/route";

const databaseUrl = process.env.COMMERCIAL_WORKFLOW_TEST_DATABASE_URL;
const password = "A memorable SILA travel phrase 2026";
function request(action: string, body: Record<string, unknown>, cookie?: string) {
  return new Request(`${SITE_ORIGIN}/api/auth/${action}`, { method: "POST", headers: { "content-type": "application/json", origin: SITE_ORIGIN, "x-forwarded-for": "127.0.0.88", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}
function auth(action: string, body: Record<string, unknown>, cookie?: string) {
  return POST(request(action, body, cookie), { params: Promise.resolve({ action }) });
}
function cookie(response: Response) { return response.headers.get("set-cookie")!.split(";")[0]; }
function me(value: string) { return GET(new Request(`${SITE_ORIGIN}/api/auth/me`, { headers: { cookie: value } }), { params: Promise.resolve({ action: "me" }) }); }

test("password pilot creates usable accounts immediately and preserves trust boundaries", { skip: !databaseUrl }, async () => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();
  const vars = { NODE_ENV: "production", AUTH_ORIGIN: SITE_ORIGIN, PASSWORD_AUTH_ENABLED: "true", PASSWORD_AUTH_RATE_LIMIT_SECRET: "2".repeat(64) };
  const before = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  const suffix = randomUUID();
  Object.assign(process.env, vars);
  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/password_pilot_auth.sql", "utf8"));
    await client.query(readFileSync("db/password_pilot_auth.sql", "utf8"));
    assert.equal(await passwordAuthReadiness.probe(), true);
    const travelerEmail = `password-traveler-${suffix}@example.invalid`;
    const signup = await auth("signup", { email: travelerEmail.toUpperCase(), name: "Password Traveler", role: "traveler", password });
    assert.equal(signup.status, 201, JSON.stringify(await signup.clone().json()));
    assert.deepEqual(await signup.json(), { ok: true, role: "traveler", emailVerified: false, destination: "/account" });
    assert.match(signup.headers.get("set-cookie")!, /HttpOnly/);
    assert.match(signup.headers.get("set-cookie")!, /Secure/);
    assert.match(signup.headers.get("set-cookie")!, /SameSite=lax/);
    assert.match(signup.headers.get("cache-control")!, /no-store/);
    const travelerMe = await me(cookie(signup));
    const traveler = (await travelerMe.json()).account;
    assert.equal(traveler.role, "traveler");
    assert.equal(traveler.email, travelerEmail);
    assert.equal(traveler.emailVerified, false);
    assert.equal("passwordHash" in traveler, false);
    const travelerRow = (await client.query("SELECT password_hash,agent_id FROM accounts WHERE id=$1", [traveler.id])).rows[0];
    assert.equal(pilotPasswordHash(travelerRow.password_hash), true);
    assert.equal(travelerRow.agent_id, null);
    assert.equal((await client.query("SELECT id FROM linked_identities WHERE account_id=$1", [traveler.id])).rowCount, 0);

    const duplicate = await auth("signup", { email: travelerEmail, name: "Changed Role", role: "agent", password: "Another long password phrase" });
    assert.equal(duplicate.status, 409);
    const preserved = (await client.query("SELECT role,display_name,agent_id,password_hash FROM accounts WHERE id=$1", [traveler.id])).rows[0];
    assert.equal(preserved.role, "traveler");
    assert.equal(preserved.display_name, "Password Traveler");
    assert.equal(preserved.agent_id, null);
    assert.equal(preserved.password_hash, travelerRow.password_hash);

    for (const provider of ["google", "email"] as const) {
      const link = await provisionVerifiedIdentity({ provider, providerSubject: `${provider}-${suffix}`, email: travelerEmail, requestedRole: "agent", intent: "signup" });
      assert.equal(link.ok, false);
      if (!link.ok) assert.equal(link.code, "IDENTITY_LINK_REQUIRES_SIGN_IN");
    }
    assert.equal((await auth("login", { email: travelerEmail, password: "wrong password phrase" })).status, 401);
    const login = await auth("login", { email: travelerEmail, password, role: "admin" });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).role, "traveler");
    const loggedInCookie = cookie(login);
    assert.equal((await me(loggedInCookie)).status, 200);

    // Password recovery is one-time, verifies the mailbox, and revokes existing sessions.
    const resetToken = randomBytes(32).toString("base64url");
    await client.query(
      "INSERT INTO auth_password_recovery(token_hash,account_id,purpose,expires_at) VALUES($1,$2,'password_reset',now()+interval '30 minutes')",
      [recoveryTokenHash(resetToken), traveler.id],
    );
    const recoveredPassword = "Recovered memorable SILA travel phrase 2026";
    const recovered = await resetPasswordWithToken(resetToken, recoveredPassword);
    assert.equal(recovered.destination, "/account");
    assert.equal((await me(loggedInCookie)).status, 401);
    assert.equal((await auth("login", { email: travelerEmail, password })).status, 401);
    const recoveredLogin = await auth("login", { email: travelerEmail, password: recoveredPassword });
    assert.equal(recoveredLogin.status, 200);
    const recoveredCookie = cookie(recoveredLogin);
    assert.equal((await (await me(recoveredCookie)).json()).account.emailVerified, true);
    assert.equal((await client.query("SELECT id FROM linked_identities WHERE account_id=$1 AND lower(email)=lower($2)", [traveler.id, travelerEmail])).rowCount, 1);
    await assert.rejects(
      () => resetPasswordWithToken(resetToken, "A second replacement phrase 2026"),
      InvalidRecoveryTokenError,
    );

    // Authenticated password changes require the current secret and rotate every session.
    const wrongChange = await changePassword(new Request(`${SITE_ORIGIN}/api/auth/password/change`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: SITE_ORIGIN, cookie: recoveredCookie, "x-forwarded-for": "127.0.0.89" },
      body: JSON.stringify({ currentPassword: "not the current phrase", newPassword: "Another memorable SILA phrase 2026" }),
    }));
    assert.equal(wrongChange.status, 401);
    const finalPassword = "Final memorable SILA travel phrase 2026";
    const changed = await changePassword(new Request(`${SITE_ORIGIN}/api/auth/password/change`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: SITE_ORIGIN, cookie: recoveredCookie, "x-forwarded-for": "127.0.0.90" },
      body: JSON.stringify({ currentPassword: recoveredPassword, newPassword: finalPassword }),
    }));
    assert.equal(changed.status, 200, JSON.stringify(await changed.clone().json()));
    assert.equal((await me(recoveredCookie)).status, 401);
    assert.equal((await auth("login", { email: travelerEmail, password: recoveredPassword })).status, 401);
    assert.equal((await auth("login", { email: travelerEmail, password: finalPassword })).status, 200);

    const agentEmail = `password-agent-${suffix}@example.invalid`;
    const agentSignup = await auth("signup", { email: agentEmail, name: "Pending Password Agent", role: "agent", password });
    assert.equal(agentSignup.status, 201);
    assert.equal((await agentSignup.json()).destination, "/account");
    const agentMe = await me(cookie(agentSignup));
    const agent = await agentMe.json();
    assert.equal(agent.account.role, "agent");
    assert.equal(agent.agent.verificationStatus, "pending");
    assert.equal(agent.agent.verifiedAt, null);
    const publicAgents = await listAgents();
    assert.equal((await publicAgents.json()).agents.some((row: { id: number }) => row.id === agent.agent.id), false);
    const refusedOffer = await createOffer(new Request(`${SITE_ORIGIN}/api/offers`, { method: "POST", headers: { cookie: cookie(agentSignup), "content-type": "application/json" }, body: "{}" }));
    assert.equal(refusedOffer.status, 403);
    assert.equal((await auth("login", { email: agentEmail, password })).status, 200);
    const events = await client.query("SELECT meta FROM events WHERE name='agent_identity_provisioned' AND meta LIKE 'provider=password%'");
    for (const row of events.rows) {
      assert.doesNotMatch(row.meta, /@|Password Agent|travel phrase/);
      assert.match(row.meta, /email_verified=false/);
    }
    const escalated = await auth("signup", { email: `admin-forged-${suffix}@example.invalid`, name: "Forged Admin", role: "admin", password });
    assert.equal(escalated.status, 422);
    assert.equal((await client.query("SELECT id FROM accounts WHERE email=$1", [`admin-forged-${suffix}@example.invalid`])).rowCount, 0);
    await client.query("INSERT INTO accounts(email,password_hash,role,display_name) VALUES($1,$2,'admin','Private Admin')", [`private-admin-${suffix}@example.invalid`, await hashPilotPassword(password)]);
    assert.equal((await auth("login", { email: `private-admin-${suffix}@example.invalid`, password })).status, 401);

    // Two concurrent signups cannot create duplicate accounts or orphan agents.
    const raceEmail = `race-${suffix}@example.invalid`;
    const race = await Promise.all([0, 1].map(() => auth("signup", { email: raceEmail, name: "Race Agent", role: "agent", password })));
    assert.deepEqual(race.map((item) => item.status).sort(), [201, 409]);
    const raceRows = await client.query("SELECT id FROM accounts WHERE lower(email)=lower($1)", [raceEmail]);
    assert.equal(raceRows.rowCount, 1);
    const orphans = await client.query("SELECT g.id FROM agents g LEFT JOIN accounts a ON a.agent_id=g.id WHERE g.display_name='Race Agent' AND a.id IS NULL");
    assert.equal(orphans.rowCount, 0);

    // Concurrent attempts share the same atomic email budget, even with different IPs.
    const budget = await Promise.all(Array.from({ length: 10 }, (_, i) => consumePasswordBudget("login", `127.1.0.${i}`, `budget-${suffix}@example.invalid`)));
    assert.equal(budget.filter((item) => item.allowed).length, 8);
    assert.equal(budget.filter((item) => !item.allowed && item.retry > 0).length, 2);
    const keys = await client.query("SELECT bucket_key FROM auth_password_attempts");
    assert.ok(keys.rows.every((row) => /^[a-f0-9]{64}$/.test(row.bucket_key)));
  } finally {
    const testAgents = await client.query("SELECT agent_id FROM accounts WHERE email LIKE $1 AND agent_id IS NOT NULL", [`%${suffix}%`]);
    await client.query("DELETE FROM accounts WHERE email LIKE $1", [`%${suffix}%`]);
    for (const row of testAgents.rows) await client.query("DELETE FROM agents WHERE id=$1", [row.agent_id]);
    for (const key of Object.keys(vars)) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
    await client.end();
    await pool.end();
  }
});
