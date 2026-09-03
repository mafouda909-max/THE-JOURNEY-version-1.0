"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug, RefreshCw, Wrench } from "lucide-react";
import type { ToolState } from "@/lib/tools";

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  CONNECTED: { label: "متصل", cls: "bg-verifiedbg text-verified" },
  CONFIGURED: { label: "مهيأ — أول استخدام سيُكمل المصافحة", cls: "bg-wash text-deep" },
  NOT_CONFIGURED: { label: "يتطلب تهيئة", cls: "bg-low text-slate" },
  DEGRADED: { label: "متدهور", cls: "bg-amber text-gold" },
  DISABLED: { label: "معطّل", cls: "bg-errorbg text-error" },
};

const LEVEL_UI: Record<string, string> = {
  L0: "قراءة فقط",
  L1: "توصية/تحليل",
  L2: "كتابة منخفضة الخطورة",
  L3: "يتطلب اعتمادًا",
  L4: "سلطة بشرية فقط",
};

export function ToolMatrix() {
  const [tools, setTools] = useState<ToolState[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (probe: boolean) => {
    setBusy(probe);
    try {
      const res = await fetch("/api/tools", {
        method: probe ? "POST" : "GET",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!tools) {
    return (
      <div className="mt-16 flex items-center gap-3 py-10 font-mono text-[11px] uppercase tracking-[0.2em] text-slate">
        <Loader2 className="h-4 w-4 animate-spin text-deep" />
        فحص طبقة الأدوات…
      </div>
    );
  }

  return (
    <section className="mt-20 border-t border-outlinev pt-14">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-wash px-4 py-2 text-[13px] font-bold text-deep">
            <Wrench className="h-4 w-4" />
            External Tooling — سجل الأدوات الحي
          </div>
          <h2 className="text-2xl font-bold text-inkwell md:text-3xl">ما الذي يمكن للمنظومة لمسه فعلًا؟</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
            الحالة تُحسب الآن من بيئة التشغيل: بيانات اعتماد موجودة + فحص صحة
            حقيقي. لا شيء هنا «متصل» لمجرد وجود واجهة.
          </p>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-deep/30 px-4 py-2.5 text-[12px] font-bold text-deep transition-colors hover:bg-deep hover:text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          إعادة فحص موثّقة
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-outlinev bg-cloud">
        {tools.map((t, i) => {
          const s = STATUS_UI[t.status] ?? STATUS_UI.NOT_CONFIGURED;
          return (
            <div
              key={t.key}
              className={`grid grid-cols-1 gap-2 p-4 md:grid-cols-12 md:items-center ${i > 0 ? "border-t border-low" : ""}`}
            >
              <div className="flex items-center gap-2.5 md:col-span-3">
                <Plug className={`h-4 w-4 ${t.status === "CONNECTED" ? "text-verified" : "text-slate/40"}`} />
                <div>
                  <div className="text-[14px] font-bold text-inkwell">{t.name}</div>
                  <div className="font-mono text-[10px] text-slate/50">{t.key}</div>
                </div>
              </div>
              <div className="md:col-span-2">
                <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${s.cls}`}>
                  {t.status === "CONNECTED" ? s.label : t.status === "NOT_CONFIGURED" ? s.label : s.label.split("—")[0]}
                </span>
              </div>
              <div className="text-[12px] font-semibold text-slate md:col-span-2">
                {LEVEL_UI[t.level]}
                {t.readOnly ? <span className="text-slate/50"> · RO</span> : ""}
              </div>
              <div className="text-[12px] leading-relaxed text-slate md:col-span-3">
                {t.note}
                {t.missing.length > 0 && <span className="mt-1 block font-mono text-[10px] text-gold">ينقص: {t.missing.join(", ")}</span>}
              </div>
              <div className="font-mono text-[10px] text-slate/50 md:col-span-2 md:text-end">
                {t.latencyMs !== null ? `${t.latencyMs}ms` : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-slate/50">
        probes are read-only · write actions pass the existing approval gates · every probe writes audit_log
      </p>
    </section>
  );
}
