import type { ComponentType, SVGProps } from "react";
import type { Metadata } from "next";
import { FileText, Lock } from "lucide-react";
import { SilaAgentIcon, SilaIdentityIcon, SilaReviewIcon } from "@/components/brand/SilaIcons";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { Reveal } from "@/components/Reveal";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "الثقة والقانون",
  description: "شروط الخدمة وسياسة الخصوصية وسياسة مراجعة أدلة الوكلاء في منصة صلة، وما يعنيه كل نطاق ثقة معروض.",
};

function DocSection({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="sila-window relative scroll-mt-24 overflow-hidden border border-outlinev bg-cloud p-7 shadow-[0_10px_34px_rgba(8,38,74,0.04)] md:p-10">
      <span aria-hidden className="absolute inset-y-0 start-0 w-1 bg-air" />
      <h2 className="flex items-center gap-3 text-2xl font-bold text-inkwell md:text-3xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-air text-deep">
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
      <SilaPageIntro
        eyebrow="نوضح ما نراجعه وما لا نضمنه"
        title="الثقة عندنا مكتوبة، لا مُعلنة فقط."
        description="كل حالة ثقة في صلة مرتبطة بمصدر وتاريخ ونطاق واضح. نُظهر ما راجعناه، وما يحتاج لتأكيد، وما لا نستطيع ضمانه."
        meta={
          <div className="grid max-w-2xl grid-cols-2 gap-2 text-[12px] font-semibold sm:grid-cols-4">
            <span className="rounded-xl bg-verifiedbg px-3 py-2 text-verified">هوية</span>
            <span className="rounded-xl bg-verifiedbg px-3 py-2 text-verified">نشاط مهني</span>
            <span className="rounded-xl bg-air px-3 py-2 text-deep">تفاصيل العرض</span>
            <span className="rounded-xl bg-low px-3 py-2 text-slate">حدود الضمان</span>
          </div>
        }
      />

      <div className="space-y-8">
        <Reveal>
          <DocSection id="terms" icon={FileText} title="شروط الخدمة">
            <p>
              منصة صلة هي سوق وصل وتوثيق: نعرض عروض الوكلاء بعد مراجعتها،
              ونوفّر قناة التواصل الأولى، ولا نتدخل في السعر ولا نتقاضى عمولة
              من المسافر. التعاقد النهائي للرحلة يتم مباشرة بين المسافر والوكيل.
            </p>
            <p>
              يُحظر على الوكلاء: التسعير المضلل، نشر عروض خارج نطاق الخدمة
              المعلنة، أو استخدام بيانات تخالف ما تم تقديمه للمراجعة. أي إجراء
              على الحساب يعتمد على حالة موثقة وسجل قرار يمكن مراجعته.
            </p>
            <p>
              صلة لا تعرض سلوك تقييم أو عقوبات زمنية كحقيقة عامة ما لم يكن
              هذا السلوك مطبقًا فعليًا ومثبتًا في المنتج والسياسات التشغيلية.
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
              وثائق توثيق الوكلاء تُحفظ في تخزين خاص، ويقتصر الوصول عليها على مسار المراجعة المصرّح به. لا نعرض الوثائق أو أرقامها للعامة؛ نعرض فقط نطاق الدليل الذي راجعناه وتاريخ مراجعته وصلاحيته المسجلة عندما تكون متاحة.
            </p>
          </DocSection>
        </Reveal>

        <Reveal delay={0.05}>
          <DocSection id="verification" icon={SilaIdentityIcon} title="سياسة توثيق الوكلاء">
            <p>
              لا نستخدم كلمة «موثّق» كضمان مطلق. <b className="text-inkwell">«هوية مُراجَعة»</b> تعني
              أن فريق الثقة راجع إثبات هوية رسميًا ما زال ضمن الصلاحية المسجلة.{" "}
              <b className="text-inkwell">«نشاط مهني مُراجع»</b> تعني مراجعة مستند مهني أو ترخيص
              يثبت نطاق النشاط المقدم، و<b className="text-inkwell">«كيان مُراجع»</b> يظهر للوكالة عندما
              تكون أدلة الكيان المطلوبة قد راجعت أيضًا.
            </p>
            <p>
              خطوات التوثيق: اكتمال الملف (١) ثم رفع الوثائق (٢) ثم مراجعة
              فريق الثقة (٣) ثم الاعتماد والظهور العام وأهلية نشر العروض بعد قرار مراجعة بشري موثّق (٤). إنشاء الحساب والدخول إليه متاحان قبل التوثيق.
              الوثيقة المرفوضة يمكن إعادة تقديمها بعد ٣٠ يوماً.
            </p>
            <p>
              المراجعة تثبت فقط النطاق المكتوب بجوار كل دليل وفي الفترة التي يظل فيها الدليل صالحًا؛ وهي ليست ضماناً لنتيجة كل رحلة، ولا إثباتًا بأن السعر أو التوفر ما زالا قائمين لحظة الدفع. وحالة التواصل أو العرض ليست بذاتها إثباتًا للدفع أو لإتمام الحجز؛
              لهذا توجد التقييمات الموثّقة بعد التفاعل، ومعدلات الاستجابة
              المعلنة، وحق الإبلاغ الذي يدخل مسار المراجعة عند وصوله.
            </p>
            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["هوية المسؤول", "نراجع الدليل ونُظهر تاريخ المراجعة", "verified"],
                ["النشاط المهني", "نراجع نطاق المستند المطلوب وصلاحيته", "verified"],
                ["كيان الوكالة", "يُراجع عند كونه مطلوبًا لنوع الحساب", "verified"],
                ["السعر والنتيجة النهائية", "لا نضمنهما بمجرد توثيق الوكيل", "limit"],
              ].map(([label, value, tone]) => (
                <div
                  key={label}
                  className={`rounded-xl border p-4 ${
                    tone === "verified"
                      ? "border-verified/20 bg-verifiedbg/40"
                      : "border-signal/20 bg-sky/20"
                  }`}
                >
                  <div className="text-[11px] font-semibold text-slate">{label}</div>
                  <div
                    className={`mt-1 font-bold ${
                      tone === "verified" ? "text-verified" : "text-signal"
                    }`}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </DocSection>
        </Reveal>

        <Reveal delay={0.05}>
          <DocSection id="agent" icon={SilaAgentIcon} title="حساب وكيل الآن، والتوثيق عندما تكون جاهزًا">
            <p>
              التسجيل يفتح حسابك فورًا ولا يتطلب مستندات. للظهور كوكيل معتمد،
              أكمل لاحقًا ملف التوثيق والهوية الحكومية، ووثائق الترخيص المطلوبة
              بحسب نوع نشاطك. يراجع فريق الثقة الأدلة قبل منح الاعتماد.
            </p>
            <ol className="space-y-3">
              {[
                "أنشئ حساب الوكيل وادخل لوحة حسابك فورًا.",
                "عندما تكون جاهزًا، قدّم أدلة التوثيق. تظهر نتيجة المراجعة بالاعتماد أو بالتعديلات المطلوبة.",
                "انشر عروضك؛ تعرض بعد اعتماد كل عرض في طابور المراجعة.",
                "تابع طلبات المسافرين وابنِ سمعتك بالرد والالتزام.",
              ].map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="tnum mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wash text-[12px] font-bold text-deep">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="flex flex-wrap gap-3">
              <a href="/join?mode=agent" className="inline-flex items-center gap-2 rounded-lg bg-signal px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-horizon">إنشاء حساب وكيل</a>
              {BRAND.agentsEmail ? (
                <a
                  href={`mailto:${BRAND.agentsEmail}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-deep px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-horizon"
                >
                  <SilaReviewIcon className="h-4 w-4" />
                  {BRAND.agentsEmail}
                </a>
              ) : null}
            </p>
          </DocSection>
        </Reveal>
      </div>
    </div>
  );
}
