import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { SilaAgentIcon } from "@/components/brand/SilaIcons";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { getReviewQueue, getRecentContactRequests, getMarketplaceStats, getFunnel } from "@/lib/data";
import { adminAuthConfigured, isAdminSession } from "@/lib/auth";
import { AdminGate } from "@/components/AdminGate";
import { AdminQueue } from "@/components/market/AdminQueue";
import { GrowthDesk } from "@/components/market/GrowthDesk";
import { VerificationDesk } from "@/components/market/VerificationDesk";
import { ToolMatrix } from "@/components/market/ToolMatrix";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { accounts, agents } from "@/db/schema";


export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "بوابة المراجعة",
  description: "طابور مراجعة العروض وطلبات التواصل — فريق الثقة في منصة صلة.",
  robots: { index: false },
};

export default async function ReviewPage() {
  // P1 boundary: the desk fetches nothing until the admin session verifies.
  if (!(await isAdminSession())) {
    return <AdminGate configured={adminAuthConfigured} />;
  }

  const [{ pending, rejected }, contacts, stats, funnel, verificationQueue] = await Promise.all([
    getReviewQueue(),
    getRecentContactRequests(10),
    getMarketplaceStats(),
    getFunnel(),
    db
      .select({ agent: agents, accountEmail: accounts.email })
      .from(agents)
      .leftJoin(accounts, eq(accounts.agentId, agents.id))
      .where(ne(agents.verificationStatus, "verified"))
      .orderBy(desc(agents.joinedAt))
      .limit(20)
      .then((rows) => rows.map((r) => ({ ...r.agent, accountEmail: r.accountEmail }))),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <SilaPageIntro
        eyebrow="فريق الثقة · بوابة المراجعة"
        title="سلامة السوق تبدأ من هنا."
        description="كل عرض جديد يقف في هذا الطابور قبل أن يراه مسافر واحد. القرار الإداري هنا يجب أن يكون واضحاً، قابلاً للتدقيق، ومتصلاً بسبب يمكن الرجوع إليه."
        meta={
          <div className="inline-flex items-start gap-2 rounded-xl border border-outlinev bg-low px-4 py-3 text-[12px] leading-relaxed text-slate">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            سطح إداري محمي — الدخول والإجراءات الحساسة تبقى خلف صلاحيات الخادم وسجل التدقيق.
          </div>
        }
      />

      <AdminQueue pending={pending} rejected={rejected} contacts={contacts} stats={stats} funnel={funnel} />

      <section className="mt-20 border-t border-outlinev pt-14">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-inkwell md:text-3xl">
          <SilaAgentIcon className="h-6 w-6 text-signal" />
          طابور توثيق الوكلاء ({verificationQueue.length})
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate">
          الحسابات المسجلة ذاتياً تبقى خارج الدليل العام حتى قرارك الموثَّق.
          كل اعتماد ورفض وإيقاف يسجل في سجل القرارات مع السبب.
        </p>
        <VerificationDesk queue={verificationQueue} />
      </section>

      <GrowthDesk />

      <ToolMatrix />
    </div>
  );
}
