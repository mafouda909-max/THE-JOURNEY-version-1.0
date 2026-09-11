import type { Metadata } from "next";
import { Lock, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { desc, eq, ne } from "drizzle-orm";
import { getReviewQueue, getRecentContactRequests, getMarketplaceStats, getFunnel } from "@/lib/data";
import { adminAuthConfigured, isAdminSession } from "@/lib/auth";
import { AdminGate } from "@/components/AdminGate";
import { AdminQueue } from "@/components/market/AdminQueue";
import { GrowthDesk } from "@/components/market/GrowthDesk";
import { VerificationDesk } from "@/components/market/VerificationDesk";
import { ToolMatrix } from "@/components/market/ToolMatrix";
import { db } from "@/db";
import { accounts, agents } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "مركز الثقة والمراجعة",
  description: "مركز داخلي لمراجعة العروض، توثيق الوكلاء، إدارة الثقة، ومتابعة إشارات السوق في THE JOURNEY.",
  robots: { index: false },
};

function agentRows(status: "verified" | "not_verified", limit: number) {
  return db
    .select({ agent: agents, accountEmail: accounts.email })
    .from(agents)
    .leftJoin(accounts, eq(accounts.agentId, agents.id))
    .where(status === "verified" ? eq(agents.verificationStatus, "verified") : ne(agents.verificationStatus, "verified"))
    .orderBy(desc(agents.joinedAt))
    .limit(limit)
    .then((rows) => rows.map((row) => ({ ...row.agent, accountEmail: row.accountEmail })));
}

export default async function ReviewPage() {
  // Trust boundary: no operational data is fetched before the admin session verifies.
  if (!(await isAdminSession())) {
    return <AdminGate configured={adminAuthConfigured} />;
  }

  const [
    { pending, rejected },
    contacts,
    stats,
    funnel,
    verificationQueue,
    verifiedDirectoryAgents,
  ] = await Promise.all([
    getReviewQueue(),
    getRecentContactRequests(10),
    getMarketplaceStats(),
    getFunnel(),
    agentRows("not_verified", 30),
    agentRows("verified", 30),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <header className="mb-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-wash px-4 py-2 text-[13px] font-bold text-deep">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Trust + Market Intelligence Center
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          القرار هنا مبني على الدليل، لا على الشارة.
        </h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-slate">
          راجع ادعاءات العروض، أدلة الوكلاء، سلوك الطلبات، وإشارات التحويل. ما لا نملك له مصدر تحقق خارجيًا يظهر بوضوح كـ«ادعاء وكيل» أو «غير متحقق» بدل ثقة مصطنعة.
        </p>
        <div className="mt-6 inline-flex items-start gap-2 rounded-lg border border-outlinev bg-low px-4 py-3 text-[12px] leading-relaxed text-slate">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          هذه بوابة داخلية محمية بجلسة إدارية محدودة الصلاحية. انتقالات الثقة الحساسة تُسجَّل مع الحالة السابقة والجديدة والسبب، والتحقق النهائي من أدلة KYC يعاد على الخادم لحظة الاعتماد.
        </div>
      </header>

      <AdminQueue pending={pending} rejected={rejected} contacts={contacts} stats={stats} funnel={funnel} />

      <section className="mt-20 border-t border-outlinev pt-14">
        <h2 className="flex items-center gap-3 text-2xl font-bold text-inkwell md:text-3xl">
          <UserCheck className="h-6 w-6 text-deep" aria-hidden="true" />
          طابور توثيق الوكلاء ({verificationQueue.length})
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate">
          المسار التشغيلي هو: انتظار بدء المراجعة → قيد المراجعة → موثّق أو مرفوض. الأدلة المعروضة للمراجع لا تكفي وحدها؛ الخادم يعيد التأكد من وجود الملفات وصلاحيتها قبل أي اعتماد.
        </p>
        <VerificationDesk queue={verificationQueue} />
      </section>

      <section className="mt-20 border-t border-outlinev pt-14">
        <h2 className="flex items-center gap-3 text-2xl font-bold text-inkwell md:text-3xl">
          <UsersRound className="h-6 w-6 text-deep" aria-hidden="true" />
          الوكلاء الموثقون — إدارة الحالة ({verifiedDirectoryAgents.length})
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate">
          التوثيق ليس دائمًا إلى الأبد. من هنا يمكن إعادة فحص الأدلة أو إيقاف وكيل مؤقتًا بسبب موثق؛ الإيقاف يزيله من الاكتشاف العام لأن واجهات السوق تفشل مغلقة لغير الموثقين حاليًا.
        </p>
        <VerificationDesk queue={verifiedDirectoryAgents} mode="verified" />
      </section>

      <GrowthDesk />
      <ToolMatrix />
    </div>
  );
}
