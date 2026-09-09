"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FileCheck2, Loader2, ShieldCheck, UploadCloud } from "lucide-react";

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

const DOCS = [
  { key: "identity", title: "إثبات الهوية", note: "هوية رسمية سارية باسم صاحب الحساب.", required: true },
  { key: "license", title: "إثبات النشاط السياحي", note: "ترخيص أو مستند مهني ساري يثبت حقك في تقديم الخدمة السياحية.", required: true },
  { key: "commercial_register", title: "السجل التجاري / مستند الكيان", note: "مطلوب للحساب المؤسسي فقط، ويجب أن يطابق بيانات الجهة.", required: false },
  { key: "tax_id", title: "المستند الضريبي", note: "مستند داعم عند توفره؛ قد يطلبه فريق الثقة عند الحاجة.", required: false },
] as const;

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
        const res = await fetch("/api/agent-verification", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "تعذر تحميل ملف التوثيق");
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
  const satisfied = requiredDocs.filter((d) => docs.some((x) => x.documentType === d.key && x.status === "pending")).length;
  const complete = satisfied === requiredDocs.length && requiredDocs.length > 0;

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
      setMessage("تم حفظ بيانات الملف.");
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
      if (!data.upload?.uploadUrl) throw new Error("تعذر تجهيز رابط الرفع الآمن.");

      const upload = await fetch(data.upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!upload.ok) throw new Error("فشل رفع الملف إلى التخزين الآمن.");

      const confirm = await fetch("/api/agent-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", documentId: data.document.id }),
      });
      const confirmation = await confirm.json();
      if (!confirm.ok || confirmation.stored !== true) {
        throw new Error(confirmation.error ?? "تعذر تأكيد وصول المستند إلى التخزين الآمن.");
      }

      setDocs((current) => [...current, data.document]);
      setMessage("تم رفع المستند والتحقق من وصوله إلى التخزين الآمن، وأصبح جاهزاً للمراجعة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر رفع المستند");
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-5 py-20 text-center text-slate">جاري تحميل ملف التوثيق…</div>;
  }

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-10 md:px-8">
      <button onClick={() => router.push("/account")} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-deep hover:underline">
        <ArrowRight className="h-4 w-4" /> العودة للحساب
      </button>

      <div className="mb-8 rounded-2xl border border-outlinev bg-cloud p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-verifiedbg p-3 text-verified"><ShieldCheck className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold text-inkwell md:text-3xl">إكمال ملف الوكيل والتوثيق</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate">هذه البيانات والأدلة هي أساس قرار فريق الثقة. لا يتم نشر ملفك أو عروضك كوكيل موثّق قبل اعتماد المراجعة.</p>
            <p className="mt-2 font-mono text-xs text-slate">وسيلة التواصل المسجلة: {email}</p>
          </div>
        </div>
      </div>

      {error && <div className="mb-5 rounded-xl bg-errorbg px-5 py-4 text-sm font-semibold text-error">{error}</div>}
      {message && <div className="mb-5 rounded-xl bg-verifiedbg px-5 py-4 text-sm font-semibold text-verified">{message}</div>}

      <section className="mb-8 rounded-2xl border border-outlinev bg-cloud p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-inkwell">بيانات الملف</h2>
          <p className="mt-1 text-sm text-slate">أكمل البيانات الفعلية التي سيعتمد عليها فريق الثقة في المطابقة والتواصل.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-inkwell">الاسم المعروض<input value={agent.displayName} onChange={(e) => setAgent({ ...agent, displayName: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep" /></label>
          <label className="text-sm font-semibold text-inkwell">الاسم اللاتيني<input value={agent.latinName} onChange={(e) => setAgent({ ...agent, latinName: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep" /></label>
          <label className="text-sm font-semibold text-inkwell">الدولة<input value={agent.country} onChange={(e) => setAgent({ ...agent, country: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep" /></label>
          <label className="text-sm font-semibold text-inkwell">المدينة<input value={agent.city} onChange={(e) => setAgent({ ...agent, city: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep" /></label>
          <label className="text-sm font-semibold text-inkwell">نوع الملف<select value={agent.licenseType} onChange={(e) => setAgent({ ...agent, licenseType: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep"><option value="individual">وكيل فرد</option><option value="agency">وكالة / كيان</option></select></label>
          <label className="text-sm font-semibold text-inkwell">رقم الترخيص<input value={agent.licenseNumber ?? ""} onChange={(e) => setAgent({ ...agent, licenseNumber: e.target.value })} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep" /></label>
        </div>
        <label className="mt-4 block text-sm font-semibold text-inkwell">نبذة مهنية<textarea value={agent.bio} onChange={(e) => setAgent({ ...agent, bio: e.target.value })} rows={5} className="mt-2 w-full rounded-lg border border-outlinev bg-white px-4 py-3 outline-none focus:border-deep" placeholder="خبرتك، نوع الخدمات السياحية التي تقدمها، والأسواق التي تعمل معها…" /></label>
        <button onClick={() => void saveProfile()} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-deep px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} حفظ بيانات الملف
        </button>
      </section>

      <section className="rounded-2xl border border-outlinev bg-cloud p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-bold text-inkwell">أدلة التوثيق</h2><p className="mt-1 text-sm text-slate">ارفع المستندات الرسمية المطلوبة فقط. التخزين خاص، والوصول إليها مخصص للمراجعين المصرح لهم.</p></div>
          <span className="rounded-full bg-low px-3 py-1 text-xs font-bold text-slate">{satisfied}/{requiredDocs.length} مكتمل</span>
        </div>

        <div className="space-y-4">
          {DOCS.map((doc) => {
            const required = doc.required || (doc.key === "commercial_register" && agent.licenseType === "agency");
            const latest = [...docs].reverse().find((x) => x.documentType === doc.key);
            return (
              <div key={doc.key} className="rounded-xl border border-low bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-deep" /><div><div className="font-bold text-inkwell">{doc.title} {required && <span className="text-error">*</span>}</div><p className="mt-1 text-xs leading-6 text-slate">{doc.note}</p>{latest && <p className="mt-2 text-xs font-semibold text-slate">{latest.originalName} · {latest.status === "pending" ? "قيد المراجعة" : latest.status}</p>}</div></div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-deep/30 px-4 py-2.5 text-xs font-bold text-deep hover:bg-low">
                    {uploading === doc.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    رفع مستند
                    <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" disabled={uploading !== null} onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ""; void uploadDocument(doc.key, file); }} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-amber bg-amber/20 p-4 text-xs leading-6 text-slate">
          <strong className="text-inkwell">قاعدة المراجعة:</strong> رفع المستند لا يعني اعتماده. كل دليل يبقى قيد المراجعة، وقرار اعتماد الوكيل يظل بيد فريق الثقة مع تسجيل القرار في سجل التدقيق.
        </div>
        {!complete && <p className="mt-5 text-sm font-semibold text-gold">أكمل الأدلة المطلوبة حتى يصبح الملف جاهزاً للمراجعة.</p>}
      </section>
    </main>
  );
}
