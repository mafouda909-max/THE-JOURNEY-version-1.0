import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  MessageSquareText,
  Search,
  ShieldCheck,
  Star,
  UserCheck,
} from "lucide-react";
import {
  getAgentsWithRatings,
  getFeaturedOffers,
  getMarketplaceStats,
  trackEvent,
} from "@/lib/data";
import { Reveal } from "@/components/Reveal";
import { SearchModule } from "@/components/market/SearchModule";
import { OfferCard, VerifiedChip } from "@/components/market/OfferCard";

export const dynamic = "force-dynamic";

const trustItems = [
  { icon: ShieldCheck, title: "هوية موثّقة", text: "تحقق حكومي من كل وكيل قبل أول عرض" },
  { icon: BadgeCheck, title: "مراجعة يدوية", text: "كل عرض يمر على فريق الثقة قبل النشر" },
  { icon: Star, title: "تقييم بعد تفاعل", text: "لا نجوم إلا من مسافر تواصل فعلاً" },
  { icon: MessageSquareText, title: "تواصل مباشر", text: "أنت تتحدث مع الوكيل — لا مع بوت أسعار" },
];

const loops = [
  {
    title: "للمسافر",
    steps: ["ابحث وقارن العروض", "افحص شارات التوثيق والتقييم", "تواصل مع الوكيل مباشرة", "قيّم تجربتك بعد السفر"],
    icon: Search,
  },
  {
    title: "للوكيل",
    steps: ["سجّل وقدّم وثائق التوثيق", "انشر عروضك بعد المراجعة", "استقبل طلبات المسافرين", "ابنِ سمعتك بالرد والالتزام"],
    icon: UserCheck,
  },
  {
    title: "لفريق الثقة",
    steps: ["مراجعة وثائق الوكلاء خلال ٤٨ ساعة", "اعتماد أو رفض العروض بمبررات", "ضبط الأسعار المضللة والصور", "متابعة معدلات الاستجابة"],
    icon: ShieldCheck,
  },
];

export default async function Home() {
  const [featured, agents, stats] = await Promise.all([
    getFeaturedOffers(),
    getAgentsWithRatings(),
    getMarketplaceStats(),
  ]);
  const topAgents = agents.slice(0, 3);
  void trackEvent("landing_view");

  return (
    <>
      {/* Hero */}
      <section className="hero-grid relative overflow-hidden bg-inverse pb-36 pt-20 text-oninverse md:pt-28">
        <div className="pointer-events-none absolute -top-40 start-1/4 h-96 w-96 rounded-full bg-horizon/30 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 end-10 h-72 w-72 rounded-full bg-gold/10 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 text-center md:px-8">
          <Reveal>
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold text-oninverse/80">
              <ShieldCheck className="h-4 w-4 text-verified" />
              سوق ثقة للسفر — تأسست لأن «رخيص» لا يكفي
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.15] tracking-tight md:text-7xl md:leading-[1.1]">
              سافر مع من<span className="text-gold"> تثق </span>به.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-oninverse/70">
              الرحلة تجمع المسافرين بوكلاء سفر موثّقين بهوية حكومية ورخص سارية.
              تتواصل مباشرة مع الوكيل — ونحن نتحقق، نراجع، ونتابع النتائج.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-[13px] text-oninverse/60">
              <span className="tnum"><b className="text-white">{stats.verifiedAgents}</b> وكلاء موثّقون</span>
              <span className="h-4 w-px bg-white/20" />
              <span className="tnum"><b className="text-white">{stats.published}</b> عرضاً بعد المراجعة</span>
              <span className="h-4 w-px bg-white/20" />
              <span className="tnum"><b className="text-white">{stats.contactRequests}</b> طلب تواصل مباشر</span>
            </div>
          </Reveal>
        </div>
      </section>

      <SearchModule />

      {/* Trust indicators */}
      <section className="mx-auto max-w-7xl px-5 pt-20 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.07}>
              <div className="flex h-full items-start gap-4 rounded-xl border border-outlinev bg-cloud p-5">
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
            <div className="mb-3 flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-gold">
              <Star className="h-4 w-4" />
              مختارات هذا الأسبوع
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">
              عروض اجتازت المراجعة
              <br />
              <span className="text-slate">وتستحق انتباهك.</span>
            </h2>
          </div>
          <Link
            href="/offers"
            className="group inline-flex items-center gap-2 rounded-lg border-2 border-deep px-5 py-3 text-sm font-bold text-deep transition-all hover:bg-deep hover:text-white"
          >
            كل العروض ({stats.published})
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((o, i) => (
            <Reveal key={o.id} delay={i * 0.06}>
              <OfferCard offer={o} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-28 md:px-8">
        <div className="mb-12 text-center">
          <div className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-deep">
            ثلاثة أدوار · نظام واحد
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">
            كيف تدور الرحلة؟
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {loops.map((loop, i) => (
            <Reveal key={loop.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-outlinev bg-cloud p-7">
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
            <div className="mb-3 flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-verified">
              <ShieldCheck className="h-4 w-4" />
              وكلاء على رأس الجدول
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">
              موثّقون، وسريعو الرد،
              <br />
              <span className="text-slate">ومجرّبون من مسافرين.</span>
            </h2>
          </div>
          <Link
            href="/agents"
            className="group inline-flex items-center gap-2 rounded-lg border-2 border-deep px-5 py-3 text-sm font-bold text-deep transition-all hover:bg-deep hover:text-white"
          >
            كل الوكلاء
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </Link>
        </div>
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
                  <VerifiedChip licenseType={a.licenseType} hasLicense={Boolean(a.licenseNumber)} compact />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        {/* Agent CTA */}
        <Reveal delay={0.1}>
          <div className="mt-16 flex flex-col items-center justify-between gap-6 rounded-2xl bg-wash p-8 md:flex-row md:p-12">
            <div className="max-w-xl text-center md:text-start">
              <h3 className="text-2xl font-bold text-deep md:text-3xl">عندك عرض يستحق الثقة؟</h3>
              <p className="mt-3 leading-relaxed text-slate">
                التوثيق يستغرق ٤٨ ساعة: بطاقة الهوية، الرخصة إن وُجدت، وملف
                الوكالة. انشر عروضك بعد اعتمادها — ولا تدفع شيئاً قبل أول طلب تواصل.
              </p>
            </div>
            <Link
              href="/trust#agent"
              className="shrink-0 rounded-lg bg-deep px-8 py-4 text-[15px] font-bold text-white transition-colors hover:bg-horizon"
            >
              ابدأ توثيق وكالتك
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
