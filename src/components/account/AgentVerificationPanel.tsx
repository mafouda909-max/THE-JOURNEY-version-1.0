"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, FileText, Loader2, Shield, UploadCloud, X } from "lucide-react";
import { accountAction } from "@/lib/account-action";
import {
  agentVerificationState,
  type AgentProfile,
} from "@/lib/agent-workspace";
import { secondaryAction } from "./WorkspaceParts";

type VerificationDocument = {
  id: number;
  documentType: string;
  originalName: string;
  status: string;
  rejectionReason: string | null;
  expiresAt: string | null;
};

const DOCS = [
  {
    key: "identity",
    title: "إثبات الهوية",
    note: "هوية رسمية سارية باسم صاحب الحساب.",
    required: true,
  },
  {
    key: "license",
    title: "إثبات النشاط السياحي",
    note: "ترخيص أو مستند مهني ساري يثبت حقك في تقديم الخدمة السياحية.",
    required: true,
  },
  {
    key: "commercial_register",
    title: "السجل التجاري / مستند الكيان",
    note: "مطلوب للوكالة أو الكيان، ويجب أن يطابق بيانات الجهة.",
    required: false,
  },
  {
    key: "tax_id",
    title: "المستند الضريبي",
    note: "دليل داعم عند توفره؛ قد يطلبه فريق الثقة عند الحاجة.",
    required: false,
  },
] as const;

const DOC_STATUS: Record<string, string> = {
  uploading: "الرفع لم يكتمل",
  pending: "قيد المراجعة",
  verified: "تمت مراجعته",
  rejected: "يحتاج استبدالًا",
};

