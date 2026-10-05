import Link from "next/link";
import {
  Bell,
  Check,
  Circle,
  FileText,
  MessageSquare,
  Shield,
  UserRound,
} from "lucide-react";
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
  primaryAction,
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
  const state = agentVerificationState(agent.verificationStatus);
  const prepared = profilePreparation(agent);
  const stats = [
    {
      label: "إجمالي العروض",
      value: counts.offers,
      note: `${counts.pendingReview} قيد المراجعة`,
      href: "/account/offers",
      icon: FileText,
    },
    {
      label: "عروض متاحة للمسافرين",
      value: agent.verificationStatus === "verified" ? counts.published : 0,
      note: "معتمدة وسارية",
      href: "/account/offers",
      icon: Shield,
    },
    {
      label: "طلبات التواصل",
      value: counts.requests,
      note: `${counts.newRequests} طلب جديد`,
      href: "/account/requests",
      icon: MessageSquare,
    },
    {
      label: "إشعارات غير مقروءة",
      value: counts.unread,
      note: "آخر تحديثات حسابك",
      href: "/account/notifications",
      icon: Bell,
    },
  ];
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-7 md:px-8 md:pt-9">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="sila-eyebrow text-xs font-semibold text-signal">
            نظرة عامة
          </p>
          <h1 className="mt-2 break-words text-2xl font-bold text-deep md:text-3xl">
            مرحباً، <bdi>{agent.displayName}</bdi>
          </h1>
          <p className="mt-2 text-sm leading-7 text-slate">
            ملفك وعروضك ومتابعة المسافرين في مساحة واحدة.
          </p>
        </div>
        <Link href="/account/profile" className={secondaryAction}>
          <UserRound className="h-4 w-4" aria-hidden="true" />
          تعديل الملف المهني
        </Link>
      </div>
      <section
        aria-label="ملخص مساحة الوكيل"
        className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {stats.map(({ label, value, note, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="sila-window border border-outlinev bg-cloud p-4 transition-colors hover:border-signal sm:p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold leading-6 text-slate">
                {label}
              </span>
              <Icon
                className="h-[18px] w-[18px] shrink-0 text-signal"
                aria-hidden="true"
              />
            </div>
            <p className="tnum mt-3 text-3xl font-bold text-deep">{value}</p>
            <p className="mt-2 text-xs leading-6 text-slate">{note}</p>
          </Link>
        ))}
      </section>
      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section
          className="sila-window border border-outlinev bg-cloud p-5 sm:p-6"
          aria-label="اعتماد الوكيل"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-deep">توثيق الوكيل</h2>
            <span
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${state.tone === "verified" ? "bg-verifiedbg text-verified" : state.tone === "error" ? "bg-errorbg text-error" : state.tone === "review" ? "bg-amber text-gold" : "bg-low text-slate"}`}
            >
              حالة التوثيق: {state.label}
            </span>
          </div>
          <h3 className="mt-5 text-lg font-bold leading-8 text-deep">
            {state.title}
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate">{state.note}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={state.href} className={primaryAction}>
              {state.action}
            </Link>
            {agent.verificationStatus === "pending" && (
              <Link href="/account/verification" className={secondaryAction}>
                ابدأ التوثيق عندما تكون جاهزًا
              </Link>
            )}
          </div>
          <p className="mt-5 border-t border-outlinev pt-4 text-xs leading-6 text-slate">
            اعتماد الوكيل مستقل عن تأكيد البريد. حسابك يظل متاحًا أثناء تجهيز
            الملف والمراجعة.
          </p>
        </section>
        <section
          className="sila-window border border-outlinev bg-cloud p-5 sm:p-6"
          aria-label="تجهيز الملف المهني"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-deep">
              تجهيز الملف المهني
            </h2>
            <span className="tnum text-xs font-semibold text-signal">
              {prepared.completed}/{prepared.total}
            </span>
          </div>
          <p className="mt-2 text-xs leading-6 text-slate">
            اكتمال البيانات فقط، وليس حالة اعتماد الوكيل.
          </p>
          <ul className="mt-4 space-y-3">
            {prepared.checks.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-3 text-sm text-deep"
              >
                {item.done ? (
                  <Check
                    className="h-4 w-4 shrink-0 text-signal"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-4 w-4 shrink-0 text-slate"
                    aria-hidden="true"
                  />
                )}
                <span>{item.label}</span>
                <span className="sr-only">
                  {item.done ? "مكتمل" : "يحتاج إكمالًا"}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/account/profile"
            className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-signal hover:underline"
          >
            إكمال البيانات
          </Link>
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="sila-window overflow-hidden border border-outlinev bg-cloud">
          <div className="flex items-center justify-between gap-3 border-b border-outlinev px-5 py-4">
            <h2 className="text-base font-bold text-deep">آخر العروض</h2>
            <Link
              href="/account/offers"
              className="inline-flex min-h-11 items-center text-xs font-bold text-signal"
            >
              كل العروض ({counts.offers})
            </Link>
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
        <section className="sila-window overflow-hidden border border-outlinev bg-cloud">
          <div className="flex items-center justify-between gap-3 border-b border-outlinev px-5 py-4">
            <h2 className="text-base font-bold text-deep">آخر طلبات التواصل</h2>
            <Link
              href="/account/requests"
              className="inline-flex min-h-11 items-center text-xs font-bold text-signal"
            >
              كل الطلبات ({counts.requests})
            </Link>
          </div>
          {requests.length ? (
            requests.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))
          ) : (
            <EmptyWork kind="requests" />
          )}
        </section>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outlinev bg-cloud px-5 py-3">
        <span className="text-xs leading-6 text-slate">
          كلمة المرور وتأكيد البريد في إعدادات الأمان.
        </span>
        <Link
          href="/account/security"
          className="inline-flex min-h-11 items-center text-xs font-bold text-deep"
        >
          أمان الحساب وكلمة المرور
        </Link>
      </div>
    </div>
  );
}
