import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "تسجيل الدخول | الرحلة" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; next?: string }>;
}) {
  const { e, next = "/dashboard" } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8 text-center text-title-lg font-bold text-on-surface">
        الرحلة
      </Link>
      <h1 className="mb-6 text-center text-headline-md text-on-surface">تسجيل الدخول</h1>

      {e && (
        <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {e}
        </p>
      )}

      <form action={signInAction} className="space-y-4 rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
        <input type="hidden" name="next" value={next} />
        <Input id="email" name="email" label="البريد الإلكتروني" type="email" required autoComplete="email" />
        <Input id="password" name="password" label="كلمة المرور" type="password" required autoComplete="current-password" />
        <Button size="lg" className="w-full">دخول</Button>
      </form>

      <p className="mt-4 text-center text-body-sm text-on-surface-variant">
        لا تملك حسابًا؟{" "}
        <Link href="/register" className="text-primary hover:underline">إنشاء حساب مسافر</Link>
        {" · "}
        <Link href="/agents/register" className="text-primary hover:underline">تسجيل وكيل</Link>
      </p>
      <p className="mt-2 text-center">
        <Link href="/forgot-password" className="text-label-lg text-on-surface-variant hover:underline">
          نسيت كلمة المرور؟
        </Link>
      </p>
    </div>
  );
}
