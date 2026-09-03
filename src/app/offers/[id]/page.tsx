import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  MapPin,
  MessageSquareText,
  Timer,
  Users,
  X,
} from "lucide-react";
import { getOfferById, getOtherOffersByAgent, getAgentsWithRatings } from "@/lib/data";
import {
  daysLeft,
  formatDay,
  formatMoney,
  PRICE_TYPE_LABELS,
  tripTypeLabel,
} from "@/lib/format";
import { Reveal } from "@/components/Reveal";
import { ContactForm } from "@/components/market/ContactForm";
import { OfferCard, VerifiedChip } from "@/components/market/OfferCard";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const offer = await getOfferById(Number(id));
  if (!offer) return { title: "عرض غير موجود" };
  return { title: offer.title, description: offer.description.split("\n")[0] };
}

export default async function OfferDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const offer = await getOfferById(Number(id));
  if (!offer || offer.status !== "published") notFound();

  const [others, agentsWithRatings] = await Promise.all([
    getOtherOffersByAgent(offer.agentId, offer.id),
    getAgentsWithRatings(),
  ]);
  const rating = agentsWithRatings.find((a) => a.id === offer.agentId);
  const left = daysLeft(offer.expiresAt);
  const urgent = left !== null && left <= 10;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: offer.title,
    description: offer.description.split("\n")[0],
    image: offer.heroImage,
    brand: { "@type": "Organization", name: offer.agent.displayName },
    category: tripTypeLabel(offer.tripType),
    offers: {
      "@type": "Offer",
      price: offer.priceAmount,
      priceCurrency: offer.currency,
      availability: "https://schema.org/InStock",
      validThrough: offer.expiresAt?.toISOString(),
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-10 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="mb-8 flex items-center gap-2 font-mono text-[12px] text-slate">
        <Link href="/offers" className="transition-colors hover:text-deep">العروض</Link>
        <span>/</span>
        <span className="text-deep">{tripTypeLabel(offer.tripType)}</span>
        <span>/</span>
        <span className="truncate">#{offer.id}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Main */}
        <div className="lg:col-span-7">
          <Reveal>
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-outlinev">
              <Image
                src={offer.heroImage}
                alt={offer.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                <span className="rounded-lg bg-cloud/95 px-3 py-1.5 text-[12px] font-bold text-deep shadow">
                  {tripTypeLabel(offer.tripType)}
                </span>
                {offer.isFeatured && (
                  <span className="rounded-lg bg-gold px-3 py-1.5 text-[12px] font-bold text-white shadow">
                    عرض مميز
                  </span>
                )}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mt-8 text-3xl font-bold leading-snug tracking-tight text-inkwell md:text-4xl">
              {offer.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-slate">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-deep" />
                {offer.originCity} ← {offer.destinationCity}، {offer.destinationCountry}
              </span>
              {offer.departureDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-deep" />
                  المغادرة {formatDay(offer.departureDate)}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-deep" />
                {offer.minTravelers}–{offer.maxTravelers} مسافرين
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-8 space-y-5 text-[17px] leading-[1.9] text-inkwell/85">
              {offer.description.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.14}>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-verified/25 bg-verifiedbg/50 p-5">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-verified">
                  <Check className="h-4 w-4" /> يشمل العرض
                </h3>
                <ul className="space-y-2.5">
                  {offer.includes.map((inc) => (
                    <li key={inc} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-inkwell/80">
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-verified" />
                      {inc}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-outlinev bg-cloud p-5">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-slate">
                  <X className="h-4 w-4" /> لا يشمل
                </h3>
                <ul className="space-y-2.5">
                  {offer.excludes.map((exc) => (
                    <li key={exc} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-slate">
                      <X className="mt-1 h-3.5 w-3.5 shrink-0 text-slate/60" />
                      {exc}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          <div className="mt-8 flex items-center gap-5 border-t border-low pt-6 font-mono text-[12px] text-slate">
            <span className="tnum inline-flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> {offer.viewCount.toLocaleString("en-US")} مشاهدة
            </span>
            <span className="tnum inline-flex items-center gap-1.5">
              <MessageSquareText className="h-4 w-4" /> {offer.contactCount} طلب تواصل
            </span>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-28 space-y-5">
            <Reveal delay={0.08}>
              <div className="rounded-2xl border border-outlinev bg-cloud p-6 shadow-lg shadow-deep/5">
                <div className="flex items-end justify-between">
                  <div>
                    {offer.priceType === "starting_from" && (
                      <div className="mb-1 text-[12px] font-bold text-gold">يبدأ من</div>
                    )}
                    <div className="tnum text-4xl font-bold text-deep">
                      {formatMoney(offer.priceAmount, offer.currency)}
                    </div>
                    <div className="mt-1.5 text-[13px] text-slate">
                      {PRICE_TYPE_LABELS[offer.priceType]}
                      {offer.durationDays ? ` · ${offer.durationDays} أيام` : ""}
                    </div>
                  </div>
                  {urgent && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber px-3 py-2 text-[12px] font-bold text-gold">
                      <Timer className="h-4 w-4" />
                      ينتهي خلال {left} {left === 1 ? "يوم" : "أيام"}
                    </span>
                  )}
                </div>
                <div className="my-6 border-t border-low" />
                <ContactForm offerId={offer.id} offerTitle={offer.title} />
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <Link href={`/agents/${offer.agent.id}`} className="group block rounded-2xl border border-outlinev bg-cloud p-6 transition-all hover:border-deep/30 hover:shadow-lg hover:shadow-deep/10">
                <div className="flex items-center gap-4">
                  <Image
                    src={offer.agent.photoUrl}
                    alt={offer.agent.displayName}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] rounded-2xl border border-outlinev object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-bold text-inkwell group-hover:text-deep">
                      {offer.agent.displayName}
                    </div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-slate">
                      {offer.agent.latinName} · {offer.agent.city}
                    </div>
                    <div className="mt-2.5">
                      <VerifiedChip
                        licenseType={offer.agent.licenseType}
                        hasLicense={Boolean(offer.agent.licenseNumber)}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-low pt-5 text-center sm:grid-cols-4">
                  <div>
                    <div className="tnum text-lg font-bold text-deep">{rating?.avgRating ?? "—"}</div>
                    <div className="text-[11px] text-slate">التقييم ★</div>
                  </div>
                  <div>
                    <div className="tnum text-lg font-bold text-deep">{offer.agent.responseRate}%</div>
                    <div className="text-[11px] text-slate">معدل الاستجابة</div>
                  </div>
                  <div>
                    <div className="tnum inline-flex items-center justify-center text-lg font-bold text-deep">
                      {offer.agent.avgResponseHours}<Clock3 className="ms-1 h-3.5 w-3.5" />
                    </div>
                    <div className="text-[11px] text-slate">متوسط الرد</div>
                  </div>
                  <div>
                    <div className="tnum text-lg font-bold text-deep">{offer.agent.totalTrips.toLocaleString("en-US")}</div>
                    <div className="text-[11px] text-slate">رحلة مكتملة</div>
                  </div>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 text-[13px] font-bold text-deep">
                  ملف الوكيل الكامل
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </div>
              </Link>
            </Reveal>

            <div className="flex items-start gap-3 rounded-xl border border-wash bg-wash/50 p-4 text-[12px] leading-relaxed text-slate">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-deep" />
              اجتاز هذا العرض مراجعة فريق الثقة في {formatDay(offer.publishedAt ?? offer.createdAt)}.
              الرحلة لا تتقاضى أي عمولة من سعرك — التفاوض والدفع يجريان مباشرة مع الوكيل.
            </div>
          </div>
        </aside>
      </div>

      {others.length > 0 && (
        <section className="mt-24">
          <h2 className="mb-8 text-2xl font-bold text-inkwell md:text-3xl">
            عروض أخرى من {offer.agent.displayName}
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
