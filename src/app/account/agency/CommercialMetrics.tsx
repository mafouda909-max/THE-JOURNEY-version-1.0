"use client";

import { useEffect, useState } from "react";

type Metrics = {
  marketplaceInquiries: number;
  pendingInbox: number;
  adoptedMarketplace: number;
  avgAdoptionSeconds: number | null;
  opportunities: number;
  openOpportunities: number;
  won: number;
  lost: number;
  quoted: number;
  avgQuoteSeconds: number | null;
  avgWonMarginBps: number | null;
  staleActiveOptions: number;
  expiringOptions: number;
  inquiryAdoptionRate: number | null;
  quoteRate: number | null;
  winRate: number | null;
  realizedGrossProfit: Array<{ currency: string; grossProfitMinor: number }>;
};

type ApiResponse = { metrics?: Metrics; error?: string };

function percent(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function duration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "—";
  const value = Number(seconds);
  if (value < 3600) return `${Math.max(1, Math.round(value / 60))} د`;
  if (value < 86_400) return `${(value / 3600).toFixed(value < 18_000 ? 1 : 0)} س`;
  return `${(value / 86_400).toFixed(1)} يوم`;
}

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function CommercialMetrics({ workspaceId }: { workspaceId: number }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/agency/workspaces/${workspaceId}/metrics`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as ApiResponse;
        if (!response.ok) throw new Error(data.error ?? "تعذر تحميل مؤشرات التشغيل.");
        return data.metrics ?? null;
      })
      .then((next) => {
        if (!cancelled) setMetrics(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل المؤشرات.");
      });
    return () => { cancelled = true; };
  }, [workspaceId]);

  if (error) return <div className="rounded-xl border border-error/20 bg-errorbg p-3 text-xs text-error">{error}</div>;
  if (!metrics) return <div className="rounded-xl border border-outlinev bg-white p-4 text-xs text-slate">جارٍ حساب مؤشرات التشغيل…</div>;

  return (
    <section className="rounded-2xl border border-outlinev bg-white p-4 sm:p-5" aria-labelledby="commercial-metrics-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="commercial-metrics-title" className="font-bold text-inkwell">Commercial Health</h3>
          <p className="mt-1 text-xs text-slate">من السجلات التجارية canonical، وليس pageviews أو تقديرات AI.</p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate">all-time operational truth</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Inbox جديد" value={String(metrics.pendingInbox)} detail={`${metrics.marketplaceInquiries} Inquiry إجمالي`} />
        <Metric label="Adoption" value={percent(metrics.inquiryAdoptionRate)} detail={`متوسط ${duration(metrics.avgAdoptionSeconds)}`} />
        <Metric label="Quote rate" value={percent(metrics.quoteRate)} detail={`متوسط أول Quote ${duration(metrics.avgQuoteSeconds)}`} />
        <Metric label="Win rate" value={percent(metrics.winRate)} detail={`${metrics.won} فوز · ${metrics.lost} خسارة`} />
        <Metric label="فرص مفتوحة" value={String(metrics.openOpportunities)} detail={`${metrics.opportunities} Opportunity إجمالي`} />
        <Metric label="متوسط Margin للفوز" value={metrics.avgWonMarginBps == null ? "—" : `${(Number(metrics.avgWonMarginBps) / 100).toFixed(1)}%`} detail="من النسخ المقبولة فقط" />
        <Metric label="Supply ينتهي <24س" value={String(metrics.expiringOptions)} detail={`${metrics.staleActiveOptions} stale ما زال active`} attention={metrics.expiringOptions > 0 || metrics.staleActiveOptions > 0} />
        <div className="rounded-xl bg-low p-4">
          <div className="text-[11px] font-bold text-slate">Realized gross profit</div>
          {metrics.realizedGrossProfit.length === 0 ? (
            <div className="mt-1 text-lg font-bold text-inkwell">—</div>
          ) : (
            <div className="mt-2 space-y-1">
              {metrics.realizedGrossProfit.map((entry) => (
                <div key={entry.currency} className="text-sm font-bold text-inkwell">{money(Number(entry.grossProfitMinor), entry.currency)}</div>
              ))}
            </div>
          )}
          <div className="mt-1 text-[10px] leading-relaxed text-slate">لا نخلط العملات في رقم واحد.</div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, detail, attention = false }: { label: string; value: string; detail: string; attention?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${attention ? "border border-gold/25 bg-amber/40" : "bg-low"}`}>
      <div className="text-[11px] font-bold text-slate">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${attention ? "text-gold" : "text-inkwell"}`}>{value}</div>
      <div className="mt-1 text-[10px] leading-relaxed text-slate">{detail}</div>
    </div>
  );
}
