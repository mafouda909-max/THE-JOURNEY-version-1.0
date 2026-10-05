"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, Shield, UploadCloud } from "lucide-react";
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
      const uploadUrl = (data.upload as { uploadUrl?: string } | undefined)
        ?.uploadUrl;
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
      )
        throw new Error("لم يتأكد وصول المستند وتثبيت حالته في التخزين الخاص. أعد فتح الصفحة قبل المحاولة مجددًا.");
      setDocs((current) => [
        {
          ...document,
          ...saved,
          rejectionReason: null,
          expiresAt: null,
        },
        ...current.filter((doc) => doc.id !== document.id),
      ]);
      setMessage(
        "وصل المستند للتخزين الخاص وأصبح قيد المراجعة. رفعه لا يعني اعتماد الوكيل.",
      );
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
    <div className="space-y-6">
      <section className="sila-window border border-outlinev bg-cloud p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={`rounded-xl p-3 ${state.tone === "verified" ? "bg-verifiedbg text-verified" : "bg-air text-signal"}`}
            >
              <Shield className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-deep">
                اعتماد الوكيل: {state.label}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-7 text-slate">
                {state.note}
              </p>
            </div>
          </div>
          <Link href="/account/profile" className={secondaryAction}>
            تعديل الملف المهني
          </Link>
        </div>
        <p className="mt-4 border-t border-outlinev pt-4 text-xs leading-6 text-slate">
          تأكيد البريد يُدار من أمان الحساب؛ ولا يمنح شارة اعتماد الوكيل.
        </p>
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-errorbg p-4 text-sm leading-7 text-error"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl bg-air p-4 text-sm leading-7 text-deep"
        >
          {message}
        </p>
      )}
      <section className="sila-window border border-outlinev bg-cloud p-5 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-deep">مستندات التوثيق</h2>
            <p className="mt-2 text-sm leading-7 text-slate">
              مستنداتك خاصة، ومتاحة للمراجعين المصرح لهم. لا تظهر في ملفك العام.
            </p>
          </div>
          <span className="rounded-lg bg-low px-3 py-2 text-xs font-semibold text-slate">
            {satisfied}/{required.length} من الأدلة المطلوبة جاهز للمراجعة
          </span>
        </div>
        <div className="space-y-4">
          {DOCS.map((doc) => {
            const isRequired = required.some((item) => item.key === doc.key);
            const latest = latestFor(doc.key);
            const expired =
              latest?.expiresAt &&
              new Date(latest.expiresAt).getTime() <= observedAt;
            return (
              <article
                key={doc.key}
                className="rounded-2xl border border-outlinev p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText
                      className="mt-1 h-5 w-5 shrink-0 text-signal"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-deep">
                        {doc.title}{" "}
                        <span className="text-xs font-normal text-slate">
                          ({isRequired ? "مطلوب للتوثيق" : "اختياري"})
                        </span>
                      </h3>
                      <p className="mt-2 text-xs leading-6 text-slate">
                        {doc.note}
                      </p>
                      {latest && (
                        <p className="mt-3 break-all text-xs leading-6 text-slate">
                          {latest.originalName} ·{" "}
                          {expired
                            ? "منتهي الصلاحية"
                            : (DOC_STATUS[latest.status] ?? "يحتاج مراجعة")}
                        </p>
                      )}
                      {latest?.rejectionReason && (
                        <p className="mt-2 text-xs leading-6 text-error">
                          ملاحظات المراجعة: {latest.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                  <label
                    className={`${secondaryAction} relative cursor-pointer text-xs ${uploading ? "opacity-60" : ""}`}
                  >
                    {uploading === doc.key ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <UploadCloud className="h-4 w-4" aria-hidden="true" />
                    )}
                    {latest ? "استبدال المستند" : "رفع مستند"}
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
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-6 rounded-xl bg-low p-4 text-xs leading-7 text-slate">
          الملفات المقبولة: PDF أو JPG أو PNG، حتى 3MB للمستند في التجربة الحالية. رفع المستند
          يبدأ مراجعته بعد تأكيد وصوله للتخزين؛ قرار اعتماد الوكيل يظل بيد فريق
          الثقة.
        </p>
      </section>
    </div>
  );
}
