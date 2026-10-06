"use client";

import { useEffect, useMemo, useState } from "react";
import { buildSilaAdvisorBrain } from "@/lib/sila-advisor-brain";
import {
  extractSilaAdvisorIntent,
  firstSilaAdvisorStep,
  selectSilaAdvisorMissingQuestions,
  summarizeSilaAdvisorUnderstanding,
  type SilaAdvisorField,
  type SilaAdvisorIntentDraft,
} from "@/lib/sila-advisor-intake";
import {
  createSilaTravelCase,
  mergeSilaTravelCaseMessage,
  parseSilaTravelCase,
  serializeSilaTravelCase,
  summarizeSilaTravelCase,
  type SilaTravelCaseSnapshot,
} from "@/lib/sila-advisor-travel-case";

const TRAVELER_EXAMPLE =
  "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر أنا ومراتي وطفلة، الميزانية محدودة ومش عارف أبدأ منين.";
const AGENT_EXAMPLE =
  "عميل مصري عايز تركيا سياحة هو ومراته وطفلة، أطلب منه إيه عشان أعمله عرض مضبوط؟";
const STORAGE_KEY = "sila-advisor-active-travel-case";

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

const TRUST_LABEL = {
  LOCAL_ONLY: "ذاكرة محلية فقط",
  NEEDS_OFFICIAL_SOURCES: "يحتاج مصادر رسمية",
  READY_FOR_HUMAN_REVIEW: "جاهز لمراجعة بشرية",
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

function SignalList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
      <p className="text-xs font-semibold text-white/50">{label}</p>
      {values.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/75">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/35">لسه صلة محتاجة تتعلم ده من الكلام الجاي.</p>
      )}
    </div>
  );
}

function knownFieldCount(fields: SilaAdvisorIntentDraft["fields"]) {
  return [
    fields.nationality,
    fields.destination,
    fields.purpose,
    fields.dateWindow,
    fields.travelers,
    fields.budget,
    fields.origin,
    fields.passportStatus,
    fields.accommodation,
    fields.returnTicket,
  ].filter((field) => Boolean(field.value)).length;
}

