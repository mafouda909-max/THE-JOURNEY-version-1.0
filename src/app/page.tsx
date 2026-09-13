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
} from "@/lib/data";
import { Reveal } from "@/components/Reveal";
import { SearchModule } from "@/components/market/SearchModule";
import { OfferCard, VerifiedChip } from "@/components/market/OfferCard";
import { AnalyticsBeacon } from "@/components/AnalyticsBeacon";

export const dynamic = "force-dynamic";

const trustItems = [
  { icon: ShieldCheck, title: "هوية ونشاط تحت المراجعة", text: "نراجع أدلة الهوية ومستندات النشاط المطلوبة قبل الظهور العام." },
  { icon: BadgeCheck, title: "مراجعة قبل النشر", text: "كل عرض يمر على سياسة النشر وفريق الثقة قبل ظهوره للمسافرين." },
  { icon: Star, title: "تقييم بعد تفاعل", text: "التقييم مرتبط بتفاعل مسجل داخل المنصة، لا بنجوم مجهولة المصدر." },
  { icon: MessageSquareText, title: "تواصل مع الوكيل", text: "طلبك يصل للوكيل صاحب العرض وتتابع حالته من حسابك عند تسجيل الدخول." },
];

const loops = [
  {
    title: "للمسافر",
    steps: ["ابحث بين العروض المنشورة", "افهم ما هو موثّق وما هو ادعاء وكيل", "تواصل مع الوكيل", "تابع حالة طلبك"],
    icon: Search,
  },
  {
    title: "للوكيل",
    steps: ["سجّل وقدّم أدلة التوثيق", "أنشئ عرضًا واضحًا", "أرسله للمراجعة", "تابع طلبات المسافرين ورد عليها"],
    icon: UserCheck,
  },
  {
    title: "لفريق الثقة",
    steps: ["راجع أدلة الوكلاء", "راجع ادعاءات العروض", "وثّق أسباب الاعتماد أو الرفض", "راقب الحالة وسجل التدقيق"],
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

  return (
    <>
      <AnalyticsBeacon name="landing_view" />

      <section className="hero-grid relative overflow-hidden bg-inverse pb-36 pt-20 text-oninverse md:pt-28">
        <div className="pointer-events-none absolute -top-40 start-1/4 h-96 w-96 rounded-full bg-horizon/30 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 end-10 h-72 w-72 rounded-full bg-gold/10 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-5 text-center md:px-8">
          <Reveal>
            <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-semibold text-oninverse/80">
              <ShieldCheck className="h-4 w-4 text-verified" aria-hidden="true" />
              سوق سفر يفرّق بين الادعاء والدليل
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.15] tracking-tight md:text-7xl md:leading-[1.1]">
              سافر مع من<span className="text-gold"> تثق </span>به.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-oninverse/70">
              THE JOURNEY تجمع المسافرين بوكلاء سفر اجتازوا مراجعة التوثيق، وتضع معلومات الثقة بجانب العرض نفسه. نراجع سياسة النشر ونوثّق القرارات، ولا نسمّي السعر أو التوفر «متحققًا خارجيًا» ما لم نملك الدليل.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-[13px] text-oninverse/60">
              <span className="tnum"><b className="text-white">{stats.verifiedAgents}</b> وكلاء موثّقون حاليًا</span>
              <span className="h-4 w-px bg-white/20" aria-hidden="true" />
              <span className="tnum"><b className="text-white">{stats.published}</b> عروض منشورة</span>
              <span className="h-4 w-px bg-white/20" aria-hidden="true" />
              <span className="tnum"><b className="text-white">{stats.contactRequests}</b> طلبات تواصل مسجلة</span>
            </div>
          </Reveal>
        </div>
      </section>

      <SearchModule />

      <section className="mx-auto max-w-7xl px-5 pt-20 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.07}>
              <div className="flex h-full items-start gap-4 rounded-xl border border-outlinev bg-cloud p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-verifiedbg text-verified">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="font-bold text-inkwell">{item.title}</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-slate">{item.text}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-24 md:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-gold">
              <Star className="h-4 w-4" aria-hidden="true" />
              عروض مميزة حاليًا
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">
              عروض اجتازت مراجعة النشر
              <br />
              <span className="text-slate">مع معلومات الثقة بجانبها.</span>
            </h2>
          </div>
          <Link
            href="/offers"
            className="group inline-flex items-center gap-2 rounded-lg border-2 border-deep px-5 py-3 text-sm font-bold text-deep transition-all hover:bg-deep hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
          >
            كل العروض ({stats.published})
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
          </Link>
        </div>
        {featured.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outlinev bg-cloud px-8 py-14 text-center">
            <p className="text-lg font-bold text-inkwell">لا عروض مميزة حاليًا.</p>
            <p className="mt-2 text-sm text-slate">يمكنك تصفّح كل العروض المنشورة بدلًا من الاعتماد على اختيار مميز.</p>
            <Link href="/offers" className="mt-5 inline-flex rounded-lg bg-deep px-5 py-3 text-sm font-bold text-white hover:bg-horizon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20">
              تصفّح العروض
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((offer, index) => (
              <Reveal key={offer.id} delay={index * 0.06}>
                <OfferCard offer={offer} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-28 md:px-8">
        <div className="mb-12 text-center">
          <div className="mb-3 font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-deep">ثلاثة أدوار · نظام واحد</div>
          <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">كيف تدور الرحلة؟</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {loops.map((loop, index) => (
            <Reveal key={loop.title} delay={index * 0.08}>
              <div className="h-full rounded-2xl border border-outlinev bg-cloud p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-wash text-deep">
                  <loop.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-inkwell">{loop.title}</h3>
                <ol className="mt-5 space-y-3.5">
                  {loop.steps.map((step, stepIndex) => (
                    <li key={step} className="flex items-start gap-3 text-[14px] leading-relaxed text-slate">
                      <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-low text-[11px] font-bold text-deep">{stepIndex + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-28 md:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-verified">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              وكلاء موثّقون حاليًا
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-5xl">
              تعرف من يرد أسرع،
              <br />
              <span className="text-slate">وما الذي نعرفه عنه فعلاً.</span>
            </h2>
          </div>
          <Link
            href="/agents"
            className="group inline-flex items-center gap-2 rounded-lg border-2 border-deep px-5 py-3 text-sm font-bold text-deep transition-all hover:bg-deep hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
          >
            كل الوكلاء
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
          </Link>
        </div>
        {topAgents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outlinev bg-cloud px-8 py-14 text-center text-sm text-slate">لا وكلاء موثّقين متاحين للعامة حاليًا.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {topAgents.map((agent, index) => (
              <Reveal key={agent.id} delay={index * 0.07}>
                <Link
                  href={`/agents/${agent.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-outlinev bg-cloud p-6 transition-all duration-300 hover:-translate-y-1 hover:border-deep/30 hover:shadow-lg hover:shadow-deep/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
                >
                  <div className="flex items-center gap-4">
                    <Image src={agent.photoUrl} alt={agent.displayName} width={64} height={64} className="h-16 w-16 rounded-2xl border border-outlinev object-cover" />
                    <div className="min-w-0">
                      <div className="truncate text-lg font-bold text-inkwell group-hover:text-deep">{agent.displayName}</div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate">{agent.latinName} · {agent.city}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {agent.specialtyTags.map((tag) => (
                      <span key={tag} className="rounded-md bg-parchment px-2.5 py-1 text-[11px] font-semibold text-stone">{tag}</span>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-low pt-4 text-[13px]">
                    <span className="tnum inline-flex items-center gap-1.5 font-bold text-gold">
                      <Star className="h-4 w-4 fill-gold" aria-hidden="true" />
                      {agent.avgRating} <span className="font-normal text-slate">({agent.reviewCount})</span>
                    </span>
                    <span className="tnum inline-flex items-center gap-1.5 text-slate">
                      <Clock3 className="h-4 w-4" aria-hidden="true" />
                      {agent.avgResponseHours} س
                    </span>
                    <VerifiedChip licenseType={agent.licenseType} hasLicense={agent.hasLicense} compact />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal delay={0.1}>
          <div className="mt-16 flex flex-col items-center justify-between gap-6 rounded-2xl bg-wash p-8 md:flex-row md:p-12">
            <div className="max-w-xl text-center md:text-start">
              <h3 className="text-2xl font-bold text-deep md:text-3xl">وكيل سفر وتريد الظهور بثقة؟</h3>
              <p className="mt-3 leading-relaxed text-slate">
                قدّم أدلة الهوية ومستندات النشاط المطلوبة حسب نوع الحساب. بعد اعتماد التوثيق يمكنك إرسال عروضك للمراجعة وإدارة طلبات المسافرين من حسابك.
              </p>
            </div>
            <Link
              href="/trust#agent"
              className="shrink-0 rounded-lg bg-deep px-8 py-4 text-[15px] font-bold text-white transition-colors hover:bg-horizon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
            >
              ابدأ التوثيق
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
