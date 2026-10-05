import { pool } from "@/db";
import type { TravelKnowledge } from "@/db/schema";

/** Real server statement cancellation plus bounded driver transport.
 * This read-only transaction changes no global timeout or business schema. */
export async function readVisaKnowledge(nationality: string, destination: string): Promise<TravelKnowledge[]> {
  const client = await pool.connect();
  let failed = false;
  try {
    await client.query({ text: "BEGIN READ ONLY", query_timeout: 1000 });
    await client.query({ text: "SET LOCAL statement_timeout='4000ms'", query_timeout: 1000 });
    const result = await client.query<TravelKnowledge>({
      text: 'SELECT id,category,country,destination_country AS "destinationCountry",data_payload AS "dataPayload",source_type AS "sourceType",freshness_status AS "freshnessStatus",source_url AS "sourceUrl",retrieved_at AS "retrievedAt",checked_at AS "checkedAt",valid_until AS "validUntil" FROM travel_knowledge WHERE category=\'visa\' AND country=$1 AND destination_country=$2 ORDER BY checked_at DESC,id DESC LIMIT 51',
      values: [nationality, destination], query_timeout: 4500,
    });
    await client.query({ text: "COMMIT", query_timeout: 1000 });
    return result.rows;
  } catch (error) {
    failed = true;
    try { await client.query({ text: "ROLLBACK", query_timeout: 1000 }); } catch { /* Discard below. */ }
    throw error;
  } finally { client.release(failed); }
}