export function SilaAdvisorEntry() {
  const [message, setMessage] = useState(TRAVELER_EXAMPLE);
  const [travelCase, setTravelCase] = useState<SilaTravelCaseSnapshot | null>(null);
  const [caseStatus, setCaseStatus] = useState("جاهز لبناء ملف رحلة من كلامك.");

  useEffect(() => {
    setTravelCase(parseSilaTravelCase(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  const liveIntent = useMemo(() => extractSilaAdvisorIntent(message), [message]);
  const activeIntent = useMemo<SilaAdvisorIntentDraft>(() => {
    if (!travelCase) return liveIntent;
    return {
      originalMessage: travelCase.messages.at(-1)?.text ?? message,
      role: travelCase.role,
      fields: travelCase.fields,
    };
  }, [liveIntent, message, travelCase]);
  const caseSummary = useMemo(
    () => (travelCase ? summarizeSilaTravelCase(travelCase) : null),
    [travelCase],
  );
  const advisorBrain = useMemo(
    () => (travelCase ? buildSilaAdvisorBrain(travelCase) : null),
    [travelCase],
  );
  const summary = caseSummary?.understanding ?? summarizeSilaAdvisorUnderstanding(activeIntent);
  const questions = caseSummary?.missingQuestions ?? selectSilaAdvisorMissingQuestions(activeIntent, 4);
  const firstStep = useMemo(() => firstSilaAdvisorStep(activeIntent), [activeIntent]);
  const fields = activeIntent.fields;
  const capturedFields = knownFieldCount(fields);
  const roleLabel = activeIntent.role === "AGENT" ? "مساحة وكيل" : "مساحة مسافر";
  const profileSignals = caseSummary?.profileSignals;

  function persistCase(nextCase: SilaTravelCaseSnapshot, status: string) {
    setTravelCase(nextCase);
    window.localStorage.setItem(STORAGE_KEY, serializeSilaTravelCase(nextCase));
    setCaseStatus(status);
  }

  function startCase() {
    if (!message.trim()) return;
    const nextCase = createSilaTravelCase(message);
    persistCase(nextCase, "اتحفظ ملف الرحلة والعميل. تقدر تكمّل بإجاباتك بدل ما تبدأ من الصفر.");
  }

  function addMessageToCase() {
    if (!message.trim()) return;
    if (!travelCase) {
      startCase();
      return;
    }
    const nextCase = mergeSilaTravelCaseMessage(travelCase, message);
    persistCase(
      nextCase,
      nextCase.changes.length > 0
        ? `تم تحديث ملف صلة بـ ${nextCase.changes.length} معلومة.`
        : "اتضافت الرسالة للذاكرة، لكن مفيش معلومة جديدة مؤكدة غيّرت الملف.",
    );
  }

  function resetCase() {
    setTravelCase(null);
    window.localStorage.removeItem(STORAGE_KEY);
    setCaseStatus("اتمسح ملف صلة المحلي. ابدأ برسالة جديدة.");
  }

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
                مستشار صلة AI داخل المنصة
              </div>
              <h2 id="sila-advisor-entry-title" className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
                اسأل كأنك بتكلم مستشار سفر بيفتكر وبيتعلم.
              </h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/60">
              {roleLabel}
            </span>
          </div>

          <p className="text-sm leading-7 text-white/64 md:text-base">
            صلة مش فورم. اكتب اللي في دماغك، والمستشار يبني ملف رحلة وملف عميل ويفهم الاهتمامات والقيود والوكيل عشان يحسن التجربة مع كل رسالة.
          </p>

          <div className="flex-1 space-y-3 overflow-hidden rounded-3xl border border-white/10 bg-[#081713] p-4">
            <div className="max-w-[86%] rounded-2xl rounded-tr-sm border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-7 text-white/78">
              أنا مستشار صلة. احكي لي الرحلة أو حالة العميل، وأنا أرتبها وأبني ذاكرة تفيدك في المرة الجاية.
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
              <button type="button" className="rounded-full border border-white/10 px-3 py-1 transition hover:border-[#f2d9a0]/60 hover:text-[#f2d9a0]" onClick={() => setMessage(TRAVELER_EXAMPLE)}>
                مثال مسافر
              </button>
              <button type="button" className="rounded-full border border-white/10 px-3 py-1 transition hover:border-[#f2d9a0]/60 hover:text-[#f2d9a0]" onClick={() => setMessage(AGENT_EXAMPLE)}>
                مثال وكيل
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={startCase} className="rounded-2xl bg-[#f2d9a0] px-4 py-3 text-sm font-bold text-[#082016] transition hover:brightness-105">
                ابدأ ملف صلة
              </button>
              <button type="button" onClick={addMessageToCase} className="rounded-2xl border border-emerald-300/30 bg-emerald-300/12 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-300/18">
                ضم الرسالة للذاكرة
              </button>
              <button type="button" onClick={resetCase} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-white/72 transition hover:bg-white/[0.09]">
                ابدأ من جديد
              </button>
            </div>
            <p className="mt-3 rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-xs leading-6 text-white/58">
              {caseStatus}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {travelCase ? (
            <div className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-300/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-200">ذاكرة صلة محفوظة محليًا</p>
              <p className="mt-2 text-sm leading-7 text-white/72">
                آخر تحديث: {new Date(travelCase.updatedAt).toLocaleString("ar-EG")} · {travelCase.messages.length} رسائل · {capturedFields} نقاط معروفة.
              </p>
            </div>
          ) : null}

          {advisorBrain ? (
            <div className="rounded-[1.75rem] border border-[#f2d9a0]/30 bg-[#f2d9a0]/12 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#f2d9a0]">عقل مستشار صلة</p>
                  <p className="mt-3 text-base leading-8 text-white">{advisorBrain.answer}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-xs text-white/60">
                  {TRUST_LABEL[advisorBrain.trustState]}
                </span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                  <p className="text-sm font-semibold text-white">الخطوات الأقوى الآن</p>
                  <div className="mt-3 space-y-3">
                    {advisorBrain.nextActions.map((action) => (
                      <div key={action.id} className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                        <p className="text-sm font-semibold text-white">{action.label}</p>
                        <p className="mt-1 text-xs leading-6 text-white/55">{action.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
                  <p className="text-sm font-semibold text-white">احتياجات المصادر والربط</p>
                  <div className="mt-3 space-y-3">
                    {advisorBrain.researchNeeds.map((need) => (
                      <div key={need.id} className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                        <p className="text-sm font-semibold text-white">{need.label}</p>
                        <p className="mt-1 text-xs leading-6 text-white/55">{need.reason}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.045] p-3 text-xs leading-6 text-white/55">
                    {advisorBrain.offerPolicy}
                  </p>
                </div>
              </div>
              {advisorBrain.agentBrief ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/18 p-4">
                  <p className="text-sm font-semibold text-white">Brief جاهز للوكيل</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <SignalList label="المعروف عن الرحلة" values={advisorBrain.agentBrief.knownTripFacts} />
                    <SignalList label="لا تفترض" values={advisorBrain.agentBrief.doNotAssume} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {profileSignals ? (
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#f2d9a0]">ملف العميل والوكيل</p>
                  <p className="mt-2 text-sm leading-7 text-white/60">
                    صلة تجمع الاهتمامات والقيود والوجهات عشان ترجع تفهم المستخدم أو الوكيل وتبني رد أدق.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-xs text-white/55">
                  حساسية السعر: {profileSignals.priceSensitivity === "HIGH" ? "عالية" : profileSignals.priceSensitivity === "MEDIUM" ? "متوسطة" : profileSignals.priceSensitivity === "LOW" ? "منخفضة" : "غير معروفة"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <SignalList label="اهتمامات العميل" values={profileSignals.travelerInterests} />
                <SignalList label="قيود العميل" values={profileSignals.travelerConstraints} />
                <SignalList label="وجهات مفضلة/متكررة" values={profileSignals.preferredDestinations} />
                <SignalList label="ذاكرة الوكيل" values={profileSignals.agentMode ? profileSignals.agentHandledDestinations : []} />
              </div>
            </div>
          ) : null}

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
                <span className="rounded-full bg-white/[0.07] px-3 py-1 text-xs text-white/55">{questions.length} أسئلة مهمة</span>
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
                إجابة واحدة قد تغيّر القرار بدل فورم طويل.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/18 p-4 text-sm leading-7 text-white/68">
                <strong className="block text-white">2. نبني ذاكرة</strong>
                ملف العميل والرحلة والوكيل يخليك تكمل من آخر نقطة.
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
