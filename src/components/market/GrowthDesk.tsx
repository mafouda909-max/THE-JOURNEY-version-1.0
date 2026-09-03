"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Megaphone,
  Rocket,
  ScrollText,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import type { AuditEntry, Campaign, ContentItem, Experiment } from "@/db/schema";
import { timeAgo } from "@/lib/format";

type GrowthData = {
  content: ContentItem[];
  campaigns: Campaign[];
  experiments: Experiment[];
  auditLog: AuditEntry[];
  leadsBySource: { source: string; count: number }[];
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  in_review: "بانتظار المراجعة",
  approved: "معتمد",
  scheduled: "مجدول",
  published: "منشور",
  measured: "تم قياسه",
  running: "جارية",
  concluded: "منتهية",
  active: "نشطة",
  planned: "مخططة",
  completed: "مكتملة",
  paused: "موقوفة",
  archived: "مؤرشفة",
};

const NEXT_ACTION: Record<string, { to: string; label: string } | null> = {
  draft: { to: "in_review", label: "إرسال للمراجعة" },
  in_review: { to: "approved", label: "اعتماد (مراجعة بشرية)" },
  approved: { to: "published", label: "نشر الآن" },
  scheduled: { to: "published", label: "نشر الآن" },
  published: { to: "measured", label: "تسجيل النتائج" },
  measured: null,
};

const RISK_STYLES: Record<string, string> = {
  low: "bg-verifiedbg text-verified",
  medium: "bg-amber text-gold",
  high: "bg-errorbg text-error",
};
const RISK_LABELS: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "عالٍ" };

