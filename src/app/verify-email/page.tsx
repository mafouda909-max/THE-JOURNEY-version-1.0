"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { SilaLogo } from "@/components/brand/SilaLogo";

function VerifyEmailCard() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/email-verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "تعذر تأكيد البريد.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تأكيد البريد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sila-window w-full border border-outlinev bg-cloud p-7 md:p-9">
      <SilaLogo className="h-10 w-auto" />
      <h1 className="mt-6 text-3xl font-bold text-inkwell">تأكيد بريدك الإلكتروني</h1>
      <p className="mt-2 text-sm leading-7 text-slate">
        نطلب ضغطة تأكيد صريحة حتى لا تستهلك برامج فحص الروابط في البريد رمز التحقق بالنيابة عنك.
      </p>

      {!token ? (
        <p className="mt-7 rounded-xl bg-errorbg px-4 py-3 text-sm text-error">رابط التحقق غير مكتمل.</p>
      ) : done ? (
        <div className="mt-7">
          <p className="rounded-xl bg-verifiedbg px-4 py-3 text-sm font-semibold text-verified">تم تأكيد بريدك بنجاح.</p>
          <Link href="/account" className="mt-5 inline-block text-sm font-bold text-deep hover:underline">العودة إلى حسابك</Link>
        </div>
      ) : (
        <div className="mt-7">
          {error ? <p className="mb-4 rounded-xl bg-errorbg px-4 py-3 text-sm text-error">{error}</p> : null}
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-signal px-6 py-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
            {busy ? "جارٍ التأكيد…" : "تأكيد أن هذا بريدي"}
          </button>
        </div>
      )}
    </section>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center px-5 py-12">
      <Suspense fallback={<div className="w-full text-center text-sm text-slate">جارٍ التحميل…</div>}>
        <VerifyEmailCard />
      </Suspense>
    </main>
  );
}
