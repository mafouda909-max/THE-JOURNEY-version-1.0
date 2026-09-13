"use client";

import { useEffect, useRef, useState } from "react";

type ResponseValue = "approved" | "declined" | "changes_requested";

type ApiResult = { error?: string; response?: ResponseValue; recorded?: boolean };

const responseLabel: Record<ResponseValue, string> = {
  approved: "موافق على العرض",
  changes_requested: "أحتاج تعديلات",
  declined: "لا يناسبني",
};

export function QuoteClientActions({
  token,
  initialResponse,
}: {
  token: string;
  initialResponse: ResponseValue | null;
}) {
  const [response, setResponse] = useState<ResponseValue | null>(initialResponse);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const viewScheduled = useRef(false);

  useEffect(() => {
    const sessionKey = `journey-quote-view:${token.slice(0, 12)}`;
    if (window.sessionStorage.getItem(sessionKey) === "1") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (viewScheduled.current || document.visibilityState !== "visible") return;
      viewScheduled.current = true;
      timer = setTimeout(() => {
        void fetch(`/api/quote-deliveries/${encodeURIComponent(token)}/view`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
          keepalive: true,
        }).then((result) => {
          if (result.ok) window.sessionStorage.setItem(sessionKey, "1");
        }).catch(() => {
          // View telemetry is best-effort and must never block quote access.
          viewScheduled.current = false;
        });
      }, 1200);
    };

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      document.removeEventListener("visibilitychange", schedule);
      if (timer) clearTimeout(timer);
    };
  }, [token]);

  async function submit(nextResponse: ResponseValue) {
    setBusy(true);
    setError("");
    try {
      const result = await fetch(`/api/quote-deliveries/${encodeURIComponent(token)}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: nextResponse, message: message.trim() || null }),
      });
      const data = await result.json() as ApiResult;
      if (!result.ok) throw new Error(data.error ?? "تعذر تسجيل ردك الآن.");
      setResponse(nextResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل ردك الآن.");
    } finally {
      setBusy(false);
    }
  }

  if (response) {
    return (
      <section className="rounded-2xl border border-verified/20 bg-verifiedbg p-5" aria-live="polite">
        <div className="text-sm font-bold text-verified">تم تسجيل ردك</div>
        <p className="mt-2 text-sm leading-relaxed text-inkwell">{responseLabel[response]}. ستراجع الوكالة الخطوة التالية معك.</p>
        {response === "approved" && (
          <p className="mt-2 text-xs leading-relaxed text-slate">الموافقة هنا تُبلغ الوكالة بقرارك، لكنها لا تعني أن الحجز أو الدفع قد تم تأكيده بعد.</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-outlinev bg-white p-5 sm:p-6" aria-labelledby="quote-response-title">
      <h2 id="quote-response-title" className="text-xl font-bold text-inkwell">ما قرارك بشأن هذا العرض؟</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate">يمكنك الموافقة، طلب تعديل، أو إبلاغ الوكالة أن العرض لا يناسبك. لن نعتبر الموافقة حجزًا نهائيًا قبل تأكيد الوكالة للتوفر والدفع.</p>

      <label className="mt-5 block text-xs font-bold text-slate">
        رسالة للوكالة — اختيارية
        <textarea
          value={message}
          maxLength={1000}
          onChange={(event) => setMessage(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-xl border border-outlinev bg-white px-3 py-3 text-sm font-normal text-inkwell outline-none focus:border-deep focus-visible:ring-4 focus-visible:ring-deep/15"
          placeholder="اكتب أي تعديل أو سؤال مهم…"
        />
      </label>

      {error && <div role="alert" className="mt-3 rounded-xl border border-error/20 bg-errorbg p-3 text-sm text-error">{error}</div>}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button type="button" disabled={busy} onClick={() => void submit("approved")} className="min-h-12 rounded-xl bg-verified px-4 py-3 text-sm font-bold text-white disabled:opacity-50">موافق على العرض</button>
        <button type="button" disabled={busy} onClick={() => void submit("changes_requested")} className="min-h-12 rounded-xl border border-deep bg-white px-4 py-3 text-sm font-bold text-deep disabled:opacity-50">أحتاج تعديلات</button>
        <button type="button" disabled={busy} onClick={() => void submit("declined")} className="min-h-12 rounded-xl border border-outlinev bg-white px-4 py-3 text-sm font-bold text-slate disabled:opacity-50">لا يناسبني</button>
      </div>
    </section>
  );
}
