"use client";

import { useCallback, useEffect, useState } from "react";

type QuoteLine = {
  kind: string;
  label: string;
  quantity: number;
  currency: string;
  sellUnitMinor: number;
  lineTotalMinor: number;
};
type Quote = {
  deliveryId: number;
  status: "active" | "responded" | "expired";
  response: "approved" | "declined" | "changes_requested" | null;
  responseMessage: string | null;
  respondedAt: string | null;
  version: number;
  currency: string;
  sellTotalMinor: number;
  lines: QuoteLine[];
  clientFacingTerms: string | null;
  validUntil: string;
  deliveryExpiresAt: string;
  createdAt: string;
};
type Provider = {
  workspaceId: number;
  name: string;
  city: string;
  country: string;
  status: string;
  opportunityId: number | null;
  quotes: Quote[];
};
type DetailReply = {
  request?: {
    id: number;
    reference: string;
    status: string;
    categoryLabel: string | null;
    intent: Record<string, unknown> | null;
    createdAt: string;
    providerCount: number;
  };
  providers?: Provider[];
  error?: string;
};

const fieldLabel = "block text-xs font-bold text-slate";

const responseLabels: Record<string, string> = {
  approved: "وافقت على العرض",
  declined: "رفضت العرض",
  changes_requested: "طلبت تعديلات",
};

