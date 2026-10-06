"use client";

import { useMemo, useState } from "react";
import {
  extractSilaAdvisorIntent,
  firstSilaAdvisorStep,
  selectSilaAdvisorMissingQuestions,
  summarizeSilaAdvisorUnderstanding,
  type SilaAdvisorField,
} from "@/lib/sila-advisor-intake";

const TRAVELER_EXAMPLE =
  "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر أنا ومراتي وطفلة، الميزانية محدودة ومش عارف أبدأ منين.";
const AGENT_EXAMPLE =
  "عميل مصري عايز تركيا سياحة هو ومراته وطفلة، أطلب منه إيه عشان أعمله عرض مضبوط؟";

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
  hajj: "حج",
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

function FieldRow({ label, field }: { label: string; field: SilaAdvisorField }) {
  const value = displayFieldValue(label, field);
  const filled = Boolean(value);
  return (
    <div className={`rounded-2xl border px-4 py-3 ${filled ? "border-white/10 bg-white/[0.055]" : "border-white/7 bg-black/16"}`}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-white/68">{label}</span>
        <span className={filled ? "text-[#f2d9a0]" : "text-white/35"}>
          {filled ? confidenceLabel(field.confidence) : "ناقص"}
        </span>
      </div>
      <p className={`mt-1 text-sm leading-6 ${filled ? "text-white" : "text-white/38"}`}>
        {value ?? "لسه محتاج أسألك عنها"}
      </p>
    </div>
  );
}

export function SilaAdvisorEntry() {
  const [message, setMessage] = useState(TRAVELER_EXAMPLE);
  const intent = useMemo(() => extractSilaAdvisorIntent(message), [message]);
  const summary = useMemo(() => summarizeSilaAdvisorUnderstanding(intent), [intent]);
  const questions = useMemo(() => selectSilaAdvisorMissingQuestions(intent, 4), [intent]);
  const firstStep = useMemo(() => firstSilaAdvisorStep(intent), [intent]);
  const fields = intent.fields;
  const capturedFields = [
    fields.nationality,
    fields.destination,
    fields.purpose,
    fields.dateWindow,
    fields.travelers,
    fields.budget,
    fields.origin,
    fields.passportStatus,
  ].filter((field) => Boolean(field.value)).length;
  const roleLabel = intent.role === "AGENT" ? "مساحة وكيل" : "مساحة مسافر";

  return (
    <section
      className="relative mt-8 overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#06110f] p-4 text-white shadow-2xl shadow-black/20 md:p-6"
      dir="rtl"
      aria-labelledby="sila-advisor-entry-title"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(231,181,95,0.23),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(50,185,145,0.2),transparent_35%)]" />
      <div className="relative grid min-h-[650px] gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-black/24 p-4 md:p-5 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex rounded-full border border-[#f2d9a0]/25 bg-[#f2d9a0]/10 px-3 py-1 text-xs font-semibold text-[#f2d9a0]">
                مستشار صلة داخل المنصة
              </div>
              <h2 id="sila-advisor-entry-title" className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
                اسأل كأنك بتكلم مستشار سفر حقيقي.
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/60">
              {roleLabel}
            </span>
          </div>

          <p className="text-sm leading-7 text-white/64 md:text-base">
            صلة مش فورم. اكتب اللي في دماغك، والمستشار يفهم الرحلة، يبني ملف مبدئي، يسأل الناقص فقط، وبعدها يفتح الفحص التفصيلي والمصادر والعروض عند الحاجة.
          </p>

          <div className="flex-1 space-y-3 overflow-hidden rounded-3xl border border-white/10 bg-[#081713] p-4">
            <div className="max-w-[86%] rounded-2xl rounded-tr-sm border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-7 text-white/78">
              أنا مستشار صلة. احكي لي الرحلة أو حالة العميل، وأنا أرتبها لك خطوة بخطوة.
            </div>
            <div className="ms-auto max-w-[92%] rounded-2xl rounded-tl-sm bg-[#f2d9a0] px-4 py-3 text-sm leading-7 text-[#082016] shadow-lg shadow-black/20">
              {message || "اكتب هنا سؤال السفر أو حالة العميل..."}
            </div>
            <div className="max-w-[92%] rounded-2xl rounded-tr-sm border border-emerald-300/18 bg-emerald-300/10 px-4 py-3 text-sm leading-7 text-white/82">
              {summary}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
            <label htmlFor="sila-advisor-message" className="mb-2 block text-sm font-medium text-white/85">
              رسالة للمستشار
            </label>
            <textarea
              id="sila-advisor-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              className="min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/24 px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/35 focus:border-[#f2d9a0]/70 focus:bg-white/[0.08]"
              placeholder="مثال: أنا مصري وعايز أسافر تركيا سياحة في ديسمبر..."
            />
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1 transition hover:border-[#f2d9a0]/60 hover:text-[#f2d9a0]"
                onClick={() => setMessage(TRAVELER_EXAMPLE)}
              >
                مثال مسافر
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1 transition hover:border-[#f2d9a0]/60 hover:text-[#f2d9a0]"
                onClick={() => setMessage(AGENT_EXAMPLE)}
              >
                مثال وكيل
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-[#f2d9a0]/24 bg-[#f2d9a0]/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f2d9a0]">ملف الرحلة الآن</p>
                <p className="mt-3 max-w-3xl text-lg leading-8 text-white">{summary}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-center">
                <div className="text-2xl font-semibold text-white">{capturedFields}</div>
                <div className="text-xs text-white/50">نقاط فهمها المستشار</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <FieldPill label="الجنسية" field={fields.nationality} />
              <FieldPill label="الوجهة" field={fields.destination} />
              <FieldPill label="الغرض" field={fields.purpose} />
              <FieldPill label="التوقيت" field={fields.dateWindow} />
              <FieldPill label="المسافرون" field={fields.travelers} />
              <FieldPill label="الميزانية" field={fields.budget} />
              <FieldPill label="الانطلاق" field={fields.origin} />
              <FieldPill label="الجواز" field={fields.passportStatus} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-5">
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

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-sm font-semibold text-white">لوحة المستشار</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FieldRow label="الجنسية" field={fields.nationality} />
                <FieldRow label="الوجهة" field={fields.destination} />
                <FieldRow label="الغرض" field={fields.purpose} />
                <FieldRow label="التوقيت" field={fields.dateWindow} />
                <FieldRow label="المسافرون" field={fields.travelers} />
                <FieldRow label="الميزانية" field={fields.budget} />
                <FieldRow label="الترانزيت" field={fields.transit} />
                <FieldRow label="العودة" field={fields.returnTicket} />
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-300/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200">توجيه المستشار</p>
            <p className="mt-3 text-base leading-7 text-white">{firstStep}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4 text-sm leading-7 text-white/68">
                <strong className="block text-white">1. نكمل الناقص</strong>
                سؤال أو سؤالين يغيروا القرار بدل فورم طويل.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4 text-sm leading-7 text-white/68">
                <strong className="block text-white">2. نفحص الجاهزية</strong>
                المتطلبات والمصادر تظهر في الفحص التفصيلي عند فتحه.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4 text-sm leading-7 text-white/68">
                <strong className="block text-white">3. نوصلك صح</strong>
                العروض والوكلاء تظهر فقط لو موجودة ومطابقة داخل صلة.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
