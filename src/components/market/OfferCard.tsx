import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, ShieldCheck, Timer } from "lucide-react";
import type { OfferWithAgent } from "@/lib/data";
import {
  daysLeft,
  formatMoney,
  PRICE_TYPE_LABELS,
  tripTypeLabel,
} from "@/lib/format";

export function VerifiedChip({
  licenseType,
  hasLicense,
  compact = false,
}: {
  licenseType: string;
  hasLicense: boolean;
  compact?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-md bg-verifiedbg px-2 py-1 text-[11px] font-semibold text-verified">
        <ShieldCheck className="h-3.5 w-3.5" />
        موثّق
      </span>
      {!compact && hasLicense && licenseType === "agency" && (
        <span className="inline-flex items-center gap-1 rounded-md bg-wash px-2 py-1 text-[11px] font-semibold text-deep">
          <BadgeCheck className="h-3.5 w-3.5" />
          وكالة مرخّصة
        </span>
      )}
    </span>
  );
}

export function OfferCard({
  offer,
  rating,
}: {
  offer: OfferWithAgent;
  rating?: number;
}) {
  const left = daysLeft(offer.expiresAt);
  const urgent = left !== null && left <= 10;

  return (
    <Link
      href={`/offers/${offer.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-outlinev bg-cloud shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-deep/30 hover:shadow-lg hover:shadow-deep/10"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={offer.heroImage}
          alt={offer.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="rounded-md bg-cloud/95 px-2.5 py-1 text-[11px] font-semibold text-deep shadow-sm">
            {tripTypeLabel(offer.tripType)}
          </span>
          {offer.isFeatured && (
            <span className="rounded-md bg-gold px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              مميز
            </span>
          )}
        </div>
        {urgent && (
          <div className="absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-md bg-amber px-2.5 py-1.5 text-[11px] font-semibold text-gold shadow-sm">
            <Timer className="h-3.5 w-3.5" />
            متبقي {left} {left === 1 ? "يوم" : "أيام"} على انتهاء العرض
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug text-inkwell transition-colors group-hover:text-deep">
          {offer.title}
        </h3>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-slate">
          {offer.originCity} ← {offer.destinationCity}
          {offer.durationDays ? ` · ${offer.durationDays} أيام` : ""}
        </p>

        {offer.includes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {offer.includes.slice(0, 3).map((inc) => (
              <span
                key={inc}
                className="rounded-md bg-parchment px-2 py-1 text-[11px] font-medium text-stone"
              >
                {inc}
              </span>
            ))}
            {offer.includes.length > 3 && (
              <span className="rounded-md bg-low px-2 py-1 text-[11px] font-medium text-slate">
                +{offer.includes.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2.5 border-t border-low pt-4">
          <Image
            src={offer.agent.photoUrl}
            alt={offer.agent.displayName}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full border border-outlinev object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-inkwell">
              {offer.agent.displayName}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate">
              استجابة {offer.agent.responseRate}%
              {rating ? ` · ★ ${rating}` : ""}
            </div>
          </div>
          <VerifiedChip
            licenseType={offer.agent.licenseType}
            hasLicense={Boolean(offer.agent.licenseNumber)}
            compact
          />
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-low pt-4">
          <div>
            {offer.priceType === "starting_from" && (
              <div className="text-[11px] font-semibold text-gold">يبدأ من</div>
            )}
            <div className="tnum text-[22px] font-bold leading-none text-deep">
              {formatMoney(offer.priceAmount, offer.currency)}
            </div>
            <div className="mt-1 text-[11px] text-slate">
              {PRICE_TYPE_LABELS[offer.priceType] ?? offer.priceType}
            </div>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-outlinev text-slate transition-all duration-300 group-hover:border-deep group-hover:bg-deep group-hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
