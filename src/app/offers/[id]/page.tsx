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
  ShieldAlert,
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
import { AnalyticsBeacon } from "@/components/AnalyticsBeacon";
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
  const rating = agentsWithRatings.find((agent) => agent.id === offer.agentId);
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
      validThrough: offer.expiresAt?.toISOString(),
      url: `/offers/${offer.id}`,
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-10 md:px-8">
      <AnalyticsBeacon name="offer_viewed" offerId={offer.id} agentId={offer.agent.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-8 flex items-center gap-2 font-mono text-[12px] text-slate" aria-label="مسار التنقل">
        <Link href="/offers" className="transition-colors hover:text-deep">العروض</Link>
        <span aria-hidden="true">/</span>
        <span className="text-deep">{tripTypeLabel(offer.tripType)}</span>
        <span aria-hidden="true">/</span>
        <span className="truncate">#{offer.id}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
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
                  <span className="rounded-lg bg-gold px-3 py-1.5 text-[12px] font-bold text-white shadow">عرض مميز</span>
                )}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mt-8 text-3xl font-bold leading-snug tracking-tight text-inkwell md:text-4xl">{offer.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-slate">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-deep" aria-hidden="true" />
                {offer.originCity} ← {offer.destinationCity}، {offer.destinationCountry}
              </span>
              {offer.departureDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-deep" aria-hidden="true" />
                  المغادرة {formatDay(offer.departureDate)}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-deep" aria-hidden="true" />
                {offer.minTravelers}–{offer.maxTravelers} مسافرين
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-8 space-y-5 text-[17px] leading-[1.9] text-inkwell/85">
              {offer.description.split("\n\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </Reveal>

          <Reveal delay={0.14}>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-verified/25 bg-verifiedbg/50 p-5">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-verified">
                  <Check className="h-4 w-4" aria-hidden="true" /> يشمل العرض
                </h3>
                <ul className="space-y-2.5">
                  {offer.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-inkwell/80">
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-verified" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-outlinev bg-cloud p-5">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-slate">
                  <X className="h-4 w-4" aria-hidden="true" /> لا يشمل
                </h3>
                {offer.excludes.length > 0 ? (
                  <ul className="space-y-2.5">
                    {offer.excludes.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-slate">
                        <X className="mt-1 h-3.5 w-3.5 shrink-0 text-slate/60" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] leading-relaxed text-slate">لم يذكر الوكيل مستثنيات إضافية في هذا العرض.</p>
                )}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <section className="mt-8 rounded-2xl border border-outlinev bg-cloud p-6" aria-labelledby="evidence-heading">
              <h2 id="evidence-heading" className="text-lg font-bold text-inkwell">ما الذي نعرفه عن هذا العرض؟</h2>
              <div className="mt-4 space-y-3 text-[13px] leading-relaxed">
                <div className="flex items-start justify-between gap-4 rounded-lg bg-verifiedbg/60 p-4">
                  <div>
                    <div className="font-bold text-verified">هوية الوكيل ونشاطه</div>
                    <p className="mt-1 text-slate">اجتاز ملف الوكيل عملية التوثيق الحالية لدى THE JOURNEY.</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-verifiedbg px-2.5 py-1 font-bold text-verified">موثّق</span>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg bg-amber/60 p-4">
                  <div>
                    <div className="font-bold text-gold">السعر والتوفر والشروط التشغيلية</div>
                    <p className="mt-1 text-slate">بيانات مقدمة من الوكيل ومراجَعة وفق سياسة النشر، لكنها ليست تحققًا لحظيًا من شركة طيران أو فندق أو مزود خارجي.</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-amber px-2.5 py-1 font-bold text-gold">ادعاء وكيل</span>
                </div>
              </div>
              <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-slate">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                قبل الدفع، اطلب من الوكيل تأكيد السعر والتوفر والشروط بتاريخ حديث. عندما تتوفر لنا مصادر تحقق خارجية موثوقة سنعرضها كدليل منفصل، لا كامتداد لشارة التوثيق.
              </p>
            </section>
          </Reveal>

          <div className="mt-8 flex items-center gap-5 border-t border-low pt-6 font-mono text-[12px] text-slate">
            <span className="tnum inline-flex items-center gap-1.5">
              <Eye className="h-4 w-4" aria-hidden="true" /> {offer.viewCount.toLocaleString("en-US")} مشاهدة مؤهلة
            </span>
            <span className="tnum inline-flex items-center gap-1.5">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" /> {offer.contactCount} طلب تواصل
            </span>
          </div>
        </div>

        <aside className="lg:col-span-5">
          <div className="space-y-5 lg:sticky lg:top-28">
            <Reveal delay={0.08}>
              <div className="rounded-2xl border border-outlinev bg-cloud p-6 shadow-lg shadow-deep/5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    {offer.priceType === "starting_from" && <div className="mb-1 text-[12px] font-bold text-gold">يبدأ من</div>}
                    <div className="tnum text-4xl font-bold text-deep">{formatMoney(offer.priceAmount, offer.currency)}</div>
                    <div className="mt-1.5 text-[13px] text-slate">
                      {PRICE_TYPE_LABELS[offer.priceType]}{offer.durationDays ? ` · ${offer.durationDays} أيام` : ""}
                    </div>
                  </div>
                  {urgent && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber px-3 py-2 text-[12px] font-bold text-gold">
                      <Timer className="h-4 w-4" aria-hidden="true" />
                      ينتهي خلال {left} {left === 1 ? "يوم" : "أيام"}
                    </span>
                  )}
                </div>
                <p className="mt-4 rounded-lg bg-low px-4 py-3 text-[12px] leading-relaxed text-slate">
                  هذا هو السعر المعلن من الوكيل بعملته الأصلية؛ أكّد السعر والتوفر النهائيين قبل أي دفع.
                </p>
                <div className="my-6 border-t border-low" />
                <ContactForm
                  offerId={offer.id}
                  offerTitle={offer.title}
                  minTravelers={offer.minTravelers}
                  maxTravelers={offer.maxTravelers}
                />
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <Link href={`/agents/${offer.agent.id}`} className="group block rounded-2xl border border-outlinev bg-cloud p-6 transition-all hover:border-deep/30 hover:shadow-lg hover:shadow-deep/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20">
                <div className="flex items-center gap-4">
                  <Image src={offer.agent.photoUrl} alt={offer.agent.displayName} width={72} height={72} className="h-[72px] w-[72px] rounded-2xl border border-outlinev object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-bold text-inkwell group-hover:text-deep">{offer.agent.displayName}</div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-slate">{offer.agent.latinName} · {offer.agent.city}</div>
                    <div className="mt-2.5">
                      <VerifiedChip licenseType={offer.agent.licenseType} hasLicense={offer.agent.hasLicense} />
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-low pt-5 text-center sm:grid-cols-4">
                  <div><div className="tnum text-lg font-bold text-deep">{rating?.avgRating ?? "—"}</div><div className="text-[11px] text-slate">التقييم ★</div></div>
                  <div><div className="tnum text-lg font-bold text-deep">{offer.agent.responseRate}%</div><div className="text-[11px] text-slate">معدل الاستجابة</div></div>
                  <div><div className="tnum inline-flex items-center justify-center text-lg font-bold text-deep">{offer.agent.avgResponseHours}<Clock3 className="ms-1 h-3.5 w-3.5" aria-hidden="true" /></div><div className="text-[11px] text-slate">متوسط الرد</div></div>
                  <div><div className="tnum text-lg font-bold text-deep">{offer.agent.totalTrips.toLocaleString("en-US")}</div><div className="text-[11px] text-slate">رحلة مكتملة</div></div>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 text-[13px] font-bold text-deep">
                  ملف الوكيل الكامل <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
                </div>
              </Link>
            </Reveal>

            <div className="flex items-start gap-3 rounded-xl border border-wash bg-wash/50 p-4 text-[12px] leading-relaxed text-slate">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-deep" aria-hidden="true" />
              <span>
                اجتاز العرض مراجعة سياسة النشر في {formatDay(offer.publishedAt ?? offer.createdAt)}. THE JOURNEY لا يضيف عمولة على السعر المعلن؛ التفاوض والدفع يتمان مباشرة مع الوكيل.
              </span>
            </div>
          </div>
        </aside>
      </div>

      {others.length > 0 && (
        <section className="mt-24">
          <h2 className="mb-8 text-2xl font-bold text-inkwell md:text-3xl">عروض أخرى من {offer.agent.displayName}</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((other) => <OfferCard key={other.id} offer={other} />)}
          </div>
        </section>
      )}
    </div>
  );
}
