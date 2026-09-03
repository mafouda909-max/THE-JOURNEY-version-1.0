/**
 * THE JOURNEY — production database schema contract check (READ-ONLY).
 *
 * Validates that the connected database contains every canonical table and
 * column required by `src/db/schema.ts` / `db/production_schema.sql` —
 * including `offers.title_en`, whose absence caused the production incident
 * (PostgreSQL 42703: column offers.title_en does not exist).
 *
 * Aligned 1:1 with db/production_schema.sql (17 tables). If you change the
 * canonical schema, regenerate this map — drift between the app schema and
 * this check is exactly what allowed the incident.
 *
 * Exit codes:
 *   0 — contract satisfied
 *   1 — schema drift detected (or check errored)
 *   2 — DATABASE_URL not configured (nothing was checked)
 *
 * Never prints connection material. Safe to run in CI with a secret env var.
 */
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });
config();

// AUTO-ALIGNED WITH db/production_schema.sql + src/db/schema.ts (17 tables)
const requiredSchema: Record<string, string[]> = {
  agents: [
    "id",
    "display_name",
    "latin_name",
    "bio",
    "photo_url",
    "city",
    "country",
    "license_type",
    "license_number",
    "verification_status",
    "verified_at",
    "specialty_tags",
    "languages",
    "response_rate",
    "avg_response_hours",
    "total_trips",
    "joined_at",
  ],
  offers: [
    "id",
    "agent_id",
    "title",
    "title_en",
    "description",
    "trip_type",
    "origin_city",
    "destination_city",
    "destination_country",
    "destination_country_en",
    "departure_date",
    "duration_days",
    "price_amount",
    "currency",
    "price_type",
    "includes",
    "excludes",
    "min_travelers",
    "max_travelers",
    "status",
    "rejection_reason",
    "hero_image",
    "is_featured",
    "view_count",
    "contact_count",
    "published_at",
    "expires_at",
    "created_at",
  ],
  contact_requests: [
    "id",
    "offer_id",
    "agent_id",
    "traveler_name",
    "traveler_email",
    "message",
    "traveler_count",
    "travel_dates",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "offer_snapshot",
    "status",
    "created_at",
    "responded_at",
  ],
  reviews: [
    "id",
    "agent_id",
    "reviewer_name",
    "rating",
    "content",
    "is_verified_transaction",
    "is_visible",
    "created_at",
  ],
  agent_documents: [
    "id",
    "agent_id",
    "document_type",
    "storage_key",
    "original_name",
    "status",
    "rejection_reason",
    "expires_at",
    "verified_at",
    "created_at",
  ],
  campaigns: [
    "id",
    "name",
    "objective",
    "audience",
    "channels",
    "hypothesis",
    "kpi",
    "status",
    "starts_at",
    "ends_at",
    "created_at",
  ],
  content_items: [
    "id",
    "campaign_id",
    "title",
    "channel",
    "content_type",
    "body",
    "cta",
    "risk",
    "status",
    "scheduled_for",
    "published_at",
    "performance_note",
    "created_at",
  ],
  experiments: [
    "id",
    "hypothesis",
    "metric",
    "status",
    "result",
    "decision",
    "owner",
    "started_at",
    "ended_at",
  ],
  accounts: [
    "id",
    "email",
    "password_hash",
    "role",
    "display_name",
    "agent_id",
    "created_at",
  ],
  sessions: [
    "id",
    "token",
    "account_id",
    "expires_at",
    "created_at",
  ],
  linked_identities: [
    "id",
    "account_id",
    "provider",
    "provider_subject",
    "email",
    "linked_at",
  ],
  travel_facts: [
    "id",
    "subject",
    "attribute",
    "value",
    "source",
    "source_type",
    "authority_level",
    "retrieved_at",
    "checked_at",
    "valid_until",
    "freshness_status",
    "confidence_score",
    "status",
    "external_reference",
  ],
  travel_knowledge: [
    "id",
    "category",
    "country",
    "destination_country",
    "data_payload",
    "source_type",
    "freshness_status",
    "source_url",
    "retrieved_at",
    "checked_at",
    "valid_until",
  ],
  workflows: [
    "id",
    "workflow_id",
    "run_id",
    "trigger_event",
    "status",
    "retry_count",
    "errors",
    "result",
    "started_at",
    "completed_at",
  ],
  notifications: [
    "id",
    "account_id",
    "type",
    "title",
    "body",
    "link",
    "idempotency_key",
    "read_at",
    "created_at",
  ],
  audit_log: [
    "id",
    "actor",
    "action",
    "target_type",
    "target_id",
    "reason",
    "prev_state",
    "new_state",
    "meta",
    "created_at",
  ],
  events: [
    "id",
    "name",
    "offer_id",
    "agent_id",
    "meta",
    "created_at",
  ],
};

/**
 * Connect for the check. Managed providers (Neon) require SSL; local/embedded
 * Postgres may not support it. Try SSL first and, only on that specific server
 * capability error, retry once with a fresh plain client. Connection material
 * is never logged.
 */
async function connectClient(connectionString: string): Promise<Client> {
  const sslClient = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await sslClient.connect();
    return sslClient;
  } catch (err) {
    await sslClient.end().catch(() => undefined);
    if (!String(err instanceof Error ? err.message : err).includes("SSL")) throw err;
    const plainClient = new Client({ connectionString });
    await plainClient.connect();
    return plainClient;
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL is required for the production schema check.");
    process.exit(2);
  }

  const client = await connectClient(databaseUrl);

  try {
    const result = await client.query<{ table_name: string; column_name: string }>(
      `
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name, ordinal_position
    `,
      [Object.keys(requiredSchema)],
    );

    const actual = new Map<string, Set<string>>();
    for (const row of result.rows) {
      if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
      actual.get(row.table_name)!.add(row.column_name);
    }

    const problems: string[] = [];

    for (const [table, columns] of Object.entries(requiredSchema)) {
      const actualColumns = actual.get(table);
      if (!actualColumns) {
        problems.push(`missing table: public.${table}`);
        continue;
      }

      for (const column of columns) {
        if (!actualColumns.has(column)) {
          problems.push(`missing column: public.${table}.${column}`);
        }
      }
    }

    if (problems.length > 0) {
      console.error("PRODUCTION DB SCHEMA CHECK: FAILED");
      for (const problem of problems) console.error(`- ${problem}`);
      console.error(
        `To align the canonical database, review db/production_alignment.sql (additive-only) with the database owner before applying.`,
      );
      process.exit(1);
    }

    console.log("PRODUCTION DB SCHEMA CHECK: PASSED");
    console.log(
      `Validated ${Object.keys(requiredSchema).length} canonical tables and all required columns (including offers.title_en).`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((err: unknown) => {
  console.error("PRODUCTION DB SCHEMA CHECK: ERROR");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
