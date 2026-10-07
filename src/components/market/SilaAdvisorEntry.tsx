"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  FileSearch,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
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
  "أنا مصري وعايز أسافر تركيا سياحة في ديسمبر أنا ومراتي وطفلة، ومش عارف موضوع التأشيرة والترانزيت.";
const STORAGE_KEY = "sila-advisor-active-travel-case";

const PURPOSE_LABEL: Record<string, string> = {
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
};

function loadStoredTravelCase() {
  if (typeof window === "undefined") return null;
  return parseSilaTravelCase(window.localStorage.getItem(STORAGE_KEY));
}

function valueOf(label: string, field: SilaAdvisorField) {
  if (!field.value) return null;
  return label === "الغرض" ? PURPOSE_LABEL[field.value] ?? field.value : field.value;
}

function knownEntries(fields: SilaAdvisorIntentDraft["fields"]) {
  return [
    ["الجنسية", fields.nationality],
    ["الانطلاق", fields.origin],
    ["الوجهة", fields.destination],
    ["الغرض", fields.purpose],
    ["التوقيت", fields.dateWindow],
    ["المسافرون", fields.travelers],
    ["الميزانية", fields.budget],
    ["الجواز", fields.passportStatus],
    ["الترانزيت", fields.transit],
    ["الإقامة", fields.accommodation],
  ] as Array<[string, SilaAdvisorField]>;
}

interface SilaAdvisorEntryProps {
  initialCase?: SilaTravelCaseSnapshot | null;
  persistentIntentId?: number | null;
}

