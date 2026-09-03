"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, CheckCircle2, Loader2, MapPin, Undo2, XCircle } from "lucide-react";
import type { Agent } from "@/db/schema";
import { timeAgo } from "@/lib/format";

const ACTION_LABELS: Record<string, { label: string; to: string; danger?: boolean } | null> = {
  pending: { label: "مراجعة الملف", to: "in_review" },
  in_review: null,
  rejected: { label: "إعادة فتح الملف", to: "in_review" },
  suspended: { label: "إعادة فتح الملف", to: "in_review" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار المراجعة",
  in_review: "قيد المراجعة",
  rejected: "مرفوض",
  suspended: "موقوف",
};

export function VerificationDesk({ queue }: { queue: (Agent & { accountEmail: string | null })[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  async function act(agentId: number, action: string, r?: string) {
    const key = `${agentId}-${action}`;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: r }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذّر التنفيذ");
      setRejecting(null);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر التنفيذ");
    } finally {
      setBusy(null);
    }
  }

  if (queue.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-outlinev bg-cloud px-8 py-12 text-center">
        <CheckCircle2 className="mx-auto h-7 w-7 text-verified" strokeWidth={1.5} />
        <p className="mt-3 font-bold text-inkwell">لا ملفات توثيق بانتظار القرار.</p>
        <p className="mt-1 text-sm text-slate">حسابات الوكلاء الجدد من /join تظهر هنا فور تسجيلها.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <p className="rounded-lg bg-errorbg px-4 py-3 text-[13px] font-semibold text-error">{error}</p>
      )}
      <AnimatePresence>
        {queue.map((a) => {
          const aux = ACTION_LABELS[a.verificationStatus] ?? null;
          return (
            <motion.div
              key={a.id}
              layout
              exit={{ opacity: 0, x: -24 }}
              className="rounded-xl border border-outlinev bg-cloud p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Image
                  src={a.photoUrl}
                  alt={a.displayName}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-xl border border-outlinev object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-inkwell">{a.displayName}</span>
                    <span className="rounded-md bg-low px-2 py-0.5 text-[11px] font-semibold text-slate">
                      {STATUS_LABELS[a.verificationStatus] ?? a.verificationStatus}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {a.city}، {a.country}
                    </span>
                    <span className="font-mono">{a.accountEmail ?? "—"}</span>
                    <span>{a.licenseType === "agency" ? "كيان مرخّص" : "وكيل فرد"}</span>
                    <span>{timeAgo(a.joinedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-low pt-4">
                {a.verificationStatus === "in_review" && (
                  <>
                    <button
                      onClick={() => void act(a.id, "verify")}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-2 rounded-lg bg-verified px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === `${a.id}-verify` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                      اعتماد التوثيق
                    </button>
                    <button
                      onClick={() => setRejecting(rejecting === a.id ? null : a.id)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-2 rounded-lg border border-error/40 px-4 py-2 text-[12px] font-bold text-error transition-colors hover:bg-error hover:text-white disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      رفض مع سبب
                    </button>
                  </>
                )}
                {a.verificationStatus === "verified" && (
                  <span className="text-[12px] text-slate">—</span>
                )}
                {aux && (
                  <button
                    onClick={() => void act(a.id, "reinstate")}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-deep/30 px-4 py-2 text-[12px] font-bold text-deep transition-colors hover:bg-deep hover:text-white disabled:opacity-50"
                  >
                    {busy === `${a.id}-reinstate` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                    {aux.label === "مراجعة الملف" ? "بدء المراجعة" : aux.label}
                  </button>
                )}
                {a.verificationStatus === "in_review" && rejecting === a.id && (
                  <div className="flex w-full gap-2">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="سبب الرفض الموثَّق — يصل للوكيل…"
                      className="flex-1 rounded-lg border border-outlinev px-4 py-2 text-[13px] outline-none focus:border-error focus:ring-4 focus:ring-error/10"
                    />
                    <button
                      onClick={() => void act(a.id, "reject", reason)}
                      disabled={busy !== null}
                      className="rounded-lg bg-error px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
                    >
                      {busy === `${a.id}-reject` ? "…" : "تأكيد"}
                    </button>
                  </div>
                )}
                {a.verificationStatus === "verified" && (
                  <button
                    onClick={() => setRejecting(rejecting === -a.id ? null : -a.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-error/40 px-4 py-2 text-[12px] font-bold text-error transition-colors hover:bg-error hover:text-white"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    إيقاف مؤقت
                  </button>
                )}
                {rejecting === -a.id && (
                  <div className="flex w-full gap-2">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="سبب الإيقاف الموثَّق…"
                      className="flex-1 rounded-lg border border-outlinev px-4 py-2 text-[13px] outline-none focus:border-error focus:ring-4 focus:ring-error/10"
                    />
                    <button
                      onClick={() => void act(a.id, "suspend", reason)}
                      disabled={busy !== null}
                      className="rounded-lg bg-error px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
                    >
                      {busy === `${a.id}-suspend` ? "…" : "إيقاف"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
