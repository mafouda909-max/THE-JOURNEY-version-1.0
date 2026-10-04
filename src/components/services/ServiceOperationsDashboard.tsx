"use client";

import { useCallback, useEffect, useState } from "react";
import { ServiceFulfillmentPanel } from "./ServiceFulfillmentPanel";
import { exactServiceMoney, type ServiceOperationsReport } from "@/lib/service-operations-domain";

export function ServiceOperationsDashboard({ workspaceId, canManage }: { workspaceId: number; canManage: boolean }) {
  const [version, setVersion] = useState(0);
  const update = useCallback(() => setVersion((current) => current + 1), []);
  return <>
    <OperationsSummary key={version} workspaceId={workspaceId} onRefresh={update} />
    <p className="mt-5 text-sm leading-relaxed text-slate">التكليفات التالية هي أحدث ١٠٠ تكليف بالمكتب. المؤشرات أعلاه تشمل جميع السجلات. افتح الفرصة التجارية لإضافة تكليف جديد.</p>
    <ServiceFulfillmentPanel workspaceId={workspaceId} canManage={canManage} onUpdated={update} />
  </>;
}

function OperationsSummary({ workspaceId, onRefresh }: { workspaceId: number; onRefresh: () => void }) {
  const [report, setReport] = useState<ServiceOperationsReport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/agency/workspaces/" + workspaceId + "/service-orders/operations", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { report?: ServiceOperationsReport; error?: string };
        if (!response.ok || !data.report) throw new Error(data.error ?? "تعذر تحميل متابعة المكتب.");
        if (!controller.signal.aborted) setReport(data.report);
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "تعذر الاتصال."); });
    return () => controller.abort();
  }, [workspaceId]);

  if (error) return <div role="alert" className="rounded-xl border border-error/20 bg-errorbg p-4 text-sm text-error">{error}<button className="mr-3 min-h-11 underline" onClick={onRefresh}>إعادة المحاولة</button></div>;
  if (!report) return <p role="status" className="rounded-xl border border-outlinev bg-white p-5 text-sm text-slate">جارٍ تحميل مؤشرات التنفيذ…</p>;
  const counts = report.counts;
  const percentage = (value: number | null) => value === null ? "لم يُقَس بعد" : new Intl.NumberFormat("ar-EG", { style: "percent", maximumFractionDigits: 1 }).format(value);
  return <section aria-labelledby="service-operations-title" className="min-w-0 rounded-2xl border border-outlinev bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 id="service-operations-title" className="text-2xl font-bold text-inkwell">متابعة التشغيل والتحصيل</h2><p className="mt-2 text-sm leading-relaxed text-slate">جميع تكليفات هذا المكتب المسجلة، بما فيها الإلغاء والاعتذار وإعادة التكليف.</p></div>
      <button className="min-h-11 rounded-lg border border-outlinev px-4 py-2 text-sm font-bold text-deep" onClick={onRefresh}>تحديث المؤشرات</button>
    </div>
    <p className="mt-2 text-xs text-slate">آخر قراءة: {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.observedAt))}</p>
    <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="الفرص التجارية" value={String(counts.opportunities)} detail={counts.assignments + " تكليف؛ إعادة التكليف لا تُنشئ فرصة جديدة"} />
      <Metric label="ينتظر موافقة الشريك" value={String(counts.awaitingPartner)} detail={counts.inProgress + " قيد التنفيذ أو مطلوب تعديل"} />
      <Metric label="ينتظر مراجعة المكتب" value={String(counts.awaitingReview)} detail={counts.completed + " تسليمًا مقبولًا"} />
      <Metric label="طلبات تجاوزت موعدها" value={String(counts.overdue)} detail="طلبات مفتوحة تحتاج متابعة" attention={counts.overdue > 0} />
      <Metric label="التسليم في الموعد" value={percentage(report.rates.onTime)} detail={counts.onTimeCompleted + " من " + counts.evaluatedAccepted + " طلبًا قابلًا للتقييم"} />
      <Metric label="طلبات سُجل لها تعديل" value={percentage(report.rates.rework)} detail={counts.reworked + " من " + counts.accepted + " تكليفًا قبله الشركاء"} />
      <Metric label="فرص لها تحصيل مسجل" value={String(counts.paidOpportunities)} detail="صافي رسوم موجب بعد الاستردادات" />
      <Metric label="طلبات مكتملة برصيد رسوم" value={String(counts.completedWithFeeBalance)} detail="قبول التسليم مستقل عن التحصيل" attention={counts.completedWithFeeBalance > 0} />
    </dl>
    <p className="mt-4 text-xs leading-relaxed text-slate">التسليم في الموعد يُقاس للتكليفات المقبولة التي اكتملت أو أُلغيت أو حل موعدها. الطلب المفتوح الذي لم يحل موعده ينتظر القياس. نسبة التعديل تشمل كل تعديل مسجل؛ تصنيف التعديل الجوهري يحتاج مراجعة.</p>
    <h3 className="mt-6 text-lg font-bold text-inkwell">اقتصاديات صلة المسجلة</h3>
    {report.currencies.length === 0 ? <p className="mt-3 text-sm text-slate">لا توجد تكليفات أو مبالغ مسجلة في هذه المساحة بعد.</p> : <div className="mt-3 space-y-3">{report.currencies.map((entry) => <div key={entry.currency} role="group" aria-label={"الأموال المسجلة " + entry.currency} className="min-w-0 rounded-xl bg-low p-4">
      <h4 className="font-bold text-deep">{entry.currency}</h4>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MoneyMetric label="إجمالي التحصيل المسجل" value={entry.collectedMinor} currency={entry.currency} />
        <MoneyMetric label="الاستردادات المسجلة" value={entry.refundedMinor} currency={entry.currency} />
        <MoneyMetric label="صافي رسوم صلة" value={entry.netCollectedMinor} currency={entry.currency} />
        <MoneyMetric label="تكلفة التشغيل المسجلة" value={entry.directCostMinor} currency={entry.currency} />
        <MoneyMetric label="المساهمة النقدية المسجلة" value={entry.cashContributionMinor} currency={entry.currency} />
        <MoneyMetric label="رصيد رسوم الطلبات المكتملة" value={entry.completedFeeBalanceMinor} currency={entry.currency} />
      </dl>
    </div>)}</div>}
    <p className="mt-4 text-sm leading-relaxed text-slate">المساهمة = صافي رسوم صلة − تكاليف التشغيل المسجلة لكل التكليفات، بما فيها الفاشلة والملغاة. مبالغ المورد تخص اتفاق المكتب معه. العملات تُعرض منفصلة.</p>
    <p className="mt-3 rounded-lg border border-outlinev p-3 text-xs leading-relaxed text-slate">تقييم الربح والتوسع يحتاج مراجعة اكتمال التكاليف، ووقت التشغيل والدعم، وتكلفة الحصول على المكاتب، وتأهيل الشركاء وسجل إعادة الشراء. هذه البيانات تحتاج سجل التجربة ومراجعته.</p>
  </section>;
}

function Metric({ label, value, detail, attention = false }: { label: string; value: string; detail: string; attention?: boolean }) {
  return <div className={attention ? "min-w-0 rounded-xl border border-gold/25 bg-amber p-4" : "min-w-0 rounded-xl bg-low p-4"}><dt className="text-xs text-slate">{label}</dt><dd className="mt-2"><span className="text-2xl font-bold text-inkwell">{value}</span><p className="mt-2 text-xs leading-relaxed text-slate">{detail}</p></dd></div>;
}
function MoneyMetric({ label, value, currency }: { label: string; value: string; currency: string }) {
  return <div className="min-w-0"><dt className="text-xs text-slate">{label}</dt><dd dir="ltr" className="mt-1 break-words text-right font-mono text-sm font-bold text-inkwell">{exactServiceMoney(value, currency)}</dd></div>;
}
