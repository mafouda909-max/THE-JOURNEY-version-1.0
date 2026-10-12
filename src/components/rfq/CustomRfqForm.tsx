"use client";

import { useState, useTransition } from "react";
import type { PublicOfferRow } from "@/lib/data/types";
import { Icon } from "@/components/ui/Icon";
import { createRfqInquiryAction } from "@/lib/rfq/actions";

export function CustomRfqForm({ offer }: { offer: PublicOfferRow }) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [travelers, setTravelers] = useState(offer.min_travelers || 2);
  const [departureDate, setDepartureDate] = useState(offer.departure_date || "");
  const [returnDate, setReturnDate] = useState(offer.return_date || "");
  const [flexible, setFlexible] = useState(false);
  const [budget, setBudget] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createRfqInquiryAction({
        contact_name: name,
        contact_phone: phone,
        contact_email: email,
        origin_city_id: offer.origin_city_id,
        destination_city_id: offer.destination_city_id,
        trip_type: offer.trip_type,
        departure_date: departureDate || undefined,
        return_date: returnDate || undefined,
        flexible_dates: flexible,
        travelers_count: travelers,
        budget_amount: budget ? parseFloat(budget) : undefined,
        budget_currency: offer.currency,
        description: notes || `طلب تعديل وتخصيص على العرض: ${offer.title_ar}`,
        target_agent_id: offer.agent_id,
      });

      if (!res.success) {
        setError(res.error || "تعذر إرسال طلب عرض السعر");
      } else {
        setSubmitted(true);
      }
    });
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 text-center text-emerald-950">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
          <Icon name="check_circle" className="text-2xl" />
        </span>
        <h4 className="mt-3 text-title-md font-bold text-emerald-900">
          تم إرسال طلب عرض السعر بنجاح!
        </h4>
        <p className="mt-1 text-body-sm text-emerald-800">
          تلقى الوكيل <strong>{offer.agent_display_name}</strong> تفاصيل طلبك المخصص، وسيقوم بدراسة
          احتياجاتك والرد عليك بأفضل عرض سعر عبر الجوال أو حسابك.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 text-label-sm font-semibold text-emerald-700 underline"
        >
          إرسال طلب مخصص آخر
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#1A2B6D] text-white">
            <Icon name="request_quote" className="text-lg" />
          </span>
          <div>
            <h3 className="text-title-sm font-bold text-on-surface">طلب عرض سعر مخصص (RFQ)</h3>
            <p className="text-label-xs text-on-surface-variant">
              هل تحتاج لتعديل التواريخ أو عدد الأفراد أو الفنادق؟ اطلب عرضاً خاصاً.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-1.5 text-label-sm font-bold text-[#1A2B6D] hover:bg-surface-container"
        >
          <span>{isOpen ? "إخفاء النموذج" : "طلب عرض مخصص"}</span>
          <Icon name={isOpen ? "expand_less" : "expand_more"} className="text-base" />
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-outline-variant/60 pt-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-body-sm text-red-700 flex items-center gap-2">
              <Icon name="error" className="text-sm shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-label-xs font-semibold text-on-surface mb-1">
                الاسم الكريم *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: محمد عبدالله"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-label-xs font-semibold text-on-surface mb-1">
                رقم الجوال للتواصل *
              </label>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+966 5X XXX XXXX"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none text-right"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-label-xs font-semibold text-on-surface mb-1">
                عدد المسافرين
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={travelers}
                onChange={(e) => setTravelers(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-label-xs font-semibold text-on-surface mb-1">
                تاريخ الذهاب المفضل
              </label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-label-xs font-semibold text-on-surface mb-1">
                الميزانية المستهدفة ({offer.currency})
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="اختياري"
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="flexible-dates"
              checked={flexible}
              onChange={(e) => setFlexible(e.target.checked)}
              className="size-4 rounded border-outline-variant text-primary focus:ring-primary"
            />
            <label htmlFor="flexible-dates" className="text-label-sm text-on-surface-variant cursor-pointer">
              تواريخ سفري مرنة (± 3 أيام)
            </label>
          </div>

          <div>
            <label className="block text-label-xs font-semibold text-on-surface mb-1">
              مواصفات وتعديلات طلبك *
            </label>
            <textarea
              required
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: نرغب في ترقية الفندق إلى 5 نجوم مطل على البحيرة، وإضافة سائق خاص طوال الرحلة، وإمكانية المساعدة في التأشيرة..."
              className="w-full rounded-lg border border-outline-variant bg-surface p-3 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1A2B6D] px-5 py-2 text-label-md font-bold text-white hover:bg-[#1A2B6D]/90 disabled:opacity-50"
            >
              {isPending ? "جارٍ الإرسال..." : "إرسال طلب عرض السعر للوكيل"}
              <Icon name="send" className="text-sm rtl:rotate-180" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
