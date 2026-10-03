"use client";

import { FormEvent, useState } from "react";
import {
  SilaCompareIcon,
  SilaSearchIcon,
} from "@/components/brand/SilaIcons";

type CompareResult = {
  query: {
    originIata: string;
    destinationIata: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    currency?: string;
  };
  checkedAt: string;
  supplierStatus: Array<{
    provider: string;
    configured: boolean;
    connected: boolean;
    checkedAt: string;
    warnings: string[];
  }>;
  count: number;
  comparison: Array<{
    offer: {
      id: string;
      source: {
        provider: string;
        kind: string;
        authorityLevel: number;
        checkedAt: string;
      };
      price: { total: number; currency: string };
      durationMinutes: number | null;
      stops: number;
      validatingAirlines: string[];
      cabin?: string;
      includedCheckedBags?: { quantity?: number; weightKg?: number };
      segments: Array<{
        departureIata: string;
        arrivalIata: string;
        departureAt: string;
        arrivalAt: string;
        carrierCode: string;
        flightNumber: string;
      }>;
      warnings: string[];
    };
    badges: string[];
    facts: {
      price: string;
      duration: string;
      stops: string;
      baggage: string;
      cabin: string;
      source: string;
      freshness: string;
    };
  }>;
  disclosure: string;
  error?: string;
};

