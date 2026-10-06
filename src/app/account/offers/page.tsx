import type { Metadata } from "next";
import Link from "next/link";
import { AccountOfferForm } from "@/components/AccountOfferForm";
import {
  EmptyWork,
  MissingAgent,
  OfferRow,
  secondaryAction,
  WorkspaceIntro,
  WorkspacePagination,
} from "@/components/account/WorkspaceParts";
import {
  agentWorkspaceCounts,
  ownedAgent,
  ownedOffers,
  WORKSPACE_PAGE_SIZE,
  workspaceAccount,
  workspacePage,
} from "@/lib/agent-workspace-data";

export const metadata: Metadata = {
  title: "عروض الوكيل",
  robots: { index: false },
};
export default async function AgentOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [agent, account, params] = await Promise.all([
    ownedAgent(),
    workspaceAccount(),
    searchParams,
  ]);
  if (!agent) return <MissingAgent />;
  const counts = await agentWorkspaceCounts(agent.id, account.id);
  const page = Math.min(
    workspacePage(params.page),
    Math.max(1, Math.ceil(counts.offers / WORKSPACE_PAGE_SIZE)),
  );
  const offers = await ownedOffers(
    agent.id,
    WORKSPACE_PAGE_SIZE,
    (page - 1) * WORKSPACE_PAGE_SIZE,
  );
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-7 md:px-8 md:pt-9">
      <WorkspaceIntro
        title="العروض"
        note="تابع عروضك وحالة مراجعتها. لا يظهر عرض للمسافرين قبل اعتماد الوكيل ومراجعة العرض."
      />
      {agent.verificationStatus === "verified" ? (
        <div className="mb-6">
          <AccountOfferForm />
        </div>
      ) : (
        <section className="mb-7 border-y border-outlinev bg-air/35 py-5">
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">قبل النشر</div>
          <h2 className="mt-2 font-bold text-deep">
            إرسال العروض يبدأ بعد اعتماد الوكيل
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate">
            جهّز ملفك المهني الآن، وابدأ التوثيق عندما تكون جاهزًا. تسجيل الحساب
            لا يتطلب هذه الخطوة.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/account/profile" className={secondaryAction}>
              تجهيز الملف المهني
            </Link>
            <Link href="/account/verification" className={secondaryAction}>
              ملف التوثيق
            </Link>
          </div>
        </section>
      )}
      <section className="overflow-hidden border-y border-outlinev bg-cloud">
        <div className="flex items-center justify-between gap-4 border-b border-outlinev bg-low/35 px-5 py-4 md:px-6">
          <h2 className="text-base font-bold text-deep">
            كل العروض ({counts.offers})
          </h2>
        </div>
        {offers.length ? (
          offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              agentApproved={agent.verificationStatus === "verified"}
            />
          ))
        ) : (
          <EmptyWork
            kind="offers"
            pending={agent.verificationStatus !== "verified"}
          />
        )}
      </section>
      <WorkspacePagination
        page={page}
        total={counts.offers}
        pageSize={WORKSPACE_PAGE_SIZE}
        href="/account/offers"
      />
    </div>
  );
}
