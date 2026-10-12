import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  adminMfaVerifyAction,
  adminMfaEnrollAction,
  adminMfaEnrollVerifyAction,
  signInAction,
} from "@/lib/auth/actions";

export const metadata: Metadata = { title: "بوابة الإدارة | الرحلة" };

/**
 * ADMIN LOGIN — password step, then mandatory TOTP (AAL2) per AD-14.
 * First-time enrollment renders the factor secret for the authenticator;
 * every later session challenges the verified factor.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mfa?: string; e?: string; factor?: string; secret?: string }>;
}) {
  const { mfa, e, factor, secret } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-center text-headline-md text-on-surface">بوابة الإدارة</h1>
      <p className="mb-6 text-center text-body-sm text-on-surface-variant">
        وصول مقيّد بفريق المنصة فقط.
      </p>

      {e && (
        <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {e}
        </p>
      )}

      {mfa === "enroll" && factor && secret ? (
        <form action={adminMfaEnrollVerifyAction} className="space-y-4 rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
          <p className="text-body-md text-on-surface">أضِف هذا السر إلى تطبيق المصادقة:</p>
          <code dir="ltr" className="block break-all rounded-md bg-surface-container px-3 py-2 font-mono text-body-sm" data-testid="mfa-secret">
            {secret}
          </code>
          <input type="hidden" name="factor" value={factor} />
          <input type="hidden" name="secret" value={secret} />
          <Input id="code" name="code" label="رمز التحقق" inputMode="numeric" maxLength={8} required autoComplete="one-time-code" />
          <Button size="lg" className="w-full">تأكيد التفعيل</Button>
        </form>
      ) : mfa === "enroll" ? (
        <form action={adminMfaEnrollAction} className="rounded-lg border border-outline-variant bg-surface p-6 text-center">
          <p className="mb-3 text-body-md text-on-surface">لم يتم تفعيل المصادقة الثنائية بعد.</p>
          <Button type="submit" size="lg">بدء تفعيل TOTP</Button>
        </form>
      ) : mfa ? (
        <form action={adminMfaVerifyAction} className="space-y-4 rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
          <p className="text-body-md text-on-surface">أدخل رمز المصادقة الثنائية (TOTP).</p>
          <Input
            id="code"
            name="code"
            label="رمز التحقق"
            inputMode="numeric"
            pattern="[0-9 ]*"
            maxLength={8}
            required
            autoComplete="one-time-code"
          />
          <Button size="lg" className="w-full">تحقق</Button>
        </form>
      ) : (
        <form action={signInAction} className="space-y-4 rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
          <input type="hidden" name="next" value="/admin/login?mfa=required" />
          <Input id="email" name="email" label="بريد المشرف" type="email" required autoComplete="email" />
          <Input id="password" name="password" label="كلمة المرور" type="password" required autoComplete="current-password" />
          <Button size="lg" className="w-full">متابعة إلى التحقق الثنائي</Button>
        </form>
      )}

      <p className="mt-6 text-center">
        <Link href="/" className="text-label-lg text-on-surface-variant hover:underline">
          العودة إلى الموقع
        </Link>
      </p>
    </div>
  );
}
