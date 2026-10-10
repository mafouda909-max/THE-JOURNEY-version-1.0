import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, FileText, MessageSquare } from "lucide-react";
import {
  OFFER_STATUS_LABELS,
  CONTACT_STATUS_LABELS,
} from "@/lib/agent-workspace";
import {
  formatMoney,
  PRICE_TYPE_LABELS,
  timeAgo,
  tripTypeLabel,
} from "@/lib/format";
import type { ContactRequest, Offer } from "@/db/schema";
import { AgentLeadActions } from "@/components/AgentLeadActions";
import { ShareOfferButton } from "@/components/market/ShareOfferButton";

export const primaryAction =
  "inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-horizon hover:shadow-[0_10px_28px_rgba(38,67,168,.16)]";
export const secondaryAction =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outlinev bg-cloud px-4 py-2.5 text-sm font-bold text-deep transition-[border-color,background-color] duration-150 hover:border-sky hover:bg-air/35";

export function WorkspaceIntro({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-9 border-b border-outlinev pb-7">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 max-w-3xl">
          <p className="sila-eyebrow text-[11px] font-bold text-signal">مساحة الوكيل</p>
          <h1 className="mt-4 text-[clamp(2.4rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.04em] text-deep">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate">{note}</p>
        </div>
        {children}
      </div>
    </header>
  );
}

export function MissingAgent() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-bold text-deep">تعذر عرض ملف الوكيل</h1>
      <p
        role="alert"
        className="mt-4 rounded-xl bg-errorbg p-5 text-sm leading-7 text-error"
      >
        حسابك غير مرتبط بملف وكيل متاح. بيانات تسجيل الدخول محفوظة؛ حاول تحديث
        الصفحة أو راجع إعداد حسابك.
      </p>
      <Link href="/account/security" className={`${secondaryAction} mt-5`}>
        أمان الحساب وكلمة المرور
      </Link>
    </div>
  );
}

export function EmptyWork({
  kind,
  pending = false,
}: {
  kind: "offers" | "requests";
  pending?: boolean;
}) {
  const Icon = kind === "offers" ? FileText : MessageSquare;
  return (
    <div className="grid grid-cols-[40px_1fr] gap-4 border-y border-outlinev px-1 py-7">
      <span className="grid h-10 w-10 place-items-center text-slate">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-deep">
          {kind === "offers" ? "لا عروض بعد" : "لا طلبات تواصل بعد"}
        </p>
        <p className="mt-2 max-w-md text-sm leading-7 text-slate">
          {kind === "offers"
            ? pending
              ? "إرسال العروض للمراجعة يتاح بعد اعتماد الوكيل. تقدر تجهّز ملفك المهني الآن."
              : "ابدأ بعرض يوضح السعر والمشمولات. يراجعه فريق الثقة قبل ظهوره للمسافرين."
            : "تظهر هنا طلبات المسافرين المرسلة على عروضك، مع تفاصيلها وإجراءات المتابعة."}
        </p>
      </div>
    </div>
  );
}

export function OfferRow({
  offer,
  agentApproved = true,
}: {
  offer: Offer;
  agentApproved?: boolean;
}) {
  const status =
    offer.status === "published" &&
    offer.expiresAt &&
    offer.expiresAt <= new Date()
      ? "expired"
      : offer.status === "published" && !agentApproved
        ? "blocked"
        : offer.status;
  return (
    <article className="border-b border-outlinev px-1 py-5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-slate">{tripTypeLabel(offer.tripType)}</div>
          <h3 className="mt-1 break-words text-base font-bold tracking-[-0.015em] text-deep">
            {offer.title}
          </h3>
          <div className="intent-route mt-3 max-w-md">
            <span className="intent-route__point truncate">{offer.originCity}</span>
            <span className="intent-route__line" />
            <span className="intent-route__point truncate">{offer.destinationCity}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-deep">
            <span className="tnum">
              {formatMoney(offer.priceAmount, offer.currency)}
            </span>{" "}
            <span className="text-xs font-normal text-slate">
              {PRICE_TYPE_LABELS[offer.priceType]}
            </span>
          </p>
        </div>
        <span
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === "published" ? "bg-verifiedbg text-verified" : status === "rejected" ? "bg-errorbg text-error" : status === "pending_review" ? "bg-amber text-gold" : "bg-low text-slate"}`}
        >
          {OFFER_STATUS_LABELS[status] ?? "غير متاح للنشر"}
        </span>
      </div>
      {offer.rejectionReason && status === "rejected" && (
        <p className="mt-3 text-xs leading-6 text-error">
          ملاحظات المراجعة: {offer.rejectionReason}
        </p>
      )}
      {status === "published" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href={`/offers/${offer.id}`}
            className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-signal"
          >
            عرض الصفحة العامة
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <ShareOfferButton offerId={offer.id} title={offer.title} compact />
        </div>
      )}
    </article>
  );
}

export function RequestRow({
  request,
  actionable = false,
}: {
  request: ContactRequest;
  actionable?: boolean;
}) {
  return (
    <article className="border-b border-outlinev px-1 py-5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold text-signal">طلب مسافر</div>
          <h3 className="mt-1 break-words text-base font-bold text-deep">
            {request.travelerName}
          </h3>
        </div>
        <span
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${request.status === "new" ? "bg-amber text-gold" : "bg-low text-slate"}`}
        >
          {CONTACT_STATUS_LABELS[request.status] ?? "حالة غير متاحة"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate">
        {timeAgo(request.createdAt)} · {request.travelerCount} مسافرين ·{" "}
        {request.travelDates ?? "تواريخ مرنة"}
      </p>
      <p
        className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate ${actionable ? "" : "line-clamp-2"}`}
      >
        {request.message}
      </p>
      {actionable && (
        <AgentLeadActions
          key={`${request.id}:${request.status}`}
          requestId={request.id}
          initialStatus={request.status}
          travelerEmail={request.travelerEmail}
          travelerName={request.travelerName}
        />
      )}
    </article>
  );
}

export function WorkspacePagination({
  page,
  total,
  pageSize,
  href,
}: {
  page: number;
  total: number;
  pageSize: number;
  href: string;
}) {
  if (!total) return null;
  const pages = Math.ceil(total / pageSize);
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate">
      <span>
        عرض {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} من{" "}
        {total}
      </span>
      <nav aria-label="صفحات النتائج" className="flex gap-2">
        {page > 1 && (
          <Link href={`${href}?page=${page - 1}`} className={secondaryAction}>
            السابق
          </Link>
        )}
        {page < pages && (
          <Link href={`${href}?page=${page + 1}`} className={secondaryAction}>
            التالي
          </Link>
        )}
      </nav>
    </div>
  );
}
