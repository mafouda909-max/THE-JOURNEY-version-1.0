import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "تأكيد البريد | الرحلة" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-3 text-headline-md text-on-surface">أكد بريدك الإلكتروني</h1>
      <p className="mb-6 text-body-md text-on-surface-variant">
        أرسلنا رابط تأكيد إلى بريدك. افتحه لتفعيل حسابك والمتابعة.
      </p>
      {e && (
        <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {e === "invalid_code" ? "رابط التأكيد غير صالح أو منتهي." : e}
        </p>
      )}
      <Link href="/login" className="text-primary hover:underline">
        العودة إلى تسجيل الدخول
      </Link>
    </div>
  );
}
