import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions } from "@/db/schema";
import type { Account } from "@/db/schema";

const SESSION_COOKIE = "tj_sess";
const SESSION_DAYS = 7;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function createSession(accountId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    token,
    accountId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  return token;
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  };
}

function tokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)tj_sess=([^;]+)/);
  return match?.[1] ?? null;
}

export async function accountForToken(token: string | null): Promise<Account | null> {
  if (!token) return null;
  const rows = await db
    .select({ account: accounts })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .where(eq(sessions.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row.account;
}

export async function accountFromRequest(request: Request): Promise<Account | null> {
  const token = tokenFromRequest(request);
  if (!token) return null;
  const rows = await db
    .select({ account: accounts, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .where(eq(sessions.token, token))
    .limit(1);
  if (!rows[0] || rows[0].expiresAt < new Date()) return null;
  return rows[0].account;
}

export function requireAccount(
  account: Account | null,
  roles?: string[],
): NextResponse | null {
  if (!account) {
    return NextResponse.json(
      { error: "Unauthorized — سجّل الدخول أولاً." },
      { status: 401 },
    );
  }
  if (roles && !roles.includes(account.role)) {
    return NextResponse.json(
      { error: "Forbidden — صلاحيات غير كافية." },
      { status: 403 },
    );
  }
  return null;
}

export async function accountFromCookies(): Promise<Account | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? null;
  if (!token) return null;
  const rows = await db
    .select({ expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);
  if (!rows[0] || rows[0].expiresAt < new Date()) return null;
  return accountForToken(token);
}

export async function endSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
