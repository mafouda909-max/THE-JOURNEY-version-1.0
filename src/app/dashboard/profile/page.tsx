import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requireAgent } from "@/lib/auth/guards";
import { saveProfileAction } from "@/lib/agent/actions";

export const dynamic = "force-dynamic";

/** AGENT PROFILE EDITOR — content columns only (status/metrics system-owned). */
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; s?: string }>;
}) {
  const { e, s } = await searchParams;
  const { supabase, agentProfileId } = await requireAgent();

  const { data: p } = await supabase
    .from("agent_profiles")
    .select("*")
    .eq("id", agentProfileId)
    .single();
  const { data: cities } = await supabase
    .from("cities")
    .select("id, name_ar")
    .eq("is_active", true)
    .order("name_ar");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <h1 className="mb-1 text-headline-md text-on-surface">ملف الوكيل</h1>
      <p className="mb-6 text-body-sm text-on-surface-variant">
        حالة التوثيق وبيانات الأداء يديرها النظام تلقائيًا.
      </p>

      {e && (
        <p role="alert" className="mb-4 rounded-md bg-error-container px-3 py-2 text-body-sm text-on-error-container">{e}</p>
      )}
      {s && (
        <p role="status" className="mb-4 rounded-md bg-primary-container px-3 py-2 text-body-sm text-on-primary-container">تم الحفظ.</p>
      )}

      <form action={saveProfileAction} className="space-y-4 rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
        <Input id="display_name" name="display_name" label="الاسم المعروض" defaultValue={p?.display_name ?? ""} required minLength={2} maxLength={120} />
        <Input id="business_name" name="business_name" label="اسم الشركة" defaultValue={p?.business_name ?? ""} maxLength={160} />
        <div className="w-full">
          <label htmlFor="bio_ar" className="mb-1.5 block text-label-lg text-on-surface-variant">نبذة بالعربية</label>
          <textarea id="bio_ar" name="bio_ar" rows={4} required defaultValue={p?.bio_ar ?? ""}
            className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md" />
        </div>
        <div className="w-full">
          <label htmlFor="bio_en" className="mb-1.5 block text-label-lg text-on-surface-variant">نبذة بالإنجليزية (اختياري)</label>
          <textarea id="bio_en" name="bio_en" rows={3} defaultValue={p?.bio_en ?? ""}
            className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md" />
        </div>
        <Input id="photo_url" name="photo_url" label="رابط الصورة (اختياري)" type="url" defaultValue={p?.photo_url ?? ""} />
        <div className="w-full">
          <label htmlFor="city_id" className="mb-1.5 block text-label-lg text-on-surface-variant">المدينة</label>
          <select id="city_id" name="city_id" defaultValue={p?.city_id ?? ""}
            className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md">
            <option value="">—</option>
            {(cities ?? []).map((c) => (<option key={c.id} value={c.id}>{c.name_ar}</option>))}
          </select>
        </div>
        <div className="w-full">
          <label htmlFor="license_type" className="mb-1.5 block text-label-lg text-on-surface-variant">نوع الترخيص</label>
          <select id="license_type" name="license_type" defaultValue={p?.license_type ?? "individual"}
            className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md">
            <option value="individual">فردي</option>
            <option value="agency">وكالة</option>
          </select>
        </div>
        <Input id="license_number" name="license_number" label="رقم الترخيص (اختياري)" defaultValue={p?.license_number ?? ""} maxLength={80} />
        <div className="w-full">
          <label htmlFor="specialty_tags" className="mb-1.5 block text-label-lg text-on-surface-variant">التخصصات (سطر لكل تخصص)</label>
          <textarea id="specialty_tags" name="specialty_tags" rows={3}
            defaultValue={(p?.specialty_tags ?? []).join("\n")}
            className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md" />
        </div>
        <Button>حفظ الملف</Button>
      </form>
    </div>
  );
}
