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
import { SilaDecisionField, SilaMetric } from "@/components/brand/SilaPrimitives";

export const dynamic = "force-dynamic";

const trustItems = [
  { icon: SilaIdentityIcon, title: "هوية مُراجَعة", text: "نعرض ما راجعناه من هوية الوكيل ونطاق الدليل قبل أن تبدأ التواصل" },
  { icon: SilaReviewIcon, title: "مراجعة قبل النشر", text: "التفاصيل تمر على فريق الثقة قبل أن تظهر للمسافر" },
  { icon: SilaCompareIcon, title: "مقارنة أوضح", text: "السعر والمشمولات والمصدر في نفس مستوى القرار" },
  { icon: SilaConversationIcon, title: "تواصل مباشر", text: "أنت تتحدث مع الوكيل نفسه — لا مع وسيط أسعار" },
];

const loops = [
  {
    title: "احكِ لنا الرحلة",
    steps: ["حدد الوجهة وغرض السفر", "أدخل ما تعرفه من تاريخ وميزانية وترانزيت", "لا تحتاج تعرف كل التفاصيل من البداية", "صلة تسأل فقط عن النقاط التي تغيّر القرار"],
    icon: SilaSearchIcon,
  },
  {
    title: "صلة تكمل الصورة",
    steps: ["توضح ما نعرفه وما ينقص", "تربط كل معلومة بمصدرها ونطاقها", "تميز بين المؤكد وما يحتاج تأكيدًا", "وتبحث مباشرة عندما تكون المصادر الحية مفعّلة"],
    icon: SilaReviewIcon,
  },
  {
    title: "اختار خطوتك التالية",
    steps: ["راجع تجهيزاتك والنقاط الحرجة", "شوف العروض المطابقة إن وُجدت", "اعرف الوكيل وما راجعته صلة", "ابدأ الاستفسار أو احفظ الرحلة للمتابعة"],
    icon: SilaConversationIcon,
  },
];

