"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Eye,
  Loader2,
  MessageSquareText,
  Star,
  Timer,
  XCircle,
} from "lucide-react";
import type { ContactWithRefs, OfferWithAgent } from "@/lib/data";
import {
  formatMoney,
  formatDay,
  timeAgo,
  tripTypeLabel,
  PRICE_TYPE_LABELS,
} from "@/lib/format";

function ContactStatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: "جديد", cls: "bg-amber text-gold" },
    viewed: { label: "شوهد", cls: "bg-wash text-deep" },
    responded: { label: "تم الرد", cls: "bg-verifiedbg text-verified" },
    closed: { label: "مغلق", cls: "bg-low text-slate" },
  };
  const s = map[status] ?? map.new;
  return (
    <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function QueueCard({
  offer,
  onDone,
}: {
  offer: OfferWithAgent;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    if (action === "reject" && reason.trim().length < 10) {
      setError("سبب الرفض مطلوب (١٠ أحرف على الأقل) — يُرسل للوكيل كما هو.");
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر التنفيذ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <motion.div
      layout
      exit={{ opacity: 0, x: -30 }}
      className="rounded-xl border border-outlinev bg-cloud p-5 md:p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg md:w-44">
          <Image
            src={offer.heroImage}
            alt={offer.title}
            fill
            sizes="(max-width: 768px) 100vw, 176px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-wash px-2 py-1 text-[11px] font-semibold text-deep">
              {tripTypeLabel(offer.tripType)}
            </span>
            <span className="text-[12px] text-slate">{offer.agent.displayName}</span>
            <span className="text-[12px] text-slate/60">·</span>
            <span className="inline-flex items-center gap-1 text-[12px] text-slate">
              <Timer className="h-3.5 w-3.5" />
              أُرسل {timeAgo(offer.createdAt)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-inkwell">{offer.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate">
            <span className="tnum font-bold text-deep">
              {formatMoney(offer.priceAmount, offer.currency)}{" "}
              <span className="font-normal text-slate">
                {PRICE_TYPE_LABELS[offer.priceType]}
              </span>
            </span>
            <span>{offer.originCity} ← {offer.destinationCity}</span>
            <span>{offer.includes.length} مشمولات مذكورة</span>
          </div>

          <details className="mt-3">
            <summary className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-deep">
              <Eye className="h-3.5 w-3.5" />
              معاينة الوصف وقائمة المراجعة
            </summary>
            <div className="mt-3 rounded-lg bg-low p-4 text-[13px] leading-relaxed text-slate">
              {offer.description.split("\n\n")[0]}
              <ul className="mt-3 space-y-1 border-t border-outlinev pt-3 text-[12px]">
                <li>✓ السعر معلن مع نوع التسعير: {PRICE_TYPE_LABELS[offer.priceType]}</li>
                <li>✓ نوع الرحلة مطابق للمحتوى</li>
                <li>✓ المشمولات ({offer.includes.length}) والمستثنيات ({offer.excludes.length}) مفصلة</li>
                <li>✓ لا توجد بيانات تواصل مباشر في الوصف</li>
              </ul>
            </div>
          </details>

          {error && (
            <p className="mt-3 rounded-lg bg-errorbg px-3.5 py-2.5 text-[12px] font-semibold text-error">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => act("approve")}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-verified px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              اعتماد ونشر (٩٠ يوماً)
            </button>
            <button
              onClick={() => setRejecting((v) => !v)}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-error/40 px-5 py-2.5 text-[13px] font-bold text-error transition-colors hover:bg-error hover:text-white disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              رفض مع سبب
            </button>
          </div>

          <AnimatePresence>
            {rejecting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="سبب الرفض — سيصل للوكيل نصاً…"
                    className="flex-1 rounded-lg border border-outlinev px-4 py-2.5 text-[13px] outline-none focus:border-error focus:ring-4 focus:ring-error/10"
                  />
                  <button
                    onClick={() => act("reject")}
                    disabled={busy !== null}
                    className="rounded-lg bg-error px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    {busy === "reject" ? "…" : "تأكيد الرفض"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

const FUNNEL_LABELS: Record<string, string> = {
  landing_view: "زيارات",
  search_submitted: "عمليات بحث",
  offer_viewed: "مشاهدات العروض",
  agent_viewed: "مشاهدات الملفات",
  contact_started: "بدء تواصل",
  contact_submitted: "طلبات مرسَلة",
};

export function AdminQueue({
  pending,
  rejected,
  contacts,
  stats,
  funnel,
}: {
  pending: OfferWithAgent[];
  rejected: OfferWithAgent[];
  contacts: ContactWithRefs[];
  stats: { published: number; pending: number; verifiedAgents: number; contactRequests: number };
  funnel: { steps: { name: string; count: number }[]; contactRatePct: number };
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const maxStep = Math.max(1, ...funnel.steps.map((s) => s.count));

  const statCards = [
    { value: stats.pending, label: "عروض بانتظار المراجعة", accent: true },
    { value: stats.published, label: "عروض منشورة الآن", accent: false },
    { value: stats.verifiedAgents, label: "وكلاء موثّقون", accent: false },
    { value: stats.contactRequests, label: "طلبات تواصل كلية", accent: false },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border p-5 ${
              s.accent ? "border-gold/40 bg-amber" : "border-outlinev bg-cloud"
            }`}
          >
            <div className={`tnum text-4xl font-bold ${s.accent ? "text-gold" : "text-deep"}`}>
              {s.value}
            </div>
            <div className="mt-2 text-[13px] font-semibold text-slate">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-outlinev bg-cloud p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-inkwell">قمع التحويل</h2>
          <span className="rounded-lg bg-wash px-3 py-1.5 text-[12px] font-bold text-deep">
            مشاهدة → طلب: <span className="tnum">{funnel.contactRatePct}%</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {funnel.steps.map((s) => (
            <div key={s.name}>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-semibold text-slate">{FUNNEL_LABELS[s.name] ?? s.name}</span>
                <span className="tnum text-lg font-bold text-deep">{s.count}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-low">
                <div
                  className="h-full rounded-full bg-deep transition-all duration-700"
                  style={{ width: `${(s.count / maxStep) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-slate/60">
          منذ تفعيل القياس · جدول الأحداث events · بدون تعريف شخصي
        </p>
      </div>

      <h2 className="mt-14 flex items-center gap-3 text-2xl font-bold text-inkwell">
        <Star className="h-5 w-5 text-gold" />
        طابور مراجعة العروض
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
        هدف الخدمة: ٤٨ ساعة لكل عرض. عند الاعتماد يُنشر العرض فوراً وتُضبط
        صلاحيته على ٩٠ يوماً؛ وعند الرفض يصل السبب للوكيل مع إمكانية إعادة
        التقديم.
      </p>

      {pending.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-outlinev bg-cloud px-8 py-14 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-verified" strokeWidth={1.5} />
          <p className="mt-4 text-lg font-bold text-inkwell">الطابور صافٍ تماماً.</p>
          <p className="mt-1 text-sm text-slate">لا عروض بانتظار المراجعة حالياً.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <AnimatePresence>
            {pending.map((o) => (
              <QueueCard key={o.id} offer={o} onDone={refresh} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {rejected.length > 0 && (
        <>
          <h2 className="mt-14 text-2xl font-bold text-inkwell">مرفوض مؤخراً</h2>
          <div className="mt-6 space-y-4">
            {rejected.map((o) => (
              <div key={o.id} className="rounded-xl border border-error/25 bg-errorbg/60 p-5">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate">
                  <XCircle className="h-4 w-4 text-error" />
                  <span className="font-semibold text-inkwell">{o.agent.displayName}</span>
                  <span>·</span>
                  <span>{formatDay(o.createdAt)}</span>
                </div>
                <h3 className="mt-2 font-bold text-inkwell">{o.title}</h3>
                <p className="mt-2 rounded-lg bg-cloud/70 p-3 text-[13px] leading-relaxed text-error">
                  {o.rejectionReason}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mt-14 flex items-center gap-3 text-2xl font-bold text-inkwell">
        <MessageSquareText className="h-5 w-5 text-deep" />
        أحدث طلبات التواصل عبر المنصة
      </h2>
      <div className="mt-6 overflow-hidden rounded-xl border border-outlinev bg-cloud">
        {contacts.map((c, i) => (
          <div
            key={c.id}
            className={`grid grid-cols-1 gap-2 p-4 md:grid-cols-12 md:items-center ${
              i > 0 ? "border-t border-low" : ""
            }`}
          >
            <div className="md:col-span-3">
              <div className="text-[14px] font-bold text-inkwell">{c.travelerName}</div>
              <div className="mt-0.5 font-mono text-[11px] text-slate">{timeAgo(c.createdAt)}</div>
            </div>
            <div className="md:col-span-4">
              <div className="line-clamp-1 text-[13px] font-semibold text-deep">{c.offerTitle}</div>
              <div className="text-[12px] text-slate">إلى: {c.agentName}</div>
            </div>
            <div className="md:col-span-3">
              <p className="line-clamp-2 text-[12px] leading-relaxed text-slate">{c.message}</p>
            </div>
            <div className="md:col-span-2 md:text-end">
              <ContactStatusChip status={c.status} />
            </div>
          </div>
        ))}
        {contacts.length === 0 && (
          <div className="p-10 text-center text-sm text-slate">لا طلبات بعد.</div>
        )}
      </div>
    </div>
  );
}
