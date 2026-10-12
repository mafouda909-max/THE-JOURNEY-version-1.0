import { Input } from "@/components/ui/Input";

/**
 * Shared contact-request form fields. Rendered twice by the panel
 * (desktop inline card + mobile Sheet) with distinct id prefixes so label
 * associations never collide.
 */
export function ContactFields({ p }: { p: string }) {
  return (
    <div className="space-y-4">
      <div className="w-full">
        <label htmlFor={`${p}-message`} className="mb-1.5 block text-label-lg text-on-surface-variant">
          رسالتك للوكيل
        </label>
        <textarea
          id={`${p}-message`}
          name="message"
          rows={4}
          required
          minLength={10}
          maxLength={2000}
          placeholder="عرّف بنفسك واذكر تفاصيل طلبك — الوجهة، عدد المسافرين، التواريخ التقريبية…"
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <p className="mt-1 text-label-md text-on-surface-variant">١٠ أحرف على الأقل.</p>
      </div>
      <Input
        id={`${p}-count`}
        name="traveler_count"
        label="عدد المسافرين"
        type="number"
        min={1}
        step={1}
        defaultValue={1}
        required
      />
      <div className="w-full">
        <label htmlFor={`${p}-dates`} className="mb-1.5 block text-label-lg text-on-surface-variant">
          تواريخ مقترحة / ملاحظات (اختياري)
        </label>
        <textarea
          id={`${p}-dates`}
          name="travel_dates_note"
          rows={2}
          maxLength={500}
          placeholder="مثال: مرن خلال أكتوبر، نفضّل الأحد…"
          className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>
    </div>
  );
}
