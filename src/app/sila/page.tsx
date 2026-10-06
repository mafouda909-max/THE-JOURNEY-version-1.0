import type { Metadata } from "next";
import Link from "next/link";
import { SilaDecisionField } from "@/components/brand/SilaPrimitives";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { SilaArrowIcon } from "@/components/brand/SilaIcons";

export const metadata: Metadata = {
  title: "ما هي صلة؟",
  description:
    "تعرف على هوية صلة: مستشار سفر عربي يبسّط القرار، يوضح المصدر، ويربط المسافر بالوكيل أو العرض المناسب عندما يكون متاحًا.",
};

const promiseCards = [
  {
    title: "نفهمك قبل ما نسألك",
    text: "ابدأ بكلام طبيعي. صلة تستخرج الهدف، الوجهة، الغرض، الميزانية، والأسئلة المؤثرة بدل ما ترميك في فورم طويل من أول لحظة.",
  },
  {
    title: "نبسّط السفر بدون تهوين",
    text: "نقول لك ما المهم الآن، ما أكبر خطر، وما أول خطوة. التفاصيل والمصادر موجودة، لكنها لا تزاحم القرار الأساسي.",
  },
  {
    title: "نفرّق بين المؤكد والمحتاج تأكيد",
    text: "كل معلومة لها نطاق: قالها المستخدم، استنتاج مبدئي، مصدر مباشر، أو معلومة ناقصة. صلة لا تبيع وهم اليقين.",
  },
  {
    title: "نوصلك عندما توجد صلة حقيقية",
    text: "لو فيه عرض أو وكيل مطابق داخل المنصة يظهر في سياقه. لو مفيش، نقول بوضوح لا يوجد عرض مؤكد بدل اختراع نتيجة.",
  },
];

const audienceCards = [
  {
    label: "للمسافر",
    title: "اسأل قبل ما تحجز",
    bullets: [
      "أبدأ منين؟",
      "أحتاج تأشيرة أو مستندات؟",
      "الترانزيت آمن ولا محتاج انتباه؟",
      "العرض ده مناسب لعيلتي وميزانيتي؟",
    ],
  },
  {
    label: "للوكيل",
    title: "حوّل سؤال العميل إلى ملف واضح",
    bullets: [
      "ما البيانات الناقصة من العميل؟",
      "ما المخاطر التي يجب توضيحها؟",
      "كيف أكتب عرضًا مضبوطًا؟",
      "ما الذي يحتاج مصدرًا أو تأكيدًا قبل الرد؟",
    ],
  },
];

const flow = [
  "اكتب سؤالك أو رحلتك بلغتك",
  "صلة تلخص ما فهمته وتكشف الناقص",
  "تراجع الجاهزية والمخاطر والمصادر",
  "تقترح الخطوة التالية أو العرض الحقيقي المناسب",
];

const cognitiveModes = [
  {
    label: "Calm · هدوء",
    title: "استكشف بدون ضغط",
    text: "المعلومات الأساسية واضحة، والخيارات الثانوية موجودة من غير ما تزاحم قرارك.",
  },
  {
    label: "Focus · تركيز",
    title: "قرار واحد يستحق انتباهك",
    text: "صلة ترفع خطوة واحدة فقط عندما تكون هي الأكثر أمانًا أو منطقية، وتؤجل الباقي بصريًا.",
  },
  {
    label: "Critical · حرج",
    title: "المشكلة قبل أي عرض",
    text: "إذا ظهرت معلومة قديمة أو تعارض مؤثر، تختفي الزوائد ويظهر السبب والنتيجة والخطوة الآمنة التالية.",
  },
];

