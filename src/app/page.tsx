import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileSearch,
  ShieldCheck,
} from "lucide-react";
import { OfferCard } from "@/components/market/OfferCard";
import { SilaArrowIcon } from "@/components/brand/SilaIcons";
import { getFeaturedOffers, getMarketplaceStats, trackEvent } from "@/lib/data";

export const dynamic = "force-dynamic";

type MarketplaceStats = Awaited<ReturnType<typeof getMarketplaceStats>>;
type FeaturedOffers = Awaited<ReturnType<typeof getFeaturedOffers>>;

const decisionSteps = [
  {
    number: "01",
    title: "أفهم",
    text: "ابدأ من اللي تعرفه، حتى لو الرحلة لسه ناقصة.",
  },
  {
    number: "02",
    title: "أتحقق",
    text: "نفرّق بين المؤكد، المختلف عليه، وغير المعروف.",
  },
  {
    number: "03",
    title: "أقارن",
    text: "العروض تتقارن بالسعر والمشمولات والمصدر والنطاق.",
  },
  {
    number: "04",
    title: "أختار",
    text: "تتحرك بخطوة واحدة واضحة بدل زحمة اختيارات.",
  },
];

export default async function Home() {
  let featured: FeaturedOffers = [];
  let stats: MarketplaceStats = {
    published: 0,
    pending: 0,
    verifiedAgents: 0,
    contactRequests: 0,
  };
  const previewDesignMode =
    process.env.VERCEL_ENV === "preview" &&
    !process.env.SILA_PREVIEW_DATABASE_URL;

  if (!previewDesignMode) {
    [featured, stats] = await Promise.all([
      getFeaturedOffers(),
      getMarketplaceStats(),
    ]);
    void trackEvent("landing_view").catch(() => undefined);
  }

  const hasOffers = stats.published > 0;

  return (
    <>
      {previewDesignMode ? (
        <div className="border-b border-outlinev bg-air px-5 py-2 text-center text-[11px] font-semibold text-deep">
          Preview بصري آمن · بيانات السوق والحسابات غير متصلة بقاعدة Production
        </div>
      ) : null}

      <section className="decision-canvas relative overflow-hidden">
        <div className="relative z-10 mx-auto grid min-h-[720px] max-w-[1320px] items-center gap-14 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[.92fr_1.08fr] lg:gap-20">
          <div className="max-w-[680px]">
            <div className="sila-eyebrow text-[12px] font-bold">
              صلة · منصة قرار وتحقق في السفر
            </div>

            <h1 className="mt-7 text-[clamp(3.4rem,7.5vw,7.4rem)] font-bold leading-[.96] tracking-[-0.055em] text-deep">
              اعرف
              <span className="block text-signal">قبل ما تختار.</span>
            </h1>

            <p className="mt-8 max-w-[620px] text-[18px] leading-9 text-slate md:text-[21px]">
              قبل ما تختار عرض سفر، اعرف ما الذي يحتويه فعلًا، من أين جاءت المعلومة،
              وما الذي تم التحقق منه وما زال يحتاج تأكيدًا.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/readiness" className="focus-action">
                ابدأ رحلتك
                <SilaArrowIcon className="h-4 w-4" />
              </Link>
              <Link href="/offers" className="quiet-action">
                استكشف العروض
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 max-w-[620px] border-t border-outlinev pt-5 text-[12px] leading-6 text-slate">
              لا حجز ولا دفع في البداية. صلة تبدأ بفهم القرار، ثم تعرض فقط ما تدعمه البيانات الموجودة.
            </div>
          </div>

          <div className="decision-board">
            <div className="flex items-center justify-between gap-4 border-b border-outlinev px-5 py-4 md:px-6">
              <div>
                <div className="text-[11px] font-bold text-signal">كيف تقرأ صلة أي قرار؟</div>
                <div className="mt-1 text-sm font-bold text-deep">العرض وحده ليس المنتج.</div>
              </div>
              <span className="decision-state decision-state--focus">Decision view</span>
            </div>

            <div className="p-5 md:p-7">
              <div className="text-[11px] font-bold text-slate">السؤال</div>
              <div className="mt-2 text-2xl font-bold tracking-[-0.025em] text-inkwell md:text-3xl">
                هل هذه المعلومة كافية لاتخاذ قرار؟
              </div>

              <div className="mt-7 space-y-0 border-y border-outlinev">
                <div className="grid gap-3 py-5 md:grid-cols-[120px_1fr_auto] md:items-center">
                  <div className="text-[12px] font-bold text-deep">العرض</div>
                  <div className="text-sm leading-7 text-slate">
                    ماذا يعرض الوكيل؟ السعر، المشمولات، الاستثناءات والشروط.
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-signal" />
                </div>
                <div className="grid gap-3 border-t border-outlinev py-5 md:grid-cols-[120px_1fr_auto] md:items-center">
                  <div className="text-[12px] font-bold text-deep">المصدر</div>
                  <div className="text-sm leading-7 text-slate">
                    من قال هذه المعلومة؟ وكيل، مصدر رسمي، مزود، أو بيانات مسافر.
                  </div>
                  <FileSearch className="h-5 w-5 text-earth" />
                </div>
                <div className="grid gap-3 border-t border-outlinev py-5 md:grid-cols-[120px_1fr_auto] md:items-center">
                  <div className="text-[12px] font-bold text-deep">النطاق</div>
                  <div className="text-sm leading-7 text-slate">
                    ما الذي يغطيه التحقق؟ ومتى شوهدت المعلومة وإلى متى تصلح؟
                  </div>
                  <ShieldCheck className="h-5 w-5 text-verified" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="border border-outlinev bg-verifiedbg p-3">
                  <div className="decision-state decision-state--confirmed">مؤكد</div>
                </div>
                <div className="border border-outlinev bg-amber p-3">
                  <div className="decision-state decision-state--conflicting">مختلف عليه</div>
                </div>
                <div className="border border-outlinev bg-low p-3">
                  <div className="decision-state decision-state--unknown">غير معروف</div>
                </div>
              </div>

              <p className="mt-5 text-[11px] leading-6 text-slate">
                صلة لا تحول المعلومة الناقصة إلى حقيقة. حالة “غير معروف” تظل كذلك حتى يظهر دليل أفضل.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-outlinev bg-cloud">
        <div className="mx-auto grid max-w-[1320px] md:grid-cols-4 md:divide-x md:divide-x-reverse md:divide-outlinev">
          {decisionSteps.map((step) => (
            <div key={step.number} className="decision-step px-5 py-7 md:px-7 md:py-9">
              <div className="decision-step__index tnum">{step.number}</div>
              <div>
                <div className="text-lg font-bold text-deep">{step.title}</div>
                <p className="mt-2 text-[12px] leading-6 text-slate">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-5 py-20 md:px-8 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
          <div>
            <div className="sila-eyebrow text-[11px] font-bold">من الغموض إلى خطوة واحدة</div>
            <h2 className="mt-5 text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-deep md:text-6xl">
              مش لازم تعرف كل حاجة عشان تبدأ.
            </h2>
          </div>

          <div className="max-w-[760px]">
            <p className="text-[18px] leading-9 text-slate">
              صلة تجمع ما تعرفه عن الرحلة، تسألك فقط عن المعلومة التي تغيّر القرار،
              ثم تحفظ السياق في نفس الرحلة حتى لا تبدأ كل شاشة من الصفر.
            </p>

            <div className="mt-8 border-y border-outlinev">
              {[
                ["ما أعرفه", "وجهة، مدة، عدد مسافرين، غرض، أو أي معلومة قلتها بالفعل."],
                ["ما يحتاج معرفة", "سؤال واحد في كل مرة، وليس فورمًا يطلب كل شيء مقدمًا."],
                ["ما سنراجعه", "متطلبات، ترانزيت، مصادر، عروض، ونقاط تعارض عندما تتوفر الأدلة."],
                ["ما أفعله الآن", "Next step واحد واضح؛ والباقي يظل خلف Progressive Disclosure."],
              ].map(([title, text], index) => (
                <div key={title} className="grid gap-3 border-b border-outlinev py-5 last:border-b-0 sm:grid-cols-[44px_150px_1fr] sm:items-start">
                  <div className="tnum text-[11px] font-bold text-signal">0{index + 1}</div>
                  <div className="text-sm font-bold text-deep">{title}</div>
                  <div className="text-sm leading-7 text-slate">{text}</div>
                </div>
              ))}
            </div>

            <Link href="/readiness" className="focus-action mt-8">
              افتح مستشار صلة
              <SilaArrowIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-outlinev bg-deep text-white">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-5 py-20 md:px-8 md:py-24 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <div className="text-[11px] font-bold text-sky">السوق داخل القرار، مش قبله</div>
            <h2 className="mt-5 text-4xl font-bold leading-[1.08] tracking-[-0.035em] md:text-6xl">
              العرض يظهر عندما يساعدك تختار.
            </h2>
          </div>

          <div className="max-w-[720px]">
            <p className="text-[17px] leading-8 text-white/68">
              لو عندنا عرض حقيقي منشور ومناسب، يظهر مع مصدره ونطاقه وصلاحية معلوماته.
              لو مفيش، نقول مفيش—من غير Mock inventory أو وعود غير موجودة.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="border-t border-white/20 pt-4">
                <div className="text-[11px] text-white/45">Source</div>
                <div className="mt-2 text-sm font-bold">صاحب المعلومة ظاهر</div>
              </div>
              <div className="border-t border-white/20 pt-4">
                <div className="text-[11px] text-white/45">Scope</div>
                <div className="mt-2 text-sm font-bold">ما تم وما لم يتم مراجعته</div>
              </div>
              <div className="border-t border-white/20 pt-4">
                <div className="text-[11px] text-white/45">Freshness</div>
                <div className="mt-2 text-sm font-bold">التاريخ والصلاحية جزء من القرار</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="mx-auto max-w-[1320px] px-5 py-20 md:px-8 md:py-24">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="sila-eyebrow text-[11px] font-bold">عروض موجودة فعلًا</div>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.025em] text-deep md:text-5xl">
                اقرأ العرض قبل ما تنجذب للسعر.
              </h2>
            </div>
            <Link href="/offers" className="quiet-action">
              كل العروض
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {featured.slice(0, 3).map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-[1320px] px-5 py-20 md:px-8 md:py-24">
          <div className="grid gap-8 border-y border-outlinev py-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-gold">
                <Clock3 className="h-4 w-4" />
                سوق صادق حتى وهو فارغ
              </div>
              <h2 className="mt-3 text-2xl font-bold text-deep md:text-4xl">
                لا توجد عروض منشورة نقدر نعرضها الآن.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate">
                ده أفضل من عرض بيانات تجريبية. ابدأ رحلتك، وسنحافظ على السياق حتى يظهر عرض حقيقي يناسبها.
              </p>
            </div>
            <Link href="/readiness" className="focus-action">
              ابدأ بدون عرض
            </Link>
          </div>
        </section>
      )}

      <section className="bg-cloud">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-20 md:px-8 md:py-24 lg:grid-cols-[.65fr_1.35fr]">
          <div>
            <div className="sila-eyebrow text-[11px] font-bold">حدود الثقة</div>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.025em] text-deep md:text-5xl">
              صلة لا تبيعك يقينًا غير موجود.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="border-t-2 border-verified pt-4">
              <ShieldCheck className="h-5 w-5 text-verified" />
              <div className="mt-4 font-bold text-deep">Confirmed</div>
              <p className="mt-2 text-[12px] leading-6 text-slate">دليل مناسب للنطاق وصلاحيته واضحة.</p>
            </div>
            <div className="border-t-2 border-gold pt-4">
              <CircleHelp className="h-5 w-5 text-gold" />
              <div className="mt-4 font-bold text-deep">Conflicting</div>
              <p className="mt-2 text-[12px] leading-6 text-slate">مصادر أو معلومات تحتاج مراجعة قبل القرار.</p>
            </div>
            <div className="border-t-2 border-slate pt-4">
              <CircleHelp className="h-5 w-5 text-slate" />
              <div className="mt-4 font-bold text-deep">Unknown</div>
              <p className="mt-2 text-[12px] leading-6 text-slate">المعلومة غير مثبتة، لذلك لا تتحول إلى Claim.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
