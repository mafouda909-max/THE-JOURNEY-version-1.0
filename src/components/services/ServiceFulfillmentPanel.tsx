"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  serviceStatusLabels, serviceActionLabels, type ServiceAudience, type ServiceOrderView,
} from "@/lib/service-fulfillment-domain";

type Supplier = { supplierOptionId: number; label: string; currency: string };
type Data = { orders: ServiceOrderView[]; eligibleSuppliers: Supplier[]; error?: string };
const inputClass = "mt-1 w-full min-w-0 scroll-mt-28 rounded-lg border border-outlinev bg-white px-3 py-2.5 text-base text-inkwell focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 sm:text-sm";
const buttonClass = "min-h-11 rounded-lg bg-deep px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("ar-EG", { style: "currency", currency }).format(value / 100);
}
function date(value: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function minor(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("أدخل مبلغًا موجبًا بدقة منزلتين عشريتين كحد أقصى.");
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("المبلغ أكبر من الحد المسموح.");
  return Number(result);
}

export function ServiceFulfillmentPanel({
  audience = "office", workspaceId, opportunityId, canManage = false,
}: { audience?: ServiceAudience; workspaceId?: number; opportunityId?: number; canManage?: boolean }) {
  const endpoint = audience === "office" ? `/api/agency/workspaces/${workspaceId}/service-orders` : "/api/partner/service-orders";
  const readUrl = endpoint + (opportunityId ? `?opportunityId=${opportunityId}` : "");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [create, setCreate] = useState({ supplier: "", email: "", scope: "", acceptance: "", qualification: "", due: "", fee: "", consent: false });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [deliveries, setDeliveries] = useState<Record<number, string>>({});
  const [finance, setFinance] = useState<Record<number, { amount: string; reference: string; note: string }>>({});
  const [links, setLinks] = useState<Record<number, { url: string; expiresAt: string }>>({});
  const requestIds = useRef(new Map<string, string>());

  const refresh = useCallback(async () => {
    const response = await fetch(readUrl, { cache: "no-store" });
    const next = await response.json() as Data;
    if (!response.ok) throw new Error(next.error ?? "تعذر تحميل الطلبات.");
    setData(next);
  }, [readUrl]);

  useEffect(() => {
    let mounted = true;
    fetch(readUrl, { cache: "no-store" })
      .then(async (response) => {
        const next = await response.json() as Data;
        if (!response.ok) throw new Error(next.error ?? "تعذر تحميل الطلبات.");
        if (mounted) { setData(next); setError(""); }
      })
      .catch((cause: unknown) => { if (mounted) setError(cause instanceof Error ? cause.message : "تعذر تحميل الطلبات."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [readUrl]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setSuccess("");
    const signature = JSON.stringify(payload);
    const requestId = requestIds.current.get(signature) ?? crypto.randomUUID();
    requestIds.current.set(signature, requestId);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, requestId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        if (response.status < 500) requestIds.current.delete(signature);
        if (response.status === 409) await refresh();
        throw new Error(result.error ?? "تعذر تسجيل الإجراء.");
      }
      await refresh();
      requestIds.current.delete(signature);
      setSuccess("تم تسجيل الإجراء وتحديث الطلب.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر الاتصال. أعد نفس الإجراء لإكمال المحاولة.");
      return false;
    } finally { setBusy(false); }
  }

  async function createOrder(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (!create.due || Number.isNaN(Date.parse(create.due))) throw new Error("أدخل موعد تسليم صالحًا.");
      const completed = await act({ command: "create_order", opportunityId, supplierOptionId: Number(create.supplier), partnerEmail: create.email, scope: create.scope,
        acceptanceCriteria: create.acceptance, qualificationReference: create.qualification, dueAt: new Date(create.due).toISOString(), silaFeeMinor: minor(create.fee), confirmScopeSharing: create.consent });
      if (completed) setCreating(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "راجع بيانات الطلب."); }
  }

  async function recordMoney(order: ServiceOrderView, command: string) {
    try {
      const entry = finance[order.id];
      if (!entry) throw new Error("أكمل مبلغ العملية ومرجع الإثبات والملاحظة.");
      const done = await act({ command, orderId: order.id, expectedRevision: order.revision, amountMinor: minor(entry.amount), reference: entry.reference, note: entry.note });
      if (done) setFinance((current) => ({ ...current, [order.id]: { amount: "", reference: "", note: "" } }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "راجع مبلغ العملية."); }
  }

  async function manageLink(order: ServiceOrderView, command: "issue" | "revoke") {
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`${endpoint}/${order.id}/status-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command, expectedRevision: order.revision }) });
      const result = await response.json() as { error?: string; token?: string; expiresAt?: string };
      if (!response.ok) throw new Error(result.error ?? "تعذر إدارة الرابط.");
      if (command === "issue" && result.token && result.expiresAt) setLinks((current) => ({ ...current, [order.id]: { url: `${window.location.origin}/s/${result.token}`, expiresAt: result.expiresAt! } }));
      else setLinks((current) => { const next = { ...current }; delete next[order.id]; return next; });
      setSuccess(command === "issue" ? "صدر رابط جديد وأُلغي أي رابط سابق لهذا الطلب." : "أُلغي رابط متابعة العميل.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الاتصال. إصدار رابط جديد يلغي أي رابط سابق."); }
    finally { setBusy(false); }
  }

  const overdueCount = data?.orders.filter((order) => order.overdue).length ?? 0;
  return (
    <section className="my-6 min-w-0 rounded-2xl border border-outlinev bg-white p-4 sm:p-6" aria-labelledby="service-fulfillment-title" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-slate">صلة · تنفيذ الخدمات</p>
          <h2 id="service-fulfillment-title" className="mt-1 text-2xl font-bold text-inkwell">{audience === "office" ? "من الموافقة إلى التسليم" : "مهام التنفيذ"}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">{audience === "office" ? "حدد نطاقًا واضحًا، وكلّف الشريك، وراجع ناتج الخدمة. حالة التنفيذ مستقلة عن رسوم صلة." : "راجع المطلوب والسعر والموعد قبل قبول المهمة. سلّم العمل وفق معيار القبول المتفق عليه."}</p>
        </div>
        {canManage && opportunityId && !!data?.eligibleSuppliers.length && <button className={buttonClass} disabled={busy} onClick={() => setCreating(!creating)}>{creating ? "إغلاق نموذج التكليف" : "تكليف شريك"}</button>}
      </header>
      <div aria-live="polite" className="mt-4">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error} <button className="mr-2 underline" disabled={busy} onClick={() => { void refresh().then(() => setError("")).catch((cause: Error) => setError(cause.message)); }}>إعادة التحميل</button></p>}
        {success && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
        {overdueCount > 0 && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{overdueCount} طلب تجاوز موعده ويحتاج متابعة مع الشريك.</p>}
      </div>
      {creating && <form onSubmit={createOrder} className="mt-5 grid min-w-0 grid-cols-1 gap-4 rounded-xl bg-low p-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">بند الخدمة المعتمد<select required className={inputClass} value={create.supplier} onChange={(e) => setCreate({ ...create, supplier: e.target.value })}><option value="">اختر الخدمة</option>{data?.eligibleSuppliers.map((supplier) => <option key={supplier.supplierOptionId} value={supplier.supplierOptionId}>{supplier.label} · {supplier.currency}</option>)}</select></label>
        <label className="text-sm font-semibold">بريد حساب الشريك<input required type="email" autoComplete="off" dir="ltr" className={inputClass} value={create.email} onChange={(e) => setCreate({ ...create, email: e.target.value })} /></label>
        <label className="text-sm font-semibold sm:col-span-2">المطلوب من الشريك<textarea required maxLength={4000} rows={3} className={inputClass} value={create.scope} onChange={(e) => setCreate({ ...create, scope: e.target.value })} /></label>
        <label className="text-sm font-semibold sm:col-span-2">معيار قبول التسليم<textarea required maxLength={2000} rows={2} className={inputClass} value={create.acceptance} onChange={(e) => setCreate({ ...create, acceptance: e.target.value })} /></label>
        <label className="text-sm font-semibold sm:col-span-2">مرجع اتفاق الشريك أو مستند تأهيله<input required maxLength={1000} className={inputClass} value={create.qualification} onChange={(e) => setCreate({ ...create, qualification: e.target.value })} /><span className="mt-1 block text-xs font-normal leading-relaxed text-slate">يسجل المكتب مراجعته للشريك لهذه الخدمة. وجود المرجع يحتاج مراجعة فعلية من المسؤول.</span></label>
        <label className="text-sm font-semibold">موعد التسليم<input required type="datetime-local" className={inputClass} value={create.due} onChange={(e) => setCreate({ ...create, due: e.target.value })} /></label>
        <label className="text-sm font-semibold">رسوم صلة بنفس عملة بند الخدمة<input required inputMode="decimal" className={inputClass} value={create.fee} onChange={(e) => setCreate({ ...create, fee: e.target.value })} /></label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed sm:col-span-2"><input required type="checkbox" className="mt-1 h-5 w-5 shrink-0 scroll-mt-28 accent-deep" checked={create.consent} onChange={(e) => setCreate({ ...create, consent: e.target.checked })} /><span className="min-w-0 flex-1">أعتمد رسوم صلة، وأسمح للشريك برؤية النطاق المكتوب هنا ومعيار القبول. راجعت البيانات اللازمة لمهمته.</span></label>
        <button type="submit" disabled={busy} className={buttonClass}>{busy ? "جارٍ التسجيل…" : "إرسال التكليف داخل صلة"}</button>
      </form>}
      {loading && <p className="mt-6 text-sm text-slate">جارٍ تحميل الطلبات…</p>}
      {!loading && data?.orders.length === 0 && <div className="mt-5 rounded-xl border border-dashed border-outlinev p-5 text-sm leading-relaxed text-slate">{audience === "partner" ? "لا توجد مهام مسندة لحسابك حتى الآن. شارك بريد حسابك مع المكتب ليحدد المطلوب والسعر والموعد." : data.eligibleSuppliers.length ? "العرض المعتمد جاهز للتكليف. اختر الشريك وحدد المطلوب ومعيار التسليم." : "تبدأ مهام التنفيذ بعد اعتماد عرض به بند مورد وتسجيل نتيجة الفرصة التجارية."}</div>}
      <div className="mt-5 space-y-5">{data?.orders.map((order) => {
        const entry = finance[order.id] ?? { amount: "", reference: "", note: "" };
        const work = (command: string) => { void act({ command, orderId: order.id, expectedRevision: order.revision, note: notes[order.id] ?? "", ...(command === "deliver" ? { deliveryReference: deliveries[order.id] ?? "" } : {}) }); };
        return <article key={order.id} className="min-w-0 rounded-xl border border-outlinev p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-inkwell">{order.serviceName}</h3><p className="mt-1 text-xs text-slate">{audience === "office" ? order.partnerName : order.officeName} · التسليم {date(order.dueAt)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${order.overdue ? "bg-amber-50 text-amber-900" : "bg-low text-deep"}`}>{serviceStatusLabels[order.status]}</span></div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><div><h4 className="text-xs font-bold text-deep">نطاق التنفيذ</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate">{order.scope}</p></div><div><h4 className="text-xs font-bold text-deep">معيار القبول</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate">{order.acceptanceCriteria}</p></div></div>
          <p className="mt-3 text-sm text-inkwell">{audience === "partner" ? "المبلغ المتفق عليه مع الشريك" : "تكلفة خدمة الشريك"}: <strong>{money(order.supplierCostMinor, order.currency)}</strong></p>
          {order.lastNote && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-low p-3 text-sm text-slate">آخر ملاحظة: {order.lastNote}</p>}
          {order.deliveries.length > 0 && <div className="mt-4"><h4 className="text-sm font-bold">سجل التسليم</h4>{order.deliveries.map((delivery) => <div key={delivery.id} className="mt-2 rounded-lg bg-low p-3"><p className="whitespace-pre-wrap break-words text-sm">{delivery.reference}</p><time className="mt-1 block text-xs text-slate">{date(delivery.submittedAt)}</time></div>)}</div>}
          {order.timeline.length > 0 && <details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-deep">سجل إجراءات التنفيذ</summary><ol className="mt-2 space-y-2">{order.timeline.map((event, index) => <li key={index} className="rounded-lg bg-low p-3 text-sm"><strong>{serviceActionLabels[event.action] ?? event.action}</strong><time className="mr-2 text-xs text-slate">{date(event.createdAt)}</time>{event.note && <p className="mt-1 whitespace-pre-wrap break-words text-slate">{event.note}</p>}</li>)}</ol></details>}
          {canManage && <div className="mt-4 rounded-xl border border-outlinev p-4">
            <h4 className="text-sm font-bold text-inkwell">متابعة العميل</h4>
            <p className="mt-2 text-xs leading-relaxed text-slate">رابط خاص يعرض اسم الخدمة وحالتها وموعدها. صالح لسبعة أيام ويمكن إلغاؤه؛ إصدار رابط جديد يلغي القديم.</p>
            {order.statusLink && <p className="mt-2 text-xs text-slate">يوجد رابط ساري حتى {date(order.statusLink.expiresAt)}.</p>}
            {links[order.id] && <div className="mt-3"><label htmlFor={`service-status-link-${order.id}`} className="block text-sm">رابط المتابعة</label><input id={`service-status-link-${order.id}`} aria-describedby={`service-status-help-${order.id}`} readOnly dir="ltr" className={inputClass} value={links[order.id].url} onFocus={(event) => event.target.select()} /><p id={`service-status-help-${order.id}`} className="mt-1 text-xs text-slate">انسخ الرابط لإرساله للعميل. إصدار رابط جديد يتيح نسخه مرة أخرى.</p></div>}
            <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className={buttonClass} onClick={() => { void manageLink(order, "issue"); }}>إصدار رابط متابعة</button>{order.statusLink && <button disabled={busy} className="min-h-11 rounded-lg border border-outlinev px-4 py-2 text-sm font-bold text-slate" onClick={() => { void manageLink(order, "revoke"); }}>إلغاء رابط المتابعة</button>}</div>
          </div>}
          {(canManage || audience === "partner") && !["completed", "declined", "cancelled"].includes(order.status) && <div className="mt-4">
            <label className="block text-sm font-semibold">ملاحظة الإجراء<textarea maxLength={2000} rows={2} className={inputClass} value={notes[order.id] ?? ""} onChange={(e) => setNotes({ ...notes, [order.id]: e.target.value })} /></label>
            {audience === "partner" && order.status === "in_progress" && <label className="mt-3 block text-sm font-semibold">وصف التسليم أو مرجعه<textarea maxLength={2000} rows={2} className={inputClass} value={deliveries[order.id] ?? ""} onChange={(e) => setDeliveries({ ...deliveries, [order.id]: e.target.value })} /><span className="mt-1 block text-xs text-slate">أدخل مرجعًا يمكن للمكتب مراجعته. تجنب إدخال كلمات مرور أو روابط تتضمن بيانات دخول.</span></label>}
            <div className="mt-3 flex flex-wrap gap-2">
              {audience === "partner" && order.status === "offered" && <><button disabled={busy} className={buttonClass} onClick={() => work("accept_assignment")}>قبول التكليف</button><button disabled={busy} className={buttonClass} onClick={() => work("decline_assignment")}>الاعتذار مع السبب</button></>}
              {audience === "partner" && ["accepted", "rework"].includes(order.status) && <button disabled={busy} className={buttonClass} onClick={() => work("start_work")}>بدء التنفيذ</button>}
              {audience === "partner" && order.status === "in_progress" && <button disabled={busy} className={buttonClass} onClick={() => work("deliver")}>تسليم للمراجعة</button>}
              {canManage && order.status === "delivered" && <><button disabled={busy} className={buttonClass} onClick={() => work("accept_delivery")}>قبول التسليم</button><button disabled={busy} className={buttonClass} onClick={() => work("request_rework")}>طلب تعديل مع السبب</button></>}
              {canManage && <button disabled={busy} className="min-h-11 rounded-lg border border-outlinev px-4 py-2 text-sm font-bold text-slate disabled:opacity-50" onClick={() => work("cancel")}>إلغاء مع السبب</button>}
            </div>
          </div>}
          {order.finance && <div className="mt-5 rounded-xl bg-low p-4">
            <h4 className="font-bold text-inkwell">رسوم صلة وتكلفة التشغيل المسجلة</h4>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"><Metric label="رسوم صلة المتفق عليها" value={money(order.finance.feeAgreedMinor, order.currency)} /><Metric label="صافي التحصيل المسجل" value={money(order.finance.netCollectedMinor, order.currency)} /><Metric label="تكلفة التشغيل المسجلة" value={money(order.finance.directCostMinor, order.currency)} /><Metric label="مساهمة نقدية مسجلة" value={money(order.finance.cashContributionMinor, order.currency)} /><Metric label="رصيد الرسوم" value={money(order.finance.feeBalanceMinor, order.currency)} /><Metric label="هامش المكتب قبل مصروفاته الأخرى" value={money(order.finance.agencyMarginBeforeOperatingCostsMinor, order.currency)} /></dl>
            <p className="mt-3 text-xs leading-relaxed text-slate">التحصيل يُسجل يدويًا بعد مراجعة الإثبات. المساهمة تخص الرسوم والتكاليف المسجلة فقط؛ أضف وقت التشغيل والدعم وإعادة العمل، وراجع اكتمال التكلفة قبل تقييم الربح. تكلفة الشريك يدفعها المكتب مباشرة في هذه التجربة.</p>
            {!!order.moneyEntries?.length && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-deep">سجل التحصيل والتكاليف</summary><ul className="mt-2 space-y-2">{order.moneyEntries.map((entry, index) => <li key={index} className="rounded-lg bg-white p-3 text-sm"><strong>{{ receipt: "تحصيل", refund: "استرداد", cost: "تكلفة تشغيل" }[entry.kind] ?? entry.kind} · {money(entry.amountMinor, order.currency)}</strong><p className="mt-1 break-words text-xs text-slate">{entry.reference} · {entry.note}</p><time className="mt-1 block text-xs text-slate">{date(entry.createdAt)}</time></li>)}</ul></details>}
            {canManage && <details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-deep">تسجيل تحصيل أو استرداد أو تكلفة تشغيل</summary><div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">المبلغ بـ{order.currency}<input inputMode="decimal" className={inputClass} value={entry.amount} onChange={(e) => setFinance({ ...finance, [order.id]: { ...entry, amount: e.target.value } })} /></label>
              <label className="text-sm">مرجع الإثبات<input maxLength={500} className={inputClass} value={entry.reference} onChange={(e) => setFinance({ ...finance, [order.id]: { ...entry, reference: e.target.value } })} /></label>
              <label className="text-sm sm:col-span-2">وصف التسجيل<input maxLength={1000} className={inputClass} value={entry.note} onChange={(e) => setFinance({ ...finance, [order.id]: { ...entry, note: e.target.value } })} /></label>
              <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={busy} className={buttonClass} onClick={() => { void recordMoney(order, "record_fee"); }}>تسجيل رسوم دُفعت لصلة</button><button disabled={busy} className={buttonClass} onClick={() => { void recordMoney(order, "record_refund"); }}>تسجيل استرداد</button><button disabled={busy} className={buttonClass} onClick={() => { void recordMoney(order, "record_cost"); }}>تسجيل تكلفة تشغيل</button></div>
            </div></details>}
          </div>}
        </article>;
      })}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate">{label}</dt><dd className="mt-1 font-bold text-inkwell">{value}</dd></div>;
}
