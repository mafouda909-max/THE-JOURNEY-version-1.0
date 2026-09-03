import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { accountFromRequest } from "@/lib/identity";

export const dynamic = "force-dynamic";

// own notifications only — account-scoped, never cross-account
export async function GET(request: Request) {
  const account = await accountFromRequest(request);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized — سجّل الدخول أولاً." }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.accountId, account.id))
    .orderBy(desc(notifications.createdAt))
    .limit(30);

  return NextResponse.json({
    unread: rows.filter((n) => !n.readAt).length,
    notifications: rows,
  });
}

export async function PATCH(request: Request) {
  const account = await accountFromRequest(request);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized — سجّل الدخول أولاً." }, { status: 401 });
  }

  // mark-all-read for this account only
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.accountId, account.id), isNull(notifications.readAt)),
    );

  return NextResponse.json({ ok: true });
}
