"use client";

import { useEffect, useMemo, useState } from "react";

type ApiError = { error?: string };
type QuoteVersion = {
  quoteId: number;
  quoteVersionId: number;
  version: number;
  status: string;
  currency: string;
  sellTotalMinor: number;
  validUntil: string | null;
  createdAt: string;
};
type OpportunityDetail = {
  opportunity: { stage: string };
  quoteVersions: QuoteVersion[];
};
type PreparedDelivery = {
  deliveryId: number;
  quoteId: number;
  quoteVersionId: number;
  state: "prepared";
  sharePath: string;
  activationToken: string;
  expiresAt: string;
};

type ActiveDelivery = {
  state: "active";
  sharePath: string;
  expiresAt: string;
};

const channelOptions = [
  ["link", "رابط مباشر"],
  ["whatsapp", "واتساب"],
  ["email", "بريد إلكتروني"],
  ["manual", "قناة خارجية أخرى"],
] as const;

function dateTime(value: string | null) {
  if (!value) return "بدون صلاحية";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير صالح";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

async function loadOpportunityDetail(workspaceId: number, opportunityId: number): Promise<OpportunityDetail> {
  const response = await fetch(`/api/agency/workspaces/${workspaceId}/opportunities/${opportunityId}`, { cache: "no-store" });
  const data = await response.json() as OpportunityDetail & ApiError;
  if (!response.ok) throw new Error(data.error ?? "تعذر تحميل أحدث Quote Version.");
  return data;
}

export function QuoteDeliveryPanel({ workspaceId, opportunityId }: { workspaceId: number; opportunityId: number }) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [channel, setChannel] = useState<(typeof channelOptions)[number][0]>("link");
  const [prepared, setPrepared] = useState<PreparedDelivery | null>(null);
  const [active, setActive] = useState<ActiveDelivery | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const data = await loadOpportunityDetail(workspaceId, opportunityId);
      setDetail(data);
      setError("");
      setPrepared(null);
      setActive(null);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل أحدث Quote Version.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    loadOpportunityDetail(workspaceId, opportunityId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setError("");
        setPrepared(null);
        setActive(null);
        setCopied(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل أحدث Quote Version.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [workspaceId, opportunityId]);

  const latest = useMemo(() => detail?.quoteVersions?.[0] ?? null, [detail]);
  const terminal = detail ? ["won", "lost", "cancelled"].includes(detail.opportunity.stage) : false;
  const shareUrl = prepared && typeof window !== "undefined" ? `${window.location.origin}${prepared.sharePath}` : active && typeof window !== "undefined" ? `${window.location.origin}${active.sharePath}` : "";

  async function prepare() {
    if (!latest) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/agency/workspaces/${workspaceId}/quote-deliveries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          quoteId: latest.quoteId,
          quoteVersionId: latest.quoteVersionId,
          channel,
        }),
      });
      const data = await response.json() as PreparedDelivery & ApiError;
      if (!response.ok) throw new Error(data.error ?? "تعذر تجهيز رابط العرض.");
      setPrepared(data);
      setActive(null);
      setCopied(false);
      setNotice("تم تجهيز رابط آمن فقط. لم نسجل العرض كمرسل بعد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تجهيز رابط العرض.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setNotice("تم نسخ الرابط. أرسله للعميل عبر القناة التي اخترتها، ثم أكد الإرسال هنا.");
    } catch {
      setError("تعذر النسخ التلقائي. انسخ الرابط يدويًا من الحقل.");
    }
  }

  async function activate() {
    if (!prepared) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/agency/workspaces/${workspaceId}/quote-deliveries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "activate", token: prepared.activationToken }),
      });
      const data = await response.json() as ActiveDelivery & ApiError;
      if (!response.ok) throw new Error(data.error ?? "تعذر تسجيل الإرسال.");
      setActive(data);
      setPrepared(null);
      setNotice("تم تسجيل الإرسال. مشاهدة العميل وردّه سيظهران الآن كأحداث حقيقية في Commercial Activity.");
      await new Promise((resolve) => setTimeout(resolve, 150));
      const detailResponse = await fetch(`/api/agency/workspaces/${workspaceId}/opportunities/${opportunityId}`, { cache: "no-store" });
      if (detailResponse.ok) setDetail(await detailResponse.json() as OpportunityDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الإرسال.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="decision-board" dir="rtl" aria-labelledby="secure-delivery-title">
      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="p-5 md:p-6">
          <div className="text-[11px] font-bold text-signal">04 · Delivery</div>
          <h2 id="secure-delivery-title" className="mt-2 text-2xl font-bold tracking-[-0.025em] text-deep">
            شارك الـQuote بدون تزوير حالة الإرسال.
          </h2>
          <p className="mt-3 max-w-2xl text-[12px] leading-6 text-slate">
            تجهيز الرابط لا يعني أن العرض أُرسل. صلة تفصل بين إنشاء رابط آمن، مشاركته فعليًا،
            ثم تسجيل الإرسال حتى تظل الـconversion analytics مبنية على أحداث حقيقية.
          </p>
        </div>

        <div className="border-t border-outlinev bg-low/40 p-5 lg:border-s lg:border-t-0">
          <div className="text-[10px] font-bold text-slate">حالة التسليم</div>
          <div className="mt-3">
            <span className={
              "decision-state " +
              (active
                ? "decision-state--confirmed"
                : prepared
                  ? "decision-state--focus"
                  : "decision-state--unknown")
            }>
              {active ? "SENT" : prepared ? "PREPARED" : latest ? "READY" : "NO_QUOTE"}
            </span>
          </div>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void refresh()}
            className="quiet-action mt-4 text-slate disabled:opacity-50"
          >
            تحديث أحدث نسخة
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="border-t border-error/20 bg-errorbg px-5 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="border-t border-sky/30 bg-air px-5 py-3 text-sm text-deep">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="border-t border-outlinev px-5 py-6 text-sm text-slate">
          جارٍ تحميل أحدث Quote Version…
        </div>
      ) : null}

      {!loading && !latest ? (
        <div className="border-t border-outlinev px-5 py-7">
          <div className="decision-state decision-state--unknown">لا توجد نسخة قابلة للمشاركة</div>
          <p className="mt-3 text-sm leading-7 text-slate">
            ارجع إلى Supplier evidence وأنشئ Quote Version بصلاحية واضحة قبل أي خطوة مشاركة.
          </p>
        </div>
      ) : null}

      {latest ? (
        <div className="border-t border-outlinev">
          <div className="grid gap-0 md:grid-cols-3 md:divide-x md:divide-x-reverse md:divide-outlinev">
            <div className="p-5">
              <div className="tnum text-[10px] font-bold text-signal">01</div>
              <div className="mt-2 text-sm font-bold text-deep">راجع النسخة</div>
              <div className="mt-3 text-[12px] leading-6 text-slate">
                Quote #{latest.quoteId} · v{latest.version}
              </div>
              <div className="mt-1 text-lg font-bold text-deep">
                {money(Number(latest.sellTotalMinor), latest.currency)}
              </div>
              <div className="mt-1 text-[10px] text-slate">
                صالح حتى {dateTime(latest.validUntil)}
              </div>
            </div>

            <div className="border-t border-outlinev p-5 md:border-t-0">
              <div className="tnum text-[10px] font-bold text-signal">02</div>
              <div className="mt-2 text-sm font-bold text-deep">جهّز الرابط</div>

              {!prepared && !active && !terminal ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-[11px] font-bold text-slate">
                    قناة المشاركة المقصودة
                    <select
                      value={channel}
                      onChange={(event) => setChannel(event.target.value as typeof channel)}
                      className="mt-2 min-h-[52px] w-full rounded-xl border border-outlinev bg-cloud px-3 text-sm font-medium text-deep outline-none focus:border-signal"
                    >
                      {channelOptions.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy || !latest.validUntil}
                    onClick={() => void prepare()}
                    className="focus-action w-full disabled:opacity-50"
                  >
                    تجهيز رابط آمن
                  </button>
                  {!latest.validUntil ? (
                    <p className="text-[10px] leading-5 text-gold">
                      لا يمكن تجهيز رابط بدون صلاحية مسجلة للـQuote.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 text-[11px] leading-6 text-slate">
                  {active ? "تم تسجيل الإرسال." : "الرابط مجهّز ولم يُسجل كمرسل بعد."}
                </div>
              )}
            </div>

            <div className="border-t border-outlinev p-5 md:border-t-0">
              <div className="tnum text-[10px] font-bold text-signal">03</div>
              <div className="mt-2 text-sm font-bold text-deep">شارك ثم أكّد</div>

              {(prepared || active) ? (
                <div className="mt-4">
                  <label className="block text-[10px] font-bold text-slate">
                    رابط العميل
                    <input
                      readOnly
                      value={shareUrl}
                      className="mt-2 min-h-[52px] w-full rounded-xl border border-outlinev bg-low px-3 py-2 text-left font-mono text-[10px] text-deep"
                      dir="ltr"
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="quiet-action min-h-[44px] border border-outlinev px-3"
                    >
                      {copied ? "تم النسخ" : "نسخ الرابط"}
                    </button>
                    {prepared ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void activate()}
                        className="focus-action min-h-[44px] px-4 py-2 text-xs disabled:opacity-50"
                      >
                        أكّد أني شاركت الرابط
                      </button>
                    ) : null}
                  </div>

                  {prepared ? (
                    <p className="mt-3 text-[10px] leading-5 text-slate">
                      لا نسجل Quote Sent قبل تأكيدك. إنشاء الرابط وحده ليس إرسالًا.
                    </p>
                  ) : null}
                  {active ? (
                    <p className="mt-3 text-[10px] leading-5 text-verified">
                      الرابط نشط حتى {dateTime(active.expiresAt)}. مشاهدة العميل وردّه يسجلان كأحداث فعلية.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-[11px] leading-6 text-slate">
                  جهّز الرابط في الخطوة السابقة أولًا.
                </p>
              )}
            </div>
          </div>

          <details className="progressive-panel border-t border-outlinev px-5">
            <summary>ما الذي يظهر للعميل وما الذي يبقى داخليًا؟</summary>
            <div className="border-t border-outlinev py-4 text-[11px] leading-6 text-slate">
              رابط العميل يعرض سعر البيع وشروط العميل فقط. تكلفة المورد، العمولة، الهامش،
              ومرجع المصدر تبقى داخل مساحة الوكالة ولا تنتقل للواجهة العامة.
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}
