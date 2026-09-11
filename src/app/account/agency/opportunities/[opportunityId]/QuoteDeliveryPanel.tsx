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
      const response = await fetch(`/api/agency/workspaces/${workspaceId}/opportunities/${opportunityId}`, { cache: "no-store" });
      const data = await response.json() as OpportunityDetail & ApiError;
      if (!response.ok) throw new Error(data.error ?? "تعذر تحميل أحدث Quote Version.");
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
    void refresh();
    // workspace/opportunity identity is stable for this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <section className="mb-6 rounded-2xl border border-deep/15 bg-wash p-5 sm:p-6" dir="rtl" aria-labelledby="secure-delivery-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="secure-delivery-title" className="text-xl font-bold text-inkwell">مشاركة العرض مع العميل</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate">الرابط يعرض سعر البيع وشروط العميل فقط. تكلفة المورد والعمولة والهامش ومرجع المصدر تبقى داخل مساحة الوكالة.</p>
        </div>
        <button type="button" disabled={busy || loading} onClick={() => void refresh()} className="rounded-lg border border-outlinev bg-white px-3 py-2 text-xs font-bold text-deep disabled:opacity-50">تحديث النسخة</button>
      </div>

      {error && <div role="alert" className="mt-4 rounded-xl border border-error/20 bg-errorbg p-3 text-sm text-error">{error}</div>}
      {notice && <div role="status" className="mt-4 rounded-xl border border-verified/20 bg-verifiedbg p-3 text-sm text-verified">{notice}</div>}

      {loading && <p className="mt-4 text-sm text-slate">جارٍ تحميل أحدث نسخة…</p>}
      {!loading && !latest && <p className="mt-4 rounded-xl border border-dashed border-outlinev bg-white p-4 text-sm text-slate">أنشئ Quote Version بصلاحية واضحة أولًا، ثم جهز رابط العميل.</p>}

      {latest && (
        <div className="mt-5 rounded-xl border border-outlinev bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate">أحدث نسخة قابلة للمشاركة</div>
              <div className="mt-1 font-bold text-inkwell">Quote #{latest.quoteId} · v{latest.version}</div>
              <div className="mt-1 text-xs text-slate">صالح حتى {dateTime(latest.validUntil)}</div>
            </div>
            <div className="text-left text-sm font-bold text-deep">{money(Number(latest.sellTotalMinor), latest.currency)}</div>
          </div>

          {!prepared && !active && !terminal && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-xs font-bold text-slate">
                قناة المشاركة المقصودة
                <select value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)} className="mt-1 min-h-11 rounded-lg border border-outlinev bg-white px-3 py-2 text-sm font-normal text-inkwell">
                  {channelOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <button type="button" disabled={busy || !latest.validUntil} onClick={() => void prepare()} className="min-h-11 rounded-lg bg-deep px-4 py-2 text-sm font-bold text-white disabled:opacity-50">تجهيز رابط آمن</button>
            </div>
          )}

          {(prepared || active) && (
            <div className="mt-4 rounded-xl bg-low p-4">
              <label className="text-xs font-bold text-slate">
                رابط العميل
                <input readOnly value={shareUrl} className="mt-1 min-h-11 w-full rounded-lg border border-outlinev bg-white px-3 py-2 text-left font-mono text-xs text-inkwell" dir="ltr" />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void copyLink()} className="min-h-11 rounded-lg border border-deep bg-white px-4 py-2 text-xs font-bold text-deep">{copied ? "تم النسخ" : "نسخ الرابط"}</button>
                {prepared && <button type="button" disabled={busy} onClick={() => void activate()} className="min-h-11 rounded-lg bg-verified px-4 py-2 text-xs font-bold text-white disabled:opacity-50">تأكيد أنني شاركت الرابط</button>}
              </div>
              {prepared && <p className="mt-2 text-[11px] leading-relaxed text-slate">لن يظهر الرابط للعميل ولن نسجل Quote Sent حتى تؤكد أنك شاركته. هذا الفصل يحافظ على دقة conversion analytics.</p>}
              {active && <p className="mt-2 text-[11px] leading-relaxed text-slate">الرابط نشط حتى {dateTime(active.expiresAt)}. أول مشاهدة حقيقية ورد العميل يسجلان تلقائيًا.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
