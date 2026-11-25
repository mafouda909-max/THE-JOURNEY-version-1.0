"use client";

import { useCallback, useEffect, useState } from "react";

type Delivery = {
  deliveryId: number;
  response: "approved";
  travelerRespondedAt: string | null;
  quoteVersionId: number;
  version: number;
  confirmationId: number | null;
  providerName: string | null;
  channel: string | null;
  note: string | null;
  reportedAt: string | null;
  travelerResponse: "confirmed" | "not_confirmed" | null;
  travelerResponseNote: string | null;
  travelerAcknowledgedAt: string | null;
};

type ApiResponse = { deliveries?: Delivery[]; error?: string };

const channelLabels: Record<string, string> = {
  phone: "مكالمة هاتفية",
  whatsapp: "واتساب",
  email: "بريد إلكتروني",
  in_person: "مقابلة مباشرة",
  other: "وسيلة أخرى",
};

function dateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DirectConfirmationPanel({
  workspaceId,
  opportunityId,
}: {
  workspaceId: number;
  opportunityId: number;
}) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [forms, setForms] = useState<Record<number, { providerName: string; channel: string; note: string }>>({});

  const endpoint = `/api/agency/workspaces/${workspaceId}/opportunities/${opportunityId}/direct-confirmation`;

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (response.status === 404) {
      setEnabled(false);
      return;
    }
    const data = await response.json() as ApiResponse;
    if (!response.ok) throw new Error(data.error ?? "تعذر تحميل التأكيدات المباشرة.");
    setEnabled(true);
    setDeliveries(data.deliveries ?? []);
  }, [endpoint]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل التأكيدات.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [load]);

  async function submit(deliveryId: number) {
    const form = forms[deliveryId] ?? { providerName: "", channel: "whatsapp", note: "" };
    setSaving(deliveryId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deliveryId,
          providerName: form.providerName,
          channel: form.channel,
          note: form.note || null,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "تعذر تسجيل التأكيد.");
      await load();
      setSuccess("تم تسجيل إفادة الوكالة. سيظهر للمسافر طلب إقرار منفصل.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل التأكيد.");
    } finally {
      setSaving(null);
    }
  }

  if (!enabled && !loading) return null;

  return (
    <section className="rounded-2xl border border-outlinev bg-white p-5 sm:p-6" aria-labelledby="direct-confirmation-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="direct-confirmation-title" className="text-xl font-bold text-inkwell">التأكيد المباشر مع مقدم الخدمة</h2>
          <p className="mt-1 max-w-3xl text-xs leading-6 text-slate">
            يظهر هنا فقط إصدار العرض الذي وافق عليه المسافر. سجّل نتيجة تواصلك المباشر مع مقدم الخدمة؛ لا تسجل رقم تذكرة أو بيانات دفع أو مستندات شخصية.
          </p>
        </div>
        <span className="rounded-lg bg-low px-3 py-1.5 text-[11px] font-bold text-slate">بعد موافقة المسافر فقط</span>
      </div>

      {loading && <p className="mt-4 text-sm text-slate">جارٍ تحميل الحالات…</p>}
      {!loading && deliveries.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-outlinev p-4 text-sm text-slate">
          لا توجد نسخة عرض وافق عليها المسافر بعد. أرسل العرض وانتظر رده أولًا.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {deliveries.map((delivery) => (
          <article key={delivery.deliveryId} className="rounded-xl border border-outlinev p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-inkwell">عرض معتمد من المسافر · v{delivery.version}</div>
              <span className="rounded-lg bg-verifiedbg px-2.5 py-1 text-[11px] font-bold text-verified">موافقة المسافر مسجلة</span>
            </div>
            <p className="mt-1 text-[11px] text-slate">الموافقة بتاريخ {dateTime(delivery.travelerRespondedAt)}</p>

            {delivery.confirmationId ? (
              <div className="mt-4 rounded-xl bg-low p-4">
                <div className="font-bold text-inkwell">إفادة الوكالة بالتواصل المباشر</div>
                <div className="mt-2 grid gap-2 text-xs text-slate sm:grid-cols-2">
                  <div>مقدم الخدمة: <b className="text-inkwell">{delivery.providerName}</b></div>
                  <div>قناة التواصل: <b className="text-inkwell">{channelLabels[delivery.channel ?? ""] ?? delivery.channel}</b></div>
                  <div>تاريخ الإفادة: <b className="text-inkwell">{dateTime(delivery.reportedAt)}</b></div>
                  <div>إقرار المسافر: <b className="text-inkwell">{delivery.travelerResponse === "confirmed" ? "أكد التواصل" : delivery.travelerResponse === "not_confirmed" ? "لم يؤكد التواصل" : "بانتظار رد المسافر"}</b></div>
                </div>
                {delivery.note && <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate">{delivery.note}</p>}
                {delivery.travelerResponseNote && <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate">ملاحظة المسافر: {delivery.travelerResponseNote}</p>}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-outlinev bg-low/40 p-4">
                <div className="mb-3 text-sm font-bold text-deep">تسجيل تواصلك مع مقدم الخدمة</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate">
                    اسم مقدم الخدمة
                    <input
                      value={(forms[delivery.deliveryId] ?? { providerName: "", channel: "whatsapp", note: "" }).providerName}
                      onChange={(event) => setForms((current) => ({ ...current, [delivery.deliveryId]: { ...(current[delivery.deliveryId] ?? { providerName: "", channel: "whatsapp", note: "" }), providerName: event.target.value } }))}
                      maxLength={160}
                      className="mt-1 min-h-11 w-full rounded-lg border border-outlinev bg-white px-3 text-sm font-normal text-inkwell"
                      placeholder="الاسم أو المنشأة"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate">
                    طريقة التواصل
                    <select
                      value={(forms[delivery.deliveryId] ?? { providerName: "", channel: "whatsapp", note: "" }).channel}
                      onChange={(event) => setForms((current) => ({ ...current, [delivery.deliveryId]: { ...(current[delivery.deliveryId] ?? { providerName: "", channel: "whatsapp", note: "" }), channel: event.target.value } }))}
                      className="mt-1 min-h-11 w-full rounded-lg border border-outlinev bg-white px-3 text-sm font-normal text-inkwell"
                    >
                      {Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="mt-3 block text-xs font-bold text-slate">
                  ملخص مختصر — اختياري
                  <textarea
                    value={(forms[delivery.deliveryId] ?? { providerName: "", channel: "whatsapp", note: "" }).note}
                    onChange={(event) => setForms((current) => ({ ...current, [delivery.deliveryId]: { ...(current[delivery.deliveryId] ?? { providerName: "", channel: "whatsapp", note: "" }), note: event.target.value } }))}
                    maxLength={500}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-outlinev bg-white p-3 text-sm font-normal text-inkwell"
                    placeholder="ملخص ما تم الاتفاق عليه مباشرة، دون بيانات حساسة."
                  />
                </label>
                <button
                  type="button"
                  disabled={saving === delivery.deliveryId}
                  onClick={() => void submit(delivery.deliveryId)}
                  className="mt-3 min-h-11 rounded-lg bg-deep px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saving === delivery.deliveryId ? "جارٍ الحفظ…" : "تسجيل إفادة التواصل المباشر"}
                </button>
                <p className="mt-2 text-[11px] leading-5 text-slate">
                  هذه إفادة تسجلها الوكالة، وليست تحققًا مستقلًا من صلة أو حجزًا مؤكدًا داخل المنصة. يستطيع المسافر إقرار ما إذا كان مقدم الخدمة قد تواصل معه وأكد التفاصيل.
                </p>
              </div>
            )}
          </article>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-errorbg p-3 text-xs text-error">{error}</p>}
      {success && <p className="mt-3 rounded-lg bg-verifiedbg p-3 text-xs text-verified">{success}</p>}
    </section>
  );
}
