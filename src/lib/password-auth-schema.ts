import { getTableColumns, sql, type SQL } from "drizzle-orm";
import { accounts, agents, contactRequests, notifications, offers, sessions } from "@/db/schema";

export const PASSWORD_PILOT_MIGRATIONS = [
  "db/contact_request_ownership.sql",
  "db/password_pilot_auth.sql",
] as const;

export async function passwordAuthSchemaReady(
  execute: (statement: SQL) => Promise<{ rows: Record<string, unknown>[] }>,
): Promise<boolean> {
  try {
    // Registration is ready only if the account page can read every required
    // column. WHERE false checks the contract without returning user data.
    const columns = [accounts, agents, contactRequests, notifications, offers, sessions]
      .flatMap((table) => Object.values(getTableColumns(table)));
    await execute(sql`SELECT ${sql.join(columns, sql`, `)},b.bucket_key,b.attempts,b.reset_at
      FROM ${accounts},${agents},${contactRequests},${notifications},${offers},${sessions},auth_password_attempts b WHERE false`);
    const indexes = await execute(sql`SELECT indisunique AND indisvalid AS ready FROM pg_index
      WHERE indexrelid=to_regclass('accounts_normalized_email_uidx') AND indrelid=to_regclass('accounts')`);
    return indexes.rows[0]?.ready === true;
  } catch {
    return false;
  }
}
