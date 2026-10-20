import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  FileText,
  MapPin,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { getOfferById, getOtherOffersByAgent } from "@/lib/data";
import { db } from "@/db";
import { travelerSavedIntents } from "@/db/schema";
import { accountFromCookies } from "@/lib/identity";
import {
  formatDay,
  formatMoney,
  PRICE_TYPE_LABELS,
  tripTypeLabel,
} from "@/lib/format";
import { ContactForm } from "@/components/market/ContactForm";
import { OfferCard } from "@/components/market/OfferCard";
import { AgentTrustChip, AgentTrustPanel } from "@/components/market/AgentTrust";
import { ShareOfferButton } from "@/components/market/ShareOfferButton";
import { SaveOfferToIntentButton } from "@/components/market/SaveOfferToIntentButton";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const offer = await getOfferById(Number(id));
  if (!offer) return { title: "عرض غير موجود" };
  const description = offer.description.split("\n")[0];
  const canonical = `/offers/${offer.id}`;
  return {
    title: offer.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: offer.title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: offer.heroImage, alt: offer.title }],
    },
  };
}

function dateLabel(value: Date | null) {
  if (!value) return "غير مسجل";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

export default async function OfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const offer = await getOfferById(Number(id));
  if (!offer || offer.status !== "published") notFound();

  const account = await accountFromCookies();
  const savedIntents =
    process.env.TRAVELER_WORKSPACE_ENABLED === "true" && account?.role === "traveler"
      ? await db
          .select({ id: travelerSavedIntents.id, label: travelerSavedIntents.label })
          .from(travelerSavedIntents)
          .where(and(
            eq(travelerSavedIntents.accountId, account.id),
            eq(travelerSavedIntents.status, "active"),
          ))
          .orderBy(desc(travelerSavedIntents.updatedAt))
          .limit(20)
      : [];

  const requestedIntentId =
    typeof query.intentId === "string" &&
    Number.isSafeInteger(Number(query.intentId)) &&
    Number(query.intentId) > 0
      ? Number(query.intentId)
      : null;

  const defaultIntentId =
    requestedIntentId && savedIntents.some((intent) => intent.id === requestedIntentId)
      ? requestedIntentId
      : null;

  const others = await getOtherOffersByAgent(offer.agentId, offer.id);

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
    },
  };

  return (
    <main className="pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="border-b border-outlinev bg-cloud">
        <div className="mx-auto max-w-[1320px] px-5 py-8 md:px-8 md:py-10">
          <nav className="mb-7 flex items-center gap-2 text-[11px] font-semibold text-slate">
            <Link href="/offers" className="hover:text-deep">العروض</Link>
            <span>/</span>
            <span>{tripTypeLabel(offer.tripType)}</span>
            <span>/</span>
            <span className="tnum text-deep">#{offer.id}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <div>
              <div className="sila-eyebrow text-[11px] font-bold">ملف قرار العرض</div>
              <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-deep md:text-6xl">
                {offer.title}
              </h1>

              <div className="intent-route mt-6 max-w-xl">
                <span className="intent-route__point truncate">{offer.originCity}</span>
                <span className="intent-route__line" />
                <span className="intent-route__point truncate">{offer.destinationCity}</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-slate">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-signal" />
                  {offer.destinationCountry}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-signal" />
                  {offer.minTravelers}–{offer.maxTravelers} مسافرين
                </span>
                {offer.departureDate ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4 text-signal" />
                    المغادرة {formatDay(offer.departureDate)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="lg:text-left">
              <div className="text-[11px] font-bold text-slate">
                {offer.priceType === "starting_from" ? "يبدأ من" : "السعر"}
              </div>
              <div className="tnum mt-2 text-4xl font-bold tracking-[-0.04em] text-deep md:text-5xl">
                {formatMoney(offer.priceAmount, offer.currency)}
              </div>
              <div className="mt-2 text-[12px] text-slate">
                {PRICE_TYPE_LABELS[offer.priceType]}
                {offer.durationDays ? ` · ${offer.durationDays} أيام` : ""}
              </div>
            </div>
          </div>

          <div className="evidence-strip mt-9">
            <div>
              <div className="text-[10px] font-bold text-slate">Source</div>
              <div className="mt-2 text-sm font-bold text-deep">{offer.agent.displayName}</div>
              <div className="mt-1 text-[11px] leading-5 text-slate">صاحب العرض المنشور</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate">Scope</div>
              <div className="mt-2">
                <AgentTrustChip trust={offer.agent.trust} />
              </div>
              <div className="mt-2 text-[11px] leading-5 text-slate">
                نطاق ثقة الوكيل منفصل عن تفاصيل السعر والتوافر التي يقدّمها العرض.
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate">Freshness</div>
              <div className="mt-2 text-sm font-bold text-deep">حتى {dateLabel(offer.expiresAt)}</div>
              <div className="mt-1 text-[11px] leading-5 text-slate">
                نُشر {dateLabel(offer.publishedAt ?? offer.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 pt-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <section className="border-y border-outlinev py-8">
            <div className="grid gap-8 md:grid-cols-[.72fr_1.28fr]">
              <div>
                <div className="text-[11px] font-bold text-signal">01 · القرار الأساسي</div>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-deep">
                  هل يناسب سياقك؟
                </h2>
              </div>

              <div>
                <p className="text-[16px] leading-8 text-slate">
                  العرض يغطي مسار {offer.originCity} إلى {offer.destinationCity}
                  {offer.durationDays ? ` لمدة ${offer.durationDays} أيام` : ""}،
                  ومجاله المسجل من {offer.minTravelers} إلى {offer.maxTravelers} مسافرين.
                  الملاءمة النهائية تعتمد على حالتك ومتطلبات الدخول والتوافر وقت التواصل.
                </p>

                {defaultIntentId ? (
                  <div className="mt-5">
                    <SaveOfferToIntentButton intentId={defaultIntentId} offerId={offer.id} />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="py-9">
            <div className="text-[11px] font-bold text-signal">02 · ما الذي يعرضه؟</div>
            <div className="mt-5 max-w-[760px] space-y-5 text-[16px] leading-8 text-inkwell/85">
              {offer.description.split("\n\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="grid gap-0 border-y border-outlinev md:grid-cols-2 md:divide-x md:divide-x-reverse md:divide-outlinev">
            <div className="py-8 md:pe-8">
              <div className="flex items-center gap-2 text-[12px] font-bold text-verified">
                <Check className="h-4 w-4" />
                يشمل
              </div>
              <ul className="mt-5 space-y-3">
                {offer.includes.length ? offer.includes.map((item) => (
                  <li key={item} className="grid grid-cols-[18px_1fr] gap-2 text-sm leading-7 text-inkwell">
                    <Check className="mt-1 h-4 w-4 text-verified" />
                    <span>{item}</span>
                  </li>
                )) : (
                  <li className="text-sm text-slate">لم تُسجل مشمولات تفصيلية.</li>
                )}
              </ul>
            </div>

            <div className="border-t border-outlinev py-8 md:border-t-0 md:ps-8">
              <div className="flex items-center gap-2 text-[12px] font-bold text-earth">
                <X className="h-4 w-4" />
                لا يشمل
              </div>
              <ul className="mt-5 space-y-3">
                {offer.excludes.length ? offer.excludes.map((item) => (
                  <li key={item} className="grid grid-cols-[18px_1fr] gap-2 text-sm leading-7 text-slate">
                    <X className="mt-1 h-4 w-4 text-earth" />
                    <span>{item}</span>
                  </li>
                )) : (
                  <li className="text-sm text-slate">لم تُسجل استثناءات تفصيلية.</li>
                )}
              </ul>
            </div>
          </section>

          <section className="py-9">
            <div className="text-[11px] font-bold text-signal">03 · لماذا أثق بهذه المعلومة؟</div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="border-t-2 border-signal pt-4">
                <div className="flex items-center gap-2 font-bold text-deep">
                  <FileText className="h-4 w-4 text-signal" />
                  مصدر العرض
                </div>
                <p className="mt-2 text-[12px] leading-6 text-slate">
                  تفاصيل العرض مقدمة من {offer.agent.displayName}. حالة النشر تعني أن العرض دخل دورة المراجعة الحالية؛
                  ولا تعني أن صلة أصدرت التذكرة أو ضمنت التوافر.
                </p>
              </div>

              <div className="border-t-2 border-verified pt-4">
                <div className="flex items-center gap-2 font-bold text-deep">
                  <ShieldCheck className="h-4 w-4 text-verified" />
                  نطاق الوكيل
                </div>
                <p className="mt-2 text-[12px] leading-6 text-slate">
                  هوية/نشاط الوكيل لهما نطاق مراجعة مستقل. راجع Trust Passport أدناه لمعرفة ما يغطيه الدليل وما لا يغطيه.
                </p>
              </div>
            </div>

            <AgentTrustPanel trust={offer.agent.trust} className="mt-6" />
          </section>

          <section className="border-y border-outlinev py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold text-slate">مشاركة ملف القرار</div>
                <p className="mt-1 text-[12px] text-slate">المشاركة تنقل رابط العرض الحالي، لا شهادة ضمان.</p>
              </div>
              <ShareOfferButton offerId={offer.id} title={offer.title} />
            </div>
          </section>
        </div>

        <aside>
          <div className="space-y-5 lg:sticky lg:top-24">
            <section className="decision-board">
              <div className="border-b border-outlinev p-5">
                <div className="text-[11px] font-bold text-signal">الخطوة التالية</div>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-deep">
                  اسأل الوكيل قبل ما تتحرك.
                </h2>
                <p className="mt-2 text-[12px] leading-6 text-slate">
                  التواصل لا يعني حجزًا أو دفعًا. استخدمه لتأكيد التوافر والتفاصيل التي تؤثر على قرارك.
                </p>
              </div>
              <div className="p-5">
                <ContactForm
                  offerId={offer.id}
                  offerTitle={offer.title}
                  savedIntents={savedIntents}
                  defaultIntentId={defaultIntentId}
                />
              </div>
            </section>

            <Link href={`/agents/${offer.agent.id}`} className="trust-passport block px-1 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold text-slate">Trust Passport</div>
                  <div className="mt-2 text-lg font-bold text-deep">{offer.agent.displayName}</div>
                  <div className="mt-2">
                    <AgentTrustChip trust={offer.agent.trust} />
                  </div>
                </div>
                <ArrowLeft className="mt-1 h-5 w-5 text-signal" />
              </div>
              <p className="mt-4 text-[11px] leading-6 text-slate">
                شوف نطاق الأدلة، تاريخ المراجعة، التخصص والعروض الحالية قبل الاعتماد على اسم الوكيل وحده.
              </p>
            </Link>
          </div>
        </aside>
      </div>

      {others.length > 0 ? (
        <section className="mx-auto max-w-[1320px] px-5 pt-20 md:px-8">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold text-slate">من نفس المصدر</div>
              <h2 className="mt-2 text-2xl font-bold text-deep">عروض أخرى من {offer.agent.displayName}</h2>
            </div>
          </div>
          <div className="space-y-4">
            {others.map((item) => (
              <OfferCard key={item.id} offer={item} intentId={defaultIntentId} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
