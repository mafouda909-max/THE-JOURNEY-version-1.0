"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

type Agent = {
  displayName: string;
  latinName: string;
  bio: string;
  city: string;
  country: string;
  licenseType: string;
  licenseNumber: string | null;
  verificationStatus: string;
};

type Doc = {
  id: number;
  documentType: string;
  originalName: string;
  status: string;
  rejectionReason: string | null;
};

type VerificationSnapshot = {
  accountEmail?: string;
  agent: Agent;
  documents?: Doc[];
};

const DOCS = [
  { key: "identity", title: "إثبات الهوية", note: "هوية رسمية سارية باسم صاحب الحساب.", required: true },
  { key: "license", title: "إثبات النشاط السياحي", note: "ترخيص أو مستند مهني ساري يثبت حقك في تقديم الخدمة السياحية.", required: true },
  { key: "commercial_register", title: "السجل التجاري / مستند الكيان", note: "مطلوب للحساب المؤسسي فقط، ويجب أن يطابق بيانات الجهة.", required: false },
  { key: "tax_id", title: "المستند الضريبي", note: "مستند داعم عند توفره؛ قد يطلبه فريق الثقة عند الحاجة.", required: false },
] as const;

const TRUST_CRITICAL_DOCUMENTS = new Set(["identity", "license", "commercial_register"]);
const SATISFIED_DOCUMENT_STATUSES = new Set(["pending", "verified"]);

const EMPTY_AGENT: Agent = {
  displayName: "",
  latinName: "",
  bio: "",
  city: "",
  country: "",
  licenseType: "individual",
  licenseNumber: "",
  verificationStatus: "pending",
};

const AGENT_STATUS: Record<string, { title: string; body: string; className: string }> = {
  pending: {
    title: "ملف التوثيق لم يدخل المراجعة بعد",
    body: "أكمل بياناتك وارفع الأدلة المطلوبة. يبدأ فريق الثقة المراجعة بعد وصول أول دليل صالح إلى التخزين الآمن.",
    className: "border-outlinev bg-low text-slate",
  },
  in_review: {
    title: "ملفك قيد المراجعة",
    body: "وصلت الأدلة المطلوبة إلى فريق الثقة. إذا عدّلت بيانات الهوية أو الترخيص بعد التوثيق يعود الملف لهذه المرحلة لحماية شارة الثقة.",
    className: "border-amber bg-amber/20 text-slate",
  },
  verified: {
    title: "ملفك موثّق",
    body: "تم اعتماد الملف. أي تغيير لاحق في بيانات الهوية أو الترخيص، أو رفع بديل لدليل أساسي، قد يعيد الملف للمراجعة قبل ظهور الشارة مجددًا.",
    className: "border-verified/30 bg-verifiedbg text-verified",
  },
  rejected: {
    title: "يحتاج الملف إلى تصحيح قبل التوثيق",
    body: "راجع أسباب الرفض على الأدلة أدناه، صحّح بياناتك عند الحاجة، ثم ارفع مستندات بديلة واضحة وسارية.",
    className: "border-error/30 bg-errorbg text-error",
  },
};

const DOC_STATUS: Record<string, { label: string; className: string }> = {
  uploading: { label: "الرفع لم يكتمل", className: "bg-low text-slate" },
  pending: { label: "وصل — قيد المراجعة", className: "bg-amber/20 text-slate" },
  verified: { label: "معتمد", className: "bg-verifiedbg text-verified" },
  rejected: { label: "مرفوض — يحتاج بديلًا", className: "bg-errorbg text-error" },
};

function latestDocument(documents: Doc[], documentType: string): Doc | undefined {
  return documents
    .filter((document) => document.documentType === documentType)
    .sort((a, b) => b.id - a.id)[0];
}

async function fetchVerificationSnapshot(): Promise<VerificationSnapshot> {
  const res = await fetch("/api/agent-verification", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "تعذر تحميل ملف التوثيق");
  return data as VerificationSnapshot;
}

