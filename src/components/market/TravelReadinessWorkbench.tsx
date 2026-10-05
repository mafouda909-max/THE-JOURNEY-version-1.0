"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { SilaReviewIcon } from "@/components/brand/SilaIcons";
import { isReadinessQuestionsResponse, isReadinessResponse, type ReadinessQuestionsResponse, type ReadinessResponse } from "@/lib/readiness-contract";

const STATUS = {
  READY: ["جاهز ضمن نطاق الفحص", "bg-verifiedbg text-verified"],
  NEEDS_ATTENTION: ["يحتاج إجراء", "bg-amber text-gold"],
  NEEDS_CONFIRMATION: ["يحتاج تأكيدًا", "bg-amber text-gold"],
  BLOCKED: ["يوجد مانع حسب البيانات المدخلة", "bg-errorbg text-error"],
  UNKNOWN: ["غير معروف بعد", "bg-low text-slate"],
} as const;

const ITEM_STATUS = {
  VERIFIED: "حكم مثبت ضمن النطاق",
  PENDING_ACTION: "يحتاج إجراء",
  PENDING_CONFIRMATION: "يحتاج تأكيدًا",
  BLOCKED: "يوجد مانع",
  UNKNOWN: "غير معروف بعد",
};

const DOSSIER_STATUS = {
  SUPPORTED: "مثبت ضمن النطاق",
  UNCONFIRMED: "يحتاج تأكيدًا",
  CONFLICTED: "مصادر متعارضة",
  UNKNOWN: "غير معروف بعد",
} as const;

const EVIDENCE_STATUS = {
  VERIFIED: "دليل مطابق للنطاق",
  REPORTED: "بيانات مقدمة",
  UNCONFIRMED: "لم يثبت الحكم",
  STALE: "يحتاج تحديثًا",
  EXPIRED: "منتهي الصلاحية",
  CONFLICTED: "مصادر تحتاج مراجعة",
  UNKNOWN: "الدليل غير متاح",
};

function time(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value)) + " UTC"
    : "غير مسجل";
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 2,
  }).format(value) + " " + currency;
}

