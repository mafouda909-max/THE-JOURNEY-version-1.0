import Link from "next/link";
import { ArrowLeft, Check, Circle, FileText, MessageSquare, Shield } from "lucide-react";
import {
  agentVerificationState,
  profilePreparation,
} from "@/lib/agent-workspace";
import {
  agentWorkspaceCounts,
  ownedAgent,
  ownedOffers,
  ownedRequests,
  workspaceAccount,
} from "@/lib/agent-workspace-data";
import {
  EmptyWork,
  MissingAgent,
  OfferRow,
  RequestRow,
  secondaryAction,
} from "./WorkspaceParts";

export async function AgentDashboard() {
  const [account, agent] = await Promise.all([
    workspaceAccount(),
    ownedAgent(),
  ]);
  if (!agent) return <MissingAgent />;

  const [counts, offers, requests] = await Promise.all([
    agentWorkspaceCounts(agent.id, account.id),
    ownedOffers(agent.id, 3),
    ownedRequests(agent.id, 3),
  ]);

  const verification = agentVerificationState(agent.verificationStatus);
  const prepared = profilePreparation(agent);

  const nextAction =
    agent.verificationStatus !== "verified"
      ? {
          eyebrow: "اعتماد الوكيل",
          title: verification.title,
          note: verification.note,
          href: verification.href,
          label: verification.action,
          tone: "critical" as const,
        }
      : counts.newRequests > 0
        ? {
            eyebrow: "مسافر ينتظر متابعة",
            title: `عندك ${counts.newRequests} ${counts.newRequests === 1 ? "طلب جديد" : "طلبات جديدة"} تحتاج قراءة.`,
            note: "ابدأ بالطلب الأحدث، وافهم السياق قبل تغيير الحالة أو إرسال Quote.",
            href: "/account/requests",
            label: "راجع الطلبات الجديدة",
            tone: "focus" as const,
          }
        : counts.pendingReview > 0
          ? {
              eyebrow: "دورة المراجعة",
              title: `عندك ${counts.pendingReview} ${counts.pendingReview === 1 ? "عرض" : "عروض"} قيد المراجعة.`,
              note: "لا تنشئ نسخة بديلة لنفس العرض. راجع الحالة والملاحظات أولًا.",
              href: "/account/offers",
              label: "راجع حالة العروض",
              tone: "focus" as const,
            }
          : counts.offers === 0
            ? {
                eyebrow: "العرض الأول",
                title: "لا يوجد عرض في دورة العمل حتى الآن.",
                note: "ابدأ بعرض واحد واضح: مسار، سعر، مشمولات، مستثنيات، ثم أرسله للمراجعة.",
                href: "/account/offers",
                label: "أنشئ عرضًا للمراجعة",
                tone: "focus" as const,
              }
            : {
                eyebrow: "حالة العمل مستقرة",
                title: "لا يوجد إجراء عاجل الآن.",
                note: "راجع عروضك المنشورة أو حسّن الملف المهني فقط إذا عندك معلومة حقيقية جديدة.",
                href: "/account/offers",
                label: "افتح العروض",
                tone: "calm" as const,
              };

  return (
    <main className="mx-auto max-w-6xl px-5 pb-12 pt-8 md:px-8 md:pt-10">
      <header className="border-b border-outlinev pb-8">
        <div className="sila-eyebrow text-[11px] font-bold">مساحة الوكيل</div>
        <h1 className="mt-4 text-[clamp(2.5rem,5vw,4.4rem)] font-bold leading-[1.04] tracking-[-0.04em] text-deep">
          ما الذي يحتاج حركتك الآن؟
        </h1>
        <p className="mt-4 max-w-[680px] text-sm leading-7 text-slate">
          <bdi>{agent.displayName}</bdi> · صلة ترتب العمل حسب الحالة الفعلية:
          التوثيق، المراجعة، طلب المسافر، ثم الـQuote—بدل لوحة أرقام بلا أولوية.
        </p>
      </header>

      <section className="decision-board mt-8">
        <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
          <div className="p-5 md:p-7">
            <div className={
              "decision-state " +
              (nextAction.tone === "critical"
                ? "decision-state--conflicting"
                : nextAction.tone === "focus"
                  ? "decision-state--focus"
                  : "decision-state--confirmed")
            }>
              {nextAction.eyebrow}
            </div>
            <h2 className="mt-5 max-w-2xl text-2xl font-bold leading-9 tracking-[-0.025em] text-deep md:text-3xl">
              {nextAction.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate">{nextAction.note}</p>
            <Link href={nextAction.href} className="focus-action mt-6">
              {nextAction.label}
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          <div className="border-t border-outlinev bg-low/40 p-5 lg:border-s lg:border-t-0 md:p-6">
            <div className="text-[10px] font-bold text-slate">حالة المسار</div>
            <div className="mt-4 space-y-4">
              {[
                {
                  label: "الهوية والتوثيق",
                  value: verification.label,
                  done: agent.verificationStatus === "verified",
                  href: "/account/verification",
                },
                {
                  label: "الملف المهني",
                  value: `${prepared.completed}/${prepared.total} مكتمل`,
                  done: prepared.completed === prepared.total,
                  href: "/account/profile",
                },
                {
                  label: "العروض",
                  value: counts.pendingReview ? `${counts.pendingReview} قيد المراجعة` : `${counts.offers} إجمالي`,
                  done: counts.offers > 0 && counts.pendingReview === 0,
                  href: "/account/offers",
                },
                {
                  label: "طلبات المسافرين",
                  value: counts.newRequests ? `${counts.newRequests} جديد` : "لا جديد",
                  done: counts.newRequests === 0,
                  href: "/account/requests",
                },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="grid grid-cols-[22px_1fr] gap-3">
                  {item.done ? (
                    <Check className="mt-0.5 h-4 w-4 text-verified" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 text-slate" />
                  )}
                  <div>
                    <div className="text-[12px] font-bold text-deep">{item.label}</div>
                    <div className="mt-0.5 text-[10px] text-slate">{item.value}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold text-slate">العروض</div>
              <h2 className="mt-1 text-xl font-bold text-deep">آخر دورة مراجعة</h2>
            </div>
            <Link href="/account/offers" className="quiet-action">
              الكل ({counts.offers})
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="border-y border-outlinev">
            {offers.length ? (
              offers.map((offer) => (
                <OfferRow
                  key={offer.id}
                  offer={offer}
                  agentApproved={agent.verificationStatus === "verified"}
                />
              ))
            ) : (
              <EmptyWork kind="offers" pending={agent.verificationStatus !== "verified"} />
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold text-slate">المسافرون</div>
              <h2 className="mt-1 text-xl font-bold text-deep">آخر طلبات التواصل</h2>
            </div>
            <Link href="/account/requests" className="quiet-action">
              الكل ({counts.requests})
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="border-y border-outlinev">
            {requests.length ? (
              requests.map((request) => <RequestRow key={request.id} request={request} />)
            ) : (
              <EmptyWork kind="requests" />
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-5 border-t border-outlinev pt-7 md:grid-cols-3">
        <Link href="/account/verification" className="grid grid-cols-[36px_1fr] gap-3">
          <Shield className="h-5 w-5 text-signal" />
          <div>
            <div className="text-[12px] font-bold text-deep">أدلة التوثيق</div>
            <div className="mt-1 text-[10px] leading-5 text-slate">ما رُفع، ما روجع، وما يحتاج استبدالًا.</div>
          </div>
        </Link>
        <Link href="/account/offers" className="grid grid-cols-[36px_1fr] gap-3">
          <FileText className="h-5 w-5 text-signal" />
          <div>
            <div className="text-[12px] font-bold text-deep">العروض والمراجعة</div>
            <div className="mt-1 text-[10px] leading-5 text-slate">اكتب العرض كمعلومة قابلة للمقارنة قبل النشر.</div>
          </div>
        </Link>
        <Link href="/account/requests" className="grid grid-cols-[36px_1fr] gap-3">
          <MessageSquare className="h-5 w-5 text-signal" />
          <div>
            <div className="text-[12px] font-bold text-deep">طلبات المسافرين</div>
            <div className="mt-1 text-[10px] leading-5 text-slate">حافظ على سياق المسافر قبل المتابعة.</div>
          </div>
        </Link>
      </section>

      <div className="mt-8">
        <Link href="/account/profile" className={secondaryAction}>تعديل الملف المهني</Link>
      </div>
    </main>
  );
}
