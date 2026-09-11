import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileText, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "الثقة والقانون",
  description: "شروط الخدمة وسياسة الخصوصية وسياسة توثيق الوكلاء في منصة الرحلة، وخطوات الانضمام كوكيل ومراجعة أدلته.",
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
          <span className="text-slate">ومرتبطة بدليل.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-slate">
          ما نعرضه عن الوكيل أو العرض يجب أن يفرّق بين ما قدّمه صاحبه، وما راجعه
          فريق الثقة، وما هو مجرد معلومة تشغيلية قابلة للتغيّر.
        </p>
      </header>

      <div className="space-y-8">
        <Reveal>
          <DocSection id="terms" icon={FileText} title="شروط الخدمة">
            <p>
              THE JOURNEY منصة اكتشاف وثقة وتواصل تجاري. تعرض عروض الوكلاء
              المؤهلة للنشر وتتيح للمسافر بدء طلب تواصل، بينما التعاقد والحجز
              النهائي وتسوية المدفوعات مع مقدم الخدمة ليست عملية تنفذها المنصة
              تلقائيًا نيابةً عن الطرفين.
            </p>
            <p>
              لا يجوز عرض سعر أو توافر أو حالة توثيق باعتبارها حقيقة حالية إذا
              انتهت صلاحية المصدر أو لم يعد الدليل يدعمها. وقد تُحجب العروض أو
              ملفات الوكلاء عن الاكتشاف العام عندما لا تكون حالتها مؤهلة للنشر.
            </p>
            <p>
              موافقة العميل على Quote داخل المنصة هي إشارة قرار تجاري، وليست
              بذاتها إثباتًا للدفع أو تأكيد المورد أو اكتمال الحجز. النتيجة
              النهائية تسجلها الوكالة بعد تحققها من التنفيذ الفعلي.
            </p>
          </DocSection>
        </Reveal>

        <Reveal delay={0.05}>
          <DocSection id="privacy" icon={Lock} title="سياسة الخصوصية">
            <p>
              نجمع البيانات اللازمة للحساب وطلب التواصل والعمل التجاري المرتبط
              به فقط، مثل الاسم والبريد ومحتوى الطلب وبيانات الرحلة التي يرسلها
              المستخدم. لا تُعرض بيانات التواصل الخاصة ضمن صفحات السوق العامة.
            </p>
            <p>
              طلب Marketplace يصل إلى الوكيل المرتبط بالعرض، ومساحات عمل
              الوكالات معزولة حسب العضوية الموثقة في الجلسة. لا يُسمح لعضو في
              Workspace بقراءة Workspace أخرى عبر تغيير المعرّفات في الطلب.
            </p>
            <p>
              مستندات توثيق الوكلاء تُرفع إلى تخزين خاص ولا تُنشر كرابط عام.
              الوصول التشغيلي إليها يتم عبر روابط موقعة قصيرة العمر، بينما تعرض
              صفحات السوق حالة التوثيق العامة فقط ولا تعرض رقم الترخيص أو ملفات
              KYC الخام.
            </p>
          </DocSection>
        </Reveal>

        <Reveal delay={0.05}>
          <DocSection id="verification" icon={ShieldCheck} title="سياسة توثيق الوكلاء">
            <p>
              التوثيق يعتمد على ملف الوكيل والأدلة التي يرفعها ثم قرار مراجعة
              بشري. قبل أي اعتماد نهائي يعيد الخادم التحقق من وجود المستندات
              المطلوبة وصلاحية الأدلة المخزنة؛ لا تعتمد الشارة على نتيجة AI
              وحدها.
            </p>
            <p>
              تغيير بيانات حساسة للتوثيق — مثل الهوية التجارية أو بيانات
              الترخيص — يعيد الملف إلى المراجعة ويزيل الاعتماد السابق إلى أن
              يكتمل القرار الجديد. كما يمكن لفريق الثقة إعادة الفحص أو تعليق
              الظهور العام عند وجود سبب موثق.
            </p>
            <p>
              شارة التوثيق تصف حالة مراجعة الأدلة الحالية، ولا تضمن نتيجة رحلة
              بعينها ولا تجعل السعر أو التوافر صالحين إلى أجل غير محدد. بيانات
              السفر والأسعار المتغيرة ترتبط بمصدر ووقت ملاحظة وصلاحية كلما كان
              ذلك مطلوبًا لاتخاذ القرار التجاري.
            </p>
          </DocSection>
        </Reveal>

        <Reveal delay={0.05}>
          <DocSection id="agent" icon={UserCheck} title="انضم كوكيل">
            <p>
              يبدأ المسار بإنشاء حساب وكيل. إنشاء الحساب لا يمنح شارة التوثيق
              ولا يفتح الظهور العام تلقائيًا؛ بعدها يستكمل الوكيل ملفه ويرفع
              الأدلة المطلوبة من داخل حسابه لتدخل المراجعة.
            </p>
            <ol className="space-y-3">
              {[
                "أنشئ حساب وكيل من بوابة الانضمام.",
                "أكمل بيانات الملف والهوية أو الترخيص الملائم لنوع الحساب.",
                "ارفع المستندات المطلوبة وأكد اكتمال الرفع من داخل حسابك.",
                "ينتقل الملف إلى المراجعة البشرية، ثم تظهر الحالة الناتجة داخل الحساب والسوق وفق قرار الثقة.",
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="tnum mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wash text-[12px] font-bold text-deep">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p>
              <Link
                href="/join?mode=agent"
                className="inline-flex items-center gap-2 rounded-lg bg-deep px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-horizon"
              >
                <BadgeCheck className="h-4 w-4" />
                إنشاء حساب وكيل
              </Link>
            </p>
          </DocSection>
        </Reveal>
      </div>
    </div>
  );
}