function todayPlus(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function FlightCompareWorkbench({
  initial,
}: {
  initial?: {
    departureDate?: string | null;
    returnDate?: string | null;
    adults?: number | null;
    intentLabel?: string | null;
  };
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams({
      origin: String(data.get("origin") ?? "").toUpperCase(),
      destination: String(data.get("destination") ?? "").toUpperCase(),
      departure: String(data.get("departure") ?? ""),
      adults: String(data.get("adults") ?? "1"),
      currency: String(data.get("currency") ?? "EGP"),
    });
    const returnDate = String(data.get("return") ?? "");
    if (returnDate) params.set("return", returnDate);
    if (data.get("nonStop") === "on") params.set("nonStop", "true");

    try {
      const response = await fetch(`/api/travel/compare?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as CompareResult;
      if (!response.ok) throw new Error(json.error ?? "تعذر إجراء المقارنة");
      setResult(json);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "تعذر إجراء المقارنة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {initial?.intentLabel ? (
        <div className="sila-window border border-sky/40 bg-air/45 px-4 py-3 text-[12px] font-semibold text-deep">
          المقارنة مرتبطة بنية السفر: {initial.intentLabel}. أدخل أكواد المطارات لأن صلة لا تحوّل أسماء المدن إلى IATA بدون مصدر موثوق.
        </div>
      ) : null}
      <form
        onSubmit={submit}
        className="sila-window border border-outlinev bg-cloud p-4 shadow-[0_18px_60px_rgba(8,38,74,0.08)] md:p-6"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.1fr_1.1fr_.7fr_.8fr]">
          {[
            ["origin", "من", "CAI"],
            ["destination", "إلى", "IST"],
          ].map(([name, label, placeholder]) => (
            <label key={name} className="block">
              <span className="mb-2 block text-[11px] font-semibold text-slate">
                {label}
              </span>
              <input
                name={name}
                required
                maxLength={3}
                placeholder={placeholder}
                className="w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-center font-mono text-sm font-bold uppercase text-deep outline-none focus:border-signal focus:bg-cloud focus:ring-4 focus:ring-signal/10"
              />
            </label>
          ))}

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold text-slate">الذهاب</span>
            <input
              name="departure"
              type="date"
              required
              defaultValue={initial?.departureDate || todayPlus(14)}
              className="w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-sm font-semibold text-deep outline-none focus:border-signal"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold text-slate">العودة</span>
            <input
              name="return"
              type="date"
              defaultValue={initial?.returnDate || todayPlus(21)}
              className="w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-sm font-semibold text-deep outline-none focus:border-signal"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold text-slate">بالغون</span>
            <input
              name="adults"
              type="number"
              min={1}
              max={9}
              defaultValue={initial?.adults && initial.adults > 0 ? Math.min(initial.adults, 9) : 1}
              className="w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-sm font-semibold text-deep outline-none focus:border-signal"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold text-slate">العملة</span>
            <select
              name="currency"
              defaultValue="EGP"
              className="w-full rounded-2xl border border-outlinev bg-low/60 px-4 py-3.5 text-sm font-semibold text-deep outline-none focus:border-signal"
            >
              {["EGP", "SAR", "AED", "USD", "EUR"].map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outlinev pt-4">
          <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate">
            <input name="nonStop" type="checkbox" className="h-4 w-4 accent-[#2E6FD8]" />
            مباشر فقط
          </label>

          <button
            type="submit"
            disabled={loading}
            className="sila-interactive inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-signal px-6 py-3 text-sm font-bold text-white hover:-translate-y-0.5 hover:bg-horizon disabled:opacity-50"
          >
            <SilaSearchIcon className="h-5 w-5" />
            {loading ? "نقارن المصادر…" : "قارن الآن"}
          </button>
        </div>
      </form>

      {error ? (
        <div className="sila-window border border-error/20 bg-errorbg p-5 text-sm font-semibold text-error">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="sila-eyebrow text-[11px] font-semibold text-signal">
                نتيجة مبنية على المصادر المتصلة
              </div>
              <h2 className="mt-2 text-2xl font-bold text-inkwell">
                {result.count > 0
                  ? `${result.count} نتيجة قابلة للمقارنة`
                  : "لا توجد نتائج مقارنة الآن"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.supplierStatus.map((supplier) => (
                <span
                  key={supplier.provider}
                  className={
                    supplier.connected
                      ? "rounded-full bg-verifiedbg px-3 py-1.5 text-[11px] font-bold text-verified"
                      : "rounded-full bg-low px-3 py-1.5 text-[11px] font-bold text-slate"
                  }
                >
                  {supplier.provider} · {supplier.connected ? "متصل" : supplier.configured ? "غير متاح الآن" : "غير مهيأ"}
                </span>
              ))}
            </div>
          </div>

          {result.comparison.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {result.comparison.map((row) => (
                <article
                  key={row.offer.id}
                  className="sila-window sila-interactive border border-outlinev bg-cloud p-5 shadow-[0_10px_36px_rgba(8,38,74,0.05)] hover:-translate-y-1 hover:border-sky hover:shadow-[0_20px_50px_rgba(8,38,74,0.1)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold text-signal">
                        {row.facts.source}
                      </div>
                      <div className="mt-1 text-[12px] text-slate">{row.facts.freshness}</div>
                    </div>
                    <div className="text-end">
                      <div className="tnum text-2xl font-bold text-deep">{row.facts.price}</div>
                      <div className="mt-1 text-[11px] text-slate">للبحث الحالي</div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {row.badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-air px-3 py-1.5 text-[11px] font-bold text-deep"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["المدة", row.facts.duration],
                      ["التوقفات", row.facts.stops],
                      ["الأمتعة", row.facts.baggage],
                      ["المقصورة", row.facts.cabin],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-low/70 p-3">
                        <div className="text-[10px] font-semibold text-slate">{label}</div>
                        <div className="mt-1 text-[12px] font-bold text-deep">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 border-t border-outlinev pt-4">
                    <div className="flex items-center gap-2 text-[12px] font-bold text-inkwell">
                      <SilaCompareIcon className="h-4 w-4 text-signal" />
                      خط السير
                    </div>
                    <div className="mt-3 space-y-2">
                      {row.offer.segments.map((segment, index) => (
                        <div
                          key={`${segment.flightNumber}-${index}`}
                          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-[11px]"
                        >
                          <span className="font-mono font-bold text-deep">
                            {segment.departureIata}
                          </span>
                          <span className="h-px bg-outlinev" />
                          <span className="font-mono font-bold text-deep">
                            {segment.arrivalIata}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="sila-window border border-dashed border-outlinev bg-cloud p-10 text-center">
              <SilaCompareIcon className="mx-auto h-8 w-8 text-signal" />
              <div className="mt-4 font-bold text-inkwell">المقارنة جاهزة، لكن المورد لم يُرجع نتائج.</div>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate">
                لو Amadeus غير مهيأ في البيئة الحالية، ستظهر حالة المصدر بوضوح بدل نتائج وهمية.
              </p>
            </div>
          )}

          <p className="rounded-2xl bg-low px-4 py-3 text-[11px] leading-5 text-slate">
            {result.disclosure}
          </p>
        </div>
      ) : null}
    </div>
  );
}
