import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import { pool } from "../src/db";
import { GET as listWorkspaces, POST as createWorkspace } from "../src/app/api/agency/workspaces/route";
import { GET as getWorkspace } from "../src/app/api/agency/workspaces/[id]/route";
import { POST as addMembership } from "../src/app/api/agency/workspaces/[id]/memberships/route";

const databaseUrl = process.env.AGENCY_TEST_DATABASE_URL;

function cookie(token: string) {
  return { cookie: `tj_sess=${token}` };
}

async function body(response: Response): Promise<Record<string, any>> {
  return await response.json() as Record<string, any>;
}

test("Agency DB authorization, isolation, constraints and event boundary", { skip: !databaseUrl }, async (t) => {
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  try {
    await client.query(readFileSync("db/production_schema.sql", "utf8"));
    await client.query(readFileSync("db/phase1_agency_foundation.sql", "utf8"));

    async function createAccount(label: string, options?: { agency?: boolean; verified?: boolean }) {
      let agentId: number | null = null;
      if (options?.agency) {
        const insertedAgent = await client.query<{ id: number }>(
          `INSERT INTO agents
            (display_name, latin_name, bio, photo_url, city, country, license_type, license_number,
             verification_status, specialty_tags, languages, response_rate, avg_response_hours, total_trips)
           VALUES ($1, $1, 'Agency test profile', 'https://example.invalid/photo', 'Cairo', 'Egypt', 'agency',
             $2, $3, '{}', '{Arabic}', 0, 0, 0)
           RETURNING id`,
          [label, `LIC-${label}`, options.verified === false ? "in_review" : "verified"],
        );
        agentId = insertedAgent.rows[0]!.id;
      }

      const insertedAccount = await client.query<{ id: number }>(
        `INSERT INTO accounts (email, password_hash, role, display_name, agent_id)
         VALUES ($1, 'test:test', $2, $3, $4) RETURNING id`,
        [`${label.toLowerCase()}@example.invalid`, options?.agency ? "agent" : "traveler", label, agentId],
      );
      const accountId = insertedAccount.rows[0]!.id;
      const token = `phase1-${label.toLowerCase()}`;
      await client.query(
        `INSERT INTO sessions (token, account_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [token, accountId],
      );
      return { accountId, agentId, token };
    }

    const ownerA = await createAccount("OwnerA", { agency: true });
    const ownerB = await createAccount("OwnerB", { agency: true });
    const memberA = await createAccount("MemberA");
    const outsider = await createAccount("Outsider");
    const unverifiedAgency = await createAccount("Unverified", { agency: true, verified: false });

    await t.test("unauthenticated requests are rejected and ineligible agents cannot create", async () => {
      const unauth = await listWorkspaces(new Request("http://local.test/api/agency/workspaces"));
      assert.equal(unauth.status, 401);

      const ineligible = await createWorkspace(new Request("http://local.test/api/agency/workspaces", {
        method: "POST",
        headers: { ...cookie(unverifiedAgency.token), "content-type": "application/json" },
        body: "{}",
      }));
      assert.equal(ineligible.status, 403);
    });

    await t.test("workspace ownership is session-derived and duplicate workspaces are prevented", async () => {
      const impersonation = await createWorkspace(new Request("http://local.test/api/agency/workspaces", {
        method: "POST",
        headers: { ...cookie(ownerA.token), "content-type": "application/json" },
        body: JSON.stringify({ agentId: ownerB.agentId }),
      }));
      assert.equal(impersonation.status, 422);

      const first = await createWorkspace(new Request("http://local.test/api/agency/workspaces", {
        method: "POST",
        headers: { ...cookie(ownerA.token), "content-type": "application/json" },
        body: "{}",
      }));
      assert.equal(first.status, 201);
      const firstBody = await body(first);
      assert.equal(firstBody.membership.role, "owner");

      const duplicate = await createWorkspace(new Request("http://local.test/api/agency/workspaces", {
        method: "POST",
        headers: { ...cookie(ownerA.token), "content-type": "application/json" },
        body: "{}",
      }));
      assert.equal(duplicate.status, 409);

      const second = await createWorkspace(new Request("http://local.test/api/agency/workspaces", {
        method: "POST",
        headers: { ...cookie(ownerB.token), "content-type": "application/json" },
        body: "{}",
      }));
      assert.equal(second.status, 201);
    });

    const workspaceA = (await client.query<{ id: number }>(
      "SELECT id FROM agency_workspaces WHERE agent_id = $1",
      [ownerA.agentId],
    )).rows[0]!.id;
    const workspaceB = (await client.query<{ id: number }>(
      "SELECT id FROM agency_workspaces WHERE agent_id = $1",
      [ownerB.agentId],
    )).rows[0]!.id;

    await t.test("non-members are rejected; owner can add only a member; member cannot escalate", async () => {
      const denied = await getWorkspace(
        new Request(`http://local.test/api/agency/workspaces/${workspaceA}`, { headers: cookie(outsider.token) }),
        { params: Promise.resolve({ id: String(workspaceA) }) },
      );
      assert.equal(denied.status, 404);

      const added = await addMembership(
        new Request(`http://local.test/api/agency/workspaces/${workspaceA}/memberships`, {
          method: "POST",
          headers: { ...cookie(ownerA.token), "content-type": "application/json" },
          body: JSON.stringify({ accountId: memberA.accountId, role: "member" }),
        }),
        { params: Promise.resolve({ id: String(workspaceA) }) },
      );
      assert.equal(added.status, 201);

      const ownerInjection = await addMembership(
        new Request(`http://local.test/api/agency/workspaces/${workspaceA}/memberships`, {
          method: "POST",
          headers: { ...cookie(ownerA.token), "content-type": "application/json" },
          body: JSON.stringify({ accountId: outsider.accountId, role: "owner" }),
        }),
        { params: Promise.resolve({ id: String(workspaceA) }) },
      );
      assert.equal(ownerInjection.status, 422);

      const memberEscalation = await addMembership(
        new Request(`http://local.test/api/agency/workspaces/${workspaceA}/memberships`, {
          method: "POST",
          headers: { ...cookie(memberA.token), "content-type": "application/json" },
          body: JSON.stringify({ accountId: outsider.accountId, role: "member" }),
        }),
        { params: Promise.resolve({ id: String(workspaceA) }) },
      );
      assert.equal(memberEscalation.status, 403);
    });

    await t.test("workspace isolation is enforced from the authenticated membership", async () => {
      const own = await getWorkspace(
        new Request(`http://local.test/api/agency/workspaces/${workspaceA}`, { headers: cookie(memberA.token) }),
        { params: Promise.resolve({ id: String(workspaceA) }) },
      );
      assert.equal(own.status, 200);

      const crossWorkspace = await getWorkspace(
        new Request(`http://local.test/api/agency/workspaces/${workspaceB}`, { headers: cookie(memberA.token) }),
        { params: Promise.resolve({ id: String(workspaceB) }) },
      );
      assert.equal(crossWorkspace.status, 404);

      const list = await listWorkspaces(new Request("http://local.test/api/agency/workspaces", { headers: cookie(memberA.token) }));
      assert.equal(list.status, 200);
      const listBody = await body(list);
      assert.deepEqual(listBody.workspaces.map((workspace: { id: number }) => workspace.id), [workspaceA]);
    });

    await t.test("duplicate membership and invalid roles are DB-enforced", async () => {
      await assert.rejects(
        client.query(
          "INSERT INTO agency_memberships (workspace_id, account_id, role) VALUES ($1, $2, 'member')",
          [workspaceA, memberA.accountId],
        ),
        (error: any) => error?.code === "23505",
      );
      await assert.rejects(
        client.query(
          "INSERT INTO agency_memberships (workspace_id, account_id, role) VALUES ($1, $2, 'admin')",
          [workspaceA, outsider.accountId],
        ),
        (error: any) => error?.code === "23514",
      );
    });

    await t.test("event actors are server-derived, secrets are rejected, and events are append-only", async () => {
      const before = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM agency_domain_events WHERE workspace_id = $1",
        [workspaceA],
      );
      const forged = await addMembership(
        new Request(`http://local.test/api/agency/workspaces/${workspaceA}/memberships`, {
          method: "POST",
          headers: { ...cookie(ownerA.token), "content-type": "application/json" },
          body: JSON.stringify({ accountId: outsider.accountId, role: "member", actorAccountId: outsider.accountId, password: "secret" }),
        }),
        { params: Promise.resolve({ id: String(workspaceA) }) },
      );
      assert.equal(forged.status, 422);
      const after = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM agency_domain_events WHERE workspace_id = $1",
        [workspaceA],
      );
      assert.equal(after.rows[0]!.count, before.rows[0]!.count);

      const events = await client.query<{ actor_account_id: number; payload: Record<string, unknown> }>(
        "SELECT actor_account_id, payload FROM agency_domain_events WHERE workspace_id = $1 ORDER BY id",
        [workspaceA],
      );
      assert.ok(events.rows.length >= 2);
      assert.ok(events.rows.every((event) => event.actor_account_id === ownerA.accountId));
      assert.doesNotMatch(JSON.stringify(events.rows), /password|secret|token|cookie|authorization|apiKey|email|phone/i);

      await assert.rejects(
        client.query("UPDATE agency_domain_events SET event_type = 'forged' WHERE workspace_id = $1", [workspaceA]),
        /append-only/i,
      );
      await assert.rejects(
        client.query("DELETE FROM agency_domain_events WHERE workspace_id = $1", [workspaceA]),
        /append-only/i,
      );
    });
  } finally {
    await pool.end().catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});