export default function SilaIdentityPage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <SilaPageIntro
        eyebrow="هوية صلة · الاسم مش من فراغ"
        title="صلة هي الوصلة بين المسافر، المعلومة الموثوقة، والوكيل المناسب."
        description="نظام بسيط من الخارج وذكي من الداخل: يفهم الكلام الطبيعي، يسأل الناقص فقط، يوضح ما نعرفه وما يحتاج تأكيدًا، ثم يرشدك للخطوة التالية بدون تعقيد أو ادعاءات وهمية."
      />

      <section className="mt-8 overflow-hidden rounded-[2rem] bg-deep text-oninverse shadow-[0_24px_70px_rgba(7,24,41,0.18)]">
        <div className="grid gap-0 lg:grid-cols-[.9fr_1.1fr] lg:items-stretch">
          <div className="p-6 md:p-9 lg:p-11">
            <div className="sila-eyebrow text-[11px] font-semibold text-sky">هوية تتحول لسلوك</div>
            <h2 className="mt-5 max-w-3xl text-[clamp(2.4rem,5vw,4.7rem)] font-bold leading-[1.02] tracking-[-0.04em]">
              صلة مش شاشة سفر.
              <span className="block text-air">هي المسافة الأقصر بين السؤال والقرار.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-[15px] leading-8 text-oninverse/68 md:text-[17px]">
              المسافر لا يدخل ليملأ خانات، والوكيل لا يحتاج لوحة تصرخ في وجهه.
              صلة تحفظ السياق، ترفع المهم، وتخلي كل خطوة قابلة للفهم قبل ما تكون قابلة للنقر.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href="/readiness"
                className="sila-motion-safe inline-flex min-h-12 items-center gap-2 rounded-2xl bg-signal px-5 py-3 text-sm font-bold text-white transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-horizon"
              >
                جرّب طريقة صلة
                <SilaArrowIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/offers"
                className="group inline-flex min-h-12 items-center gap-2 text-sm font-bold text-oninverse/75 transition-colors hover:text-white"
              >
                شوف السوق
                <SilaArrowIcon className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              </Link>
            </div>
          </div>

          <div className="border-t border-white/10 p-4 md:p-6 lg:border-r lg:border-t-0">
            <SilaDecisionField className="h-full min-h-[430px]" />
          </div>
        </div>
      </section>

      <section className="mt-10 border-y border-outlinev">
        <div className="grid md:grid-cols-4 md:divide-x md:divide-x-reverse md:divide-outlinev">
          {flow.map((item, index) => (
            <div key={item} className="grid grid-cols-[36px_1fr] gap-3 py-5 md:px-5">
              <span className="tnum text-[11px] font-bold text-signal">0{index + 1}</span>
              <p className="text-[13px] leading-6 text-slate">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <div className="mb-6 max-w-3xl">
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">أربع قواعد ما تتغيرش</div>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-inkwell md:text-5xl">
            الذكاء عندنا لازم يقلّل الاحتكاك، مش يضيف استعراض.
          </h2>
        </div>

        <div className="grid border-y border-outlinev md:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-x-reverse lg:divide-outlinev">
          {promiseCards.map((item, index) => (
            <article key={item.title} className="py-6 md:px-5 lg:min-h-[220px]">
              <div className="tnum text-[11px] font-bold text-signal">0{index + 1}</div>
              <h3 className="mt-5 text-xl font-bold text-inkwell">{item.title}</h3>
              <p className="mt-3 text-[13px] leading-7 text-slate">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        {audienceCards.map((card) => (
          <article
            key={card.label}
            className="rounded-[1.75rem] border border-outlinev bg-cloud p-6 shadow-[0_10px_32px_rgba(8,38,74,0.05)]"
          >
            <div className="inline-flex rounded-full bg-air px-3 py-1 text-xs font-bold text-deep">
              {card.label}
            </div>
            <h3 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-inkwell">
              {card.title}
            </h3>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate">
              {card.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-3 rounded-2xl border border-outlinev bg-low/45 p-3"
                >
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-signal" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <div className="mb-5 max-w-3xl">
          <div className="sila-eyebrow text-[12px] font-semibold text-signal">سلوك الواجهة</div>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-inkwell md:text-4xl">
            نفس الهوية، لكن شدة مختلفة حسب الموقف.
          </h2>
          <p className="sila-copy-comfort mt-3 text-sm text-slate">
            صلة لا تغيّر مكان الأزرار عشوائيًا ولا تحاول تخمين حالتك النفسية سرًا. الواجهة تتكيّف فقط مع حالة القرار الفعلية.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {cognitiveModes.map((mode, index) => (
            <article
              key={mode.label}
              className="sila-decision-window p-5"
              data-attention={index === 2 ? "critical" : index === 1 ? "focus" : "calm"}
            >
              <div className="text-[11px] font-bold text-signal">{mode.label}</div>
              <h3 className="mt-2 text-xl font-bold text-deep">{mode.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate">{mode.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-[2rem] border border-outlinev bg-cloud p-6 md:p-8">
        <div className="max-w-3xl">
          <div className="sila-eyebrow text-[12px] font-semibold text-signal">
            قانون المنتج
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-inkwell md:text-4xl">
            صلة لا تعقّد، لا تخترع، ولا تدفن القرار تحت التفاصيل.
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate md:text-base">
            كل تجربة داخل صلة يجب أن تبدأ من سؤال بسيط: هل المستخدم فهم ماذا يفعل الآن؟ بعد ذلك تأتي الأدلة، المصادر، العروض، والوكلاء. الذكاء الحقيقي هنا أن يشعر المسافر أو الوكيل أن الطريق أصبح أوضح، لا أن النظام أصبح أكبر فقط.
          </p>
        </div>
      </section>
    </main>
  );
}