export default async function Home() {
  let featured: Awaited<ReturnType<typeof getFeaturedOffers>> = [];
  let agents: Awaited<ReturnType<typeof getAgentsWithRatings>> = [];
  let stats: Awaited<ReturnType<typeof getMarketplaceStats>> = {
    published: 0,
    pending: 0,
    verifiedAgents: 0,
    contactRequests: 0,
  };
  let previewDesignMode = false;

  try {
    [featured, agents, stats] = await Promise.all([
      getFeaturedOffers(),
      getAgentsWithRatings(),
      getMarketplaceStats(),
    ]);
  } catch (error) {
    const isolatedPreviewMissing =
      process.env.VERCEL_ENV === "preview" &&
      error instanceof Error &&
      error.message.includes("Preview database isolation is not configured");

    if (!isolatedPreviewMissing) throw error;
    previewDesignMode = true;
  }

  const topAgents = agents.slice(0, 3);
  const hasPublishedOffers = stats.published > 0;
  const hasVerifiedAgents = stats.verifiedAgents > 0;
  const marketplaceEmpty = !hasPublishedOffers && !hasVerifiedAgents;

  if (!previewDesignMode) {
    void trackEvent("landing_view").catch(() => undefined);
  }

  return (
    <>
      {previewDesignMode ? (
        <div className="border-b border-sky/20 bg-deep px-5 py-2.5 text-center text-[11px] font-semibold text-oninverse/70">
          Preview بصري آمن · بيانات السوق والحسابات غير متصلة بقاعدة Production
        </div>
      ) : null}

      {/* Hero */}
      <section className="relative overflow-hidden bg-deep pb-24 pt-16 text-oninverse md:pb-32 md:pt-24">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
          <div className="absolute inset-x-[8%] bottom-0 h-px bg-gradient-to-l from-transparent via-sky/30 to-transparent" />
          <div className="absolute -end-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-sky/[0.055] blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 md:px-8 lg:grid-cols-[.94fr_1.06fr] lg:gap-20">
          <div className="text-right">
            <Reveal>
              <div className="sila-eyebrow mb-7 text-[12px] font-semibold text-sky">
                صلة · بينك وبين القرار اللي يستاهل
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="max-w-4xl text-[clamp(3.35rem,6.5vw,6.9rem)] font-bold leading-[.98] tracking-[-0.045em]">
                ابدأ من اللي تعرفه.
                <span className="mt-2 block text-air">{BRAND.nameAr} توصلك للي يغيّر القرار.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-8 max-w-[42rem] text-[17px] leading-8 text-oninverse/70 md:text-[19px]">
                مش محتاج تدخل الرحلة كاملة من أول مرة. اكتب اللي تعرفه، وصلة تفصل لك
                المؤكد عن اللي يحتاج تأكيد، وبعدها ترفع لك خطوة واحدة واضحة بدل زحمة الخيارات.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href="/readiness"
                  className="sila-motion-safe inline-flex min-h-13 items-center gap-3 rounded-2xl bg-signal px-6 py-3.5 text-[15px] font-bold text-white transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-horizon hover:shadow-[0_14px_34px_rgba(46,111,216,.24)]"
                >
                  ابدأ رحلتك
                  <SilaArrowIcon className="h-5 w-5" />
                </Link>
                <Link
                  href={hasPublishedOffers ? "/offers" : "/join?mode=agent"}
                  className="group inline-flex min-h-12 items-center gap-2 text-sm font-bold text-oninverse/80 transition-colors hover:text-white"
                >
                  {hasPublishedOffers ? "شوف العروض الحقيقية" : "أنا وكيل سفر"}
                  <SilaArrowIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </Link>
              </div>
              <p className="sila-reassurance mt-4 text-oninverse/58">
                بدون حجز أو دفع في البداية. تقدر تحفظ الرحلة وتكمل لما الصورة تبقى أوضح.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              {marketplaceEmpty ? (
                <div className="mt-10 max-w-2xl border-t border-white/10 pt-6 text-right">
                  <div className="text-[11px] font-bold text-sky">الآن · إطلاق تأسيسي مضبوط</div>
                  <p className="mt-2 max-w-xl text-sm leading-7 text-oninverse/58">
                    السوق يبدأ بعدد محدود من الوكلاء والعروض التي اجتازت المراجعة.
                    مستشار صلة يظل مفيدًا حتى لو لم يوجد عرض مطابق بعد.
                  </p>
                </div>
              ) : (
                <div className="mt-10 grid max-w-2xl grid-cols-3 gap-5 border-t border-white/10 pt-6 text-right">
                  <SilaMetric value={stats.verifiedAgents} label="وكيل بأدلة مُراجَعة" className="[&_div:first-child]:text-white [&_div:last-child]:text-oninverse/50" />
                  <SilaMetric value={stats.published} label="عرض بعد المراجعة" className="[&_div:first-child]:text-white [&_div:last-child]:text-oninverse/50" />
                  <SilaMetric value={stats.contactRequests} label="طلب تواصل مباشر" className="[&_div:first-child]:text-white [&_div:last-child]:text-oninverse/50" />
                </div>
              )}
            </Reveal>
          </div>

          <Reveal delay={0.08}>
            <SilaDecisionField className="mx-auto w-full max-w-[570px]" />
          </Reveal>
        </div>
      </section>

      <SearchModule marketplaceEmpty={marketplaceEmpty} />

      {/* Trust indicators */}
      <section className="mx-auto max-w-7xl px-5 pt-20 md:px-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">الثقة مش Badge</div>
          <div className="hidden text-[11px] text-slate sm:block">كل إشارة هنا لها دليل أو نطاق واضح</div>
        </div>
        <div className="sila-trust-rail grid sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-x-reverse lg:divide-outlinev">
          {trustItems.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.05}>
              <div className="flex min-h-[148px] items-start gap-4 py-6 sm:px-5 lg:px-6">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center text-verified">
                  <t.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-inkwell">{t.title}</div>
                  <div className="mt-2 text-[13px] leading-6 text-slate">{t.text}</div>
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
              {hasPublishedOffers ? "مختارات هذا الأسبوع" : "عندما يوجد عرض مناسب"}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">
              {hasPublishedOffers ? "عروض اجتازت المراجعة" : "صلة لن تقترح عليك عرضًا غير موجود."}
              <br />
              <span className="text-slate">
                {hasPublishedOffers ? "وتظهر مع صاحبها ونطاق المراجعة." : "وعندما يتطابق عرض حقيقي مع رحلتك، سيظهر داخل السياق المناسب."}
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
              استخدم مستشار السفر الآن لتكوين سياق رحلتك. لو لم يوجد عرض مناسب، سنقول ذلك بوضوح بدل عرض نتيجة تجريبية.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/readiness" className="rounded-lg bg-deep px-5 py-3 text-sm font-bold text-white hover:bg-horizon">
                مستشار السفر
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
        <div className="mb-10 grid gap-5 md:grid-cols-[.75fr_1.25fr] md:items-end">
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">من سؤال إلى قرار</div>
          <div>
            <h2 className="text-3xl font-bold tracking-[-0.025em] text-inkwell md:text-5xl">
              صلة ما تفتحش لك عشر شاشات.
              <span className="block text-slate">تمشي معاك على مسار واحد مفهوم.</span>
            </h2>
          </div>
        </div>

        <div className="sila-step-rail grid md:grid-cols-3 md:divide-x md:divide-x-reverse md:divide-outlinev">
          {loops.map((loop, i) => (
            <Reveal key={loop.title} delay={i * 0.06}>
              <div className="sila-step-rail__item h-full">
                <div className="flex items-center justify-between gap-4">
                  <span className="sila-step-rail__index tnum">0{i + 1}</span>
                  <loop.icon className="h-5 w-5 text-signal" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-inkwell md:text-2xl">{loop.title}</h3>
                <ol className="mt-5 space-y-3">
                  {loop.steps.map((s, j) => (
                    <li key={s} className="grid grid-cols-[22px_1fr] gap-3 text-[13px] leading-6 text-slate">
                      <span className="tnum pt-px text-[10px] font-bold text-signal">0{j + 1}</span>
                      <span>{s}</span>
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
              {hasVerifiedAgents ? "أدلة مُراجَعة،" : "لا نعرض وكيلًا قبل اجتياز التوثيق."}
              <br />
              <span className="text-slate">
                {hasVerifiedAgents ? "ونطاق واضح قبل التواصل." : "أول وكيل معتمد سيظهر هنا فقط بعد قرار مراجعة فعلي."}
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
