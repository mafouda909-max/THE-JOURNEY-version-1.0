import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, ShieldCheck, Users } from "lucide-react";
import { getOffersForDestination, getDestinations } from "@/lib/data";
import { getVisaGuide } from "@/lib/visas";
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
    description: `عروض وكلاء بأدلة مُراجَعة إلى ${first.destinationCountry} — ${offers.length} ${offers.length === 1 ? "عرض" : "عروض"} مراجعة بأسعار معلنة، انطلاقاً من ${formatMoney(first.priceAmount, first.currency)}.`,
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
  const visaGuide = getVisaGuide(slug, "مصر");

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

      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          السفر إلى {country}
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-slate">
          {offers.length} {offers.length === 1 ? "عرض مراجَع" : "عروض مراجَعة"} من{" "}
          {agentsCount} {agentsCount === 1 ? "وكيل بأدلة مُراجَعة" : "وكلاء بأدلة مُراجَعة"} — انطلاقاً
          من {origins.join("، ")}، وبأسعار تبدأ من{" "}
          {formatMoney(minPrice, minCurrency)} معلنة بلا مبهَمات.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-[13px] font-semibold">
          <span className="tnum rounded-lg bg-wash px-4 py-2 text-deep">
            يبدأ من {formatMoney(minPrice, minCurrency)}
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-verifiedbg px-4 py-2 text-verified">
            <Users className="h-4 w-4" />
            {agentsCount === 1 ? "وكيل واحد بأدلة مُراجَعة" : `${agentsCount} وكلاء بأدلة مُراجَعة`}
          </span>
          {visaGuide && (
            <Link
              href="/visas"
              className="inline-flex items-center gap-1.5 rounded-lg border border-outlinev bg-cloud px-4 py-2 text-deep hover:border-deep"
            >
              <ShieldCheck className="h-4 w-4 text-verified" />
              <span>دليل التأشيرة الرسمي</span>
            </Link>
          )}
        </div>
      </header>

      {visaGuide && (
        <section className="sila-window mb-12 border border-outlinev bg-cloud p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outlinev/70 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-verified" />
              <h2 className="text-lg font-bold text-inkwell">
                المتطلبات الرسمية لدخول {country} (لحاملي الجواز المصري)
              </h2>
            </div>
            <span className="rounded-full bg-air px-3 py-1 text-xs font-bold text-deep">
              {visaGuide.visaTypeLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate">الشروط الأساسية:</p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate">
                {visaGuide.entryRequirements.slice(0, 3).map((req, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-verified">✓</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-between rounded-xl bg-low/40 p-4 text-xs">
              <div>
                <span className="font-semibold text-deep">المصدر الحكومي المعتمد:</span>
                <p className="mt-1 text-slate">{visaGuide.officialSourceName}</p>
                <p className="mt-1 text-[11px] text-slate/70">
                  تاريخ التحقق: {new Date(visaGuide.lastVerifiedAt).toLocaleDateString("ar-EG")}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <a
                  href={visaGuide.officialPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-deep px-3 py-2 font-bold text-white hover:bg-horizon"
                >
                  <span>البوابة الرسمية</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <Link
                  href={`/visas?destination=${slug}`}
                  className="rounded-lg border border-outlinev bg-cloud px-3 py-2 font-bold text-deep hover:border-deep"
                >
                  تفاصيل أكثر
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
      </div>
    </div>
  );
}