export function TravelReadinessWorkbench({
  initial,
}: {
  initial?: { destination?: string | null; intentLabel?: string | null };
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReadinessResponse | null>(null);
  const [questions, setQuestions] = useState<ReadinessQuestionsResponse["questions"]>([]);
  const [advisorAnswers, setAdvisorAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      const current = active.current;
      active.current = null;
      current?.abort();
    },
    [],
  );

  function changed(event: ChangeEvent<HTMLFormElement>) {
    const targetName = event.target instanceof HTMLElement
      ? event.target.getAttribute("name") ?? ""
      : "";
    const current = active.current;
    active.current = null;
    current?.abort();
    setLoading(false);
    setResult(null);
    setError(null);
    if (!targetName.startsWith("advisor.")) {
      setQuestions([]);
      setAdvisorAnswers({});
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const roundAnswers = questions.length
      ? Object.fromEntries(
          questions.map((question) => [
            question.id,
            String(data.get(`advisor.${question.id}`) ?? "").trim(),
          ]),
        )
      : {};
    const accumulatedAnswers = { ...advisorAnswers, ...roundAnswers };
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError(null);
    setResult(null);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 23_000);

    try {
      const response = await fetch("/api/travel/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          nationality: data.get("nationality"),
          originCity: data.get("originCity"),
          destination: data.get("destination"),
          passportValidityMonths: data.get("passportValidityMonths"),
          transitCountry: data.get("transitCountry"),
          travelPurpose: data.get("travelPurpose"),
          travelDate: data.get("travelDate"),
          travelerCount: data.get("travelerCount"),
          budgetAmount: data.get("budgetAmount"),
          budgetCurrency: data.get("budgetCurrency"),
          advisorAnswers: Object.keys(accumulatedAnswers).length
            ? accumulatedAnswers
            : undefined,
        }),
      });

      const json: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          json &&
          typeof json === "object" &&
          "error" in json &&
          typeof json.error === "string"
            ? json.error
            : "تعذر فحص المصادر. حاول مجددًا.",
        );
      }
      if (isReadinessQuestionsResponse(json)) {
        if (active.current === controller) {
          setAdvisorAnswers(accumulatedAnswers);
          setQuestions(json.questions);
          setResult(null);
        }
        return;
      }
      if (!isReadinessResponse(json)) {
        throw new Error("لم تصل نتيجة مكتملة يمكن الاعتماد عليها. أعد الفحص.");
      }
      if (active.current === controller) {
        setAdvisorAnswers(accumulatedAnswers);
        setQuestions([]);
        setResult(json);
      }
    } catch (failure) {
      if (active.current !== controller) return;
      setError(
        timedOut
          ? "استغرق الفحص وقتًا طويلًا. لم تصدر نتيجة؛ حاول مجددًا."
          : failure instanceof Error && failure.name === "Error"
            ? failure.message
            : "تعذر الاتصال بالمصادر. لم تصدر نتيجة؛ حاول مجددًا.",
      );
    } finally {
      clearTimeout(timer);
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
      }
    }
  }

  const field =
    "w-full rounded-xl border border-outlinev bg-low/60 px-4 py-3 text-sm font-semibold text-inkwell outline-none focus:border-signal focus:bg-cloud focus:ring-4 focus:ring-signal/10";
  const label = "mb-1.5 block text-[12px] font-bold text-inkwell";

  return (
    <div className="space-y-4">
      {initial?.intentLabel ? (
        <div className="sila-window border border-sky/40 bg-air/45 px-4 py-3 text-[12px] font-semibold text-deep">
          فحص الجاهزية مرتبط بنية السفر: {initial.intentLabel}. أكمل البيانات التي لا نفترضها عنك.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[.78fr_1.22fr]">
        <form
          onSubmit={submit}
          onChange={changed}
          aria-busy={loading}
          className="sila-window h-fit border border-outlinev bg-cloud p-5 lg:sticky lg:top-28"
        >
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">
            صلة تساعدك قبل الحجز
          </div>
          <h2 className="mt-2 text-xl font-bold text-inkwell">احكي لنا رحلتك.</h2>
          <p className="mt-2 text-[12px] leading-6 text-slate">
            نراجع ما لدينا من أدلة، ونبحث مباشرة عندما تكون الخدمة مفعلة، ونقترح عروض صلة الحقيقية فقط إذا طابقت رحلتك.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="readiness-nationality" className={label}>الجنسية</label>
              <input id="readiness-nationality" name="nationality" required minLength={2} maxLength={64} placeholder="مثال: مصري" className={field} />
            </div>

            <div>
              <label htmlFor="readiness-origin" className={label}>مدينة الانطلاق</label>
              <input id="readiness-origin" name="originCity" maxLength={64} placeholder="مثال: القاهرة" className={field} />
            </div>

            <div>
              <label htmlFor="readiness-destination" className={label}>الوجهة</label>
              <input id="readiness-destination" name="destination" required minLength={2} maxLength={64} defaultValue={initial?.destination ?? ""} placeholder="دولة أو مدينة السفر" className={field} />
            </div>

            <div>
              <label htmlFor="readiness-purpose" className={label}>الغرض من السفر</label>
              <select id="readiness-purpose" name="travelPurpose" required className={field} defaultValue="">
                <option value="">لم أحدد بعد</option>
                <option value="tourism">سياحة</option>
                <option value="study">دراسة</option>
                <option value="work">عمل بعقد أو وظيفة</option>
                <option value="business">رحلة عمل أو اجتماعات</option>
                <option value="freelance">عمل حر أو عن بُعد</option>
                <option value="umrah">عمرة</option>
                <option value="visit">زيارة عائلية أو شخصية</option>
                <option value="medical">علاج</option>
                <option value="transit">ترانزيت</option>
                <option value="other">غرض آخر</option>
              </select>
            </div>

            <div>
              <label htmlFor="readiness-date" className={label}>تاريخ السفر إن تحدد</label>
              <input id="readiness-date" name="travelDate" type="date" className={field} />
            </div>

            <div>
              <label htmlFor="readiness-passport" className={label}>صلاحية الجواز المتبقية بالأشهر</label>
              <input id="readiness-passport" name="passportValidityMonths" type="number" required min={0} max={120} step="0.5" placeholder="مثال: 12" className={field} />
            </div>

            <div>
              <label htmlFor="readiness-travelers" className={label}>عدد المسافرين</label>
              <input id="readiness-travelers" name="travelerCount" type="number" min={1} max={50} step={1} placeholder="اختياري" className={field} />
            </div>

            <details className="rounded-xl border border-outlinev bg-low/40 p-3">
              <summary className="cursor-pointer text-[12px] font-bold text-deep">
                تفاصيل إضافية لنتيجة أدق
              </summary>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="readiness-transit" className={label}>دولة الترانزيت إن وجدت</label>
                  <input id="readiness-transit" name="transitCountry" maxLength={64} placeholder="اختياري" className={field} />
                </div>
                <div className="grid grid-cols-[1fr_.8fr] gap-2">
                  <div>
                    <label htmlFor="readiness-budget" className={label}>الميزانية</label>
                    <input id="readiness-budget" name="budgetAmount" type="number" min={0} max={10000000} step="0.01" placeholder="اختياري" className={field} />
                  </div>
                  <div>
                    <label htmlFor="readiness-currency" className={label}>العملة</label>
                    <select id="readiness-currency" name="budgetCurrency" className={field} defaultValue="">
                      <option value="">—</option>
                      <option value="EGP">EGP</option>
                      <option value="SAR">SAR</option>
                      <option value="AED">AED</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              </div>
            </details>

            {questions.length ? (
              <div className="rounded-xl border border-sky/50 bg-air/35 p-4">
                <div className="text-[11px] font-semibold text-signal">قبل ما نبحث</div>
                <h3 className="mt-1 text-sm font-bold text-inkwell">محتاجين منك شوية تفاصيل عشان ما نجاوبش بسياق غلط.</h3>
                <div className="mt-4 space-y-4">
                  {questions.map((question) => (
                    <div key={question.id}>
                      <label htmlFor={`advisor-${question.id}`} className={label}>{question.label}</label>
                      {question.kind === "choice" ? (
                        <select
                          id={`advisor-${question.id}`}
                          name={`advisor.${question.id}`}
                          required
                          defaultValue=""
                          className={field}
                        >
                          <option value="">اختر الأقرب</option>
                          {question.options?.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`advisor-${question.id}`}
                          name={`advisor.${question.id}`}
                          type={question.kind === "number" ? "number" : "text"}
                          required
                          min={question.kind === "number" ? 1 : undefined}
                          max={question.kind === "number" ? 1440 : undefined}
                          step={question.kind === "number" ? 1 : undefined}
                          maxLength={question.kind === "number" ? undefined : 500}
                          placeholder={question.placeholder ?? "اكتب اللي تعرفه؛ ولو غير متأكد اكتب غير متأكد"}
                          className={field}
                        />
                      )}
                      <p className="mt-1 text-[10px] leading-5 text-slate">{question.why}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="sila-interactive mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white hover:bg-horizon disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SilaReviewIcon className="h-4 w-4" />}
            {loading ? "نراجع ونبحث…" : questions.length ? "كمّل البحث" : "ابدأ مع صلة"}
          </button>

          {error ? (
            <div role="alert" aria-label="خطأ فحص الجاهزية" className="mt-4 rounded-xl bg-errorbg px-4 py-3 text-[12px] font-semibold text-error">
              {error}
            </div>
          ) : null}
        </form>

        <section aria-label="نتيجة جاهزية السفر" aria-live="polite">
          {!result ? (
            <div className="sila-window flex min-h-[260px] items-center justify-center border border-dashed border-outlinev bg-cloud p-6 text-center">
              <div className="max-w-lg">
                <SilaReviewIcon className="mx-auto h-8 w-8 text-signal" />
                <h2 className="mt-4 text-xl font-bold text-inkwell">
                  {questions.length ? "قبل ما نبحث، هنكمّل السياق معك." : "هنبني لك صورة الرحلة، مش مجرد نسبة."}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate">
                  {questions.length
                    ? "جاوب الأسئلة الظاهرة في النموذج. بعدها صلة تبدأ الفحص والبحث بنفس سياق الرحلة، من غير ما تعيد البيانات من الأول."
                    : "مستندات، تأشيرة، ترانزيت، نقاط ناقصة، بحث مباشر عند توفره، تفاصيل تجهيز، وعروض صلة المطابقة إن وُجدت."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="sila-window border border-outlinev bg-cloud p-5">
                <div className="text-[11px] font-semibold text-slate">حالة الجاهزية</div>
                <h2 className="mt-2 text-2xl font-bold text-inkwell">{STATUS[result.status][0]}</h2>
                <p className="mt-3 text-[11px] leading-6 text-slate">
                  وقت الفحص: {time(result.evaluatedAt)}. النتيجة تخص البنود المعروضة فقط.
                </p>
              </div>

              {result.decisionDossier ? (
                <div className="sila-window border border-outlinev bg-cloud p-5">
                  <div className="text-[11px] font-semibold text-signal">صورة القرار</div>
                  <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-inkwell">ما الذي نعرفه فعلًا؟</h3>
                      <p className="mt-1 text-[11px] leading-5 text-slate">
                        صلة تجمع الادعاءات حسب الموضوع والنطاق، ولا تختار مصدرًا بصمت عند التعارض.
                      </p>
                    </div>
                    <div className="text-[10px] text-slate">
                      {result.decisionDossier.claims.length} ادعاء · {result.decisionDossier.groups.length} مجموعة قرار
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {result.decisionDossier.groups.map((group) => (
                      <div
                        key={group.key}
                        className={
                          "rounded-xl border p-3 " +
                          (group.resolution === "CONFLICTED"
                            ? "border-error/25 bg-errorbg/35"
                            : group.resolution === "SUPPORTED"
                              ? "border-verified/20 bg-verifiedbg/25"
                              : "border-outlinev bg-low/45")
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[12px] font-bold text-inkwell">{group.topicLabel}</div>
                          <span className="rounded-full bg-cloud px-2 py-1 text-[9px] font-bold text-slate">
                            {DOSSIER_STATUS[group.resolution]}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-slate">{group.reason}</p>
                        <p className="mt-2 text-[10px] text-slate">المصادر/المداخل: {group.sourceCount}</p>
                      </div>
                    ))}
                  </div>

                  {result.decisionDossier.conflicts.length ? (
                    <div className="mt-4 rounded-xl border border-error/20 bg-errorbg/40 px-4 py-3 text-[12px] font-semibold leading-6 text-error">
                      تعارض يحتاج حسمًا قبل القرار: {result.decisionDossier.conflicts.join(" · ")}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {result.advisor ? (
                <>
                  <div className="sila-window border border-sky/50 bg-air/35 p-5">
                    <div className="text-[11px] font-semibold text-signal">خطة التجهيز حسب رحلتك</div>
                    <h3 className="mt-2 text-lg font-bold text-inkwell">{result.advisor.purposeLabel}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.advisor.preparationTopics.map((topic) => (
                        <span key={topic} className="rounded-full bg-cloud px-3 py-1 text-[11px] font-semibold text-deep">{topic}</span>
                      ))}
                    </div>
                    {result.advisor.questionsToComplete.length ? (
                      <div className="mt-4">
                        <div className="text-[12px] font-bold text-inkwell">أسئلة لو جاوبتها هنقدر ندقّق أكتر</div>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-[12px] leading-6 text-slate">
                          {result.advisor.questionsToComplete.map((question) => <li key={question}>{question}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  {result.advisor.routeIntelligence.status !== "NOT_APPLICABLE" ? (
                    <div className="sila-window border border-outlinev bg-cloud p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold text-signal">تحليل مسار الترانزيت</div>
                          <h3 className="mt-1 text-lg font-bold text-inkwell">
                            {result.advisor.routeIntelligence.complexityLabel}
                          </h3>
                        </div>
                        <span className="rounded-full bg-low px-2.5 py-1 text-[10px] font-bold text-slate">
                          {result.advisor.routeIntelligence.status === "AVAILABLE" ? "السياق مكتمل" : "يحتاج تفاصيل"}
                        </span>
                      </div>
                      <p className="mt-3 text-[12px] leading-6 text-slate">
                        {result.advisor.routeIntelligence.summary}
                      </p>
                      {result.advisor.routeIntelligence.routeDescription ? (
                        <p className="mt-3 rounded-xl bg-air/55 px-3 py-2 text-[11px] font-semibold leading-5 text-deep">
                          المسار المبلغ عنه: {result.advisor.routeIntelligence.routeDescription}
                        </p>
                      ) : null}
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {result.advisor.routeIntelligence.factors.map((factor) => (
                          <div key={factor.id} className="rounded-xl border border-outlinev bg-low/40 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-[11px] font-bold text-inkwell">{factor.label}</div>
                              <span className="rounded-full bg-cloud px-2 py-0.5 text-[9px] font-bold text-slate">
                                {factor.state === "COMPLEXITY"
                                  ? "يحتاج انتباه"
                                  : factor.state === "LOWER_COMPLEXITY"
                                    ? "أبسط حسب الوصف"
                                    : factor.state === "INFO"
                                      ? "سياق"
                                      : "غير مؤكد"}
                              </span>
                            </div>
                            <p className="mt-2 text-[10px] leading-5 text-slate">{factor.detail}</p>
                            <p className="mt-2 text-[10px] font-semibold leading-5 text-deep">التالي: {factor.nextAction}</p>
                          </div>
                        ))}
                      </div>
                      <details className="mt-3 text-[10px] leading-5 text-slate">
                        <summary className="cursor-pointer font-bold text-deep">حدود تحليل المسار</summary>
                        {result.advisor.routeIntelligence.limitations.map((note) => <p key={note} className="mt-1">{note}</p>)}
                      </details>
                    </div>
                  ) : null}

                  <div className="sila-window border border-outlinev bg-cloud p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold text-signal">بحث مباشر</div>
                        <h3 className="mt-1 text-lg font-bold text-inkwell">معلومات من الويب بمصادرها</h3>
                      </div>
                      <span className="rounded-full bg-low px-2.5 py-1 text-[10px] font-bold text-slate">
                        {result.advisor.liveResearch.status === "AVAILABLE"
                          ? "متاح الآن"
                          : result.advisor.liveResearch.status === "SOURCES_ONLY"
                            ? "مصادر فقط"
                            : result.advisor.liveResearch.status === "NOT_CONFIGURED"
                              ? "غير مفعّل"
                              : "تعذر مؤقتًا"}
                      </span>
                    </div>

                    {result.advisor.liveResearch.answer ? (
                      <p className="mt-4 whitespace-pre-line text-[13px] leading-7 text-inkwell/85">
                        {result.advisor.liveResearch.answer}
                      </p>
                    ) : (
                      <p className="mt-4 text-[12px] leading-6 text-slate">
                        {result.advisor.liveResearch.status === "NOT_CONFIGURED"
                          ? "البحث المباشر غير مفعّل في بيئة التشغيل الحالية؛ لا نحوله إلى إجابة متخيلة."
                          : result.advisor.liveResearch.status === "SOURCES_ONLY"
                            ? "وجدنا مصادر مباشرة، لكن لم نصدر تلخيصًا منها في هذه المحاولة."
                            : "لم نحصل على نتيجة بحث مباشرة قابلة للعرض في هذه المحاولة."}
                      </p>
                    )}

                    {result.advisor.liveResearch.sources.length ? (
                      <div className="mt-4 border-t border-outlinev pt-3">
                        <div className="text-[11px] font-bold text-inkwell">المصادر التي وصلنا إليها</div>
                        <div className="mt-2 space-y-2">
                          {result.advisor.liveResearch.sources.map((source) => (
                            <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] leading-6 text-signal underline underline-offset-4">
                              {source.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <p className="mt-3 text-[10px] leading-5 text-slate">آخر محاولة بحث: {time(result.advisor.liveResearch.checkedAt)}</p>
                  </div>

                  {result.advisor.offers.length ? (
                    <div className="sila-window border border-verified/20 bg-verifiedbg/20 p-5">
                      <div className="text-[11px] font-semibold text-verified">عروض صلة المطابقة</div>
                      <h3 className="mt-1 text-lg font-bold text-inkwell">خيارات موجودة فعلًا داخل المنصة</h3>
                      <div className="mt-4 space-y-3">
                        {result.advisor.offers.map((offer) => (
                          <a key={offer.id} href={offer.href} className="block rounded-xl border border-outlinev bg-cloud p-4 transition-colors hover:border-signal">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-bold text-inkwell">{offer.title}</div>
                                <div className="mt-1 text-[11px] text-slate">{offer.destination} · {offer.agentName}</div>
                              </div>
                              <div className="tnum text-sm font-bold text-deep">{money(offer.priceAmount, offer.currency)}</div>
                            </div>
                            <ul className="mt-3 list-inside list-disc space-y-1 text-[11px] leading-5 text-slate">
                              {offer.matchReasons.map((reason) => <li key={reason}>{reason}</li>)}
                            </ul>
                            <p className="mt-3 text-[11px] font-semibold leading-5 text-gold">{offer.confirmationNeeded.join(" ")}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : result.advisor.offerSearchStatus === "NO_MATCH" ? (
                    <div className="rounded-xl border border-outlinev bg-low p-4 text-[12px] leading-6 text-slate">
                      لا يوجد عرض منشور يطابق الوجهة الحالية الآن. لم ننشئ عرضًا تجريبيًا بدلًا منه.
                    </div>
                  ) : null}
                </>
              ) : null}

              {result.checklist.map((item) => (
                <article
                  key={item.id}
                  className={
                    "sila-window border p-5 " +
                    (item.status === "VERIFIED"
                      ? "border-verified/20 bg-verifiedbg/30"
                      : item.status === "BLOCKED"
                        ? "border-error/20 bg-errorbg/40"
                        : "border-outlinev bg-cloud")
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-bold text-inkwell">{item.title}</h3>
                    <span className="rounded-full bg-low px-2.5 py-1 text-[10px] font-bold text-slate">
                      {ITEM_STATUS[item.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-6 text-slate">{item.description}</p>
                  <dl className="mt-3 grid gap-2 border-t border-outlinev pt-3 text-[11px] leading-6">
                    <div>
                      <dt className="inline font-bold text-inkwell">المصدر: </dt>
                      <dd className="inline">
                        {item.evidence.source.reference ? (
                          <a href={item.evidence.source.reference} target="_blank" rel="noopener noreferrer" className="text-signal underline underline-offset-4">
                            {item.evidence.source.label}
                          </a>
                        ) : item.evidence.source.label}
                        {" · "}{EVIDENCE_STATUS[item.evidence.status]}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-bold text-inkwell">نطاق الدليل: </dt>
                      <dd className="inline">{item.evidence.scope.length ? item.evidence.scope.join(" · ") : "غير محدد، لا يثبت الحكم"}</dd>
                    </div>
                    <div>
                      <dt className="inline font-bold text-inkwell">آخر فحص مسجل: </dt>
                      <dd className="inline">{time(item.evidence.checkedAt)}</dd>
                    </div>
                    <div>
                      <dt className="inline font-bold text-inkwell">صلاحية المصدر: </dt>
                      <dd className="inline">{item.evidence.validUntil ? time(item.evidence.validUntil) : "لم يُحدد تاريخ انتهاء؛ يلزم إعادة التأكيد قبل السفر"}</dd>
                    </div>
                  </dl>
                  <details className="mt-2 text-[11px] leading-6 text-slate">
                    <summary className="cursor-pointer font-bold text-deep">وقت جمع الدليل وما لم يتم التحقق منه</summary>
                    <p>الرصد: {time(item.evidence.observedAt)} · التحقق: {time(item.evidence.verifiedAt)}</p>
                    {item.evidence.limitations.map((note) => <p key={note}>{note}</p>)}
                  </details>
                  <p className="mt-3 rounded-xl bg-air/60 px-3 py-2 text-[12px] font-semibold leading-6 text-deep">
                    الخطوة التالية: {item.nextAction}
                  </p>
                </article>
              ))}

              {result.warnings.length ? (
                <div className="sila-window border border-gold/20 bg-amber/30 p-4">
                  <h3 className="text-sm font-bold text-gold">تنبيهات تحتاج مراجعة</h3>
                  {result.warnings.map((warning) => <p key={warning} className="mt-2 text-[12px] leading-6 text-slate">{warning}</p>)}
                </div>
              ) : null}

              {result.missingInformation.length ? (
                <div className="sila-window border border-outlinev bg-cloud p-4">
                  <h3 className="text-sm font-bold text-inkwell">بيانات تساعد على التأكيد</h3>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-[12px] leading-6 text-slate">
                    {result.missingInformation.map((info) => <li key={info}>{info}</li>)}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-xl bg-low p-4 text-[11px] leading-6 text-slate">
                <p>{result.disclosure}</p>
                <p className="mt-2">خارج نطاق الفحص: {result.decisionScope.excluded.join(" · ")}.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
