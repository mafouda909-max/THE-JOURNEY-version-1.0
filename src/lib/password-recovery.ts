import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, linkedIdentities, sessions } from "@/db/schema";
import { emailProvider } from "@/lib/providers/email";
import { hashPilotPassword } from "@/lib/password-credentials";
import { normalizeAuthEmail, postAuthDestination } from "@/lib/passwordless-auth";

export type RecoveryPurpose = "password_reset" | "email_verify";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const SESSION_MS = 7 * 86_400_000;

export class RecoveryMailUnavailableError extends Error {}
export class InvalidRecoveryTokenError extends Error {}

export function recoveryTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validRecoveryToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

function verificationSubject(email: string): string {
  return `verified:${createHash("sha256").update(email).digest("hex")}`;
}

export async function accountEmailVerified(accountId: number, email: string): Promise<boolean> {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return false;
  const rows = await db
    .select({ id: linkedIdentities.id })
    .from(linkedIdentities)
    .where(and(
      eq(linkedIdentities.accountId, accountId),
      sql`lower(${linkedIdentities.email})=${normalized}`,
    ))
    .limit(1);
  return Boolean(rows[0]);
}

async function createRecoveryToken(
  accountId: number,
  purpose: RecoveryPurpose,
  ttlMs: number,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hash = recoveryTokenHash(token);
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.execute(sql`
    INSERT INTO auth_password_recovery(token_hash, account_id, purpose, expires_at)
    VALUES (${hash}, ${accountId}, ${purpose}, ${expiresAt})
  `);
  await db.execute(sql`
    DELETE FROM auth_password_recovery
    WHERE expires_at < now() - interval '1 day'
       OR (used_at IS NOT NULL AND used_at < now() - interval '1 day')
  `);
  return token;
}

async function recentTokenCount(accountId: number, purpose: RecoveryPurpose, minutes: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT count(*)::integer AS count
    FROM auth_password_recovery
    WHERE account_id=${accountId}
      AND purpose=${purpose}
      AND created_at > now() - (${minutes} * interval '1 minute')
  `);
  return Number(result.rows[0]?.count ?? 0);
}

async function invalidateToken(token: string, purpose: RecoveryPurpose): Promise<void> {
  if (!validRecoveryToken(token)) return;
  await db.execute(sql`
    UPDATE auth_password_recovery
    SET used_at=coalesce(used_at, now())
    WHERE token_hash=${recoveryTokenHash(token)} AND purpose=${purpose}
  `);
}

export async function recoveryMailReady(): Promise<boolean> {
  return (await emailProvider.probe()).status === "CONNECTED";
}

export async function requestPasswordReset(emailInput: unknown, origin: string): Promise<void> {
  const email = normalizeAuthEmail(emailInput);
  if (!email) return;

  const rows = await db
    .select()
    .from(accounts)
    .where(sql`lower(${accounts.email})=${email}`)
    .limit(1);
  const account = rows[0];

  // Keep the public response indistinguishable for missing, admin and throttled accounts.
  if (!account || !["traveler", "agent"].includes(account.role)) return;
  if (await recentTokenCount(account.id, "password_reset", 15) >= 3) return;

  const token = await createRecoveryToken(account.id, "password_reset", 30 * 60_000);
  const link = new URL(`/reset-password?token=${encodeURIComponent(token)}`, origin).toString();
  const result = await emailProvider.sendEmail({
    to: account.email,
    subject: "استعادة كلمة مرور صلة",
    text: `طلبت استعادة كلمة مرور حسابك في صلة. افتح الرابط خلال 30 دقيقة: ${link}\nإذا لم تطلب ذلك فتجاهل الرسالة.`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h2>استعادة كلمة مرور صلة</h2><p>استخدم الزر التالي لاختيار كلمة مرور جديدة. الرابط صالح لمدة 30 دقيقة ويُستخدم مرة واحدة.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#0b376b;color:#fff;text-decoration:none;border-radius:10px">اختيار كلمة مرور جديدة</a></p><p>إذا لم تطلب الاستعادة فتجاهل هذه الرسالة.</p></div>`,
    idempotencyKey: `password-reset-${recoveryTokenHash(token)}`,
  });
  if (!result.sent) {
    await invalidateToken(token, "password_reset");
    throw new RecoveryMailUnavailableError();
  }
}

