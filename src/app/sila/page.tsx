import type { Metadata } from "next";
import Link from "next/link";
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

export default function SilaIdentityPage() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <SilaPageIntro
        eyebrow="هوية صلة · الاسم مش من فراغ"
        title="صلة هي الوصلة بين المسافر، المعلومة الموثوقة، والوكيل المناسب."
        description="نظام بسيط من الخارج وذكي من الداخل: يفهم الكلام الطبيعي، يسأل الناقص فقط، يوضح ما نعرفه وما يحتاج تأكيدًا، ثم يرشدك للخطوة التالية بدون تعقيد أو ادعاءات وهمية."
      />

      <section className="mt-8 overflow-hidden rounded-[2rem] border border-outlinev bg-deep text-oninverse shadow-[0_18px_48px_rgba(8,38,74,0.16)]">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_.95fr]">
          <div className="p-6 md:p-9">
            <div className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-sky">
              مستشار صلة الدائم
            </div>
            <h2 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-[-0.035em] md:text-5xl">
              المستخدم لا يدخل ليملأ خانات. يدخل ليسأل… وصلة تقوده.
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-8 text-oninverse/70">
              صلة ليست مجرد شات بوت ولا سوق عروض فقط. هي طبقة قرار: تفهم الهدف، ترتب الصورة، تسأل بذكاء، وتربط القرار بالمصدر أو بالوكيل عندما يكون ذلك متاحًا.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/readiness"
                className="inline-flex items-center gap-2 rounded-2xl bg-signal px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-horizon"
              >
                جرّب مستشار صلة
                <SilaArrowIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/offers"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/10"
              >
                شاهد العروض المتاحة
              </Link>
            </div>
          </div>
          <div className="border-t border-white/10 bg-white/[0.04] p-6 md:p-9 lg:border-r lg:border-t-0">
            <div className="rounded-3xl border border-white/12 bg-black/18 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky">طريقة صلة</p>
              <div className="mt-5 space-y-4">
                {flow.map((item, index) => (
                  <div key={item} className="grid grid-cols-[42px_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky/15 text-sm font-bold text-sky">
                      {index + 1}
                    </span>
                    <p className="self-center text-sm leading-6 text-oninverse/82">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {promiseCards.map((item) => (
          <article key={item.title} className="sila-window border border-outlinev bg-cloud p-5">
            <h3 className="text-lg font-bold text-inkwell">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        {audienceCards.map((card) => (
          <article key={card.label} className="rounded-[1.75rem] border border-outlinev bg-cloud p-6 shadow-[0_10px_32px_rgba(8,38,74,0.05)]">
            <div className="inline-flex rounded-full bg-air px-3 py-1 text-xs font-bold text-deep">{card.label}</div>
            <h3 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-inkwell">{card.title}</h3>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate">
              {card.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 rounded-2xl border border-outlinev bg-low/45 p-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-signal" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-[2rem] border border-outlinev bg-cloud p-6 md:p-8">
        <div className="max-w-3xl">
          <div className="sila-eyebrow text-[12px] font-semibold text-signal">قانون المنتج</div>
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
