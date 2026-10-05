import Link from "next/link";
import Image from "next/image";
import {
  Clock3,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
  SilaAgentIcon,
  SilaArrowIcon,
  SilaCompareIcon,
  SilaConversationIcon,
  SilaIdentityIcon,
  SilaReviewIcon,
  SilaSearchIcon,
} from "@/components/brand/SilaIcons";
import {
  getAgentsWithRatings,
  getFeaturedOffers,
  getMarketplaceStats,
  trackEvent,
} from "@/lib/data";
import { Reveal } from "@/components/Reveal";
import { SearchModule } from "@/components/market/SearchModule";
import { OfferCard } from "@/components/market/OfferCard";
import { AgentTrustChip } from "@/components/market/AgentTrust";
import { BRAND } from "@/lib/brand";
import { SilaMetric, SilaRelationRail } from "@/components/brand/SilaPrimitives";

export const dynamic = "force-dynamic";

const trustItems = [
  { icon: SilaIdentityIcon, title: "هوية مُراجَعة", text: "نعرض ما راجعناه من هوية الوكيل ونطاق الدليل قبل أن تبدأ التواصل" },
  { icon: SilaReviewIcon, title: "مراجعة قبل النشر", text: "التفاصيل تمر على فريق الثقة قبل أن تظهر للمسافر" },
  { icon: SilaCompareIcon, title: "مقارنة أوضح", text: "السعر والمشمولات والمصدر في نفس مستوى القرار" },
  { icon: SilaConversationIcon, title: "تواصل مباشر", text: "أنت تتحدث مع الوكيل نفسه — لا مع وسيط أسعار" },
];

const loops = [
  {
    title: "للمسافر",
    steps: ["ابحث وقارن العروض", "افحص شارات التوثيق والتقييم", "تواصل مع الوكيل مباشرة", "قيّم تجربتك بعد السفر"],
    icon: SilaSearchIcon,
  },
  {
    title: "للوكيل",
    steps: ["أنشئ حسابك وادخل فورًا", "وثّق ملفك للظهور والاعتماد", "انشر عروضك بعد المراجعة", "استقبل الطلبات وابنِ سمعتك"],
    icon: SilaAgentIcon,
  },
  {
    title: "لفريق الثقة",
    steps: ["مراجعة أدلة توثيق الوكلاء", "اعتماد أو رفض العروض بمبررات", "ضبط الأسعار المضللة والصور", "متابعة معدلات الاستجابة"],
    icon: SilaReviewIcon,
  },
];

