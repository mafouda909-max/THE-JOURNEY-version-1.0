import Link from "next/link";
import { ArrowLeft, CalendarClock, FileText, ShieldCheck } from "lucide-react";
import { AgentTrustChip } from "@/components/market/AgentTrust";
import type { OfferWithAgent } from "@/lib/data";
import {
  formatMoney,
  PRICE_TYPE_LABELS,
  tripTypeLabel,
} from "@/lib/format";

function dateLabel(value: Date | null) {
  if (!value) return "غير محددة";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

export function OfferCard({
  offer,
  intentId,
}: {
  offer: OfferWithAgent;
  rating?: number;
  intentId?: number | null;
}) {
  const href = intentId ? `/offers/${offer.id}?intentId=${intentId}` : `/offers/${offer.id}`;

  return (
    <Link
      href={href}
      className="offer-dossier group block transition-[background-color,border-color,box-shadow] duration-150 hover:bg-air/25"
    >
      <div className="grid gap-6 px-5 py-6 md:px-7 lg:grid-cols-[1.25fr_.72fr_.9fr] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="font-bold text-signal">{tripTypeLabel(offer.tripType)}</span>
            <span className="text-slate">#{offer.id}</span>
            {offer.isFeatured ? (
              <span className="border-s border-outlinev ps-3 font-semibold text-earth">مختار للمراجعة</span>
            ) : null}
          </div>

          <div className="intent-route mt-4 max-w-xl">
            <span className="intent-route__point truncate">{offer.originCity}</span>
            <span className="intent-route__line" />
            <span className="intent-route__point truncate">{offer.destinationCity}</span>
          </div>

          <h3 className="mt-5 text-xl font-bold leading-8 tracking-[-0.02em] text-deep md:text-2xl">
            {offer.title}
          </h3>

          <p className="mt-3 line-clamp-2 max-w-2xl text-[13px] leading-7 text-slate">
            {offer.description}
          </p>

          {offer.includes.length ? (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate">
              {offer.includes.slice(0, 3).map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                  {item}
                </span>
              ))}
              {offer.includes.length > 3 ? <span>+{offer.includes.length - 3} مشمولات أخرى</span> : null}
            </div>
          ) : null}
        </div>

        <div className="lg:border-x lg:border-outlinev lg:px-6">
          <div className="text-[10px] font-bold text-slate">السعر</div>
          <div className="tnum mt-2 text-3xl font-bold tracking-[-0.035em] text-deep">
            {formatMoney(offer.priceAmount, offer.currency)}
          </div>
          <div className="mt-1 text-[11px] text-slate">
            {PRICE_TYPE_LABELS[offer.priceType] ?? offer.priceType}
            {offer.durationDays ? ` · ${offer.durationDays} أيام` : ""}
          </div>

          <div className="mt-5 border-t border-outlinev pt-4">
            <div className="flex items-center gap-2 text-[11px] text-slate">
              <CalendarClock className="h-4 w-4 text-gold" />
              <span>صالح حتى {dateLabel(offer.expiresAt)}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-slate">المصدر والنطاق</div>

          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-[28px_1fr] gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-air text-signal">
                <FileText className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="text-[11px] font-bold text-deep">المصدر · {offer.agent.displayName}</div>
                <div className="mt-0.5 text-[10px] leading-5 text-slate">بيانات العرض مقدمة من الوكيل ونُشرت بعد دورة المراجعة.</div>
              </div>
            </div>

            <div className="grid grid-cols-[28px_1fr] gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-verifiedbg text-verified">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="text-[11px] font-bold text-deep">نطاق الثقة</div>
                <div className="mt-1">
                  <AgentTrustChip trust={offer.agent.trust} compact />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 text-[12px] font-bold text-signal">
            افتح ملف القرار
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}
