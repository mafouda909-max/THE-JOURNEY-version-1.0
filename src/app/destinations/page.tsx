import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { getDestinations, trackEvent } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الوجهات",
  description:
    "كل الوجهات التي تغطيها عروض الوكلاء الموثّقين حالياً — من مكة المكرمة إلى تبليسي والمالديف، بأسعار معلنة ومراجعة.",
};

export default async function DestinationsPage() {
  const destinations = await getDestinations();
  void trackEvent("landing_view", { meta: "destinations_index" });

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          وجهات يقف خلفها
          <span className="text-deep"> وكيل موثّق</span>.
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-slate">
          لا نعرض دليل عناوين وهمياً — كل وجهة هنا موجودة لأن عرضاً حقيقياً
          مراجَعاً يخدمها اليوم. القائمة تنمو مع كل اعتماد جديد.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d, i) => (
          <Reveal key={d.slug} delay={Math.min(i * 0.05, 0.25)}>
            <Link
              href={`/destinations/${d.slug}`}
              className="group relative block aspect-[16/10] overflow-hidden rounded-2xl border border-outlinev"
            >
              <Image
                src={d.image}
                alt={d.country}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-inkwell/85 via-inkwell/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                <div>
                  <div className="text-2xl font-bold text-white">{d.country}</div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">
                    <MapPin className="h-3 w-3" />
                    {d.countryEn}
                  </div>
                </div>
                <div className="text-start text-white/90">
                  <div className="tnum text-sm font-bold">{d.offerCount} {d.offerCount === 1 ? "عرض" : "عروض"}</div>
                  <div className="tnum font-mono text-[11px] text-white/70">
                    من {formatMoney(d.minPrice, d.currency)}
                  </div>
                </div>
              </div>
              <span className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg bg-cloud/95 text-deep opacity-0 transition-opacity group-hover:opacity-100">
                <ArrowLeft className="h-4 w-4" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
