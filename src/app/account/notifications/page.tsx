import type { Metadata } from "next";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { Bell } from "lucide-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import {
  workspaceAccount,
  WORKSPACE_PAGE_SIZE,
  workspacePage,
} from "@/lib/agent-workspace-data";
import { timeAgo } from "@/lib/format";
import { MarkAllRead } from "@/components/AccountDock";
import { WorkspacePagination } from "@/components/account/WorkspaceParts";

export const metadata: Metadata = {
  title: "الإشعارات",
  robots: { index: false },
};
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [account, params] = await Promise.all([
    workspaceAccount(),
    searchParams,
  ]);
  const scope = eq(notifications.accountId, account.id);
  const [totals, unreadTotals] = await Promise.all([
    db.select({ total: count() }).from(notifications).where(scope),
    db
      .select({ total: count() })
      .from(notifications)
      .where(and(scope, isNull(notifications.readAt))),
  ]);
  const total = totals[0]?.total ?? 0;
  const unread = unreadTotals[0]?.total ?? 0;
  const page = Math.min(
    workspacePage(params.page),
    Math.max(1, Math.ceil(total / WORKSPACE_PAGE_SIZE)),
  );
  const rows = await db
    .select()
    .from(notifications)
    .where(scope)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(WORKSPACE_PAGE_SIZE)
    .offset((page - 1) * WORKSPACE_PAGE_SIZE);
  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-7 md:px-8 md:pt-9">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="sila-eyebrow text-xs font-semibold text-signal">
            تحديثات حسابك
          </p>
          <h1 className="mt-2 text-3xl font-bold text-deep">الإشعارات</h1>
          <p className="mt-2 text-sm leading-7 text-slate">
            {unread} إشعار غير مقروء · تحديثات ملفك وعروضك وطلبات التواصل.
          </p>
        </div>
        {unread > 0 && <MarkAllRead />}
      </div>
      <section
        className="sila-window overflow-hidden border border-outlinev bg-cloud"
        aria-label="قائمة الإشعارات"
      >
        {rows.length ? (
          rows.map((item) => (
            <article
              key={item.id}
              className={`border-b border-outlinev p-5 last:border-b-0 ${item.readAt ? "" : "bg-air/40"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-sm font-bold text-deep">{item.title}</h2>
                <span className="text-xs text-slate">
                  {timeAgo(item.createdAt)} ·{" "}
                  {item.readAt ? "مقروء" : "غير مقروء"}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate">
                {item.body}
              </p>
            </article>
          ))
        ) : (
          <div className="flex items-start gap-3 p-6">
            <Bell
              className="mt-1 h-5 w-5 shrink-0 text-signal"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-bold text-deep">لا إشعارات بعد</h2>
              <p className="mt-2 text-sm leading-7 text-slate">
                تظهر تحديثات حسابك هنا عند وصولها. لا تحتاج لاتخاذ أي إجراء
                الآن.
              </p>
            </div>
          </div>
        )}
      </section>
      <WorkspacePagination
        page={page}
        total={total}
        pageSize={WORKSPACE_PAGE_SIZE}
        href="/account/notifications"
      />
    </div>
  );
}
