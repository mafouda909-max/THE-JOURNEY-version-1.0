"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/db/schema";

export function OnboardingPanel({
  agent,
  emailVerified,
  phoneConfigured,
  phoneVerified,
}: {
  agent: Agent | null;
  emailVerified: boolean;
  phoneConfigured: boolean;
  phoneVerified: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function post(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "تعذر الإتمام");
    return data;
  }
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage("تم حفظ الخطوة بنجاح.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذر الإتمام");
    } finally {
      setBusy(false);
    }
  }
  const editable =
    agent && ["pending", "rejected"].includes(agent.verificationStatus);
  async function profile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(() =>
      post("/api/onboarding", { action: "profile", ...Object.fromEntries(f) }),
    );
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = f.get("document") as File;
    await run(async () => {
      if (!file?.size) throw new Error("اختر مستندًا");
      const details = {
        filename: file.name,
        documentType: f.get("documentType"),
        contentType: file.type,
        contentLength: file.size,
      };
      const signed = await post("/api/kyc", { action: "upload", ...details });
      const uploaded = await fetch(signed.url, {
        method: "PUT",
        headers: signed.headers,
        body: file,
      });
      if (!uploaded.ok) throw new Error("تعذر رفع المستند إلى التخزين");
      await post("/api/kyc", {
        action: "confirm",
        ...details,
        key: signed.key,
      });
    });
  }
  const input = "w-full rounded-lg border border-outlinev p-3";
  return (
    <section
      className="mb-8 space-y-5 rounded-2xl border border-outlinev bg-cloud p-6"
      dir="rtl"
    >
      <h2 className="text-xl font-bold">إكمال حسابك</h2>
      <p>
        البريد الإلكتروني: {emailVerified ? "متحقق" : "بانتظار التحقق"}. الهاتف:{" "}
        {phoneVerified
          ? "متحقق"
          : phoneConfigured
            ? "بانتظار التحقق"
            : "التحقق غير متاح حاليًا"}
        .
      </p>
      {!emailVerified && (
        <div className="space-y-3">
          <button
            disabled={busy}
            onClick={() =>
              void run(() =>
                post("/api/verification", {
                  channel: "email",
                  action: "request",
                }),
              )
            }
            className="rounded-lg bg-deep px-4 py-2 text-white"
          >
            إرسال رمز إلى بريدي
          </button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                post("/api/verification", {
                  channel: "email",
                  action: "confirm",
                  code: f.get("code"),
                }),
              );
            }}
          >
            <input
              name="code"
              aria-label="رمز التحقق"
              placeholder="رمز من ٦ أرقام"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              className={input}
            />
            <button
              disabled={busy}
              className="rounded-lg bg-deep px-4 text-white"
            >
              تحقق
            </button>
          </form>
        </div>
      )}
      {phoneConfigured && !phoneVerified && (
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                post("/api/verification", {
                  channel: "phone",
                  action: "request",
                  phone: f.get("phone"),
                }),
              );
            }}
          >
            <input
              name="phone"
              type="tel"
              aria-label="رقم الهاتف الدولي"
              placeholder="+201xxxxxxxxx"
              required
              className={input}
            />
            <button disabled={busy}>إرسال رمز للهاتف</button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                post("/api/verification", {
                  channel: "phone",
                  action: "confirm",
                  code: f.get("code"),
                }),
              );
            }}
          >
            <input
              name="code"
              aria-label="رمز الهاتف"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              className={input}
            />
            <button disabled={busy}>تحقق من الهاتف</button>
          </form>
        </div>
      )}
      {editable && (
        <>
          <form onSubmit={profile} className="grid gap-3 md:grid-cols-2">
            <label>
              المدينة
              <input
                name="city"
                required
                defaultValue={agent.city}
                className={input}
              />
            </label>
            <label>
              الدولة
              <input
                name="country"
                required
                defaultValue={agent.country}
                className={input}
              />
            </label>
            <label>
              نوع الترخيص
              <select
                name="licenseType"
                defaultValue={agent.licenseType}
                className={input}
              >
                <option value="individual">فرد</option>
                <option value="agency">وكالة</option>
              </select>
            </label>
            <label>
              رقم الترخيص
              <input
                name="licenseNumber"
                defaultValue={agent.licenseNumber ?? ""}
                className={input}
              />
            </label>
            <label className="md:col-span-2">
              نبذة عن خدماتك
              <textarea
                name="bio"
                required
                minLength={30}
                defaultValue={agent.bio}
                className={input}
              />
            </label>
            <button
              disabled={busy}
              className="rounded-lg bg-deep p-3 text-white"
            >
              حفظ البيانات
            </button>
          </form>
          <form onSubmit={upload} className="space-y-3 border-t pt-4">
            <p>
              أرفق هوية رسمية. الوكالات تحتاج أيضًا إلى سجل تجاري أو ترخيص. PDF
              أو JPEG أو PNG حتى ١٠ ميجابايت.
            </p>
            <label>
              نوع المستند
              <select name="documentType" className={input}>
                <option value="passport_id">هوية / جواز سفر</option>
                <option value="commercial_register">سجل تجاري</option>
                <option value="license_cert">ترخيص</option>
              </select>
            </label>
            <input
              name="document"
              aria-label="ملف المستند"
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png"
              className={input}
            />
            <button
              disabled={busy}
              className="rounded-lg bg-deep px-4 py-2 text-white"
            >
              رفع المستند
            </button>
          </form>
          <button
            disabled={busy}
            onClick={() =>
              void run(() => post("/api/onboarding", { action: "submit" }))
            }
            className="rounded-lg bg-verified px-4 py-3 text-white"
          >
            إرسال الملف للمراجعة
          </button>
        </>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-low p-3">
          {message}
        </p>
      )}
    </section>
  );
}
