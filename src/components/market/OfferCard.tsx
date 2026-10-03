import Image from "next/image";
import Link from "next/link";
import { Timer } from "lucide-react";
import { SilaArrowIcon, SilaIdentityIcon, SilaReviewIcon } from "@/components/brand/SilaIcons";
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-verifiedbg px-2.5 py-1 text-[11px] font-semibold text-verified">
        <SilaIdentityIcon className="h-3.5 w-3.5" />
        موثّق
      </span>
      {!compact && hasLicense && licenseType === "agency" && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-air px-2.5 py-1 text-[11px] font-semibold text-deep">
          <SilaReviewIcon className="h-3.5 w-3.5" />
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
      className="sila-window sila-motion-safe group flex h-full flex-col overflow-hidden border border-outlinev bg-cloud shadow-[0_8px_30px_rgba(8,38,74,0.05)] transition-all duration-300 hover:-translate-y-1.5 hover:border-sky hover:shadow-[0_20px_50px_rgba(8,38,74,0.12)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-low">
        <Image
          src={offer.heroImage}
          alt={offer.title}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="rounded-full border border-white/50 bg-cloud/92 px-3 py-1.5 text-[11px] font-semibold text-deep shadow-sm backdrop-blur">
            {tripTypeLabel(offer.tripType)}
          </span>
          {offer.isFeatured && (
            <span className="rounded-full bg-signal px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm">
              مختار
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

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3 text-[11px]">
          <span className="font-semibold text-signal">عرض من {offer.agent.displayName}</span>
          <span className="tnum text-slate">
            {offer.originCity} ← {offer.destinationCity}
          </span>
        </div>
        <h3 className="text-xl font-bold leading-snug tracking-[-0.01em] text-inkwell transition-colors group-hover:text-deep">
          {offer.title}
        </h3>
        <p className="mt-2 text-[12px] font-medium text-slate">
          {offer.durationDays ? `${offer.durationDays} أيام` : "مدة مرنة"}
          {" · "}
          {PRICE_TYPE_LABELS[offer.priceType] ?? offer.priceType}
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

        <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-low/70 p-3">
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

        <div className="mt-5 flex items-end justify-between border-t border-outlinev/80 pt-5">
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
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-outlinev bg-cloud text-deep transition-all duration-300 group-hover:border-signal group-hover:bg-signal group-hover:text-white">
            <SilaArrowIcon className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