const CHANNEL_LABELS: Record<string, string> = {
  blog: "مدونة", instagram: "إنستغرام", facebook: "فيسبوك",
  tiktok: "تيك توك", whatsapp: "واتساب", email: "بريد", seo_page: "صفحة SEO",
};

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-low text-slate",
    in_review: "bg-amber text-gold",
    approved: "bg-wash text-deep",
    scheduled: "bg-wash text-deep",
    published: "bg-verifiedbg text-verified",
    measured: "bg-parchment text-stone",
    running: "bg-amber text-gold",
    concluded: "bg-low text-slate",
    active: "bg-verifiedbg text-verified",
    planned: "bg-wash text-deep",
  };
  return (
    <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${styles[status] ?? "bg-low text-slate"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function GrowthDesk() {
  const [data, setData] = useState<GrowthData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/growth", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/growth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "تعذّر التنفيذ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر التنفيذ");
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <div className="mt-16 flex items-center gap-3 py-16 font-mono text-[11px] uppercase tracking-[0.2em] text-slate">
        <Loader2 className="h-4 w-4 animate-spin text-deep" />
        تحميل مكتب النمو…
      </div>
    );
  }

  const totalLeads = data.leadsBySource.reduce((s, x) => s + x.count, 0);

  return (
    <div className="mt-20 border-t border-outlinev pt-14">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-wash px-4 py-2 text-[13px] font-bold text-deep">
        <Rocket className="h-4 w-4" />
        Growth OS · المرحلة ٣–٤ — عمليات محتوى معتمدة بشرياً
      </div>
      <h2 className="text-3xl font-bold tracking-tight text-inkwell md:text-4xl">
        مكتب النمو والمحتوى
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
        مسار واحد لا يتخطى البشر: مسودة → مراجعة → اعتماد → نشر → قياس. المحتوى
        المتوسط والعالي الخطورة لا يُعتمد إلا بقرار بشري صريح.
      </p>
      {error && (
        <p className="mt-4 rounded-lg bg-errorbg px-4 py-3 text-[13px] font-semibold text-error">
          {error}
        </p>
      )}

      {/* Attribution */}
      <h3 className="mt-12 flex items-center gap-2 text-xl font-bold text-inkwell">
        <TrendingUp className="h-5 w-5 text-deep" />
        مصادر طلبات التواصل (UTM)
      </h3>
      <div className="mt-4 flex flex-wrap gap-3">
        {data.leadsBySource.map((s) => (
          <div key={s.source} className="rounded-xl border border-outlinev bg-cloud px-5 py-4">
            <div className="tnum text-2xl font-bold text-deep">{s.count}</div>
            <div className="mt-1 text-[12px] font-semibold text-slate">
              {s.source}
              <span className="tnum text-slate/50"> · {totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Campaigns */}
      <h3 className="mt-12 flex items-center gap-2 text-xl font-bold text-inkwell">
        <Megaphone className="h-5 w-5 text-gold" />
        الحملات
      </h3>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.campaigns.map((c) => (
          <div key={c.id} className="rounded-xl border border-outlinev bg-cloud p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-inkwell">{c.name}</div>
              <StatusChip status={c.status} />
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-slate">{c.objective}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.channels.map((ch) => (
                <span key={ch} className="rounded-md bg-low px-2 py-1 text-[11px] font-semibold text-slate">
                  {CHANNEL_LABELS[ch] ?? ch}
                </span>
              ))}
            </div>
            <p className="mt-3 border-t border-low pt-3 text-[12px] leading-relaxed text-slate">
              <b className="text-inkwell">الفرضية:</b> {c.hypothesis}
              <br />
              <b className="text-inkwell">KPI:</b> {c.kpi}
            </p>
          </div>
        ))}
      </div>

      {/* Content pipeline */}
      <h3 className="mt-12 flex items-center gap-2 text-xl font-bold text-inkwell">
        <CalendarClock className="h-5 w-5 text-deep" />
        مسار المحتوى ({data.content.length})
      </h3>
      <div className="mt-4 space-y-3">
        {data.content.map((item) => {
          const next = NEXT_ACTION[item.status];
          const key = `c-${item.id}`;
          return (
            <div key={item.id} className="rounded-xl border border-outlinev bg-cloud p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={item.status} />
                <span className="rounded-md bg-low px-2 py-1 text-[11px] font-semibold text-slate">
                  {CHANNEL_LABELS[item.channel] ?? item.channel}
                </span>
                {item.risk !== "low" && (
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${RISK_STYLES[item.risk]}`}>
                    <ShieldAlert className="h-3 w-3" />
                    خطورة {RISK_LABELS[item.risk]}
                  </span>
                )}
                <span className="font-mono text-[11px] text-slate/60">{timeAgo(item.createdAt)}</span>
              </div>
              <h4 className="mt-2.5 font-bold text-inkwell">{item.title}</h4>
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate">{item.body}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-low pt-3">
                <div className="text-[12px] text-slate">
                  {item.cta ? <>CTA: <span className="font-semibold text-deep">{item.cta}</span></> : item.performanceNote ? (
                    <span className="inline-flex items-center gap-1.5 text-stone">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {item.performanceNote}
                    </span>
                  ) : "—"}
                </div>
                {next && (
                  <button
                    onClick={() => void act({ entity: "content", id: item.id, to: next.to }, key)}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-deep px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-horizon disabled:opacity-50"
                  >
                    {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {next.label}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Immutable decision log */}
      <h3 className="mt-12 flex items-center gap-2 text-2xl font-bold text-inkwell">
        <ScrollText className="h-5 w-5 text-deep" />
        سجل القرارات — أثر تدقيقي غير قابل للتعديل
      </h3>
      <div className="mt-4 overflow-hidden rounded-xl border border-outlinev bg-cloud">
        {data.auditLog.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate">
            لا قرارات مسجلة بعد — أول اعتماد أو رفض يُوثَّق هنا تلقائياً.
          </p>
        ) : (
          data.auditLog.map((a, i) => (
            <div
              key={a.id}
              className={`grid grid-cols-1 gap-1.5 p-4 md:grid-cols-12 md:items-center ${
                i > 0 ? "border-t border-low" : ""
              }`}
            >
              <div className="font-mono text-[11px] text-slate/60 md:col-span-2">
                {timeAgo(a.createdAt)}
              </div>
              <div className="md:col-span-3">
                <span className="rounded-md bg-wash px-2 py-1 font-mono text-[11px] font-semibold text-deep">
                  {a.action}
                </span>
              </div>
              <div className="text-[12px] text-slate md:col-span-3">
                {a.targetType} #{a.targetId}
                {a.prevState && a.newState && (
                  <span className="tnum text-slate/60"> · {a.prevState} → {a.newState}</span>
                )}
              </div>
              <div className="line-clamp-1 text-[12px] text-slate md:col-span-4">
                {a.reason ?? a.meta ?? "—"}
                <span className="ms-2 font-mono text-[10px] text-slate/50">by {a.actor}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Experiments */}
      <h3 className="mt-12 flex items-center gap-2 text-xl font-bold text-inkwell">
        <FlaskConical className="h-5 w-5 text-gold" />
        سجل التجارب — ذاكرة النمو
      </h3>
      <div className="mt-4 space-y-3">
        {data.experiments.map((e) => {
          const key = `e-${e.id}`;
          return (
            <div key={e.id} className="rounded-xl border border-outlinev bg-cloud p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={e.status} />
                <span className="text-[12px] font-semibold text-slate">{e.owner}</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-inkwell/85">«{e.hypothesis}»</p>
              <p className="mt-1 font-mono text-[11px] text-slate">المقياس: {e.metric}</p>
              {e.result && (
                <p className="mt-2.5 rounded-lg bg-low px-3.5 py-2.5 text-[13px] leading-relaxed text-slate">
                  {e.result}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-low pt-3">
                <span className="font-mono text-[11px] text-slate/60">
                  بدأت {timeAgo(e.startedAt)}
                </span>
                {e.status === "running" ? (
                  <div className="flex flex-wrap gap-2">
                    {(["keep", "iterate", "scale", "kill"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => void act({ entity: "experiment", id: e.id, decision: d }, key + d)}
                        disabled={busy !== null}
                        className={`rounded-lg border px-3.5 py-1.5 text-[12px] font-bold transition-colors disabled:opacity-50 ${
                          d === "kill"
                            ? "border-error/40 text-error hover:bg-error hover:text-white"
                            : "border-deep/30 text-deep hover:bg-deep hover:text-white"
                        }`}
                      >
                        {busy === key + d ? "…" : { keep: "إبقاء", iterate: "تكرار محسّن", scale: "توسيع", kill: "إيقاف" }[d]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-deep">
                    القرار:
                    {e.decision === "kill" ? "إيقاف" : e.decision === "scale" ? "توسيع" : e.decision === "iterate" ? "تكرار محسّن" : "إبقاء"}
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
