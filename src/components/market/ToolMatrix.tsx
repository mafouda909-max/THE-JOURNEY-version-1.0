"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import type { ToolState } from "@/lib/tools";

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  CONNECTED: { label: "متاحة · فحص ناجح", cls: "bg-verifiedbg text-verified" },
  NOT_CONFIGURED: { label: "تحتاج إعدادًا", cls: "bg-low text-slate" },
  CONFIGURATION_REQUIRED: { label: "تحتاج تأكيد الإعداد", cls: "bg-amber text-gold" },
  GATED: { label: "موقوفة بإعداد المرحلة", cls: "bg-air text-deep" },
  PLANNED: { label: "لم تُنفّذ بعد", cls: "bg-low text-slate" },
  DEGRADED: { label: "الاتصال غير متاح", cls: "bg-errorbg text-error" },
};
const FILTERS = [{ key: "implemented", label: "القدرات المنفّذة" }, { key: "ready", label: "المتاحة" }, { key: "blocked", label: "تحتاج تدخلًا" }, { key: "planned", label: "قيد التطوير" }] as const;
const TRUST: Record<string, string> = { first_party: "بيانات صلة", untrusted_external: "محتوى خارجي يحتاج تحققًا", supplier_evidence: "دليل من المورد", delivery_channel: "قناة إرسال" };
const DATA: Record<string, string> = { public: "عامة", account: "بيانات الحساب", private: "خاصة", financial: "مالية" };
class ToolsRequestError extends Error {}

