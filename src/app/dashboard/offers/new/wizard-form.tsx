"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createDraftOfferAction } from "@/lib/agent/actions";
import { TRIP_TYPE_LABELS } from "@/components/search/SearchModule";

interface Ref { id: string; name_ar: string }
const CURRENCIES = ["SAR", "EGP", "AED", "USD", "EUR"];

/** CREATE OFFER wizard — SCREEN_MAP f8ee26d5 unified flow (4 steps). */
export function CreateWizard({
  cities,
  airports,
  airlines,
}: {
  cities: Ref[];
  airports: (Ref & { city_id: string })[];
  airlines: Ref[];
}) {
  const [step, setStep] = useState(1);
  const total = 4;

  return (
    <form action={createDraftOfferAction} className="rounded-lg border border-outline-variant bg-surface p-6 shadow-sm">
      <ol className="mb-6 flex gap-2 text-label-md" aria-hidden>
        {["المسار", "التفاصيل", "السعر", "الصلاحية"].map((label, i) => (
          <li
            key={label}
            className={
              "flex-1 rounded-full px-3 py-1 text-center " +
              (step === i + 1 ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant")
            }
          >
            {`${i + 1}. ${label}`}
          </li>
        ))}
      </ol>

      <div className="space-y-4">
        {/* Step 1 — route */}
        <div className={step === 1 ? "space-y-4" : "hidden"}>
          <div className="w-full">
            <label htmlFor="trip_type" className="mb-1.5 block text-label-lg text-on-surface-variant">نوع الرحلة</label>
            <select id="trip_type" name="trip_type" required defaultValue="flight"
              className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md">
              {Object.entries(TRIP_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="مدينة الانطلاق" name="origin_city_id" options={cities} required />
            <Field label="الوجهة" name="destination_city_id" options={cities} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="مطار الانطلاق (اختياري)" name="origin_airport_id" options={airports} />
            <Field label="مطار الوصول (اختياري)" name="destination_airport_id" options={airports} />
          </div>
          <div className="w-full">
            <label htmlFor="route_type" className="mb-1.5 block text-label-lg text-on-surface-variant">نوع المسار</label>
            <select id="route_type" name="route_type" className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md">
              <option value="">— غير محدد</option>
              <option value="direct">مباشر</option>
              <option value="transit">بمحطة تحويل</option>
            </select>
          </div>
          <Field label="الناقل (اختياري)" name="airline_id" options={airlines} />
        </div>

        {/* Step 2 — content */}
        <div className={step === 2 ? "space-y-4" : "hidden"}>
          <Input id="title_ar" name="title_ar" label="العنوان بالعربية" required maxLength={200} />
          <Input id="title_en" name="title_en" label="العنوان بالإنجليزية (اختياري)" maxLength={200} />
          <div className="w-full">
            <label htmlFor="description_ar" className="mb-1.5 block text-label-lg text-on-surface-variant">الوصف بالعربية</label>
            <textarea id="description_ar" name="description_ar" rows={5} required
              className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md" />
          </div>
          <div className="w-full">
            <label htmlFor="description_en" className="mb-1.5 block text-label-lg text-on-surface-variant">الوصف بالإنجليزية (اختياري)</label>
            <textarea id="description_en" name="description_en" rows={3}
              className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <LinesArea id="includes" label="يشمل (سطر لكل بند)" />
            <LinesArea id="excludes" label="لا يشمل (سطر لكل بند)" />
          </div>
        </div>

        {/* Step 3 — pricing */}
        <div className={step === 3 ? "space-y-4" : "hidden"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="price_amount" name="price_amount" label="السعر" type="number" min="0.01" step="0.01" required />
            <div className="w-full">
              <label htmlFor="currency" className="mb-1.5 block text-label-lg text-on-surface-variant">العملة</label>
              <select id="currency" name="currency" defaultValue="EGP"
                className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md">
                {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="w-full">
              <label htmlFor="price_type" className="mb-1.5 block text-label-lg text-on-surface-variant">نوع السعر</label>
              <select id="price_type" name="price_type" defaultValue="fixed"
                className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md">
                <option value="fixed">سعر نهائي</option>
                <option value="starting_from">يبدأ من</option>
              </select>
            </div>
            <div className="w-full">
              <label htmlFor="price_basis" className="mb-1.5 block text-label-lg text-on-surface-variant">أساس السعر</label>
              <select id="price_basis" name="price_basis" defaultValue="per_person"
                className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md">
                <option value="per_person">للشخص</option>
                <option value="per_group">للمجموعة</option>
                <option value="total">إجمالي</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="min_travelers" name="min_travelers" label="أقل عدد مسافرين" type="number" min="1" defaultValue={1} required />
            <Input id="max_travelers" name="max_travelers" label="أقصى عدد مسافرين (اختياري)" type="number" min="1" />
          </div>
        </div>

        {/* Step 4 — dates/validity */}
        <div className={step === 4 ? "space-y-4" : "hidden"}>
          <p className="text-body-sm text-on-surface-variant">
            صلاحية العرض حتى ٩٠ يومًا كحد أقصى من تاريخ النشر.
          </p>
          <Input id="valid_until" name="valid_until" label="صالح حتى" type="date" required />
          <label className="flex items-center gap-2 text-body-md text-on-surface">
            <input type="checkbox" name="flexible_dates" /> تواريخ مرنة / مفتوحة
          </label>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
          السابق
        </Button>
        {step < total ? (
          <Button type="button" size="lg" onClick={() => setStep((s) => Math.min(total, s + 1))}>التالي</Button>
        ) : (
          <Button type="submit" size="lg">حفظ كمسودة</Button>
        )}
      </div>
    </form>
  );
}

function Field({ label, name, options, required }: { label: string; name: string; options: Ref[]; required?: boolean }) {
  return (
    <div className="w-full">
      <label htmlFor={name} className="mb-1.5 block text-label-lg text-on-surface-variant">{label}</label>
      <select id={name} name={name} required={required}
        className="h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md">
        {!required && <option value="">—</option>}
        {options.map((o) => (<option key={o.id} value={o.id}>{o.name_ar}</option>))}
      </select>
    </div>
  );
}

function LinesArea({ id, label }: { id: string; label: string }) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1.5 block text-label-lg text-on-surface-variant">{label}</label>
      <textarea id={id} name={id} rows={4}
        className="w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-body-md" />
    </div>
  );
}
