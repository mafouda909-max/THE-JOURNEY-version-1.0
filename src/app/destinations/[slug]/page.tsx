import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { getOffersForDestination } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { OfferCard } from "@/components/market/OfferCard";

export const dynamic = "force-dynamic";

type Params = { slug: string };

function priceSummary(offers: Awaited<ReturnType<typeof getOffersForDestination>>) {
  const currencies = [...new Set(offers.map((offer) => offer.currency))];
  if (currencies.length !== 1) return { currencies, minimum: null as number | null, currency: null as string | null };
  return {
    currencies,
    minimum: Math.min(...offers.map((offer) => offer.priceAmount)),
    currency: currencies[0] ?? null,
  };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const offers = await getOffersForDestination(slug);
  const first = offers[0];
  if (!first) return { title: "وجهة غير مغطاة" };
  const pricing = priceSummary(offers);
  const priceText = pricing.minimum !== null && pricing.currency
    ? ` وتبدأ الأسعار المنشورة من ${formatMoney(pricing.minimum, pricing.currency)}.`
    : " والأسعار معروضة بعملاتها الأصلية دون تحويل غير موثّق.";
  return {
    title: `عروض السفر إلى ${first.destinationCountry}`,
    description: `${offers.length} ${offers.length === 1 ? "عرض سفر منشور" : "عروض سفر منشورة"} إلى ${first.destinationCountry} من وكلاء موثّقين.${priceText}`,
  };
}

export default async function DestinationPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const offers = await getOffersForDestination(slug);
  if (offers.length === 0) notFound();

  const origins = [...new Set(offers.map((offer) => offer.originCity))];
  const agentsCount = new Set(offers.map((offer) => offer.agentId)).size;
  const pricing = priceSummary(offers);
  const country = offers[0].destinationCountry;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `عروض السفر إلى ${country}`,
    numberOfItems: offers.length,
    itemListElement: offers.map((offer, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: offer.title,
      url: `/offers/${offer.id}`,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-10 md:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-8 flex items-center gap-2 font-mono text-[12px] text-slate" aria-label="مسار التنقل">
        <Link href="/destinations" className="transition-colors hover:text-deep">الوجهات</Link>
        <span aria-hidden="true">/</span>
        <span className="text-deep">{country}</span>
      </nav>

      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">عروض السفر إلى {country}</h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-slate">
          {offers.length} {offers.length === 1 ? "عرض منشور" : "عروض منشورة"} من{" "}
          {agentsCount} {agentsCount === 1 ? "وكيل موثّق" : "وكلاء موثّقين"}، انطلاقاً من {origins.join("، ")}.{" "}
          {pricing.minimum !== null && pricing.currency
            ? `كل الأسعار في هذه المجموعة بعملة ${pricing.currency}، ويبدأ السعر المنشور من ${formatMoney(pricing.minimum, pricing.currency)}.`
            : "توجد أكثر من عملة في هذه المجموعة، لذلك لا نعلن سعراً أدنى موحّداً بدون تحويل موثوق ومؤرّخ."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-[13px] font-semibold">
          {pricing.minimum !== null && pricing.currency ? (
            <span className="tnum rounded-lg bg-wash px-4 py-2 text-deep">
              يبدأ من {formatMoney(pricing.minimum, pricing.currency)}
            </span>
          ) : (
            <span className="rounded-lg bg-amber px-4 py-2 text-gold">
              العملات: {pricing.currencies.join(" · ")}
            </span>
          )}
          <span className="inline-flex items-center gap-2 rounded-lg bg-verifiedbg px-4 py-2 text-verified">
            <Users className="h-4 w-4" aria-hidden="true" />
            {agentsCount === 1 ? "وكيل موثّق واحد" : `${agentsCount} وكلاء موثّقون`}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
      </div>
    </div>
  );
}