function formatMoney(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}
function dateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function intentObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function MarketplaceRequestComparison({ requestId }: { requestId: number }) {
  const [detail, setDetail] = useState<DetailReply | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyDelivery, setBusyDelivery] = useState<number | null>(null);
  const [responseMessage, setResponseMessage] = useState<Record<number, string>>({});
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/traveler/requests/${requestId}`, { cache: "no-store" });
    const data = await response.json() as DetailReply;
    if (!response.ok || !data.request) throw new Error(data.error ?? "تعذر تحميل طلب السفر.");
    return data;
  }, [requestId]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await load();
        if (!cancelled) {
          setDetail(data);
          setError("");
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "تعذر تحميل طلب السفر.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    return () => { cancelled = true; };
  }, [load]);

  async function respond(deliveryId: number, response: "approved" | "declined" | "changes_requested") {
    setBusyDelivery(deliveryId);
    setError("");
    setSuccess("");
    try {
      const result = await fetch(`/api/traveler/requests/${requestId}/quotes/${deliveryId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, message: responseMessage[deliveryId] ?? null }),
      });
      const data = await result.json() as { error?: string };
      if (!result.ok) throw new Error(data.error ?? "تعذر تسجيل ردك.");
      setSuccess(responseLabels[response] + ". تم إبلاغ الوكالة بقرارك.");
      setDetail(await load());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تسجيل ردك.");
    } finally {
      setBusyDelivery(null);
    }
  }

  if (loading) return <div role="status" className="rounded-2xl border border-outlinev bg-white p-6 text-sm text-slate">جارٍ تحميل العروض والجهات المستلمة…</div>;
  if (error && !detail) return <div role="alert" className="rounded-2xl border border-error/20 bg-errorbg p-5 text-sm text-error">{error}</div>;
  if (!detail?.request) return null;

  const request = detail.request;
  const intent = intentObject(request.intent);
  const destinations = Array.isArray(intent.destinations) ? intent.destinations.filter((item): item is string => typeof item === "string") : [];
  const travelers = intentObject(intent.travelers);
  const currencyGroups = [...new Set((detail.providers ?? []).flatMap((provider) => provider.quotes.map((quote) => quote.currency)))];

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 pb-24 pt-8 sm:px-6 md:px-8" dir="rtl">
      <header className="rounded-2xl bg-inverse p-5 text-oninverse sm:p-7">
        <div className="text-xs font-bold text-oninverse/65">طلبك في سوق صلة</div>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{request.reference} · {request.categoryLabel ?? "طلب خدمة"}</h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-oninverse/80">
          <span>الوجهات: {destinations.join("، ") || "غير محددة"}</span>
          <span>المسافرون: {Number(travelers.adults ?? 0) + Number(travelers.children ?? 0) + Number(travelers.infants ?? 0)}</span>
          <span>عدد الجهات المستلمة: {request.providerCount}</span>
        </div>
        <p className="mt-3 text-xs leading-6 text-oninverse/65">استلام الوكالة للطلب لا يعني قبولها أو وجود عرض. كل عرض يصدر بصورة مستقلة، وموافقتك عليه تُبلغ الوكالة فقط؛ يتم التأكيد مباشرة خارج صلة.</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-error/20 bg-errorbg p-3 text-sm text-error">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-verified/20 bg-verifiedbg p-3 text-sm text-verified">{success}</p>}

      {currencyGroups.length > 1 && (
        <p className="rounded-xl border border-outlinev bg-low p-4 text-xs leading-6 text-slate">
          العروض الواردة تستخدم أكثر من عملة ({currencyGroups.join("، ")}). نعرض إجمالي كل عرض بعملته، ولا نحولها أو نرتبها سعريًا دون مصدر صرف واضح.
        </p>
      )}

      {(detail.providers ?? []).map((provider) => (
        <section key={provider.workspaceId} className="rounded-2xl border border-outlinev bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-inkwell">{provider.name}</h2>
              <p className="mt-1 text-xs text-slate">{provider.city}، {provider.country}</p>
            </div>
            <span className={provider.status === "accepted" ? "rounded-lg bg-verifiedbg px-3 py-2 text-[11px] font-bold text-verified" : provider.status === "declined" ? "rounded-lg bg-low px-3 py-2 text-[11px] font-bold text-slate" : "rounded-lg bg-air px-3 py-2 text-[11px] font-bold text-deep"}>
              {provider.status === "accepted" ? "تبنّت الوكالة الطلب" : provider.status === "declined" ? "اعتذرت الوكالة" : provider.status === "viewed" ? "اطلعت على الطلب" : "الطلب بانتظار رد الوكالة"}
            </span>
          </div>

          {provider.quotes.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-outlinev p-4 text-sm text-slate">
              لم يصل عرض من هذه الجهة بعد.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {provider.quotes.map((quote) => {
                const expired = quote.status === "expired" || new Date(quote.deliveryExpiresAt).getTime() <= Date.now() && quote.status === "active";
                const actionable = quote.status === "active" && !expired;
                return (
                  <article key={quote.deliveryId} className="rounded-xl border border-outlinev bg-low/25 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-inkwell">عرض رقم {quote.version}</div>
                        <p className="mt-1 text-[11px] text-slate">تاريخ الإصدار: {dateTime(quote.createdAt)} · صالح حتى {dateTime(quote.validUntil)}</p>
                      </div>
                      <div className="text-left">
                        <div className="text-[11px] text-slate">الإجمالي المعروض</div>
                        <div className="mt-1 text-xl font-bold text-deep">{formatMoney(quote.sellTotalMinor, quote.currency)}</div>
                      </div>
                    </div>

                    <div className="mt-4 divide-y divide-outlinev">
                      {quote.lines.map((line, index) => (
                        <div key={line.kind + line.label + index} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div>
                            <div className="text-sm font-semibold text-inkwell">{line.label}</div>
                            <div className="mt-1 text-[11px] text-slate">الكمية {line.quantity}</div>
                          </div>
                          <div className="shrink-0 text-sm font-bold text-inkwell">{formatMoney(line.lineTotalMinor, line.currency)}</div>
                        </div>
                      ))}
                    </div>

                    {quote.clientFacingTerms && (
                      <div className="mt-4 rounded-lg border border-outlinev bg-white p-3">
                        <div className="text-[11px] font-bold text-deep">شروط الوكالة</div>
                        <p className="mt-2 whitespace-pre-line text-xs leading-6 text-slate">{quote.clientFacingTerms}</p>
                      </div>
                    )}

                    <div className="mt-3 rounded-lg bg-low p-3 text-[11px] leading-5 text-slate">
                      هذا عرض وكالة بسعر ونطاق وشروط محددة. راجع التفاصيل قبل الرد؛ قد لا تكون عروض الوكالات متكافئة في المحتوى أو شروط الإلغاء حتى إذا كانت العملة واحدة.
                    </div>

                    {quote.response ? (
                      <div className="mt-4 rounded-lg border border-verified/20 bg-verifiedbg p-3 text-xs font-bold text-verified">
                        {responseLabels[quote.response] ?? "تم تسجيل ردك"}
                        {quote.responseMessage ? <p className="mt-2 font-normal leading-5 text-slate">{quote.responseMessage}</p> : null}
                      </div>
                    ) : expired ? (
                      <p className="mt-4 rounded-lg bg-low p-3 text-xs text-slate">انتهت صلاحية هذا العرض. اطلب من الوكالة إصدار نسخة محدثة.</p>
                    ) : actionable ? (
                      <div className="mt-4 space-y-3">
                        <label className={fieldLabel}>رسالة للوكالة — اختيارية
                          <textarea rows={2} maxLength={1000} value={responseMessage[quote.deliveryId] ?? ""} onChange={(event) => setResponseMessage((current) => ({ ...current, [quote.deliveryId]: event.target.value }))} className="mt-1 w-full rounded-lg border border-outlinev bg-white p-3 text-sm text-inkwell" placeholder="اكتب سؤالًا أو توضيحًا…" />
                        </label>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <button type="button" disabled={busyDelivery === quote.deliveryId} onClick={() => void respond(quote.deliveryId, "approved")} className="min-h-11 rounded-lg bg-deep px-3 py-2 text-xs font-bold text-white disabled:opacity-50">أوافق على هذا العرض</button>
                          <button type="button" disabled={busyDelivery === quote.deliveryId} onClick={() => void respond(quote.deliveryId, "changes_requested")} className="min-h-11 rounded-lg border border-outlinev bg-white px-3 py-2 text-xs font-bold text-deep disabled:opacity-50">أطلب تعديلات</button>
                          <button type="button" disabled={busyDelivery === quote.deliveryId} onClick={() => void respond(quote.deliveryId, "declined")} className="min-h-11 rounded-lg border border-outlinev bg-white px-3 py-2 text-xs font-bold text-slate disabled:opacity-50">لا يناسبني</button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ))}

      <p className="rounded-xl border border-gold/20 bg-amber/35 p-4 text-xs leading-6 text-slate">
        موافقتك على العرض تسجل اختيارك فقط. لا تُصدر صلة حجزًا أو تذكرة ولا تجمع أموالًا. بعد الموافقة تتواصل الوكالة ومقدم الخدمة معك مباشرة لتأكيد التوافر والشروط خارج المنصة.
      </p>
    </main>
  );
}
