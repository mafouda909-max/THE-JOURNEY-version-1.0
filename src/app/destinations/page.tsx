import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { SilaArrowIcon } from "@/components/brand/SilaIcons";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { getDestinations, trackEvent } from "@/lib/data";
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
      <SilaPageIntro
        eyebrow="وجهة لها عرض حقيقي خلفها"
        title="وجهات يقف خلفها وكيل موثّق."
        description="لا نعرض كتالوج وجهات لمجرد الإلهام. كل وجهة هنا مرتبطة بعرض منشور فعلاً، ومصدر واضح يمكنك الرجوع إليه."
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d, i) => (
          <Reveal key={d.slug} delay={Math.min(i * 0.05, 0.25)}>
            <Link
              href={`/destinations/${d.slug}`}
              className="sila-window sila-motion-safe group relative block aspect-[16/10] overflow-hidden border border-outlinev bg-deep shadow-[0_8px_30px_rgba(8,38,74,0.05)] transition-all hover:-translate-y-1 hover:border-sky hover:shadow-[0_20px_50px_rgba(8,38,74,0.12)]"
            >
              <Image
                src={d.image}
                alt={d.country}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-deep/95 via-deep/25 to-transparent" />
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
                    {d.currencies.join(" · ")}
                  </div>
                </div>
              </div>
              <span className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-cloud/95 text-deep opacity-0 shadow-sm transition-all group-hover:opacity-100">
                <SilaArrowIcon className="h-4 w-4" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
