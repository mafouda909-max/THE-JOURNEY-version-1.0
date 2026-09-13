import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { getDestinations } from "@/lib/data";
import { AnalyticsBeacon } from "@/components/AnalyticsBeacon";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الوجهات",
  description:
    "تصفّح الوجهات التي تغطيها حالياً عروض منشورة من وكلاء سفر موثّقين، مع الأسعار بعملتها الأصلية دون مقارنة مضللة بين العملات.",
};

export default async function DestinationsPage() {
  const destinations = await getDestinations();

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <AnalyticsBeacon name="landing_view" />
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          وجهات يقف خلفها
          <span className="text-deep"> وكيل موثّق</span>.
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-slate">
          كل وجهة هنا مرتبطة بعرض منشور حاليًا من وكيل موثّق. نعرض السعر داخل كل عرض بعملته الأصلية، ولا نحول بين العملات أو نعلن «الأرخص» بدون مصدر تحويل موثوق ومؤرّخ.
        </p>
      </header>

      {destinations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outlinev bg-cloud px-8 py-16 text-center">
          <h2 className="text-2xl font-bold text-inkwell">لا وجهات منشورة حالياً.</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate">
            تظهر الوجهات هنا تلقائياً عندما يوجد عرض منشور صالح من وكيل موثّق.
          </p>
          <Link href="/offers" className="mt-6 inline-flex rounded-lg bg-deep px-5 py-3 text-sm font-bold text-white hover:bg-horizon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20">
            تصفّح العروض
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((destination, index) => (
            <Reveal key={destination.slug} delay={Math.min(index * 0.05, 0.25)}>
              <Link
                href={`/destinations/${destination.slug}`}
                className="group relative block aspect-[16/10] overflow-hidden rounded-2xl border border-outlinev focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
              >
                <Image
                  src={destination.image}
                  alt={destination.country}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-inkwell/85 via-inkwell/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                  <div>
                    <div className="text-2xl font-bold text-white">{destination.country}</div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {destination.countryEn}
                    </div>
                  </div>
                  <div className="text-start text-white/90">
                    <div className="tnum text-sm font-bold">
                      {destination.offerCount} {destination.offerCount === 1 ? "عرض" : "عروض"}
                    </div>
                    <div className="font-mono text-[10px] text-white/70">
                      {destination.currencies.length === 1
                        ? `العملة: ${destination.currencies[0]}`
                        : `عملات: ${destination.currencies.join(" · ")}`}
                    </div>
                  </div>
                </div>
                <span className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg bg-cloud/95 text-deep opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