export function SilaAdvisorEntry({
  initialCase = null,
  persistentIntentId = null,
}: SilaAdvisorEntryProps) {
  const [message, setMessage] = useState("");
  const [travelCase, setTravelCase] = useState<SilaTravelCaseSnapshot | null>(
    () => initialCase ?? loadStoredTravelCase(),
  );
  const [caseStatus, setCaseStatus] = useState(
    initialCase && persistentIntentId
      ? "تم تحميل سياق رحلتك المحفوظة."
      : "ابدأ بما تعرفه فقط.",
  );
  const [isSyncing, setIsSyncing] = useState(false);

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
  const currentQuestion = questions[0] ?? null;
  const firstStep = useMemo(() => firstSilaAdvisorStep(activeIntent), [activeIntent]);
  const entries = knownEntries(activeIntent.fields);
  const known = entries.filter(([, field]) => Boolean(field.value));
  const unknown = entries.filter(([, field]) => !field.value);
  const destination = valueOf("الوجهة", activeIntent.fields.destination);
  const origin = valueOf("الانطلاق", activeIntent.fields.origin);
  const travelers = valueOf("المسافرون", activeIntent.fields.travelers);
  const dateWindow = valueOf("التوقيت", activeIntent.fields.dateWindow);

  const currentState = !travelCase
    ? "COLLECTING_CONTEXT"
    : currentQuestion
      ? "NEEDS_INPUT"
      : "READY_TO_VERIFY";

  async function persistCase(nextCase: SilaTravelCaseSnapshot, status: string) {
    setTravelCase(nextCase);
    window.localStorage.setItem(STORAGE_KEY, serializeSilaTravelCase(nextCase));

    if (!persistentIntentId) {
      setCaseStatus(status);
      return;
    }

    setIsSyncing(true);
    setCaseStatus("بنحفظ التحديث داخل نفس الرحلة...");
    try {
      const response = await fetch("/api/sila/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: persistentIntentId, case: nextCase }),
      });
      if (!response.ok) throw new Error("memory sync failed");
      setCaseStatus(status + " وتم حفظه داخل رحلتك.");
    } catch {
      setCaseStatus(status + " اتحفظ على الجهاز، وتعذر مزامنته مع الحساب الآن.");
    } finally {
      setIsSyncing(false);
    }
  }

  function applyMessage() {
    if (!message.trim() || isSyncing) return;
    const nextCase = travelCase
      ? mergeSilaTravelCaseMessage(travelCase, message)
      : createSilaTravelCase(message);

    void persistCase(
      nextCase,
      travelCase
        ? "تم تحديث سياق الرحلة بالمعلومة الجديدة."
        : "تم إنشاء سياق الرحلة من كلامك.",
    );
    setMessage("");
  }

  function openVerificationWorkspace() {
    const details = document.getElementById("verification-check");
    if (!(details instanceof HTMLDetailsElement)) return;
    details.open = true;
    details.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function resetCase() {
    if (isSyncing) return;
    setTravelCase(null);
    setMessage("");
    window.localStorage.removeItem(STORAGE_KEY);

    if (!persistentIntentId) {
      setCaseStatus("بدأنا من جديد. اكتب فقط اللي تعرفه.");
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch(`/api/sila/memory?intentId=${persistentIntentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("memory clear failed");
      setCaseStatus("تم مسح ذاكرة المستشار فقط، بدون حذف الرحلة المحفوظة.");
    } catch {
      setCaseStatus("تم مسح الذاكرة المحلية، وتعذر تحديث نسخة الحساب الآن.");
    } finally {
      setIsSyncing(false);
    }
  }

  const verificationNeeds = advisorBrain?.researchNeeds.slice(0, 5) ?? [
    { id: "entry", label: "متطلبات الدخول", reason: "تتحدد حسب الجنسية والغرض والتاريخ." },
    { id: "transit", label: "الترانزيت", reason: "قد يغيّر المتطلبات حسب المسار." },
    { id: "offers", label: "العروض المناسبة", reason: "لا تظهر إلا من مخزون منشور فعليًا." },
  ];

  return (
    <section className="decision-board" aria-labelledby="sila-advisor-title">
      <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-outlinev bg-low/50 p-5 lg:border-b-0 lg:border-l lg:p-6">
          <div className="text-[11px] font-bold text-signal">رحلتي</div>
          <h2 id="sila-advisor-title" className="mt-3 text-2xl font-bold tracking-[-0.025em] text-deep">
            {origin || destination ? (
              <span className="intent-route">
                <span className="intent-route__point truncate">{origin || "من؟"}</span>
                <span className="intent-route__line" />
                <span className="intent-route__point truncate">{destination || "إلى؟"}</span>
              </span>
            ) : (
              "ابنِ سياق الرحلة."
            )}
          </h2>

          <div className="mt-5 space-y-2 text-[12px] leading-6 text-slate">
            {dateWindow ? <div>التوقيت · <strong className="text-deep">{dateWindow}</strong></div> : null}
            {travelers ? <div>المسافرون · <strong className="text-deep">{travelers}</strong></div> : null}
            <div>الحالة · <strong className="text-deep">{currentState}</strong></div>
          </div>

          <div className="mt-7 border-t border-outlinev pt-5">
            <div className="text-[11px] font-bold text-slate">مسار القرار</div>
            <div className="mt-4 space-y-4">
              {[
                ["01", "فهم السياق", Boolean(travelCase)],
                ["02", "استكمال الناقص", Boolean(travelCase && currentQuestion)],
                ["03", "البحث والمصادر", false],
                ["04", "التحقق", false],
                ["05", "النتيجة والخطوة التالية", false],
              ].map(([number, label, active]) => (
                <div key={String(number)} className="grid grid-cols-[32px_1fr] items-center gap-3">
                  <span className={
                    "tnum grid h-8 w-8 place-items-center rounded-full border text-[10px] font-bold " +
                    (active ? "border-signal bg-air text-signal" : "border-outlinev bg-cloud text-slate")
                  }>
                    {number}
                  </span>
                  <span className={"text-[12px] font-semibold " + (active ? "text-deep" : "text-slate")}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void resetCase()}
            disabled={isSyncing}
            className="quiet-action mt-7 text-slate disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            ابدأ سياقًا جديدًا
          </button>
        </aside>

        <div className="min-w-0">
          <div className="border-b border-outlinev p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-[680px]">
                <div className="sila-eyebrow text-[11px] font-bold">مستشار صلة</div>
                <h3 className="mt-4 text-3xl font-bold leading-[1.08] tracking-[-0.035em] text-deep md:text-5xl">
                  سؤال أقل.
                  <span className="block text-slate">سياق أوضح.</span>
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate">
                  صلة لا تحاول الإجابة قبل ما تفهم الرحلة. كل معلومة تقولها تدخل في نفس السياق،
                  وأي شيء ناقص يظل Unknown بدل ما يتحول لاستنتاج.
                </p>
              </div>
              <span className={
                "decision-state " +
                (currentState === "NEEDS_INPUT" ? "decision-state--focus" : currentState === "READY_TO_VERIFY" ? "decision-state--confirmed" : "decision-state--unknown")
              }>
                {currentState}
              </span>
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[1fr_.92fr]">
            <div className="p-5 md:p-7 xl:border-l xl:border-outlinev">
              <div className="text-[11px] font-bold text-slate">فهمت رحلتك</div>
              <p className="mt-3 text-lg font-semibold leading-8 text-inkwell">
                {summary || "لسه ما عنديش سياق كفاية. ابدأ بما تعرفه."}
              </p>

              <div className="mt-7">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[11px] font-bold text-deep">ما أعرفه</div>
                  <span className="tnum text-[11px] text-slate">{known.length} معلوم</span>
                </div>

                {known.length ? (
                  <div className="mt-3 border-y border-outlinev">
                    {known.map(([label, field]) => (
                      <div key={label} className="grid grid-cols-[110px_1fr_auto] gap-3 border-b border-outlinev py-3 last:border-b-0">
                        <span className="text-[11px] font-bold text-slate">{label}</span>
                        <span className="text-[13px] font-semibold text-deep">{valueOf(label, field)}</span>
                        <Check className="h-4 w-4 text-verified" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 border-y border-outlinev py-5 text-sm text-slate">
                    لا توجد معلومة مثبتة في السياق حتى الآن.
                  </div>
                )}
              </div>

              <div className="mt-7">
                <div className="text-[11px] font-bold text-deep">ما أحتاج معرفته الآن</div>
                <div className="mt-3 border border-outlinev bg-air/55 p-5">
                  {currentQuestion ? (
                    <>
                      <div className="decision-state decision-state--focus">سؤال واحد فقط</div>
                      <p className="mt-4 text-xl font-bold leading-8 text-deep">
                        {currentQuestion.question}
                      </p>
                      <p className="mt-2 text-[12px] leading-6 text-slate">
                        {currentQuestion.why}
                      </p>
                    </>
                  ) : travelCase ? (
                    <>
                      <div className="decision-state decision-state--confirmed">السياق كافٍ للخطوة التالية</div>
                      <p className="mt-4 text-lg font-bold text-deep">{firstStep}</p>
                    </>
                  ) : (
                    <>
                      <div className="decision-state decision-state--unknown">ابدأ من أي معلومة</div>
                      <p className="mt-4 text-lg font-bold text-deep">
                        الوجهة، الموعد، الجنسية، عدد المسافرين—أي حاجة تعرفها.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="sila-advisor-message" className="mb-2 block text-[11px] font-bold text-deep">
                  {currentQuestion ? "إجابتك" : travelCase ? "أضف معلومة تغيّر السياق" : "احكِ اللي تعرفه"}
                </label>
                <textarea
                  id="sila-advisor-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  placeholder={currentQuestion ? "اكتب إجابتك أو قل: غير متأكد" : "مثال: أنا مصري وعايز تركيا سياحة في ديسمبر..."}
                  className="min-h-28 w-full resize-none rounded-xl border border-outlinev bg-cloud px-4 py-3 text-sm leading-7 text-inkwell outline-none transition-[border-color,box-shadow] focus:border-signal focus:ring-4 focus:ring-air"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={applyMessage}
                    disabled={!message.trim() || isSyncing}
                    className="focus-action disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {travelCase ? "أضف للسياق" : "ابدأ بهذا السياق"}
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  {!travelCase ? (
                    <button
                      type="button"
                      onClick={() => setMessage(TRAVELER_EXAMPLE)}
                      className="quiet-action text-slate"
                    >
                      استخدم مثالًا
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate">{caseStatus}</p>
              </div>
            </div>

            <div className="bg-low/35 p-5 md:p-7">
              <div className="text-[11px] font-bold text-deep">سأتحقق لك من</div>
              <div className="mt-4 space-y-3">
                {verificationNeeds.map((need) => (
                  <div key={need.id} className="grid grid-cols-[34px_1fr] gap-3 border-b border-outlinev pb-3 last:border-b-0">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-cloud text-signal">
                      <FileSearch className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-[13px] font-bold text-deep">{need.label}</div>
                      <p className="mt-1 text-[11px] leading-5 text-slate">{need.reason}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 border-t border-outlinev pt-5">
                <div className="text-[11px] font-bold text-deep">قاعدة الثقة</div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-verified" />
                    <div>
                      <div className="text-[12px] font-bold text-deep">Confirmed</div>
                      <p className="text-[11px] leading-5 text-slate">دليل مناسب للنطاق ومعلومات صلاحية مفهومة.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CircleHelp className="mt-0.5 h-4 w-4 text-gold" />
                    <div>
                      <div className="text-[12px] font-bold text-deep">Conflicting</div>
                      <p className="text-[11px] leading-5 text-slate">مصادر أو شروط لا تتفق وتحتاج مراجعة.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CircleHelp className="mt-0.5 h-4 w-4 text-slate" />
                    <div>
                      <div className="text-[12px] font-bold text-deep">Unknown</div>
                      <p className="text-[11px] leading-5 text-slate">نقول غير معروف بدل ما نخترع إجابة.</p>
                    </div>
                  </div>
                </div>
              </div>

              {unknown.length ? (
                <details className="progressive-panel mt-7">
                  <summary>تفاصيل لسه غير معروفة ({unknown.length})</summary>
                  <div className="space-y-2 pb-2">
                    {unknown.map(([label]) => (
                      <div key={label} className="flex items-center gap-2 text-[12px] text-slate">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate" />
                        {label}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}

              {travelCase ? (
                <button
                  type="button"
                  onClick={openVerificationWorkspace}
                  className="focus-action mt-7 w-full"
                >
                  انتقل للفحص المدعوم بالمصادر
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
