"use client";

import { useState } from "react";

export type DirectConfirmationView = {
  providerName: string;
  channel: string;
  note: string | null;
  reportedAt: string;
  travelerResponse: "confirmed" | "not_confirmed" | null;
  travelerResponseNote: string | null;
  travelerRespondedAt: string | null;
};

const channelLabels: Record<string, string> = {
  phone: "مكالمة هاتفية",
  whatsapp: "واتساب",
  email: "بريد إلكتروني",
  in_person: "مقابلة مباشرة",
  other: "وسيلة أخرى",
};

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DirectConfirmationActions({
  token,
  confirmation,
}: {
  token: string;
  confirmation: DirectConfirmationView | null;
}) {
  const [response, setResponse] = useState<"confirmed" | "not_confirmed" | null>(confirmation?.travelerResponse ?? null);
  const [message, setMessage] = useState(confirmation?.travelerResponseNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (!confirmation) return null;

  async function submit(next: "confirmed" | "not_confirmed") {
    setBusy(true);
    setError("");
    try {
      const result = await fetch(`/api/quote-deliveries/${encodeURIComponent(token)}/acknowledge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: next, message: message.trim() || null }),
      });
      const data = await result.json() as { error?: string };
      if (!result.ok) throw new Error(data.error ?? "تعذر تسجيل إقرارك.");
      setResponse(next);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل إقرارك.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-outlinev bg-white p-5 sm:p-6" aria-labelledby="direct-confirmation-response-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="direct-confirmation-response-title" className="text-lg font-bold text-inkwell">تأكيد التواصل المباشر</h2>
        <span className="rounded-lg bg-amber px-3 py-1 text-[11px] font-bold text-gold">إفادة الوكالة</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate">
        أفادت الوكالة بأنها تواصلت مباشرة مع مقدم الخدمة. راجع البيانات التالية وأخبرنا هل تواصل معك مقدم الخدمة وأكد التفاصيل؟
      </p>

      <div className="mt-4 grid gap-3 rounded-xl bg-low p-4 text-sm sm:grid-cols-2">
        <div>مقدم الخدمة: <b className="text-inkwell">{confirmation.providerName}</b></div>
        <div>وسيلة التواصل: <b className="text-inkwell">{channelLabels[confirmation.channel] ?? confirmation.channel}</b></div>
        <div>تاريخ الإفادة: <b className="text-inkwell">{dateTime(confirmation.reportedAt)}</b></div>
        {confirmation.note && <p className="whitespace-pre-wrap text-xs leading-6 text-slate sm:col-span-2">{confirmation.note}</p>}
      </div>

      <p className="mt-3 rounded-xl border border-gold/20 bg-amber/35 p-3 text-xs leading-6 text-slate">
        هذه إفادة من الوكالة وليست تحققًا مستقلًا من صلة أو حجزًا أو تذكرة أو عملية دفع. تأكيد الخدمة يتم مباشرة بينك وبين مقدم الخدمة خارج المنصة.
      </p>

      {response ? (
        <div className="mt-4 rounded-xl border border-verified/20 bg-verifiedbg p-4" aria-live="polite">
          <div className="text-sm font-bold text-verified">
            {response === "confirmed" ? "أكدت أن مقدم الخدمة تواصل معك مباشرة." : "سجلت أنك لم تتلقَّ تأكيدًا مباشرًا من مقدم الخدمة."}
          </div>
          {confirmation.travelerRespondedAt && <p className="mt-1 text-xs text-slate">تاريخ الإقرار: {dateTime(confirmation.travelerRespondedAt)}</p>}
          {confirmation.travelerResponseNote && <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate">{confirmation.travelerResponseNote}</p>}
          {saved && <p className="mt-1 text-xs text-slate">تم حفظ ردك.</p>}
        </div>
      ) : (
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate">
            ملاحظة — اختيارية
            <textarea
              value={message}
              maxLength={500}
              onChange={(event) => setMessage(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-outlinev bg-white p-3 text-sm font-normal text-inkwell"
              placeholder="اكتب ملاحظة مختصرة إن لزم."
            />
          </label>
          {error && <p role="alert" className="mt-3 rounded-lg bg-errorbg p-3 text-xs text-error">{error}</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={busy} onClick={() => void submit("confirmed")} className="min-h-11 rounded-lg bg-deep px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              نعم، تواصل معي وأكد التفاصيل
            </button>
            <button type="button" disabled={busy} onClick={() => void submit("not_confirmed")} className="min-h-11 rounded-lg border border-outlinev px-4 py-2 text-xs font-bold text-slate disabled:opacity-50">
              لم أتلقَّ تأكيدًا مباشرًا
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
