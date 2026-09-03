import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { getOffersForDestination, getDestinations } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { OfferCard } from "@/components/market/OfferCard";

export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const offers = await getOffersForDestination(slug);
  const first = offers[0];
  if (!first) return { title: "وجهة غير مغطاة" };
  return {
    title: `السفر إلى ${first.destinationCountry}`,
    description: `عروض وكلاء موثّقين إلى ${first.destinationCountry} — ${offers.length} ${offers.length === 1 ? "عرض" : "عروض"} مراجعة بأسعار معلنة، انطلاقاً من ${formatMoney(first.priceAmount, first.currency)}.`,
  };
}

export default async function DestinationPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [offers, destinations] = await Promise.all([
    getOffersForDestination(slug),
    getDestinations(),
  ]);
  if (offers.length === 0) notFound();

  const info = destinations.find((d) => d.slug === slug);
  const origins = [...new Set(offers.map((o) => o.originCity))];
  const agentsCount = new Set(offers.map((o) => o.agentId)).size;
  const minPrice = Math.min(...offers.map((o) => o.priceAmount));
  const minCurrency = offers.find((o) => o.priceAmount === minPrice)!.currency;
  const country = offers[0].destinationCountry;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `عروض السفر إلى ${country}`,
    numberOfItems: offers.length,
    itemListElement: offers.map((o, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: o.title,
      url: `/offers/${o.id}`,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-10 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="mb-8 flex items-center gap-2 font-mono text-[12px] text-slate">
        <Link href="/destinations" className="transition-colors hover:text-deep">الوجهات</Link>
        <span>/</span>
        <span className="text-deep">{country}</span>
      </nav>

      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          السفر إلى {country}
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-slate">
          {offers.length} {offers.length === 1 ? "عرض مراجَع" : "عروض مراجَعة"} من{" "}
          {agentsCount} {agentsCount === 1 ? "وكيل موثّق" : "وكلاء موثّقين"} — انطلاقاً
          من {origins.join("، ")}، وبأسعار تبدأ من{" "}
          {formatMoney(minPrice, minCurrency)} معلنة بلا مبهَمات.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-[13px] font-semibold">
          <span className="tnum rounded-lg bg-wash px-4 py-2 text-deep">
            يبدأ من {formatMoney(minPrice, minCurrency)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-verifiedbg px-4 py-2 text-verified">
            <Users className="h-4 w-4" />
            {agentsCount === 1 ? "وكيل موثّق واحد" : `${agentsCount} وكلاء موثّقون`}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
      </div>
    </div>
  );
}
