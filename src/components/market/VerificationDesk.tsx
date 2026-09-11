"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  CheckCircle2,
  FileCheck2,
  Loader2,
  MapPin,
  ShieldAlert,
  Sparkles,
  Undo2,
  XCircle,
} from "lucide-react";
import type { Agent } from "@/db/schema";
import { timeAgo } from "@/lib/format";

type ReviewDocument = {
  id: number;
  documentType: string;
  originalName: string;
  status: string;
  rejectionReason: string | null;
  signedAccessUrl: string;
  expiresInSeconds: number;
};

type AIRun = {
  overallConfidence: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: "pass" | "review" | "reject";
  summary: string;
  profileChecks: {
    nameMatch: string;
    addressMatch: string;
    licenseMatch: string;
  };
};

type QueueAgent = Agent & { accountEmail: string | null };
type DeskMode = "verification" | "verified";

const STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار بدء المراجعة",
  in_review: "قيد المراجعة",
  verified: "موثّق",
  rejected: "مرفوض",
  suspended: "موقوف",
};

const DOC_LABELS: Record<string, string> = {
  identity: "إثبات الهوية",
  license: "إثبات النشاط السياحي",
  commercial_register: "السجل التجاري / مستند الكيان",
  tax_id: "المستند الضريبي",
};

const DOC_STATUS_LABELS: Record<string, string> = {
  uploading: "الرفع لم يكتمل",
  pending: "مؤكد في التخزين · بانتظار القرار",
  verified: "تم اعتماده",
  rejected: "مرفوض",
};

const MATCH_LABELS: Record<string, string> = {
  match: "مطابق",
  partial: "تطابق جزئي",
  mismatch: "غير متطابق",
  not_available: "غير متاح",
};

const RISK_LABELS: Record<string, string> = {
  low: "مخاطر منخفضة",
  medium: "مراجعة إضافية",
  high: "مخاطر مرتفعة",
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  pass: "يوصي بالمرور",
  review: "يوصي بالمراجعة",
  reject: "يوصي بالرفض",
};

function requiredDocumentTypes(agent: Agent): string[] {
  return agent.licenseType === "agency"
    ? ["identity", "license", "commercial_register"]
    : ["identity", "license"];
}

function eligibleEvidence(documents: ReviewDocument[]): ReviewDocument[] {
  return documents.filter((doc) => doc.status === "pending" || doc.status === "verified");
}