export function AgentVerificationPanel({
  initialProfile,
  initialDocuments,
  observedAt,
}: {
  initialProfile: AgentProfile;
  initialDocuments: VerificationDocument[];
  observedAt: number;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState(initialDocuments);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = agentVerificationState(initialProfile.verificationStatus);
  const required = DOCS.filter(
    (doc) =>
      doc.required ||
      (doc.key === "commercial_register" &&
        initialProfile.licenseType === "agency"),
  );

  const latestFor = (type: string) =>
    docs.find((doc) => doc.documentType === type);

  const acceptable = (doc: VerificationDocument | undefined) =>
    Boolean(
      doc &&
        ["pending", "verified"].includes(doc.status) &&
        (!doc.expiresAt || new Date(doc.expiresAt).getTime() > observedAt),
    );

  const satisfied = required.filter((doc) =>
    acceptable(latestFor(doc.key)),
  ).length;

  const missingRequired = required.filter((doc) => !acceptable(latestFor(doc.key)));

  async function uploadDocument(type: string, file: File | undefined) {
    if (!file) return;
    setUploading(type);
    setError(null);
    setMessage(null);

    try {
      if (!file.size || file.size > 3 * 1024 * 1024)
        throw new Error("اختر ملفًا صالحًا لا يتجاوز 3MB.");
      if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
        throw new Error("يسمح فقط بـ PDF أو JPG أو PNG.");

      const data = await accountAction(
        "/api/agent-verification",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType: type,
            originalName: file.name,
            contentType: file.type,
            contentLength: file.size,
          }),
        },
        "تعذر تجهيز الرفع. حاول مرة أخرى.",
      );

      const uploadUrl = (data.upload as { uploadUrl?: string } | undefined)?.uploadUrl;
      const document = data.document as VerificationDocument | undefined;
      if (!uploadUrl || !document?.id)
        throw new Error("تعذر تجهيز رابط رفع آمن.");

      const uploaded = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
        signal: AbortSignal.timeout(90_000),
      });
      await uploaded.arrayBuffer();
      if (!uploaded.ok)
        throw new Error("لم يكتمل رفع المستند. حاول رفعه مرة أخرى.");

      const confirmed = await accountAction(
        "/api/agent-verification",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm", documentId: document.id }),
        },
        "تعذر تأكيد وصول المستند. أعد فتح الملف قبل المحاولة مجددًا.",
      );

      const saved = confirmed.document as VerificationDocument | undefined;
      if (
        confirmed.stored !== true ||
        !saved ||
        saved.id !== document.id ||
        saved.documentType !== document.documentType ||
        saved.status !== "pending"
      ) {
        throw new Error("لم يتأكد وصول المستند وتثبيت حالته في التخزين الخاص. أعد فتح الصفحة قبل المحاولة مجددًا.");
      }

      setDocs((current) => [
        {
          ...document,
          ...saved,
          rejectionReason: null,
          expiresAt: null,
        },
        ...current.filter((doc) => doc.id !== document.id),
      ]);
      setMessage("وصل المستند للتخزين الخاص وأصبح قيد المراجعة. رفعه لا يعني اعتماد الوكيل.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.name !== "TimeoutError"
          ? err.message
          : "استغرق الرفع وقتًا طويلًا. حاول مرة أخرى.",
      );
    } finally {
      setUploading(null);
    }
  }

  return (
    <div>
      <section className="decision-board">
        <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
          <div className="p-5 md:p-7">
            <div className={
              "decision-state " +
              (state.tone === "verified"
                ? "decision-state--confirmed"
                : state.tone === "error"
                  ? "decision-state--conflicting"
                  : "decision-state--focus")
            }>
              اعتماد الوكيل · {state.label}
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.025em] text-deep md:text-3xl">
              {state.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate">{state.note}</p>
            <p className="mt-4 max-w-2xl text-[11px] leading-6 text-slate">
              اعتماد الوكيل يخص نطاق الأدلة التي يراجعها فريق الثقة. تأكيد البريد أو رفع ملف واحد لا يمنح اعتمادًا عامًا.
            </p>
          </div>

          <div className="border-t border-outlinev bg-low/40 p-5 lg:border-s lg:border-t-0 md:p-6">
            <div className="text-[10px] font-bold text-slate">الأدلة المطلوبة</div>
            <div className="tnum mt-2 text-3xl font-bold text-deep">{satisfied}/{required.length}</div>
            <div className="mt-2 text-[11px] leading-5 text-slate">
              جاهز للمراجعة بحسب الملفات الحالية
            </div>
            {missingRequired.length ? (
              <div className="mt-4 border-t border-outlinev pt-3">
                <div className="text-[10px] font-bold text-gold">ينقص الآن</div>
                <div className="mt-2 space-y-1 text-[11px] text-slate">
                  {missingRequired.map((doc) => <div key={doc.key}>{doc.title}</div>)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <p role="alert" className="mt-5 border-y border-error/20 bg-errorbg px-4 py-3 text-sm leading-7 text-error">
          {error}
        </p>
      ) : null}

      {message ? (
        <p role="status" className="mt-5 border-y border-sky/30 bg-air px-4 py-3 text-sm leading-7 text-deep">
          {message}
        </p>
      ) : null}

      <section className="mt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold text-signal">Evidence lifecycle</div>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-deep">مستند → تخزين خاص → مراجعة → نطاق ثقة</h2>
          </div>
          <Link href="/account/profile" className={secondaryAction}>تعديل الملف المهني</Link>
        </div>

        <div className="divide-y divide-outlinev border-y border-outlinev bg-cloud">
          {DOCS.map((doc) => {
            const isRequired = required.some((item) => item.key === doc.key);
            const latest = latestFor(doc.key);
            const expired =
              Boolean(latest?.expiresAt) &&
              new Date(latest!.expiresAt as string).getTime() <= observedAt;
            const status = expired
              ? "منتهي الصلاحية"
              : latest
                ? DOC_STATUS[latest.status] ?? "يحتاج مراجعة"
                : "لم يُرفع";

            const verified = latest?.status === "verified" && !expired;
            const rejected = latest?.status === "rejected" || expired;

            return (
              <article key={doc.key} className="grid gap-5 px-1 py-6 md:grid-cols-[44px_1fr_180px_auto] md:items-start md:px-4">
                <span className={
                  "grid h-10 w-10 place-items-center rounded-full " +
                  (verified
                    ? "bg-verifiedbg text-verified"
                    : rejected
                      ? "bg-errorbg text-error"
                      : latest
                        ? "bg-air text-signal"
                        : "bg-low text-slate")
                }>
                  {verified ? <Check className="h-4 w-4" /> : rejected ? <X className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-deep">{doc.title}</h3>
                    <span className="text-[10px] text-slate">{isRequired ? "مطلوب للتوثيق" : "اختياري"}</span>
                  </div>
                  <p className="mt-2 max-w-2xl text-[11px] leading-6 text-slate">{doc.note}</p>
                  {latest ? (
                    <div className="mt-3 break-all text-[10px] leading-5 text-slate">
                      الملف: {latest.originalName}
                    </div>
                  ) : null}
                  {latest?.rejectionReason ? (
                    <p className="mt-2 text-[11px] leading-5 text-error">
                      ملاحظات المراجعة: {latest.rejectionReason}
                    </p>
                  ) : null}
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate">الحالة</div>
                  <div className={
                    "mt-2 text-[12px] font-bold " +
                    (verified ? "text-verified" : rejected ? "text-error" : latest ? "text-signal" : "text-slate")
                  }>
                    {status}
                  </div>
                  {latest?.expiresAt ? (
                    <div className="mt-1 text-[10px] text-slate">
                      الصلاحية: {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(latest.expiresAt))}
                    </div>
                  ) : null}
                </div>

                <label className={`${secondaryAction} relative cursor-pointer text-xs ${uploading ? "opacity-60" : ""}`}>
                  {uploading === doc.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  {latest ? "استبدال" : "رفع مستند"}
                  <input
                    aria-label={`رفع ${doc.title}`}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="sr-only"
                    disabled={uploading !== null}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      void uploadDocument(doc.key, file);
                    }}
                  />
                </label>
              </article>
            );
          })}
        </div>

        <details className="progressive-panel mt-6">
          <summary>حدود رفع المستندات وماذا يحدث بعدها</summary>
          <div className="border-t border-outlinev py-4 text-[11px] leading-6 text-slate">
            الملفات المقبولة PDF أو JPG أو PNG وحتى 3MB للمستند في التجربة الحالية. الرفع يثبت وصول الملف للتخزين الخاص فقط؛
            قرار التحقق يعتمد على المراجعة وحالة الملف وصلاحيته، والمستندات لا تظهر في الملف العام.
          </div>
        </details>
      </section>
    </div>
  );
}
