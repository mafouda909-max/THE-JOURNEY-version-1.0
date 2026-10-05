"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { SilaReviewIcon } from "@/components/brand/SilaIcons";
import { isReadinessResponse, type ReadinessResponse } from "@/lib/readiness-contract";

const STATUS = {
  READY: ["جاهز ضمن نطاق الفحص", "bg-verifiedbg text-verified"],
  NEEDS_ATTENTION: ["يحتاج إجراء", "bg-amber text-gold"],
  NEEDS_CONFIRMATION: ["يحتاج تأكيدًا", "bg-amber text-gold"],
  BLOCKED: ["يوجد مانع حسب البيانات المدخلة", "bg-errorbg text-error"],
  UNKNOWN: ["غير معروف بعد", "bg-low text-slate"],
} as const;
const ITEM_STATUS = { VERIFIED: "حكم مثبت ضمن النطاق", PENDING_ACTION: "يحتاج إجراء", PENDING_CONFIRMATION: "يحتاج تأكيدًا", BLOCKED: "يوجد مانع", UNKNOWN: "غير معروف بعد" };
const EVIDENCE_STATUS = { VERIFIED: "دليل مطابق للنطاق", REPORTED: "بيانات مقدمة", UNCONFIRMED: "لم يثبت الحكم", STALE: "يحتاج تحديثًا", EXPIRED: "منتهي الصلاحية", CONFLICTED: "مصادر تحتاج مراجعة", UNKNOWN: "الدليل غير متاح" };
function time(value: string | null) {
  return value ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC" : "غير مسجل";
}
export function TravelReadinessWorkbench({ initial }: { initial?: { destination?: string | null; intentLabel?: string | null } }) {
  const [loading, setLoading] = useState(false), [result, setResult] = useState<ReadinessResponse | null>(null), [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { const current = active.current; active.current = null; current?.abort(); }, []);
  function changed() {
    const current = active.current; active.current = null; current?.abort();
    setLoading(false); setResult(null); setError(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(null); setResult(null);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 23_000);
    try {
      const response = await fetch("/api/travel/readiness", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal,
        body: JSON.stringify({ nationality: data.get("nationality"), destination: data.get("destination"), passportValidityMonths: data.get("passportValidityMonths"), transitCountry: data.get("transitCountry"), travelPurpose: data.get("travelPurpose"), travelDate: data.get("travelDate") }),
      });
      const json: unknown = await response.json();
      if (!response.ok) throw new Error(json && typeof json === "object" && "error" in json && typeof json.error === "string" ? json.error : "تعذر فحص المصادر. حاول مجددًا.");
      if (!isReadinessResponse(json)) throw new Error("لم تصل نتيجة مكتملة يمكن الاعتماد عليها. أعد الفحص.");
      if (active.current === controller) setResult(json);
    } catch (failure) {
      if (active.current !== controller) return;
      setError(timedOut ? "استغرق الفحص وقتًا طويلًا. لم تصدر نتيجة؛ حاول مجددًا." : failure instanceof Error && failure.name === "Error" ? failure.message : "تعذر الاتصال بالمصادر. لم تصدر نتيجة؛ حاول مجددًا.");
    } finally {
      clearTimeout(timer);
      if (active.current === controller) { active.current = null; setLoading(false); }
    }
  }
  const field = "w-full rounded-xl border border-outlinev bg-low/60 px-4 py-3 text-sm font-semibold text-inkwell outline-none focus:border-signal focus:bg-cloud focus:ring-4 focus:ring-signal/10";
  const label = "mb-1.5 block text-[12px] font-bold text-inkwell";
  return <div className="space-y-4">
    {initial?.intentLabel ? <div className="sila-window border border-sky/40 bg-air/45 px-4 py-3 text-[12px] font-semibold text-deep">فحص الجاهزية مرتبط بنية السفر: {initial.intentLabel}. أكمل البيانات التي لا نفترضها عنك.</div> : null}
    <div className="grid gap-6 lg:grid-cols-[.78fr_1.22fr]">
      <form onSubmit={submit} onChange={changed} aria-busy={loading} className="sila-window h-fit border border-outlinev bg-cloud p-5 lg:sticky lg:top-28">
        <div className="sila-eyebrow text-[11px] font-semibold text-signal">اعرف ما ثبت وما يحتاج تأكيدًا</div>
        <h2 className="mt-2 text-xl font-bold text-inkwell">افحص جاهزيتك.</h2>
        <p className="mt-2 text-[12px] leading-6 text-slate">الفحص الحالي لجواز السفر العادي. لا نفترض جنسيتك أو شروط صلاحية الجواز أو التأشيرة.</p>
        <div className="mt-5 space-y-4">
          <div><label htmlFor="readiness-nationality" className={label}>الجنسية</label><input id="readiness-nationality" name="nationality" required minLength={2} maxLength={64} placeholder="الجنسية" className={field} /></div>
          <div><label htmlFor="readiness-destination" className={label}>وجهة السفر</label><input id="readiness-destination" name="destination" required minLength={2} maxLength={64} defaultValue={initial?.destination ?? ""} placeholder="وجهة السفر" className={field} /></div>
          <div><label htmlFor="readiness-passport" className={label}>صلاحية الجواز المتبقية بالأشهر</label><input id="readiness-passport" name="passportValidityMonths" type="number" required min={0} max={120} step="0.5" placeholder="مثال: 12" className={field} /></div>
          <div><label htmlFor="readiness-transit" className={label}>دولة الترانزيت إن وجدت</label><input id="readiness-transit" name="transitCountry" maxLength={64} placeholder="اختياري" className={field} /></div>
          <div><label htmlFor="readiness-purpose" className={label}>الغرض من السفر</label><select id="readiness-purpose" name="travelPurpose" className={field} defaultValue=""><option value="">لم أحدد بعد</option><option value="tourism">سياحة</option><option value="business">عمل</option><option value="study">دراسة</option><option value="visit">زيارة</option><option value="medical">علاج</option><option value="other">غرض آخر يحتاج تأكيدًا</option></select></div>
          <div><label htmlFor="readiness-date" className={label}>تاريخ السفر إن تحدد</label><input id="readiness-date" name="travelDate" type="date" className={field} /></div>
        </div>
        <button type="submit" disabled={loading} className="sila-interactive mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white hover:bg-horizon disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <SilaReviewIcon className="h-4 w-4" />}{loading ? "نفحص المصادر…" : "افحص الجاهزية"}
        </button>
        {error ? <div role="alert" aria-label="خطأ فحص الجاهزية" className="mt-4 rounded-xl bg-errorbg px-4 py-3 text-[12px] font-semibold text-error">{error}</div> : null}
      </form>
      <section aria-label="نتيجة جاهزية السفر" aria-live="polite">
        {!result ? <div className="sila-window flex min-h-[260px] items-center justify-center border border-dashed border-outlinev bg-cloud p-6 text-center"><div className="max-w-lg"><SilaReviewIcon className="mx-auto h-8 w-8 text-signal" /><h2 className="mt-4 text-xl font-bold text-inkwell">الـChecklist تتكوّن من سياقك أنت.</h2><p className="mt-2 text-sm leading-7 text-slate">لكل بند: الدليل، نطاقه، آخر فحص مسجل والخطوة التالية. عدم توفر دليل يعني أن الحكم غير معروف بعد.</p></div></div> : <div className="space-y-4">
          <div className="sila-window border border-outlinev bg-cloud p-5"><div className="text-[11px] font-semibold text-slate">حالة الجاهزية</div><h2 className="mt-2 text-2xl font-bold text-inkwell">{STATUS[result.status][0]}</h2><p className="mt-3 text-[11px] leading-6 text-slate">وقت الفحص: {time(result.evaluatedAt)}. النتيجة تخص البنود المعروضة فقط.</p></div>
          {result.checklist.map(item => <article key={item.id} className={"sila-window border p-5 " + (item.status === "VERIFIED" ? "border-verified/20 bg-verifiedbg/30" : item.status === "BLOCKED" ? "border-error/20 bg-errorbg/40" : "border-outlinev bg-cloud")}>
            <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-bold text-inkwell">{item.title}</h3><span className="rounded-full bg-low px-2.5 py-1 text-[10px] font-bold text-slate">{ITEM_STATUS[item.status]}</span></div>
            <p className="mt-2 text-[12px] leading-6 text-slate">{item.description}</p>
            <dl className="mt-3 grid gap-2 border-t border-outlinev pt-3 text-[11px] leading-6">
              <div><dt className="inline font-bold text-inkwell">المصدر: </dt><dd className="inline">{item.evidence.source.reference ? <a href={item.evidence.source.reference} target="_blank" rel="noopener noreferrer" className="text-signal underline underline-offset-4">{item.evidence.source.label}</a> : item.evidence.source.label} · {EVIDENCE_STATUS[item.evidence.status]}</dd></div>
              <div><dt className="inline font-bold text-inkwell">نطاق الدليل: </dt><dd className="inline">{item.evidence.scope.length ? item.evidence.scope.join(" · ") : "غير محدد، لا يثبت الحكم"}</dd></div>
              <div><dt className="inline font-bold text-inkwell">آخر فحص مسجل: </dt><dd className="inline">{time(item.evidence.checkedAt)}</dd></div>
              <div><dt className="inline font-bold text-inkwell">صلاحية المصدر: </dt><dd className="inline">{item.evidence.validUntil ? time(item.evidence.validUntil) : "لم يُحدد تاريخ انتهاء؛ يلزم إعادة التأكيد قبل السفر"}</dd></div>
            </dl>
            <details className="mt-2 text-[11px] leading-6 text-slate"><summary className="cursor-pointer font-bold text-deep">وقت جمع الدليل وما لم يتم التحقق منه</summary><p>الرصد: {time(item.evidence.observedAt)} · التحقق: {time(item.evidence.verifiedAt)}</p>{item.evidence.limitations.map(note => <p key={note}>{note}</p>)}</details>
            <p className="mt-3 rounded-xl bg-air/60 px-3 py-2 text-[12px] font-semibold leading-6 text-deep">الخطوة التالية: {item.nextAction}</p>
          </article>)}
          {result.warnings.length ? <div className="sila-window border border-gold/20 bg-amber/30 p-4"><h3 className="text-sm font-bold text-gold">تنبيهات تحتاج مراجعة</h3>{result.warnings.map(warning => <p key={warning} className="mt-2 text-[12px] leading-6 text-slate">{warning}</p>)}</div> : null}
          {result.missingInformation.length ? <div className="sila-window border border-outlinev bg-cloud p-4"><h3 className="text-sm font-bold text-inkwell">بيانات تساعد على التأكيد</h3><ul className="mt-2 list-inside list-disc space-y-1 text-[12px] leading-6 text-slate">{result.missingInformation.map(info => <li key={info}>{info}</li>)}</ul></div> : null}
          <div className="rounded-xl bg-low p-4 text-[11px] leading-6 text-slate"><p>{result.disclosure}</p><p className="mt-2">خارج نطاق الفحص: {result.decisionScope.excluded.join(" · ")}.</p></div>
        </div>}
      </section>
    </div>
  </div>;
}
