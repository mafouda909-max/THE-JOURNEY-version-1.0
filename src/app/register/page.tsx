import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signUpTravelerAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "إنشاء حساب | الرحلة" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8 text-center text-title-lg font-bold text-on-surface">
        الرحلة
      </Link>
      <h1 className="mb-6 text-center text-headline-md text-on-surface">حساب مسافر جديد</h1>

      {e && (
        <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {e}
        </p>
      )}

      <form action={signUpTravelerAction} className="space-y-4 rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
        <Input id="display_name" name="display_name" label="الاسم المعروض" required minLength={2} maxLength={80} />
        <Input id="email" name="email" label="البريد الإلكتروني" type="email" required autoComplete="email" />
        <Input
          id="password"
          name="password"
          label="كلمة المرور"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          hint="٨ أحرف على الأقل"
        />
        <Button size="lg" className="w-full">إنشاء الحساب</Button>
        <p className="text-center text-label-md text-on-surface-variant">
          بإنشائك حسابًا فأنت توافق على شروط الاستخدام وسياسة الخصوصية.
        </p>
      </form>

      <p className="mt-4 text-center text-body-sm text-on-surface-variant">
        لديك حساب؟ <Link href="/login" className="text-primary hover:underline">تسجيل الدخول</Link>
      </p>
    </div>
  );
}
