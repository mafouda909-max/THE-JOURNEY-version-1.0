/**
 * SILA — read-only production database schema contract check.
 * Keep this map aligned with db/production_schema.sql. Never prints secrets.
 */
import { config } from "dotenv";
import { Client } from "pg";
import { URL } from "node:url";

config({ path: ".env.local" });
config();

const requiredSchema: Record<string, string[]> = {
  agents: ["id","display_name","latin_name","bio","photo_url","city","country","license_type","license_number","verification_status","verified_at","specialty_tags","languages","response_rate","avg_response_hours","total_trips","joined_at"],
  offers: ["id","agent_id","title","title_en","description","trip_type","origin_city","destination_city","destination_country","destination_country_en","departure_date","duration_days","price_amount","currency","price_type","includes","excludes","min_travelers","max_travelers","status","rejection_reason","hero_image","is_featured","view_count","contact_count","published_at","expires_at","created_at"],
  contact_requests: ["id","offer_id","agent_id","traveler_account_id","traveler_name","traveler_email","message","traveler_count","travel_dates","utm_source","utm_medium","utm_campaign","offer_snapshot","status","created_at","responded_at"],
  reviews: ["id","agent_id","reviewer_name","rating","content","is_verified_transaction","is_visible","created_at"],
  agent_documents: ["id","agent_id","document_type","storage_key","original_name","status","rejection_reason","expires_at","verified_at","created_at"],
  campaigns: ["id","name","objective","audience","channels","hypothesis","kpi","status","starts_at","ends_at","created_at"],
  content_items: ["id","campaign_id","title","channel","content_type","body","cta","risk","status","scheduled_for","published_at","performance_note","created_at"],
  experiments: ["id","hypothesis","metric","status","result","decision","owner","started_at","ended_at"],
  accounts: ["id","email","password_hash","role","display_name","agent_id","created_at"],
  traveler_saved_intents: ["id","account_id","label","intent_snapshot","status","created_at","updated_at"],
  traveler_intent_offers: ["saved_intent_id","offer_id","position","created_at"],
  traveler_intent_inquiries: ["saved_intent_id","contact_request_id","created_at"],
  sessions: ["id","token","account_id","expires_at","created_at"],
  linked_identities: ["id","account_id","provider","provider_subject","email","linked_at"],
  auth_challenges: ["id","token_hash","email","requested_role","intent","purpose","display_name","city","expires_at","used_at","created_at"],
  community_posts: ["id","author_account_id","type","title","body","destination_country","destination_city","topic","status","helpful_count","comment_count","published_at","updated_at","created_at"],
  community_comments: ["id","post_id","author_account_id","body","status","published_at","created_at"],
  community_reactions: ["id","post_id","account_id","type","created_at"],
  travel_facts: ["id","subject","attribute","value","source","source_type","authority_level","retrieved_at","checked_at","valid_until","freshness_status","confidence_score","status","external_reference"],
  travel_knowledge: ["id","category","country","destination_country","data_payload","source_type","freshness_status","source_url","retrieved_at","checked_at","valid_until"],
  workflows: ["id","workflow_id","run_id","trigger_event","status","retry_count","errors","result","started_at","completed_at"],
  notifications: ["id","account_id","type","title","body","link","idempotency_key","read_at","created_at"],
  audit_log: ["id","actor","action","target_type","target_id","reason","prev_state","new_state","meta","created_at"],
  events: ["id","name","offer_id","agent_id","meta","created_at"],
  agent_ai_verification_runs: ["id","agent_id","status","overall_confidence","risk_level","recommendation","result_json","model","created_at"],
};

async function connectClient(connectionString: string): Promise<Client> {
  const parsed = new URL(connectionString);
  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";

  if (!isLocal) {
    // Match the application runtime: URI SSL knobs must not override the
    // certificate-verifying policy, and remote checks never downgrade to plain.
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("sslcert");
    parsed.searchParams.delete("sslkey");
    parsed.searchParams.delete("sslrootcert");
  }

  const client = new Client({
    connectionString: parsed.toString(),
    connectionTimeoutMillis: 10000,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: true } }),
  });
  await client.connect();
  return client;
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
      `select table_name, column_name
       from information_schema.columns
       where table_schema = 'public'
         and table_name = any($1::text[])
       order by table_name, ordinal_position`,
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
        if (!actualColumns.has(column)) problems.push(`missing column: public.${table}.${column}`);
      }
    }

    if (problems.length) {
      console.error("PRODUCTION DB SCHEMA CHECK: FAILED");
      for (const problem of problems) console.error(`- ${problem}`);
      console.error("Review the additive release migrations with the database owner before applying them.");
      process.exit(1);
    }

    console.log("PRODUCTION DB SCHEMA CHECK: PASSED");
    console.log(`Validated ${Object.keys(requiredSchema).length} canonical tables and all required columns.`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((err: unknown) => {
  console.error("PRODUCTION DB SCHEMA CHECK: ERROR");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
