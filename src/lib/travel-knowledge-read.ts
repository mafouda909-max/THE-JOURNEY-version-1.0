import { pool } from "@/db";
import type { TravelKnowledge } from "@/db/schema";
import type { QueryConfig } from "pg";

// pg accepts a per-query transport timeout; its QueryConfig typings omit it.
function timedRead(text: string, query_timeout: number, values?: string[]): QueryConfig & { query_timeout: number } {
  return { text, query_timeout, values };
}

/** Real server statement cancellation plus bounded driver transport.
 * This read-only transaction changes no global timeout or business schema. */
export async function readVisaKnowledge(nationality: string, destination: string): Promise<TravelKnowledge[]> {
  const client = await pool.connect();
  let failed = false;
  try {
    await client.query(timedRead("BEGIN READ ONLY", 1000));
    await client.query(timedRead("SET LOCAL statement_timeout='4000ms'", 1000));
    const result = await client.query<TravelKnowledge>(timedRead(
      'SELECT id,category,country,destination_country AS "destinationCountry",data_payload AS "dataPayload",source_type AS "sourceType",freshness_status AS "freshnessStatus",source_url AS "sourceUrl",retrieved_at AS "retrievedAt",checked_at AS "checkedAt",valid_until AS "validUntil" FROM travel_knowledge WHERE category=\'visa\' AND country=$1 AND destination_country=$2 ORDER BY checked_at DESC,id DESC LIMIT 51',
      4500, [nationality, destination],
    ));
    await client.query(timedRead("COMMIT", 1000));
    return result.rows;
  } catch (error) {
    failed = true;
    try { await client.query(timedRead("ROLLBACK", 1000)); } catch { /* Discard below. */ }
    throw error;
  } finally { client.release(failed); }
}