async function requestTools(force: boolean, signal?: AbortSignal): Promise<ToolState[]> {
  const response = await fetch("/api/tools", { method: force ? "POST" : "GET", cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
  if (!response.ok) throw new ToolsRequestError(response.status === 401 || response.status === 403 ? "انتهت صلاحية الجلسة الإدارية. سجّل الدخول من جديد." : response.status === 429 ? "فحوصات كثيرة. انتظر قليلًا ثم أعد المحاولة." : "تعذر تحميل حالة التشغيل. أعد المحاولة بعد قليل.");
  const data = await response.json() as { tools?: ToolState[] };
  if (!Array.isArray(data.tools)) throw new ToolsRequestError("تعذر قراءة حالة التشغيل. أعد المحاولة.");
  return data.tools;
}
const requestError = (error: unknown) => error instanceof ToolsRequestError ? error.message : "تعذر الاتصال بالخدمة. أعد المحاولة بعد قليل.";

export function ToolMatrix() {
  const [tools, setTools] = useState<ToolState[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<typeof FILTERS[number]["key"]>("implemented");

  const load = useCallback(async (force: boolean, signal?: AbortSignal) => {
    setBusy(true);
    setError(null);
    try {
      const tools = await requestTools(force, signal);
      if (!signal?.aborted) setTools(tools);
    } catch (err) {
      if (!signal?.aborted) setError(requestError(err));
    } finally { if (!signal?.aborted) setBusy(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void requestTools(false, controller.signal)
      .then((tools) => { if (!controller.signal.aborted) setTools(tools); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setError(requestError(error)); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, []);

  const ready = tools?.filter((item) => item.ready).length ?? 0;
  const blocked = tools?.filter((item) => item.implemented && !item.ready).length ?? 0;
  const planned = tools?.filter((item) => !item.implemented).length ?? 0;
  const visible = tools?.filter((item) => filter === "ready" ? item.ready : filter === "planned" ? !item.implemented : filter === "blocked" ? item.implemented && !item.ready : item.implemented) ?? [];

  return <section aria-labelledby="capability-title" className="mt-16 border-t border-outlinev pt-10">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="sila-eyebrow text-[11px] font-semibold text-signal">التشغيل الفعلي</div>
        <h2 id="capability-title" className="mt-2 text-2xl font-bold text-inkwell md:text-3xl">قدرات صلة</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate">اعرف الخدمة المتاحة، وما يحتاج تدخلًا، وما لم يُنفّذ بعد. نجاح الاتصال لا يمنح المستخدم صلاحية جديدة.</p>
      </div>
      <button type="button" onClick={() => void load(Boolean(tools))} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outlinev bg-cloud px-4 py-3 text-sm font-bold text-deep hover:bg-air disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{tools ? "تحديث الفحص" : "إعادة المحاولة"}
      </button>
    </div>
    {error ? <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-error/20 bg-errorbg p-4 text-sm leading-7 text-error"><AlertCircle className="mt-1 h-4 w-4 shrink-0" />{error}</p> : null}
    {!tools && busy ? <p role="status" className="mt-5 flex items-center gap-2 py-6 text-sm text-slate"><Loader2 className="h-4 w-4 animate-spin" />جارٍ فحص الخدمات…</p> : null}
    {tools ? <>
      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        {[{ label: "متاحة", count: ready, Icon: CheckCircle2, color: "text-verified" }, { label: "تحتاج تدخلًا", count: blocked, Icon: Activity, color: "text-deep" }, { label: "قيد التطوير", count: planned, Icon: ChevronDown, color: "text-slate" }].map(({ label, count, Icon, color }) => <div key={label} className="sila-window border border-outlinev bg-cloud p-3 sm:p-5"><Icon className={`h-4 w-4 ${color}`} /><div className="mt-3 text-2xl font-bold text-inkwell">{count.toLocaleString("ar-EG")}</div><div className="mt-1 text-[11px] font-semibold text-slate sm:text-sm">{label}</div></div>)}
      </div>
      <div className="mt-6 flex flex-wrap gap-2" aria-label="تصفية القدرات">
        {FILTERS.map((item) => <button type="button" key={item.key} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold sm:text-sm ${filter === item.key ? "bg-deep text-white" : "border border-outlinev bg-cloud text-slate hover:bg-air"}`}>{item.label}</button>)}
      </div>
      <div className="mt-4 divide-y divide-outlinev overflow-hidden rounded-3xl border border-outlinev bg-cloud">
        {visible.map((item) => {
          const status = STATUS_UI[item.status] ?? STATUS_UI.NOT_CONFIGURED;
          return <article key={item.id} className="p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-bold text-inkwell">{item.name}</h3><span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status.cls}`}>{status.label}</span></div>
            <p className="mt-2 text-sm leading-7 text-slate">{item.description}</p>
            {!item.ready ? <p className="mt-3 border-s-2 border-air ps-3 text-sm leading-7 text-deep">{item.status === "GATED" ? "التفعيل مقصود بإعداد المرحلة. تأكد من جاهزية المورد قبل تشغيل الخدمة." : item.status === "PLANNED" ? "تحتاج تنفيذ محول واختباره قبل ظهورها كخدمة متاحة." : item.prerequisites.join(" · ")}</p> : null}
            <details className="mt-4 text-xs text-slate"><summary className="min-h-11 cursor-pointer select-none py-3 font-semibold text-deep">تفاصيل التشغيل والبيانات</summary>
              <dl className="grid grid-cols-1 gap-3 rounded-2xl bg-low/60 p-4 sm:grid-cols-2">
                {[ ["المورد", item.provider ?? "لم يُحدد"], ["نطاق البيانات", DATA[item.sensitivity]], ["نوع الدليل", TRUST[item.trust]], ["الصلاحية", item.readOnly ? "قراءة فقط" : "تمر بإذن الخدمة وقواعدها"], ["مهلة الاستدعاء", `${item.policy.callTimeoutMs / 1000} ثوانٍ`], ["إعادة المحاولة", item.readOnly ? String(item.policy.retries) : "لا تُعاد الكتابة تلقائيًا"], ["آخر فحص", item.checkedAt ? new Date(item.checkedAt).toLocaleTimeString("ar-EG") : "لم يحدث"], ["آخر نجاح في جلسة التشغيل", item.lastSuccessAt ? new Date(item.lastSuccessAt).toLocaleTimeString("ar-EG") : "لم يُرصد"], ["حماية تكرار الفشل", item.circuit === "open" ? "الاتصال موقوف مؤقتًا" : "جاهزة للمراقبة"], ["رمز الحالة", item.failureCode ?? "OK"] ].map(([label, value]) => <div key={label}><dt className="font-semibold text-slate">{label}</dt><dd className="mt-1 break-words text-inkwell">{value}</dd></div>)}
              </dl>
              {item.missing.length ? <p dir="ltr" className="mt-3 break-words text-left font-mono leading-6">{item.missing.join(", ")}</p> : null}
            </details>
          </article>;
        })}
        {!visible.length ? <p role="status" className="p-6 text-sm text-slate">لا توجد قدرات في هذه المجموعة حاليًا.</p> : null}
      </div>
      <p className="mt-4 text-xs leading-6 text-slate">الفحص للقراءة فقط. تحديثه الصريح يسجّل حالة القدرات في سجل التدقيق؛ القياس يحفظ الحالة والمدة فقط. آخر نجاح هنا يخص جلسة الخادم الحالية.</p>
    </> : null}
  </section>;
}
