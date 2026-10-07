import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { getAgentsWithRatings } from "@/lib/data";
import { AgentTrustChip } from "@/components/market/AgentTrust";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الوكلاء الذين راجعتهم صلة",
  description: "اعرف من يقف خلف العرض، وما نطاق المراجعة المسجل لهذا الوكيل، قبل التواصل.",
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
    ? agents.filter((agent) =>
        agent.specialtyTags.some((item) => item.includes(tag) || tag.includes(item)),
      )
    : agents;

  return (
    <main className="pb-24">
      <section className="border-b border-outlinev bg-cloud">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
          <div>
            <div className="sila-eyebrow text-[11px] font-bold">Trust Passport directory</div>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-deep md:text-6xl">
              اعرف من يقف خلف العرض.
            </h1>
          </div>
          <div className="max-w-[760px]">
            <p className="text-[17px] leading-8 text-slate">
              الوكيل هنا ليس صورة وتقييمًا فقط. الملف يوضح نطاق الثقة المسجل، آخر مراجعة،
              التخصص، والعروض الحالية—بدون تحويل الشارة إلى ضمان عام.
            </p>
            <div className="mt-6 border-y border-outlinev py-4 text-[11px] leading-6 text-slate">
              حالة التحقق تخص الأدلة والنطاق المعروضين. لا تعني ضمان السعر أو التوافر أو نتيجة الرحلة.
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 pt-8 md:px-8">
        <details className="progressive-panel">
          <summary>تصفية حسب التخصص {tag ? `· ${tag}` : ""}</summary>
          <div className="flex flex-wrap gap-2 border-t border-outlinev py-5">
            <Link
              href="/agents"
              className={
                "min-h-10 rounded-full border px-4 py-2 text-[12px] font-bold " +
                (!tag ? "border-signal bg-air text-deep" : "border-outlinev bg-cloud text-slate")
              }
            >
              الكل
            </Link>
            {TAGS.map((item) => (
              <Link
                key={item}
                href={`/agents?tag=${encodeURIComponent(item)}`}
                className={
                  "min-h-10 rounded-full border px-4 py-2 text-[12px] font-bold " +
                  (tag === item ? "border-signal bg-air text-deep" : "border-outlinev bg-cloud text-slate")
                }
              >
                {item}
              </Link>
            ))}
          </div>
        </details>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold text-slate">النتائج</div>
            <div className="tnum mt-1 text-2xl font-bold text-deep">{shown.length} وكيل</div>
          </div>
        </div>

        {shown.length === 0 ? (
          <section className="mt-8 border-y border-outlinev py-12">
            <h2 className="text-2xl font-bold text-deep">
              {agents.length === 0 ? "لا يوجد وكيل ظاهر للعامة الآن." : "لا يوجد وكيل بهذا التخصص الآن."}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate">
              {agents.length === 0
                ? "لن نعرض ملفات تجريبية. الوكيل يظهر بعد استيفاء شروط الظهور العامة المسجلة في النظام."
                : "جرّب تخصصًا آخر أو ارجع إلى كل الوكلاء."}
            </p>
            <Link href={agents.length === 0 ? "/join?mode=agent" : "/agents"} className="focus-action mt-6">
              {agents.length === 0 ? "مساحة الوكيل" : "عرض كل الوكلاء"}
            </Link>
          </section>
        ) : (
          <div className="mt-8 divide-y divide-outlinev border-y border-outlinev">
            {shown.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="group grid gap-5 py-6 transition-colors hover:bg-air/20 md:grid-cols-[80px_1fr_260px_auto] md:items-center md:px-4"
              >
                <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-outlinev bg-low">
                  <Image
                    src={agent.photoUrl}
                    alt={agent.displayName}
                    fill
                    sizes="64px"
                    className="object-cover object-top"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-bold text-deep">{agent.displayName}</h2>
                    <AgentTrustChip trust={agent.trust} compact />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate">
                    <span className="font-mono uppercase tracking-[0.08em]">{agent.latinName}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-signal" />
                      {agent.city}، {agent.country}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-earth">
                    {agent.specialtyTags.slice(0, 4).map((item) => <span key={item}>{item}</span>)}
                  </div>
                </div>

                <div className="border-t border-outlinev pt-4 md:border-s md:border-t-0 md:ps-5 md:pt-0">
                  <div className="text-[10px] font-bold text-slate">نطاق المراجعة</div>
                  <p className="mt-2 text-[11px] leading-5 text-slate">
                    افتح Trust Passport لمعرفة ما تغطيه الأدلة الحالية وتاريخ مراجعتها وحدودها.
                  </p>
                </div>

                <ArrowLeft className="h-5 w-5 text-signal transition-transform group-hover:-translate-x-1" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
