"use client";

import { useMemo, useState } from "react";
import {
  extractSilaAdvisorIntent,
  firstSilaAdvisorStep,
  selectSilaAdvisorMissingQuestions,
  summarizeSilaAdvisorUnderstanding,
  type SilaAdvisorField,
} from "@/lib/sila-advisor-intake";

const EXAMPLE_MESSAGE =
  "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر أنا ومراتي وطفلة، الميزانية محدودة ومش عارف أبدأ منين.";

const PROVENANCE_LABEL = {
  USER_STATED: "قالها المستخدم",
  INFERRED: "استنتاج مبدئي",
  UNKNOWN: "غير معروف",
} as const;

const PURPOSE_LABEL = {
  tourism: "سياحة",
  study: "دراسة",
  work: "عمل",
  business: "رحلة عمل",
  freelance: "عمل حر أو عن بُعد",
  umrah: "عمرة",
  visit: "زيارة",
  medical: "علاج",
  transit: "ترانزيت",
  other: "غرض آخر",
} as const;

function confidenceLabel(confidence: number) {
  if (confidence >= 0.8) return "ثقة عالية";
  if (confidence >= 0.55) return "ثقة متوسطة";
  return "محتاج تأكيد";
}

function displayFieldValue(label: string, field: SilaAdvisorField) {
  if (label === "الغرض" && field.value) {
    return PURPOSE_LABEL[field.value as keyof typeof PURPOSE_LABEL] ?? field.value;
  }
  return field.value;
}

function FieldPill({ label, field }: { label: string; field: SilaAdvisorField }) {
  const value = displayFieldValue(label, field);
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs text-white/80">
      <strong className="font-semibold text-white">{label}</strong>
      <span>{value}</span>
      <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] text-white/55">
        {PROVENANCE_LABEL[field.provenance]} · {confidenceLabel(field.confidence)}
      </span>
    </span>
  );
}

export function SilaAdvisorEntry() {
  const [message, setMessage] = useState(EXAMPLE_MESSAGE);
  const intent = useMemo(() => extractSilaAdvisorIntent(message), [message]);
  const summary = useMemo(() => summarizeSilaAdvisorUnderstanding(intent), [intent]);
  const questions = useMemo(() => selectSilaAdvisorMissingQuestions(intent, 4), [intent]);
  const firstStep = useMemo(() => firstSilaAdvisorStep(intent), [intent]);
  const fields = intent.fields;

  return (
    <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[#07110f] p-5 text-white shadow-2xl shadow-black/20 md:p-7" dir="rtl" aria-labelledby="sila-advisor-entry-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(231,181,95,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(50,185,145,0.18),transparent_32%)]" />
      <div className="relative grid items-start gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5 lg:sticky lg:top-28">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-[#f2d9a0]">
            مستشار صلة · اكتب طبيعي وسيب علينا ترتيب الصورة
          </div>
          <div className="space-y-3">
            <h2 id="sila-advisor-entry-title" className="text-2xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
              ابدأ بسؤال سفر عادي… وصلة تفهمك وتقولك الخطوة الصح.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-white/68 md:text-base">
              مش لازم تبدأ بفورم طويل. احكي الرحلة بلغتك: وجهة، غرض، ميزانية، عيلة، أو حتى سؤال ناقص. صلة تلخص ما فهمته، تسأل الناقص فقط، وبعدها نكمل فحص الجاهزية والعروض الحقيقية.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/22 p-4">
            <label htmlFor="sila-advisor-message" className="mb-2 block text-sm font-medium text-white/85">
              اكتب رسالة للمستشار
            </label>
            <textarea
              id="sila-advisor-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={7}
              className="min-h-40 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/35 focus:border-[#f2d9a0]/70 focus:bg-white/[0.08]"
              placeholder="مثال: أنا مصري وعايز أسافر تركيا سياحة في ديسمبر..."
            />
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1 transition hover:border-[#f2d9a0]/60 hover:text-[#f2d9a0]"
                onClick={() => setMessage(EXAMPLE_MESSAGE)}
              >
                جرّب مثال مسافر
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1 transition hover:border-[#f2d9a0]/60 hover:text-[#f2d9a0]"
                onClick={() => setMessage("عميل مصري عايز تركيا سياحة هو ومراته وطفلة، أطلب منه إيه عشان أعمله عرض مضبوط؟")}
              >
                جرّب مثال وكيل
              </button>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-sm leading-7 text-white/62">
            <strong className="block text-white">صلة مش فورم.</strong>
            اكتب اللي تعرفه، والمستشار يرتّب الصورة ويسأل فقط عن المعلومة التي تغيّر القرار.
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[#f2d9a0]/25 bg-[#f2d9a0]/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f2d9a0]">فهمت منك</p>
            <p className="mt-3 text-lg leading-8 text-white">{summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <FieldPill label="الجنسية" field={fields.nationality} />
              <FieldPill label="الوجهة" field={fields.destination} />
              <FieldPill label="الغرض" field={fields.purpose} />
              <FieldPill label="التوقيت" field={fields.dateWindow} />
              <FieldPill label="المسافرون" field={fields.travelers} />
              <FieldPill label="الميزانية" field={fields.budget} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">ناقصني بس</p>
              <span className="rounded-full bg-white/[0.07] px-3 py-1 text-xs text-white/55">
                {questions.length} أسئلة مهمة
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {questions.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/18 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-[#f2d9a0]">
                    <span className="grid size-6 place-items-center rounded-full bg-[#f2d9a0]/15 text-[11px]">{index + 1}</span>
                    <span>{item.priority === "HIGH" ? "مهم جدًا" : "مفيد للدقة"}</span>
                  </div>
                  <p className="font-medium text-white">{item.question}</p>
                  <p className="mt-1 text-sm leading-6 text-white/55">{item.why}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200">الخطوة الجاية</p>
            <p className="mt-3 text-base leading-7 text-white">{firstStep}</p>
            <p className="mt-3 text-xs leading-6 text-white/48">
              ده تمهيد ذكي فقط. فحص الجاهزية الكامل والمصادر والعروض الحقيقية موجودين في الأداة التفصيلية أسفل الصفحة.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