export default function AgentVerificationPage() {
  const router = useRouter();
  const [agent, setAgent] = useState<Agent>(EMPTY_AGENT);
  const [email, setEmail] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchVerificationSnapshot();
        setAgent(data.agent);
        setEmail(data.accountEmail ?? "");
        setDocs(data.documents ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر تحميل ملف التوثيق");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requiredDocs = useMemo(
    () => DOCS.filter((d) => d.required || (d.key === "commercial_register" && agent.licenseType === "agency")),
    [agent.licenseType],
  );
  const satisfied = requiredDocs.filter((definition) => {
    const latest = latestDocument(docs, definition.key);
    return latest ? SATISFIED_DOCUMENT_STATUSES.has(latest.status) : false;
  }).length;
  const complete = satisfied === requiredDocs.length && requiredDocs.length > 0;
  const agentStatus = AGENT_STATUS[agent.verificationStatus] ?? AGENT_STATUS.pending;

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/agent-verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agent),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذر حفظ البيانات");
      setAgent(data.agent);
      setMessage(data.message ?? "تم حفظ بيانات الملف.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ البيانات");
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(type: string, file: File | undefined) {
    if (!file) return;
    setUploading(type);
    setError(null);
    setMessage(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("الحد الأقصى للملف 10MB.");
      if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
        throw new Error("يسمح فقط بـ PDF أو JPG أو PNG.");
      }

      const res = await fetch("/api/agent-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: type, originalName: file.name, contentType: file.type, contentLength: file.size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "تعذر تجهيز الرفع");
      if (!data.upload?.uploadUrl || !data.document?.id) throw new Error("تعذر تجهيز رابط الرفع الآمن.");

      const upload = await fetch(data.upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!upload.ok) throw new Error("فشل رفع الملف إلى التخزين الآمن. لم يدخل المستند المراجعة.");

      const confirm = await fetch("/api/agent-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", documentId: data.document.id }),
      });
      const confirmation = await confirm.json();
      if (!confirm.ok || confirmation.stored !== true || !confirmation.document) {
        throw new Error(confirmation.error ?? "تعذر تأكيد وصول المستند إلى التخزين الآمن.");
      }

      const confirmedDocument: Doc = {
        id: confirmation.document.id,
        documentType: confirmation.document.documentType,
        originalName: confirmation.document.originalName,
        status: confirmation.document.status,
        rejectionReason: null,
      };
      setDocs((current) => [confirmedDocument, ...current.filter((item) => item.id !== confirmedDocument.id)]);
      setAgent((current) => {
        if (
          current.verificationStatus === "pending" ||
          (current.verificationStatus === "verified" && TRUST_CRITICAL_DOCUMENTS.has(type))
        ) {
          return { ...current, verificationStatus: "in_review" };
        }
        return current;
      });
      setMessage("اكتمل الرفع وتأكد وصول المستند. أصبح الآن قيد مراجعة فريق الثقة.");

      try {
        const snapshot = await fetchVerificationSnapshot();
        setAgent(snapshot.agent);
        setDocs(snapshot.documents ?? []);
      } catch {
        // The upload is already confirmed. Keep the authoritative confirmation
        // result visible and let a later page refresh reconcile the snapshot.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر رفع المستند");
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-2 px-5 py-20 text-center text-slate" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> جاري تحميل ملف التوثيق…
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-10 md:px-8">
      <button
        type="button"
        onClick={() => router.push("/account")}
        className="mb-6 inline-flex items-center gap-2 rounded-md text-sm font-bold text-deep hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep focus-visible:ring-offset-2"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" /> العودة للحساب
      </button>

      <div className="mb-6 rounded-2xl border border-outlinev bg-cloud p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-verifiedbg p-3 text-verified"><ShieldCheck className="h-6 w-6" aria-hidden="true" /></div>
          <div>
            <h1 className="text-2xl font-bold text-inkwell md:text-3xl">إكمال ملف الوكيل والتوثيق</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate">هذه البيانات والأدلة هي أساس قرار فريق الثقة. لا يتم نشر ملفك أو عروضك كوكيل موثّق قبل اعتماد المراجعة.</p>
            <p className="mt-2 text-xs text-slate">وسيلة التواصل المسجلة: <span dir="ltr" className="font-mono">{email}</span></p>
          </div>
        </div>
      </div>

      <div className={`mb-6 rounded-xl border px-5 py-4 text-sm leading-7 ${agentStatus.className}`} role="status">
        <div className="font-bold">{agentStatus.title}</div>
        <p className="mt-1">{agentStatus.body}</p>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error && <div className="mb-5 rounded-xl bg-errorbg px-5 py-4 text-sm font-semibold text-error" role="alert">{error}</div>}
        {message && <div className="mb-5 rounded-xl bg-verifiedbg px-5 py-4 text-sm font-semibold text-verified">{message}</div>}
      </div>

      <section className="mb-8 rounded-2xl border border-outlinev bg-cloud p-6 md:p-8" aria-labelledby="profile-heading">
        <div className="mb-6">
          <h2 id="profile-heading" className="text-xl font-bold text-inkwell">بيانات الملف</h2>
          <p className="mt-1 text-sm text-slate">أكمل البيانات الفعلية التي سيعتمد عليها فريق الثقة في المطابقة والتواصل.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-inkwell">الاسم المعروض<input maxLength={120} value={agent.displayName} onChange={(e) => setAgent({ ...agent, displayName: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep focus-visible:ring-2 focus-visible:ring-deep/20" /></label>
          <label className="text-sm font-semibold text-inkwell">الاسم اللاتيني<input maxLength={120} dir="ltr" value={agent.latinName} onChange={(e) => setAgent({ ...agent, latinName: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 text-left outline-none focus:border-deep focus-visible:ring-2 focus-visible:ring-deep/20" /></label>
          <label className="text-sm font-semibold text-inkwell">الدولة<input maxLength={120} value={agent.country} onChange={(e) => setAgent({ ...agent, country: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep focus-visible:ring-2 focus-visible:ring-deep/20" /></label>
          <label className="text-sm font-semibold text-inkwell">المدينة<input maxLength={120} value={agent.city} onChange={(e) => setAgent({ ...agent, city: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep focus-visible:ring-2 focus-visible:ring-deep/20" /></label>
          <label className="text-sm font-semibold text-inkwell">نوع الملف<select value={agent.licenseType} onChange={(e) => setAgent({ ...agent, licenseType: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep focus-visible:ring-2 focus-visible:ring-deep/20"><option value="individual">وكيل فرد</option><option value="agency">وكالة / كيان</option></select></label>
          <label className="text-sm font-semibold text-inkwell">رقم الترخيص<input maxLength={40} dir="ltr" value={agent.licenseNumber ?? ""} onChange={(e) => setAgent({ ...agent, licenseNumber: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 text-left outline-none focus:border-deep focus-visible:ring-2 focus-visible:ring-deep/20" /></label>
        </div>
        <label className="mt-4 block text-sm font-semibold text-inkwell">نبذة مهنية<textarea minLength={30} maxLength={1200} value={agent.bio} onChange={(e) => setAgent({ ...agent, bio: e.target.value })} rows={5} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep focus-visible:ring-2 focus-visible:ring-deep/20" placeholder="خبرتك، نوع الخدمات السياحية التي تقدمها، والأسواق التي تعمل معها…" /></label>
        <button type="button" onClick={() => void saveProfile()} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-deep px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep focus-visible:ring-offset-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />} {saving ? "جاري الحفظ…" : "حفظ بيانات الملف"}
        </button>
      </section>

      <section className="rounded-2xl border border-outlinev bg-cloud p-6 md:p-8" aria-labelledby="evidence-heading">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="evidence-heading" className="text-xl font-bold text-inkwell">أدلة التوثيق</h2><p className="mt-1 text-sm text-slate">ارفع المستندات الرسمية المطلوبة فقط. التخزين خاص، والوصول إليها مخصص للمراجعين المصرح لهم.</p></div>
          <span className="rounded-full bg-low px-3 py-1 text-xs font-bold text-slate">{satisfied}/{requiredDocs.length} مستوفى</span>
        </div>

        <div className="space-y-4">
          {DOCS.map((definition) => {
            const required = definition.required || (definition.key === "commercial_register" && agent.licenseType === "agency");
            const latest = latestDocument(docs, definition.key);
            const status = latest ? (DOC_STATUS[latest.status] ?? { label: latest.status, className: "bg-low text-slate" }) : null;
            const isUploadingThis = uploading === definition.key;
            const buttonLabel = latest?.status === "rejected" ? "رفع بديل" : latest ? "رفع نسخة أحدث" : "رفع مستند";
            return (
              <div key={definition.key} className="rounded-xl border border-low bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-deep" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="font-bold text-inkwell">{definition.title} {required && <span className="text-error" aria-label="مطلوب">*</span>}</div>
                      <p className="mt-1 text-xs leading-6 text-slate">{definition.note}</p>
                      {latest && status && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="max-w-full break-all font-semibold text-slate">{latest.originalName}</span>
                          <span className={`rounded-full px-2.5 py-1 font-bold ${status.className}`}>{status.label}</span>
                        </div>
                      )}
                      {latest?.status === "uploading" && (
                        <p className="mt-2 flex items-start gap-2 text-xs leading-6 text-slate"><Clock3 className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />هذا الحجز لم يتحول إلى دليل مراجعة لأن وصول الملف لم يتأكد. أعد الرفع.</p>
                      )}
                      {latest?.status === "rejected" && (
                        <p className="mt-2 flex items-start gap-2 text-xs font-semibold leading-6 text-error"><AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{latest.rejectionReason || "لم يعتمد فريق الثقة هذا المستند. ارفع نسخة بديلة واضحة وسارية."}</p>
                      )}
                      {latest?.status === "verified" && TRUST_CRITICAL_DOCUMENTS.has(definition.key) && (
                        <p className="mt-2 text-xs leading-6 text-slate">إذا رفعت نسخة أحدث من هذا الدليل، سيُراجع البديل قبل الاعتماد وقد يعود ملف الوكيل إلى حالة المراجعة مؤقتًا.</p>
                      )}
                    </div>
                  </div>
                  <label className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-deep/30 px-4 py-2.5 text-xs font-bold text-deep focus-within:ring-2 focus-within:ring-deep focus-within:ring-offset-2 ${uploading !== null ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-low"}`}>
                    {isUploadingThis ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-4 w-4" aria-hidden="true" />}
                    {isUploadingThis ? "جاري الرفع…" : buttonLabel}
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="sr-only"
                      disabled={uploading !== null}
                      aria-label={`${buttonLabel}: ${definition.title}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.currentTarget.value = "";
                        void uploadDocument(definition.key, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-amber bg-amber/20 p-4 text-xs leading-6 text-slate">
          <strong className="text-inkwell">كيف تعمل دورة التوثيق؟</strong> يبدأ المستند كرفع غير مكتمل، ثم لا يدخل المراجعة إلا بعد تأكيد وجوده في التخزين الآمن. بعدها يكون «قيد المراجعة»، ثم يقرر فريق الثقة اعتماده أو رفضه. شارة الوكيل لا تعتمد على مجرد الرفع.
        </div>
        {!complete && <p className="mt-5 text-sm font-semibold text-gold">أكمل الأدلة المطلوبة بحالة «قيد المراجعة» أو «معتمد» حتى يصبح الملف مستوفيًا للأدلة.</p>}
      </section>
    </main>
  );
}