export default async function Home() {
  const [featured, agents, stats] = await Promise.all([
    getFeaturedOffers(),
    getAgentsWithRatings(),
    getMarketplaceStats(),
  ]);
  const topAgents = agents.slice(0, 3);
  const hasPublishedOffers = stats.published > 0;
  const hasVerifiedAgents = stats.verifiedAgents > 0;
  const marketplaceEmpty = !hasPublishedOffers && !hasVerifiedAgents;
  void trackEvent("landing_view");

  return (
    <>
      {/* Hero */}
      <section className="hero-grid relative overflow-hidden bg-deep pb-32 pt-14 text-oninverse md:pb-40 md:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute -start-24 top-20 h-72 w-72 rounded-full border border-sky/20" />
          <div className="absolute -start-8 top-44 h-48 w-48 rounded-full border border-air/10" />
          <div className="absolute bottom-8 end-8 flex items-center gap-3 opacity-40">
            <span className="h-3 w-3 rounded-full bg-sky" />
            <span className="h-3 w-3 rounded-full bg-sky" />
            <span className="h-1.5 w-24 rounded-full bg-air" />
          </div>
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-16">
          <div className="text-right">
            <Reveal>
              <div className="sila-eyebrow mb-6 text-[12px] font-semibold tracking-[0.12em] text-sky">
                منصة ثقة للسفر
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="max-w-4xl text-5xl font-bold leading-[1.12] tracking-[-0.035em] md:text-7xl md:leading-[1.04]">
                {BRAND.nameAr} بينك وبين
                <span className="block text-air">قرار سفر أوضح.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-7 max-w-2xl text-[17px] leading-8 text-oninverse/72 md:text-lg">
                قارن العرض والوكيل والمعلومة في مكان واحد. نحن لا نبيعك الرحلة؛
                نحن نوضح لك من تتعامل معه وما الذي تمّت مراجعته قبل القرار.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={marketplaceEmpty ? "/readiness" : "/offers"}
                  className="sila-motion-safe inline-flex items-center gap-3 rounded-2xl bg-signal px-6 py-3.5 text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-horizon"
                >
                  {marketplaceEmpty ? "افحص جاهزية سفرك" : "استكشف العروض"}
                  <SilaArrowIcon className="h-5 w-5" />
                </Link>
                <Link
                  href="/trust"
                  className="sila-motion-safe inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-[15px] font-bold text-white transition-all hover:bg-white/10"
                >
                  كيف نبني الثقة؟
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              {marketplaceEmpty ? (
                <div className="mt-10 max-w-2xl border-t border-white/10 pt-6 text-right">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky/25 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-sky">
                    <span className="h-2 w-2 rounded-full bg-signal" />
                    لا مخزون تجريبي
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-oninverse/65">
                    لا توجد عروض أو وكالات منشورة للعامة حتى الآن. أول رقم سيظهر هنا فقط بعد توثيق وكيل واعتماد عرض فعلي.
                  </p>
                </div>
              ) : (
                <div className="mt-10 grid max-w-2xl grid-cols-3 gap-2 border-t border-white/10 pt-6 text-right">
                  <SilaMetric value={stats.verifiedAgents} label="وكيل بأدلة مُراجَعة" className="[&_div:first-child]:text-white [&_div:last-child]:text-oninverse/50" />
                  <SilaMetric value={stats.published} label="عرض بعد المراجعة" className="[&_div:first-child]:text-white [&_div:last-child]:text-oninverse/50" />
                  <SilaMetric value={stats.contactRequests} label="طلب تواصل مباشر" className="[&_div:first-child]:text-white [&_div:last-child]:text-oninverse/50" />
                </div>
              )}
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="sila-window border border-white/14 bg-white/[0.07] p-3 shadow-2xl shadow-black/20 backdrop-blur">
                <div className="sila-window bg-mist p-6 text-inkwell md:p-7">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <div className="text-[11px] font-semibold text-signal">قبل أن تختار</div>
                      <div className="mt-2 text-2xl font-bold tracking-tight text-deep">شوف الصورة كاملة.</div>
                    </div>
                    <div className="flex gap-1.5 pt-1" aria-hidden>
                      <span className="h-3 w-3 rounded-full bg-signal" />
                      <span className="h-3 w-3 rounded-full bg-sky" />
                    </div>
                  </div>

                  <div className="mt-7 space-y-3">
                    {[
                      ["01", "العرض", "السعر والمشمولات والمستثنيات"],
                      ["02", "المصدر", "من الوكيل الذي يقف خلفه"],
                      ["03", "النطاق", "ما الذي راجعناه وما الذي يحتاج تأكيد"],
                    ].map(([num, title, text]) => (
                      <div
                        key={num}
                        className="grid grid-cols-[44px_1fr] gap-4 rounded-2xl border border-outlinev bg-cloud p-4"
                      >
                        <div className="tnum flex h-11 w-11 items-center justify-center rounded-xl bg-air text-[12px] font-bold text-deep">
                          {num}
                        </div>
                        <div>
                          <div className="font-bold text-inkwell">{title}</div>
                          <div className="mt-1 text-[12px] leading-5 text-slate">{text}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center gap-3 border-t border-outlinev pt-5 text-[12px] font-semibold text-deep">
                    <span className="h-2.5 w-2.5 rounded-full bg-signal" />
                    <span className="h-2.5 w-2.5 rounded-full bg-signal" />
                    <span className="h-px flex-1 bg-outlinev" />
                    <span>{BRAND.promiseAr}</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SearchModule marketplaceEmpty={marketplaceEmpty} />

      {/* Trust indicators */}
      <section className="mx-auto max-w-7xl px-5 pt-20 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.07}>
              <div className="flex h-full items-start gap-4 sila-window border border-outlinev bg-cloud p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-verifiedbg text-verified">
                  <t.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-bold text-inkwell">{t.title}</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-slate">{t.text}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Featured offers */}
      <section className="mx-auto max-w-7xl px-5 pt-24 md:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="sila-eyebrow mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-signal">
              <Star className="h-4 w-4" />
              {hasPublishedOffers ? "مختارات هذا الأسبوع" : "السوق الآن"}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">
              {hasPublishedOffers ? "عروض اجتازت المراجعة" : "لا توجد عروض منشورة بعد."}
              <br />
              <span className="text-slate">
                {hasPublishedOffers ? "وتستحق انتباهك." : "أول عرض سيظهر هنا بعد مراجعة فعلية."}
              </span>
            </h2>
          </div>
          <Link
            href="/offers"
            className="group inline-flex items-center gap-2 rounded-2xl border border-outlinev bg-cloud px-5 py-3 text-sm font-bold text-deep transition-all hover:border-signal hover:text-signal"
          >
            كل العروض ({stats.published})
            <SilaArrowIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((o, i) => (
              <Reveal key={o.id} delay={i * 0.06}>
                <OfferCard offer={o} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outlinev bg-cloud p-8 md:p-10">
            <p className="max-w-2xl text-sm leading-7 text-slate">
              صلة لا تملأ الواجهة بعروض تجريبية. يمكنك الآن استخدام جاهزية السفر أو قراءة معايير الثقة، وستظهر العروض هنا عندما تجتاز المراجعة.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/readiness" className="rounded-lg bg-deep px-5 py-3 text-sm font-bold text-white hover:bg-horizon">
                جاهزية السفر
              </Link>
              <Link href="/trust" className="rounded-lg border border-outlinev bg-low px-5 py-3 text-sm font-bold text-deep hover:border-deep">
                معايير الثقة
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-28 md:px-8">
        <div className="mb-12 text-center">
          <div className="sila-eyebrow mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-deep">
            ثلاثة أدوار · نظام واحد
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">
            كيف تعمل {BRAND.nameAr}؟
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {loops.map((loop, i) => (
            <Reveal key={loop.title} delay={i * 0.08}>
              <div className="h-full sila-window border border-outlinev bg-cloud p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-wash text-deep">
                  <loop.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-inkwell">{loop.title}</h3>
                <ol className="mt-5 space-y-3.5">
                  {loop.steps.map((s, j) => (
                    <li key={s} className="flex items-start gap-3 text-[14px] leading-relaxed text-slate">
                      <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-low text-[11px] font-bold text-deep">
                        {j + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Top agents */}
      <section className="mx-auto max-w-7xl px-5 py-28 md:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="sila-eyebrow mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-verified">
              <ShieldCheck className="h-4 w-4" />
              {hasVerifiedAgents ? "وكلاء على رأس الجدول" : "التوثيق قبل الظهور"}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">
              {hasVerifiedAgents ? "موثّقون، وسريعو الرد،" : "لا نعرض وكيلًا قبل اجتياز التوثيق."}
              <br />
              <span className="text-slate">
                {hasVerifiedAgents ? "ومجرّبون من مسافرين." : "أول وكيل معتمد سيظهر هنا فقط بعد قرار مراجعة فعلي."}
              </span>
            </h2>
          </div>
          <Link
            href="/agents"
            className="group inline-flex items-center gap-2 rounded-2xl border border-outlinev bg-cloud px-5 py-3 text-sm font-bold text-deep transition-all hover:border-signal hover:text-signal"
          >
            كل الوكلاء
            <SilaArrowIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </Link>
        </div>
        {topAgents.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {topAgents.map((a, i) => (
              <Reveal key={a.id} delay={i * 0.07}>
                <Link
                  href={`/agents/${a.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-outlinev bg-cloud p-6 transition-all duration-300 hover:-translate-y-1 hover:border-deep/30 hover:shadow-lg hover:shadow-deep/10"
                >
                  <div className="flex items-center gap-4">
                    <Image
                      src={a.photoUrl}
                      alt={a.displayName}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-2xl border border-outlinev object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-lg font-bold text-inkwell group-hover:text-deep">
                        {a.displayName}
                      </div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate">
                        {a.latinName} · {a.city}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {a.specialtyTags.map((t) => (
                      <span key={t} className="rounded-md bg-parchment px-2.5 py-1 text-[11px] font-semibold text-stone">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-low pt-4 text-[13px]">
                    <span className="tnum inline-flex items-center gap-1.5 font-bold text-gold">
                      <Star className="h-4 w-4 fill-gold" />
                      {a.avgRating} <span className="font-normal text-slate">({a.reviewCount})</span>
                    </span>
                    <span className="tnum inline-flex items-center gap-1.5 text-slate">
                      <Clock3 className="h-4 w-4" />
                      {a.avgResponseHours} س
                    </span>
                    <AgentTrustChip trust={a.trust} compact />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outlinev bg-cloud p-8 text-sm leading-7 text-slate md:p-10">
            لا توجد ملفات وكلاء بحالة موثّقة منشورة للعامة حتى الآن. لن نعرض ملفًا أو شارة قبل اكتمال المراجعة الفعلية.
          </div>
        )}

        {/* Agent CTA */}
        <Reveal delay={0.1}>
          <div className="mt-16 flex flex-col items-center justify-between gap-6 rounded-2xl bg-wash p-8 md:flex-row md:p-12">
            <div className="max-w-xl text-center md:text-start">
              <h3 className="text-2xl font-bold text-deep md:text-3xl">افتح حساب وكيل، وخذ خطوتك الأولى.</h3>
              <p className="mt-3 leading-relaxed text-slate">
                سجّل وادخل حسابك فورًا من غير مستندات. عندما تكون جاهزًا، وثّق
                ملفك للظهور للمسافرين والاعتماد، ثم انشر عروضك بعد مراجعتها.
              </p>
            </div>
            <Link
              href="/join?mode=agent"
              className="shrink-0 rounded-lg bg-deep px-8 py-4 text-[15px] font-bold text-white transition-colors hover:bg-horizon"
            >
              إنشاء حساب وكيل
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
