import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock3, MapPin, Star } from "lucide-react";
import { getAgentsWithRatings } from "@/lib/data";
import { VerifiedChip } from "@/components/market/OfferCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الوكلاء الموثّقون",
  description: "دليل وكلاء السفر الموثّقين على منصة الرحلة — بهوية حكومية، تقييمات حقيقية، ومعدلات استجابة معلنة.",
};

const TAGS = ["عمرة", "تأشيرات", "جورجيا", "تركيا", "المالديف", "البلقان", "دبي", "مصر", "المغرب"];

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tag = typeof params.tag === "string" ? params.tag : "";

  const agents = await getAgentsWithRatings();
  const shown = tag
    ? agents.filter((a) =>
        a.specialtyTags.some((t) => t.includes(tag) || tag.includes(t)),
      )
    : agents;

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          الوكلاء الموثّقون
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-slate">
          لا ينضم أحد إلى هذا الدليل إلا بعد تحقق هوية حكومي، ومراجعة رخصة
          السياحة للوكالات، واكتمال ملف العمل. الأرقام تحت كل اسم حقيقية ومحدثة.
        </p>
      </header>

      <div className="mb-10 flex flex-wrap gap-2">
        <Link
          href="/agents"
          className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-all ${
            !tag ? "border-deep bg-deep text-white" : "border-outlinev bg-cloud text-slate hover:border-deep/50 hover:text-deep"
          }`}
        >
          الكل ({agents.length})
        </Link>
        {TAGS.map((t) => (
          <Link
            key={t}
            href={`/agents?tag=${encodeURIComponent(t)}`}
            className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-all ${
              tag === t ? "border-deep bg-deep text-white" : "border-outlinev bg-cloud text-slate hover:border-deep/50 hover:text-deep"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outlinev bg-cloud px-8 py-20 text-center">
          <p className="text-xl font-bold text-inkwell">لا وكلاء بهذا التخصص بعد.</p>
          <p className="mt-2 text-sm text-slate">التوثيق الجديد يُعلن أسبوعياً — جرّب تخصصاً آخر.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-outlinev bg-cloud transition-all duration-300 hover:-translate-y-1 hover:border-deep/30 hover:shadow-lg hover:shadow-deep/10"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-low">
                <Image
                  src={a.photoUrl}
                  alt={a.displayName}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-inkwell/80 to-transparent p-4 pt-12">
                  <div className="text-lg font-bold text-white">{a.displayName}</div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">
                    {a.latinName}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-slate">
                    <MapPin className="h-4 w-4 text-deep" />
                    {a.city}، {a.country}
                  </span>
                  <VerifiedChip licenseType={a.licenseType} hasLicense={Boolean(a.licenseNumber)} compact />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {a.specialtyTags.map((t) => (
                    <span key={t} className="rounded-md bg-parchment px-2.5 py-1 text-[11px] font-semibold text-stone">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-low pt-4 text-center">
                  <div>
                    <div className="tnum inline-flex items-center gap-1 font-bold text-gold">
                      <Star className="h-3.5 w-3.5 fill-gold" />{a.avgRating}
                    </div>
                    <div className="text-[10px] text-slate">({a.reviewCount} تقييم)</div>
                  </div>
                  <div>
                    <div className="tnum font-bold text-deep">{a.responseRate}%</div>
                    <div className="text-[10px] text-slate">استجابة</div>
                  </div>
                  <div>
                    <div className="tnum inline-flex items-center gap-0.5 font-bold text-deep">
                      {a.avgResponseHours}<Clock3 className="h-3 w-3" />
                    </div>
                    <div className="text-[10px] text-slate">متوسط الرد</div>
                  </div>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-[13px] font-bold text-deep">
                  الملف الكامل
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
