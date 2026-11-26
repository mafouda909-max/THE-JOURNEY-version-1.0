import type { Metadata } from "next";
import Link from "next/link";
import { AdminGate } from "@/components/AdminGate";
import { CommunityModerationQueue } from "@/components/community/CommunityDiscussion";
import { CommunityReportQueue } from "@/components/community/CommunityReportQueue";
import { adminAuthConfigured, isAdminSession } from "@/lib/auth";
import { isCommunityEnabled, listPendingCommunityComments, listPendingCommunityReports } from "@/lib/community";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مراجعة المجتمع | صلة",
  description: "طابور اعتماد تعليقات وردود مجتمع صلة.",
};

export default async function CommunityModerationPage() {
  const authorized = await isAdminSession();
  if (!authorized) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12">
        <AdminGate configured={adminAuthConfigured} />
      </main>
    );
  }

  const enabled = isCommunityEnabled();
  const pending = enabled ? await listPendingCommunityComments(100) : [];
  const pendingReports = enabled ? await listPendingCommunityReports(100) : [];

  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-5 py-10 md:px-8">
      <div className="mb-8">
        <Link href="/trust" className="text-xs font-semibold text-slate underline underline-offset-4">سياسات الثقة</Link>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.15em] text-signal">SILA · TRUST DESK</p>
        <h1 className="mt-2 text-3xl font-bold text-inkwell">مراجعة المجتمع والبلاغات</h1>
        <p className="mt-3 text-sm leading-7 text-slate">
          كل تعليق أو رد يظل غير ظاهر حتى يعتمد. نشر الرد يتطلب أن يكون التعليق الأصلي منشوراً.
        </p>
      </div>

      {!enabled ? (
        <div className="rounded-2xl border border-outlinev bg-cloud p-6 text-sm leading-7 text-slate">
          المجتمع غير مفعّل في هذه البيئة. لن تظهر قائمة المراجعة قبل تفعيل <code>COMMUNITY_ENABLED</code> والتحقق من ترحيل قاعدة البيانات.
        </div>
      ) : (
        <>
          <CommunityModerationQueue
            comments={pending.map((comment) => ({
              ...comment,
              createdAt: comment.createdAt.toISOString(),
            }))}
          />
          <CommunityReportQueue
            reports={pendingReports.map((report) => ({
              ...report,
              createdAt: report.createdAt.toISOString(),
            }))}
          />
        </>
      )}
    </main>
  );
}