export function VerificationDesk({
  queue,
  mode = "verification",
}: {
  queue: QueueAgent[];
  mode?: DeskMode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<number | null>(null);
  const [aiRuns, setAiRuns] = useState<Record<number, AIRun>>({});
  const [error, setError] = useState<string | null>(null);
  const [decisionOpen, setDecisionOpen] = useState<Record<number, "reject" | "suspend" | null>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [docs, setDocs] = useState<Record<number, ReviewDocument[]>>({});
  const [loadingDocs, setLoadingDocs] = useState<number | null>(null);

  async function loadDocs(agentId: number, force = false) {
    if (docs[agentId] && !force) return;
    setLoadingDocs(agentId);
    setError(null);
    try {
      const response = await fetch(`/api/agents/${agentId}/documents`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر تحميل الأدلة");
      setDocs((current) => ({ ...current, [agentId]: data.documents ?? [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الأدلة");
    } finally {
      setLoadingDocs(null);
    }
  }

  async function runAIReview(agentId: number) {
    const loaded = docs[agentId];
    if (!loaded) {
      setError("حمّل أدلة التوثيق أولاً قبل تشغيل التحليل الآلي.");
      return;
    }
    if (eligibleEvidence(loaded).length === 0) {
      setError("لا توجد أدلة مؤكدة قابلة للتحليل لهذا الملف.");
      return;
    }

    setAiBusy(agentId);
    setError(null);
    try {
      const response = await fetch("/api/agent-verification/ai-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذر تشغيل مراجعة الذكاء الاصطناعي");
      setAiRuns((current) => ({ ...current, [agentId]: data.result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تشغيل مراجعة الذكاء الاصطناعي");
    } finally {
      setAiBusy(null);
    }
  }

  async function act(agentId: number, action: string, reason?: string) {
    const normalizedReason = reason?.trim();
    if ((action === "reject" || action === "suspend") && (!normalizedReason || normalizedReason.length < 10 || normalizedReason.length > 1000)) {
      setError("السبب مطلوب بين ١٠ و١٠٠٠ حرف ويُوثَّق في سجل القرارات.");
      return;
    }

    const key = `${agentId}-${action}`;
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: normalizedReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "تعذّر التنفيذ");
      setDecisionOpen((current) => ({ ...current, [agentId]: null }));
      setReasons((current) => ({ ...current, [agentId]: "" }));
      setAiRuns((current) => {
        const next = { ...current };
        delete next[agentId];
        return next;
      });
      setDocs((current) => {
        const next = { ...current };
        delete next[agentId];
        return next;
      });
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
        <CheckCircle2 className="mx-auto h-7 w-7 text-verified" strokeWidth={1.5} aria-hidden="true" />
        <p className="mt-3 font-bold text-inkwell">
          {mode === "verified" ? "لا وكلاء موثّقين في هذه القائمة." : "لا ملفات توثيق بانتظار المراجعة."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <p className="rounded-lg bg-errorbg px-4 py-3 text-[13px] font-semibold text-error" role="alert">
          {error}
        </p>
      )}
      <AnimatePresence>
        {queue.map((agent) => {
          const loadedDocs = docs[agent.id];
          const evidence = loadedDocs ? eligibleEvidence(loadedDocs) : [];
          const required = requiredDocumentTypes(agent);
          const completeRequiredSet = Boolean(loadedDocs) && required.every((type) => evidence.some((doc) => doc.documentType === type));
          const ai = aiRuns[agent.id];
          const reason = reasons[agent.id] ?? "";
          const decision = decisionOpen[agent.id] ?? null;
          const transition = agent.verificationStatus === "pending"
            ? { action: "start_review", label: "بدء المراجعة" }
            : agent.verificationStatus === "rejected" || agent.verificationStatus === "suspended"
              ? { action: "reinstate", label: "إعادة فتح الملف" }
              : null;

          return (
            <motion.div
              key={agent.id}
              layout
              exit={{ opacity: 0, x: -24 }}
              className="rounded-xl border border-outlinev bg-cloud p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Image
                  src={agent.photoUrl}
                  alt={agent.displayName}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-xl border border-outlinev object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-inkwell">{agent.displayName}</span>
                    <span className="rounded-md bg-low px-2 py-0.5 text-[11px] font-semibold text-slate">
                      {STATUS_LABELS[agent.verificationStatus] ?? agent.verificationStatus}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden="true" /> {agent.city}، {agent.country}
                    </span>
                    <span className="font-mono" dir="ltr">{agent.accountEmail ?? "—"}</span>
                    <span>{agent.licenseType === "agency" ? "وكالة / كيان" : "وكيل فرد"}</span>
                    <span>{timeAgo(agent.joinedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-low pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadDocs(agent.id, Boolean(loadedDocs))}
                    disabled={loadingDocs !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-deep/30 px-4 py-2 text-[12px] font-bold text-deep hover:bg-low focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 disabled:opacity-50"
                  >
                    {loadingDocs === agent.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    {loadedDocs ? "تحديث الأدلة" : "تحميل أدلة التوثيق"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAIReview(agent.id)}
                    disabled={aiBusy !== null || !loadedDocs || evidence.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-deep px-4 py-2 text-[12px] font-bold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {aiBusy === agent.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                    {aiBusy === agent.id ? "جاري تحليل الأدلة…" : ai ? "إعادة التحليل الآلي" : "تحليل الأدلة آليًا"}
                  </button>
                </div>

                {loadedDocs && (
                  <div className="mt-4">
                    <div className={`mb-3 rounded-lg px-3 py-2 text-[11px] font-semibold ${completeRequiredSet ? "bg-verifiedbg text-verified" : "bg-amber text-gold"}`}>
                      {completeRequiredSet
                        ? "مجموعة الأدلة المطلوبة ظاهرة للمراجع. الخادم سيعيد التحقق من وجود الملفات وصلاحيتها عند الاعتماد."
                        : `المجموعة الظاهرة غير مكتملة. المطلوب: ${required.map((type) => DOC_LABELS[type] ?? type).join("، ")}.`}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {loadedDocs.length === 0 ? (
                        <p className="text-xs text-error">لا توجد أدلة مرفوعة.</p>
                      ) : loadedDocs.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.signedAccessUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-low bg-white p-3 hover:border-deep focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
                        >
                          <div className="text-xs font-bold text-inkwell">{DOC_LABELS[doc.documentType] ?? doc.documentType}</div>
                          <div className="mt-1 truncate font-mono text-[10px] text-slate" dir="ltr">{doc.originalName}</div>
                          <div className="mt-1 text-[10px] text-slate">
                            {DOC_STATUS_LABELS[doc.status] ?? doc.status} · رابط خاص صالح {Math.max(1, Math.round(doc.expiresInSeconds / 60))} دقيقة
                          </div>
                          {doc.rejectionReason && <div className="mt-1 text-[10px] font-semibold text-error">سبب الرفض: {doc.rejectionReason}</div>}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {ai && (
                  <div className="mt-4 rounded-xl border border-deep/20 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-inkwell">توصية تحليل آلي للأدلة الحالية</div>
                      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                        <span className="rounded-full bg-low px-2.5 py-1">ثقة النموذج {Math.round(ai.overallConfidence)}%</span>
                        <span className="rounded-full bg-low px-2.5 py-1">{RISK_LABELS[ai.riskLevel] ?? ai.riskLevel}</span>
                        <span className="rounded-full bg-low px-2.5 py-1">{RECOMMENDATION_LABELS[ai.recommendation] ?? ai.recommendation}</span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-slate">{ai.summary}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {([
                        ["الاسم", ai.profileChecks.nameMatch],
                        ["العنوان", ai.profileChecks.addressMatch],
                        ["الترخيص", ai.profileChecks.licenseMatch],
                      ] as const).map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-low px-3 py-2 text-xs">
                          <div className="text-slate">{label}</div>
                          <div className="mt-1 font-bold text-inkwell">{MATCH_LABELS[value] ?? value}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-[11px] font-semibold leading-relaxed text-slate">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
                      هذه ثقة النموذج في تحليله وليست «درجة توثيق». القرار النهائي بشري، والخادم يعيد التحقق من الأدلة عند الاعتماد.
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {transition && (
                    <button
                      type="button"
                      onClick={() => void act(agent.id, transition.action)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-2 rounded-lg border border-deep/30 px-4 py-2 text-[12px] font-bold text-deep hover:bg-deep hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 disabled:opacity-50"
                    >
                      {busy === `${agent.id}-${transition.action}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />}
                      {transition.label}
                    </button>
                  )}

                  {agent.verificationStatus === "in_review" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void act(agent.id, "verify")}
                        disabled={busy !== null || !completeRequiredSet}
                        title={!completeRequiredSet ? "حمّل الأدلة المطلوبة أولاً" : undefined}
                        className="inline-flex items-center gap-2 rounded-lg bg-verified px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-verified/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy === `${agent.id}-verify` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                        اعتماد التوثيق
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecisionOpen((current) => ({ ...current, [agent.id]: decision === "reject" ? null : "reject" }))}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-error/40 px-4 py-2 text-[12px] font-bold text-error hover:bg-error hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-error/20 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> رفض مع سبب
                      </button>
                    </>
                  )}

                  {agent.verificationStatus === "verified" && (
                    <button
                      type="button"
                      onClick={() => setDecisionOpen((current) => ({ ...current, [agent.id]: decision === "suspend" ? null : "suspend" }))}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-2 rounded-lg border border-error/40 px-4 py-2 text-[12px] font-bold text-error hover:bg-error hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-error/20 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> إيقاف مؤقت
                    </button>
                  )}
                </div>

                {(decision === "reject" || decision === "suspend") && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <label className="flex-1">
                      <span className="sr-only">{decision === "reject" ? "سبب رفض التوثيق" : "سبب إيقاف الوكيل"}</span>
                      <input
                        value={reason}
                        onChange={(event) => setReasons((current) => ({ ...current, [agent.id]: event.target.value }))}
                        minLength={10}
                        maxLength={1000}
                        placeholder={decision === "reject" ? "سبب الرفض الموثّق — يصل للوكيل…" : "سبب الإيقاف الموثّق — يصل للوكيل…"}
                        className="w-full rounded-lg border border-outlinev px-4 py-2 text-[13px] outline-none focus:border-error focus:ring-4 focus:ring-error/10"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void act(agent.id, decision, reason)}
                      disabled={busy !== null}
                      className="rounded-lg bg-error px-4 py-2 text-[12px] font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-error/20 disabled:opacity-50"
                    >
                      {busy === `${agent.id}-${decision}` ? "…" : decision === "reject" ? "تأكيد الرفض" : "تأكيد الإيقاف"}
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
