import type { Metadata } from "next";
import { BadgeCheck, FileText, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "الثقة والقانون",
  description: "شروط الخدمة وسياسة الخصوصية وسياسة توثيق الوكلاء في منصة الرحلة، وخطوات الانضمام كوكيل موثّق.",
};

function DocSection({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-outlinev bg-cloud p-7 md:p-10">
      <h2 className="flex items-center gap-3 text-2xl font-bold text-inkwell md:text-3xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-wash text-deep">
          <Icon className="h-5 w-5" />
        </span>
        {title}
      </h2>
      <div className="mt-6 space-y-4 leading-[1.9] text-inkwell/80">{children}</div>
    </section>
  );
}

export default function TrustPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <header className="mb-14 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          الثقة عندنا مكتوبة،
          <br />
          <span className="text-slate">لا مُعلنة فقط.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-slate">
          الوثائق التي تحكم العلاقة بين المسافر والوكيل والمنصة — بلغة عربية
          واضحة، بلا حشو قانوني متعمد.
        </p>
      </header>

      <div className="space-y-8">
        <Reveal>
          <DocSection id="terms" icon={FileText} title="شروط الخدمة">
            <p>
              منصة الرحلة هي سوق وصل وتوثيق: نعرض عروض الوكلاء بعد مراجعتها،
              ونوفّر قناة التواصل الأولى، ولا نتدخل في السعر ولا نتقاضى عمولة
              من المسافر. التعاقد النهائي للرحلة يتم مباشرة بين المسافر والوكيل.
            </p>
            <p>
              يُحظر على الوكلاء: تسعير مضلل أو «يبدأ من» بلا جدول فروقات،
              نشر عروض خارج تخصصهم المعلن، وضع بيانات تواصل مباشر داخل وصف
              العرض، أو تكرار العرض نفسه بالمسار والسعر ذاتهما. تعليق الحساب
              يقع بعد ثلاث مخالفات خلال ٩٠ يوماً.
            </p>
            <p>
              يحق للمسافر تقييم أي وكيل تواصل معه خلال نافذة ٢٤ ساعة إلى ٩٠
              يوماً من الطلب، والتقييم نهائي غير قابل للتعديل بعد النشر.
            </p>
          </DocSection>
        </Reveal>

        <Reveal delay={0.05}>
          <DocSection id="privacy" icon={Lock} title="سياسة الخصوصية">
            <p>
              نجمع الحد الأدنى: اسمك وبريدك عند إرسال طلب تواصل، ومحتوى رسائلك
              للوكيل. لا نبيع البيانات ولا نشاركها مع طرف ثالث للإعلانات.
            </p>
            <p>
              بريدك لا يظهر إلا للوكيل صاحب العرض الذي راسلته تحديداً. لا يملك
              أي وكيل رؤية طلبات وكيل آخر، ولا يستطيع الوكلاء مراسلة المسافرين
              ابتداءً — المسافر هو من يبدأ دائماً.
            </p>
            <p>
              وثائق توثيق الوكلاء تُخزن مشفرة ولا يطّلع عليها إلا فريق المراجعة،
              وتُعرض منها للعامة حالة التوثيق فقط — لا الوثائق نفسها.
            </p>
          </DocSection>
        </Reveal>

        <Reveal delay={0.05}>
          <DocSection id="verification" icon={ShieldCheck} title="سياسة توثيق الوكلاء">
            <p>
              <b className="text-inkwell">شارة «موثّق»</b> تعني أننا تحققنا من
              هوية حكومية سارية للشخص المسؤول عن الحساب.{" "}
              <b className="text-inkwell">شارة «وكالة مرخّصة»</b> تعني إضافةً
              تحققاً من رخصة سياحة أو سجل تجاري ساري المفعول باسم الكيان.
            </p>
            <p>
              خطوات التوثيق: اكتمال الملف (١) ثم رفع الوثائق (٢) ثم مراجعة
              فريق الثقة خلال ٤٨ ساعة (٣) ثم التفعيل مع أهلية نشر العروض (٤).
              الوثيقة المرفوضة يمكن إعادة تقديمها بعد ٣٠ يوماً.
            </p>
            <p>
              التوثيق يؤكد الهوية والترخيص — وهو ليس ضماناً لنتيجة كل رحلة؛
              لهذا توجد التقييمات الموثّقة بعد التفاعل، ومعدلات الاستجابة
              المعلنة، وحق الإبلاغ الذي نراجعه خلال يوم عمل.
            </p>
          </DocSection>
        </Reveal>

        <Reveal delay={0.05}>
          <DocSection id="agent" icon={UserCheck} title="انضم كوكيل موثّق">
            <p>
              قبولنا انتقائي عن قصد. جهّز: هوية حكومية سارية، رخصة سياحة أو
              سجلاً تجارياً إن كنت وكالة، وثلاثة عروض حقيقية تستطيع تسليمها
              بالسعر المعلن نفسه.
            </p>
            <ol className="space-y-3">
              {[
                "أرسل الملف إلى agents@alrihla.travel — نرد خلال يوم عمل.",
                "مراجعة وثائقك خلال ٤٨ ساعة مع رد مسبّب بالقبول أو الرفض.",
                "انشر عروضك؛ تعرض بعد اعتماد كل عرض في طابور المراجعة.",
                "احمل شارة التوثيق، وابنِ السمعة بمعدل استجابة يتفوق على ٩٠٪.",
              ].map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="tnum mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wash text-[12px] font-bold text-deep">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <p>
              <a
                href="mailto:agents@alrihla.travel"
                className="inline-flex items-center gap-2 rounded-lg bg-deep px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-horizon"
              >
                <BadgeCheck className="h-4 w-4" />
                agents@alrihla.travel
              </a>
            </p>
          </DocSection>
        </Reveal>
      </div>
    </div>
  );
}
