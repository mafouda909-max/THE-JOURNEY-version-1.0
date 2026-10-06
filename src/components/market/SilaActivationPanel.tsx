"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleOff,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type {
  SilaActivationManifest,
  SilaActivationState,
} from "@/lib/sila-activation-manifest";

const STATE_UI: Record<SilaActivationState, { label: string; cls: string }> = {
  ACTIVE: { label: "مفعّل", cls: "bg-verifiedbg text-verified" },
  READY: { label: "جاهز للتفعيل", cls: "bg-air text-deep" },
  BLOCKED: { label: "محجوب", cls: "bg-errorbg text-error" },
  SAFE_OFF: { label: "مغلق بأمان", cls: "bg-low text-slate" },
};

class ActivationRequestError extends Error {}

async function requestActivation(signal?: AbortSignal) {
  const response = await fetch("/api/sila/activation", {
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new ActivationRequestError(
      response.status === 401 || response.status === 403
        ? "انتهت صلاحية الجلسة الإدارية. سجّل الدخول من جديد."
        : "تعذر تحميل حالة التفعيل. أعد المحاولة بعد قليل.",
    );
  }
  const data = (await response.json()) as { manifest?: SilaActivationManifest };
  if (!data.manifest) {
    throw new ActivationRequestError("تعذر قراءة Manifest التفعيل.");
  }
  return data.manifest;
}

function requestError(error: unknown) {
  return error instanceof ActivationRequestError
    ? error.message
    : "تعذر الاتصال بخدمة التفعيل.";
}

export function SilaActivationPanel() {
  const [manifest, setManifest] = useState<SilaActivationManifest | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    setError(null);
    try {
      const next = await requestActivation(signal);
      if (!signal?.aborted) setManifest(next);
    } catch (err) {
      if (!signal?.aborted) setError(requestError(err));
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <section aria-labelledby="activation-title" className="mt-16 border-t border-outlinev pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="sila-eyebrow text-[11px] font-semibold text-signal">
            Activation Manifest
          </div>
          <h2 id="activation-title" className="mt-2 text-2xl font-bold text-inkwell md:text-3xl">
            تفعيل صلة
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate">
            اعرف ما يعمل الآن، وما هو جاهز، وما يجب أن يظل مغلقًا. هذه اللوحة لا تعرض الأسرار ولا تغيّر Environment Variables.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outlinev bg-cloud px-4 py-3 text-sm font-bold text-deep hover:bg-air disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          تحديث الحالة
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-error/20 bg-errorbg p-4 text-sm leading-7 text-error">
          <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {!manifest && busy ? (
        <p role="status" className="mt-5 flex items-center gap-2 py-6 text-sm text-slate">
          <Loader2 className="h-4 w-4 animate-spin" />
          جارٍ قراءة Manifest التفعيل…
        </p>
      ) : null}

      {manifest ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: "مفعّل", value: manifest.counts.ACTIVE, Icon: CheckCircle2 },
              { label: "جاهز", value: manifest.counts.READY, Icon: ShieldCheck },
              { label: "محجوب", value: manifest.counts.BLOCKED, Icon: AlertCircle },
              { label: "مغلق بأمان", value: manifest.counts.SAFE_OFF, Icon: CircleOff },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="sila-window border border-outlinev bg-cloud p-4">
                <Icon className="h-4 w-4 text-deep" />
                <div className="mt-3 text-2xl font-bold text-inkwell">{value.toLocaleString("ar-EG")}</div>
                <div className="mt-1 text-xs font-semibold text-slate">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {manifest.tracks.map((track) => {
              const state = STATE_UI[track.state];
              return (
                <article key={track.id} className="rounded-3xl border border-outlinev bg-cloud p-5 md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-inkwell">{track.label}</h3>
                    <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${state.cls}`}>
                      {state.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate">{track.purpose}</p>
                  <p className="mt-4 rounded-2xl bg-low/70 p-3 text-sm leading-7 text-deep">
                    {track.nextAction}
                  </p>

                  <details className="mt-4 text-xs text-slate">
                    <summary className="min-h-11 cursor-pointer py-3 font-semibold text-deep">
                      متطلبات التفعيل
                    </summary>
                    <div className="space-y-2 rounded-2xl bg-low/60 p-4">
                      {track.requirements.map((item) => (
                        <div key={`${track.id}-${item.key}`} className="flex items-start justify-between gap-4">
                          <div>
                            <div dir="ltr" className="break-all text-left font-mono text-[11px] text-inkwell">
                              {item.key}
                            </div>
                            <div className="mt-1 leading-5 text-slate">
                              {item.expectation}{item.sensitive ? " · سر خادمي" : ""}
                            </div>
                          </div>
                          <span className={item.satisfied ? "font-bold text-verified" : "font-bold text-slate"}>
                            {item.satisfied ? "جاهز" : "ناقص"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>

                  {track.blockers.length ? (
                    <div className="mt-4 space-y-1 text-xs leading-6 text-error">
                      {track.blockers.map((item) => <p key={item}>• {item}</p>)}
                    </div>
                  ) : null}
                  {track.warnings.length ? (
                    <div className="mt-4 space-y-1 text-xs leading-6 text-slate">
                      {track.warnings.map((item) => <p key={item}>• {item}</p>)}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-outlinev bg-low/50 p-4 text-xs leading-6 text-slate">
            <strong className="text-deep">Safe defaults:</strong>{" "}
            {manifest.safeDefaults.join(" · ")}
          </div>
        </>
      ) : null}
    </section>
  );
}
