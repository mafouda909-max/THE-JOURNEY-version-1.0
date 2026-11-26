"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type PendingReport = {
  id: number;
  targetType: string;
  postId: number | null;
  commentId: number | null;
  category: string;
  details: string | null;
  createdAt: string;
  reporter: { displayName: string };
  postTitle: string | null;
  commentBody: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  spam: "إزعاج أو محتوى غير مرغوب",
  misinformation: "معلومة مضللة أو غير دقيقة",
  harassment: "إساءة أو مضايقة",
  privacy: "انتهاك خصوصية",
  unsafe: "محتوى قد يسبب ضرراً",
  other: "سبب آخر",
};

function ReportCard({ report }: { report: PendingReport }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"resolve" | "dismiss" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function review(action: "resolve" | "dismiss") {
    if (note.trim().length < 5) {
      setError("اكتب ملحوظة مراجعة من 5 أحرف على الأقل.");
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const response = await fetch("/api/community/reports/" + report.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "تعذر حفظ قرار المراجعة.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ قرار المراجعة.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-2xl border border-outlinev bg-cloud p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-deep">بلاغ من {report.reporter.displayName || "مشارك"}</div>
        <time className="text-[10px] text-slate">
          {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(report.createdAt))}
        </time>
      </div>
      <div className="mt-2 text-[11px] font-semibold text-signal">
        {report.targetType === "post" ? "منشور" : "تعليق"} · {CATEGORY_LABELS[report.category] ?? report.category}
      </div>
      <div className="mt-2 rounded-xl bg-low p-3">
        {report.postTitle ? <p className="text-xs font-bold text-inkwell">{report.postTitle}</p> : null}
        {report.commentBody ? <p className="whitespace-pre-line text-xs leading-6 text-inkwell">{report.commentBody}</p> : null}
        <div className="mt-1 text-[10px] text-slate">المعرّف: #{report.postId ?? report.commentId}</div>
      </div>
      {report.details ? <p className="mt-3 text-xs leading-6 text-slate">تفاصيل المبلّغ: {report.details}</p> : null}
      {error ? <p className="mt-3 rounded-lg bg-errorbg px-3 py-2 text-xs font-semibold text-error">{error}</p> : null}
      <label className="mt-3 block text-[11px] font-bold text-inkwell" htmlFor={"report-note-" + report.id}>ملحوظة المراجعة</label>
      <textarea
        id={"report-note-" + report.id}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={500}
        rows={2}
        className="mt-1 w-full rounded-lg border border-outlinev bg-low px-3 py-2 text-xs outline-none focus:border-signal"
        placeholder="ما الإجراء أو سبب إغلاق البلاغ؟"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void review("resolve")} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-verified px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">
          {busy === "resolve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          تمت المعالجة
        </button>
        <button type="button" onClick={() => void review("dismiss")} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-outlinev px-3 py-2 text-[11px] font-bold text-slate disabled:opacity-50">
          {busy === "dismiss" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          إغلاق دون إجراء
        </button>
      </div>
    </article>
  );
}

export function CommunityReportQueue({ reports }: { reports: PendingReport[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-outlinev bg-cloud p-6 text-center">
        <h2 className="font-bold text-inkwell">لا توجد بلاغات معلّقة.</h2>
        <p className="mt-2 text-xs text-slate">أي بلاغ جديد سيظهر هنا للمراجعة الخاصة.</p>
      </div>
    );
  }

  return (
    <section className="mt-10 space-y-4">
      <h2 className="text-xl font-bold text-inkwell">البلاغات المعلّقة ({reports.length})</h2>
      {reports.map((report) => <ReportCard key={report.id} report={report} />)}
    </section>
  );
}
