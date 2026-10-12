import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "استعادة كلمة المرور | الرحلة" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; e?: string }>;
}) {
  const { sent, e } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-center text-headline-md text-on-surface">استعادة كلمة المرور</h1>

      {sent ? (
        <p role="status" className="rounded-md bg-primary-container px-4 py-3 text-body-md text-on-primary-container">
          إن كان البريد مسجلًا لدينا فأرسلنا رابط إعادة التعيين إليه. تفقد صندوق الوارد.
        </p>
      ) : (
        <>
          <p className="mb-6 text-center text-body-sm text-on-surface-variant">
            أدخل بريدك وسنرسل رابط إعادة التعيين.
          </p>
          {e && (
            <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">
              {e}
            </p>
          )}
          <form action={requestPasswordResetAction} className="space-y-4 rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
            <Input id="email" name="email" label="البريد الإلكتروني" type="email" required />
            <Button size="lg" className="w-full">إرسال الرابط</Button>
          </form>
        </>
      )}

      <p className="mt-4 text-center">
        <Link href="/login" className="text-label-lg text-on-surface-variant hover:underline">
          العودة لتسجيل الدخول
        </Link>
      </p>
    </div>
  );
}
