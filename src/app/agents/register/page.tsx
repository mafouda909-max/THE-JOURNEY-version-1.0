import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signUpAgentAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "تسجيل وكيل | الرحلة" };

/** AGENT REGISTRATION — SCREEN_MAP Zone2: Account → Profile basics → Docs. */
export default async function AgentRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; step?: string }>;
}) {
  const { e } = await searchParams;
  const supabase = await createClient();
  const { data: cities } = await supabase
    .from("cities")
    .select("id, name_ar")
    .eq("is_active", true)
    .order("name_ar");

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-center text-title-lg font-bold text-on-surface">
        الرحلة
      </Link>
      <h1 className="mb-2 text-center text-headline-md text-on-surface">تسجيل وكيل سفر</h1>
      <p className="mb-6 text-center text-body-sm text-on-surface-variant">
        الخطوة ١ من ٣ — الحساب والملف الأساسي. بعدها ترفع مستندات التوثيق.
      </p>

      {e && (
        <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {e}
        </p>
      )}

      <form action={signUpAgentAction} className="space-y-4 rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
        <Input id="display_name" name="display_name" label="اسم الوكيل المعروض" required minLength={2} maxLength={120} />
        <Input id="business_name" name="business_name" label="اسم الشركة (اختياري)" maxLength={160} />
        <div className="w-full">
          <label htmlFor="bio_ar" className="mb-1.5 block text-label-lg text-on-surface-variant">
            نبذة بالعربية
          </label>
          <textarea
            id="bio_ar"
            name="bio_ar"
            rows={3}
            required
            minLength={10}
            className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <div className="w-full">
          <label htmlFor="city_id" className="mb-1.5 block text-label-lg text-on-surface-variant">
            المدينة
          </label>
          <select
            id="city_id"
            name="city_id"
            required
            className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md text-on-surface"
          >
            {(cities ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name_ar}</option>
            ))}
          </select>
        </div>
        <div className="w-full">
          <label htmlFor="license_type" className="mb-1.5 block text-label-lg text-on-surface-variant">
            نوع الترخيص
          </label>
          <select
            id="license_type"
            name="license_type"
            className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md text-on-surface"
          >
            <option value="individual">فردي</option>
            <option value="agency">وكالة</option>
          </select>
        </div>
        <Input id="email" name="email" label="البريد الإلكتروني" type="email" required autoComplete="email" />
        <Input id="password" name="password" label="كلمة المرور" type="password" required minLength={8} autoComplete="new-password" />
        <Button size="lg" className="w-full">إنشاء حساب الوكيل</Button>
      </form>

      <p className="mt-4 text-center text-body-sm text-on-surface-variant">
        لديك حساب؟ <Link href="/login?next=/dashboard/verification" className="text-primary hover:underline">دخول</Link>
      </p>
    </div>
  );
}