export async function requestEmailVerification(accountId: number, emailInput: unknown, origin: string): Promise<"sent" | "already"> {
  const email = normalizeAuthEmail(emailInput);
  if (!email) throw new Error("invalid_email");
  if (await accountEmailVerified(accountId, email)) return "already";
  if (await recentTokenCount(accountId, "email_verify", 60) >= 3) return "sent";

  const token = await createRecoveryToken(accountId, "email_verify", 24 * 60 * 60_000);
  const link = new URL(`/verify-email?token=${encodeURIComponent(token)}`, origin).toString();
  const result = await emailProvider.sendEmail({
    to: email,
    subject: "تأكيد بريدك في صلة",
    text: `أكد بريد حسابك في صلة من هذا الرابط خلال 24 ساعة: ${link}\nإذا لم تطلب ذلك فتجاهل الرسالة.`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h2>تأكيد البريد الإلكتروني</h2><p>أكد أن هذا البريد يخص حسابك في صلة. الرابط صالح لمدة 24 ساعة ويُستخدم مرة واحدة.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#0b376b;color:#fff;text-decoration:none;border-radius:10px">تأكيد البريد</a></p></div>`,
    idempotencyKey: `email-verify-${recoveryTokenHash(token)}`,
  });
  if (!result.sent) {
    await invalidateToken(token, "email_verify");
    throw new RecoveryMailUnavailableError();
  }
  return "sent";
}

async function markEmailVerified(
  tx: Pick<typeof db, "execute">,
  accountId: number,
  email: string,
): Promise<void> {
  const subject = verificationSubject(email);
  await tx.execute(sql`
    INSERT INTO linked_identities(account_id, provider, provider_subject, email)
    SELECT ${accountId}, 'email', ${subject}, ${email}
    WHERE NOT EXISTS (
      SELECT 1 FROM linked_identities
      WHERE account_id=${accountId} AND lower(email)=${email}
    )
    ON CONFLICT(provider, provider_subject) DO NOTHING
  `);
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  if (!validRecoveryToken(token)) throw new InvalidRecoveryTokenError();
  const hash = recoveryTokenHash(token);
  const preflight = await db.execute(sql`
    SELECT r.account_id, a.email, a.role
    FROM auth_password_recovery r
    JOIN accounts a ON a.id=r.account_id
    WHERE r.token_hash=${hash}
      AND r.purpose='password_reset'
      AND r.used_at IS NULL
      AND r.expires_at > now()
    LIMIT 1
  `);
  const row = preflight.rows[0] as { account_id?: number; email?: string; role?: string } | undefined;
  if (!row?.account_id || !row.email || !row.role || !["traveler", "agent"].includes(row.role)) {
    throw new InvalidRecoveryTokenError();
  }

  const passwordHash = await hashPilotPassword(newPassword);
  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MS);

  await db.transaction(async (tx) => {
    const consumed = await tx.execute(sql`
      UPDATE auth_password_recovery
      SET used_at=now()
      WHERE token_hash=${hash}
        AND purpose='password_reset'
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING account_id
    `);
    const accountId = Number(consumed.rows[0]?.account_id ?? 0);
    if (!accountId || accountId !== row.account_id) throw new InvalidRecoveryTokenError();

    await tx.update(accounts).set({ passwordHash }).where(eq(accounts.id, accountId));
    await tx.delete(sessions).where(eq(sessions.accountId, accountId));
    await markEmailVerified(tx, accountId, row.email!);
    await tx.execute(sql`
      UPDATE auth_password_recovery
      SET used_at=coalesce(used_at, now())
      WHERE account_id=${accountId} AND purpose='password_reset' AND used_at IS NULL
    `);
    await tx.insert(sessions).values({ token: sessionToken, accountId, expiresAt });
  });

  return { sessionToken, role: row.role, destination: postAuthDestination(row.role) };
}

export async function verifyEmailWithToken(token: string): Promise<boolean> {
  if (!validRecoveryToken(token)) return false;
  const hash = recoveryTokenHash(token);
  return db.transaction(async (tx) => {
    const consumed = await tx.execute(sql`
      UPDATE auth_password_recovery
      SET used_at=now()
      WHERE token_hash=${hash}
        AND purpose='email_verify'
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING account_id
    `);
    const accountId = Number(consumed.rows[0]?.account_id ?? 0);
    if (!accountId) return false;
    const rows = await tx.select({ email: accounts.email, role: accounts.role }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
    const account = rows[0];
    if (!account || !["traveler", "agent"].includes(account.role)) return false;
    await markEmailVerified(tx, accountId, account.email);
    await tx.execute(sql`
      UPDATE auth_password_recovery
      SET used_at=coalesce(used_at, now())
      WHERE account_id=${accountId} AND purpose='email_verify' AND used_at IS NULL
    `);
    return true;
  });
}
