import type { Metadata } from "next";
import { CreateWizard } from "./wizard-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "عرض جديد | الرحلة" };

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  const supabase = await createClient();

  const [{ data: cities }, { data: airlines }] = await Promise.all([
    supabase.from("cities").select("id, name_ar").eq("is_active", true).order("name_ar"),
    supabase.from("airlines").select("id, name_ar").eq("is_active", true).order("name_ar"),
  ]);
  const { data: airports } = await supabase
    .from("airports")
    .select("id, name_ar, city_id")
    .eq("is_active", true)
    .order("name_ar");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <h1 className="mb-1 text-headline-md text-on-surface">إنشاء عرض جديد</h1>
      <p className="mb-6 text-body-sm text-on-surface-variant">
        يُحفظ كمسودة أولًا، ثم ترسله للمراجعة بعد اكتمال التفاصيل والصور.
      </p>
      {e && (
        <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {e}
        </p>
      )}
      <CreateWizard
        cities={cities ?? []}
        airports={airports ?? []}
        airlines={airlines ?? []}
      />
    </div>
  );
}
