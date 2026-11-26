import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (
  process.env.MULTI_PROVIDER_BROWSER_QA !== "true" ||
  !databaseUrl ||
  databaseUrl !== process.env.MULTI_PROVIDER_BROWSER_TEST_DATABASE_URL
) {
  throw new Error("Explicit isolated multi-provider browser-QA configuration is required.");
}

const url = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.pathname !== "/journey_multi_provider_browser"
) {
  throw new Error("Multi-provider browser fixtures require the dedicated local QA database.");
}

type AgencyFixture = {
  name: string;
  workspaceId: number;
  agentId: number;
  accountId: number;
  token: string;
};

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const preflight = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'",
    );
    assert.equal(
      preflight.rows[0]?.count,
      0,
      "Refusing to apply the empty-database release chain to a database that already contains public tables.",
    );

    const manifest = JSON.parse(readFileSync("db/release_manifest.json", "utf8")) as {
      baseSchema: string;
      existingDatabaseMigrations: string[];
      schemaVersion: number;
    };
    assert.equal(manifest.schemaVersion, 13, "Browser QA must follow the current schema manifest.");
    await client.query(readFileSync(manifest.baseSchema, "utf8"));
    for (const migration of manifest.existingDatabaseMigrations) {
      await client.query(readFileSync(migration, "utf8"));
    }

    const existing = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM accounts",
    );
    assert.equal(existing.rows[0]?.count, 0, "Use a fresh QA database; fixtures never reset existing data.");

    const suffix = randomUUID().slice(0, 12);

    async function createAgency(
      key: string,
      name: string,
      specialty: string,
      trusted: boolean,
    ): Promise<AgencyFixture> {
      const agent = await client.query<{ id: number }>(
        [
          "INSERT INTO agents",
          "(display_name,latin_name,bio,photo_url,city,country,license_type,license_number,",
          " verification_status,verified_at,specialty_tags,languages,response_rate,avg_response_hours,total_trips)",
          "VALUES ($1,$1,'Synthetic browser-QA agency; not a real travel business.',",
          " '/brand/sila-app-icon.svg','Cairo','Egypt','agency',$2,'verified',NOW(),$3,'{Arabic}',85,6,40)",
          "RETURNING id",
        ].join(" "),
        [name, "MP-BROWSER-" + suffix + "-" + key, [specialty]],
      );
      const agentId = Number(agent.rows[0]!.id);
      const owner = await client.query<{ id: number }>(
        "INSERT INTO accounts (email,password_hash,role,display_name,agent_id) VALUES ($1,'disabled$browser-qa','agent',$2,$3) RETURNING id",
        ["mp-" + key + "-" + suffix + "@example.invalid", name, agentId],
      );
      const accountId = Number(owner.rows[0]!.id);
      const workspace = await client.query<{ id: number }>(
        "INSERT INTO agency_workspaces (agent_id,name,status) VALUES ($1,$2,'active') RETURNING id",
        [agentId, name],
      );
      const workspaceId = Number(workspace.rows[0]!.id);
      await client.query(
        "INSERT INTO agency_memberships (workspace_id,account_id,role,status) VALUES ($1,$2,'owner','active')",
        [workspaceId, accountId],
      );

      if (trusted) {
        for (const documentType of ["identity", "license", "commercial_register"]) {
          await client.query(
            "INSERT INTO agent_documents (agent_id,document_type,storage_key,original_name,status,verified_at,expires_at) VALUES ($1,$2,$3,$4,'verified',NOW(),NOW()+INTERVAL '1 year')",
            [agentId, documentType, "qa/mp_" + agentId + "/" + documentType + ".pdf", documentType + "-qa.pdf"],
          );
        }
      }

      const token = randomUUID();
      await client.query(
        "INSERT INTO sessions (token,account_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '2 hours')",
        [token, accountId],
      );
      return { name, workspaceId, agentId, accountId, token };
    }

    const agencyA = await createAgency("a", "وكالة الاختبار A", "hotel", true);
    const agencyB = await createAgency("b", "وكالة الاختبار B", "فنادق", true);
    await createAgency("wrong-category", "جهة خارج التخصص", "flight", true);
    await createAgency("untrusted", "جهة بلا أدلة ثقة مكتملة", "hotel", false);

    const travelerEmail = "traveler-mp-" + suffix + "@example.invalid";
    const traveler = await client.query<{ id: number }>(
      "INSERT INTO accounts (email,password_hash,role,display_name) VALUES ($1,'disabled$browser-qa','traveler','مسافر اختبار السوق') RETURNING id",
      [travelerEmail],
    );
    const travelerToken = randomUUID();
    await client.query(
      "INSERT INTO sessions (token,account_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '2 hours')",
      [travelerToken, traveler.rows[0]!.id],
    );

    writeFileSync(
      ".multi-provider-browser-fixture.json",
      JSON.stringify({ travelerToken, travelerEmail, agencies: [agencyA, agencyB] }),
      { mode: 0o600 },
    );
    console.log("Created schema-v13 synthetic multi-provider browser fixtures in the dedicated local QA database.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
