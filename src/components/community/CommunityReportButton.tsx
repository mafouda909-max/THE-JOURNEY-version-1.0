"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Loader2, Flag } from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "spam", label: "إزعاج أو محتوى غير مرغوب" },
  { value: "misinformation", label: "معلومة مضللة أو غير دقيقة" },
  { value: "harassment", label: "إساءة أو مضايقة" },
  { value: "privacy", label: "انتهاك خصوصية" },
  { value: "unsafe", label: "محتوى قد يسبب ضرراً" },
  { value: "other", label: "سبب آخر" },
];

export function CommunityReportButton({
  targetType,
  targetId,
}: {
  targetType: "post" | "comment";
  targetId: number;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reported) return;
    setBusy(true);
    setMessage(null);
    setNeedsLogin(false);
    try {
      const response = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, category, details }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (response.status === 401) setNeedsLogin(true);
      if (!response.ok) throw new Error(payload.error ?? "تعذر إرسال البلاغ.");
      setReported(true);
      setMessage(payload.message ?? "وصل البلاغ للمراجعة.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إرسال البلاغ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate hover:bg-low hover:text-deep"
      >
        <Flag className="h-3.5 w-3.5" />
        {reported ? "تم الإبلاغ" : "إبلاغ"}
      </button>

      {open && !reported ? (
        <form onSubmit={submit} className="mt-2 w-64 max-w-[80vw] rounded-xl border border-outlinev bg-cloud p-3 shadow-sm">
          <label className="block text-[11px] font-bold text-inkwell" htmlFor={"report-category-" + targetType + "-" + targetId}>
            سبب البلاغ
          </label>
          <select
            id={"report-category-" + targetType + "-" + targetId}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2 w-full rounded-lg border border-outlinev bg-low px-2.5 py-2 text-xs text-inkwell"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="تفاصيل اختيارية تساعد فريق المراجعة"
            className="mt-2 w-full rounded-lg border border-outlinev bg-low px-2.5 py-2 text-xs text-inkwell outline-none focus:border-signal"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-[10px] font-semibold text-slate underline">
              إلغاء
            </button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-deep px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
              إرسال البلاغ
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className="mt-1 max-w-64 text-[10px] leading-5 text-slate">
          {message}
          {needsLogin ? <Link href="/join" className="ms-1 font-bold text-deep underline">تسجيل الدخول</Link> : null}
        </p>
      ) : null}
    </div>
  );
}
