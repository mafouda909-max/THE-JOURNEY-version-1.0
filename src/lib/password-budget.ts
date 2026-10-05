import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type PasswordAction = "signup" | "login" | "recovery" | "reset" | "change" | "verify" | "confirm";
const POLICIES: Record<PasswordAction, { ip: number; identity: number; global: number; seconds: number; globalSeconds?: number }> = {
  signup: { ip: 8, identity: 3, global: 30, seconds: 600, globalSeconds: 3600 },
  login: { ip: 20, identity: 8, global: 200, seconds: 300 },
  recovery: { ip: 8, identity: 3, global: 40, seconds: 900, globalSeconds: 3600 },
  reset: { ip: 12, identity: 8, global: 100, seconds: 900 },
  change: { ip: 12, identity: 8, global: 100, seconds: 900 },
  verify: { ip: 6, identity: 3, global: 30, seconds: 3600 },
  confirm: { ip: 20, identity: 6, global: 100, seconds: 900 },
};

function key(value: string) {
  const secret = process.env.PASSWORD_AUTH_RATE_LIMIT_SECRET;
  if (!/^[a-f0-9]{64}$/.test(secret ?? "")) throw new Error("auth_budget_unavailable");
  return createHmac("sha256", secret!).update(value).digest("hex");
}

export const passwordBudget = {
  async consume(action: PasswordAction, ip: string, identity: string): Promise<{ allowed: boolean; retry: number }> {
    const policy = POLICIES[action];
    const limits = [
      { key: key(`${action}:ip:${ip}`), max: policy.ip, seconds: policy.seconds },
      // Keep existing login/signup buckets stable across deployment.
      { key: key(`${action}:email:${identity}`), max: policy.identity, seconds: action === "signup" ? 300 : policy.seconds },
      { key: key(`${action}:global`), max: policy.global, seconds: policy.globalSeconds ?? policy.seconds },
    ].sort((a, b) => a.key.localeCompare(b.key));
    const values = sql.join(limits.map((limit) => sql`(${limit.key},1,now()+${limit.seconds}*interval '1 second')`), sql`, `);
    const result = await db.execute(sql`INSERT INTO auth_password_attempts(bucket_key,attempts,reset_at) VALUES ${values}
      ON CONFLICT(bucket_key) DO UPDATE SET
        attempts=CASE WHEN auth_password_attempts.reset_at<=now() THEN 1 ELSE LEAST(auth_password_attempts.attempts+1,1000000) END,
        reset_at=CASE WHEN auth_password_attempts.reset_at<=now() THEN EXCLUDED.reset_at ELSE auth_password_attempts.reset_at END
      RETURNING bucket_key,attempts, GREATEST(1,ceil(extract(epoch FROM reset_at-now())))::integer AS retry`);
    let retry = 0;
    for (const row of result.rows) {
      const limit = limits.find((item) => item.key === row.bucket_key)!;
      if (Number(row.attempts) > limit.max) retry = Math.max(retry, Number(row.retry));
    }
    await db.execute(sql`DELETE FROM auth_password_attempts WHERE reset_at < now()-interval '1 hour'`);
    return { allowed: retry === 0, retry };
  },
};
