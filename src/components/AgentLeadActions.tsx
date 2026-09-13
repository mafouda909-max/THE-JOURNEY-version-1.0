"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";

type ContactStatus = "new" | "viewed" | "responded" | "closed";

const NEXT: Record<ContactStatus, { to: ContactStatus; label: string } | null> = {
  new: { to: "viewed", label: "تأكيد الاطلاع" },
  viewed: { to: "responded", label: "تسجيل أنه تم الرد" },
  responded: { to: "closed", label: "إغلاق الطلب" },
  closed: null,
};

export function AgentLeadActions({
  requestId,
  initialStatus,
  travelerEmail,
  travelerName,
}: {
  requestId: number;
  initialStatus: string;
  travelerEmail: string;
  travelerName: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ContactStatus>(
    initialStatus === "viewed" || initialStatus === "responded" || initialStatus === "closed" ? initialStatus : "new",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = NEXT[status];

  async function transition() {
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/contact-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: next.to }),
      });
      const data = await response.json() as { error?: string; contactRequest?: { status?: string } };
      if (!response.ok) throw new Error(data.error ?? "تعذر تحديث حالة الطلب.");
      const returned = data.contactRequest?.status;
      if (returned === "new" || returned === "viewed" || returned === "responded" || returned === "closed") {
        setStatus(returned);
      } else {
        setStatus(next.to);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث حالة الطلب.");
    } finally {
      setBusy(false);
    }
  }

  const subject = encodeURIComponent(`متابعة طلبك على THE JOURNEY #${requestId}`);
  const body = encodeURIComponent(`مرحباً ${travelerName}،\n\nأتواصل معك بخصوص طلبك على THE JOURNEY.\n`);

  return (
    <div className="mt-4 border-t border-low pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`mailto:${encodeURIComponent(travelerEmail)}?subject=${subject}&body=${body}`}
          className="inline-flex items-center gap-2 rounded-lg border border-deep/25 bg-white px-3.5 py-2 text-xs font-bold text-deep transition-colors hover:bg-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep focus-visible:ring-offset-2"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          مراسلة المسافر بالبريد
        </a>
        {next && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void transition()}
            className="inline-flex items-center gap-2 rounded-lg bg-deep px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-horizon disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep focus-visible:ring-offset-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            {busy ? "جاري التحديث…" : next.label}
          </button>
        )}
        {status === "closed" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate">
            <CheckCircle2 className="h-4 w-4 text-verified" aria-hidden="true" />
            دورة الطلب مكتملة
          </span>
        )}
      </div>
      <p className="mt-2 break-all font-mono text-[11px] text-slate" dir="ltr">{travelerEmail}</p>
      {status === "viewed" && (
        <p className="mt-2 text-xs leading-6 text-slate">بعد التواصل مع المسافر فعلياً، سجّل «تم الرد» حتى تعكس اللوحة الحالة الحقيقية.</p>
      )}
      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-errorbg px-3 py-2 text-xs font-semibold text-error" role="alert">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
