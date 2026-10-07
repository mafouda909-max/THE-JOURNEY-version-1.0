"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import type { OfferWithAgent } from "@/lib/data";
import { TRIP_TYPES } from "@/lib/format";
import { OfferCard } from "@/components/market/OfferCard";

type Sort = "relevant" | "newest";
type SearchEventName = "search_submitted" | "search_filter_changed" | "search_sort_changed";

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function emitSearchEvent(name: SearchEventName, detail: Record<string, unknown>) {
  const meta = JSON.stringify({ v: 1, source: "offers_browser", path: "/offers", ...detail });
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, meta }),
    keepalive: true,
  }).catch(() => undefined);
}

export function OffersBrowser({
  offers,
  initial,
}: {
  offers: OfferWithAgent[];
  initial: { from: string; to: string; type: string; travelers: number | null; intentId: number | null };
}) {
  const [origin, setOrigin] = useState(initial.from);
  const [query, setQuery] = useState(initial.to);
  const [types, setTypes] = useState<string[]>(initial.type ? [initial.type] : []);
  const [travelers, setTravelers] = useState<number | null>(initial.travelers);
  const [sort, setSort] = useState<Sort>("relevant");

  function recordSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    emitSearchEvent("search_submitted", {
      from: origin.trim() || null,
      query: query.trim() || null,
      types,
      travelers,
      sort,
    });
  }

  const shown = useMemo(() => {
    const originNeedle = normalise(origin);
    const needle = normalise(query);
    let list = offers.filter((offer) => {
      if (types.length > 0 && !types.includes(offer.tripType)) return false;
      if (travelers !== null && (travelers < offer.minTravelers || travelers > offer.maxTravelers)) return false;
      if (originNeedle && !normalise(offer.originCity).includes(originNeedle)) return false;
      if (needle) {
        const haystack = normalise(
          [
            offer.title,
            offer.titleEn ?? "",
            offer.destinationCity,
            offer.destinationCountry,
            offer.destinationCountryEn,
            offer.agent.displayName,
            offer.description,
          ].join(" "),
        );
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    if (sort === "newest") {
      list = [...list].sort(
        (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      );
    } else {
      list = [...list].sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
      );
    }
    return list;
  }, [offers, origin, query, types, travelers, sort]);

  const inventoryEmpty = offers.length === 0;
  const activeFilters =
    (origin.trim() ? 1 : 0) +
    types.length +
    (travelers !== null ? 1 : 0) +
    (query.trim() ? 1 : 0);

  function reset() {
    setOrigin("");
    setQuery("");
    setTypes([]);
    setTravelers(null);
    setSort("relevant");
    emitSearchEvent("search_filter_changed", { action: "reset" });
  }

  return (
    <div>
      <form onSubmit={recordSearch} className="border-y border-outlinev bg-cloud">
        <div className="grid gap-0 lg:grid-cols-[1fr_1fr_160px_auto] lg:divide-x lg:divide-x-reverse lg:divide-outlinev">
          <label className="p-4 md:p-5">
            <span className="mb-2 block text-[10px] font-bold text-slate">من أين؟</span>
            <input
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              placeholder="مدينة الانطلاق"
              className="w-full border-0 bg-transparent p-0 text-[15px] font-bold text-deep outline-none placeholder:font-medium placeholder:text-slate/55"
            />
          </label>

          <label className="border-t border-outlinev p-4 md:p-5 lg:border-t-0">
            <span className="mb-2 block text-[10px] font-bold text-slate">إلى أين / ماذا تبحث؟</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="وجهة، وكيل، أو نوع رحلة"
              className="w-full border-0 bg-transparent p-0 text-[15px] font-bold text-deep outline-none placeholder:font-medium placeholder:text-slate/55"
            />
          </label>

          <label className="border-t border-outlinev p-4 md:p-5 lg:border-t-0">
            <span className="mb-2 block text-[10px] font-bold text-slate">المسافرون</span>
            <input
              type="number"
              min={1}
              max={14}
              inputMode="numeric"
              value={travelers ?? ""}
              onChange={(event) => {
                const value = event.target.value === "" ? null : Number(event.target.value);
                setTravelers(value !== null && Number.isInteger(value) && value >= 1 && value <= 14 ? value : null);
              }}
              placeholder="أي عدد"
              className="tnum w-full border-0 bg-transparent p-0 text-[15px] font-bold text-deep outline-none placeholder:font-medium placeholder:text-slate/55"
            />
          </label>

          <div className="flex items-center border-t border-outlinev p-3 lg:border-t-0">
            <button type="submit" className="focus-action w-full lg:w-auto">
              <Search className="h-4 w-4" />
              طبّق
            </button>
          </div>
        </div>

        <details className="progressive-panel px-4 md:px-5">
          <summary>
            <span>فلاتر إضافية {activeFilters > 0 ? `· ${activeFilters} مستخدمة` : ""}</span>
          </summary>
          <div className="grid gap-6 border-t border-outlinev py-5 lg:grid-cols-[1fr_220px_auto]">
            <div>
              <div className="text-[10px] font-bold text-slate">نوع الرحلة</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {TRIP_TYPES.map((tripType) => {
                  const active = types.includes(tripType.key);
                  return (
                    <button
                      key={tripType.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        const next = active
                          ? types.filter((item) => item !== tripType.key)
                          : [...types, tripType.key];
                        setTypes(next);
                        emitSearchEvent("search_filter_changed", { filter: "trip_type", values: next });
                      }}
                      className={
                        "min-h-10 rounded-full border px-4 py-2 text-[12px] font-bold transition-colors " +
                        (active
                          ? "border-signal bg-air text-deep"
                          : "border-outlinev bg-cloud text-slate hover:border-sky hover:text-deep")
                      }
                    >
                      {tripType.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label>
              <span className="mb-2 block text-[10px] font-bold text-slate">الترتيب</span>
              <select
                value={sort}
                onChange={(event) => {
                  const next = event.target.value as Sort;
                  setSort(next);
                  emitSearchEvent("search_sort_changed", { sort: next });
                }}
                className="min-h-11 w-full rounded-xl border border-outlinev bg-cloud px-3 text-sm font-bold text-deep outline-none focus:border-signal"
              >
                <option value="relevant">الأكثر ملاءمة</option>
                <option value="newest">الأحدث نشرًا</option>
              </select>
            </label>

            {activeFilters > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="quiet-action self-end text-slate"
              >
                <RotateCcw className="h-4 w-4" />
                مسح الفلاتر
              </button>
            ) : null}
          </div>
        </details>
      </form>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-slate">النتائج</div>
          <div className="tnum mt-1 text-2xl font-bold text-deep">
            {shown.length} {shown.length === 1 ? "عرض" : "عروض"}
          </div>
        </div>
        <p className="max-w-lg text-[11px] leading-6 text-slate">
          لا نقارن أسعار عملات مختلفة كأنها متساوية، ولا نعرض عرضًا منتهيًا أو غير منشور.
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 border-y border-outlinev py-12 text-center">
          <h2 className="text-2xl font-bold text-deep">
            {inventoryEmpty ? "لا توجد عروض منشورة الآن." : "لا توجد نتيجة تطابق هذا السياق."}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate">
            {inventoryEmpty
              ? "صلة لا تملأ السوق ببيانات تجريبية. ابدأ رحلتك، وسنحتفظ بالسياق حتى يظهر عرض حقيقي مناسب."
              : "غيّر الوجهة أو عدد المسافرين أو نوع الرحلة. النتيجة الفارغة أفضل من نتيجة مضللة."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/readiness" className="focus-action">ابدأ رحلتك</Link>
            {!inventoryEmpty ? (
              <button type="button" onClick={reset} className="quiet-action">إزالة الفلاتر</button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {shown.map((offer) => (
            <OfferCard key={offer.id} offer={offer} intentId={initial.intentId} />
          ))}
        </div>
      )}
    </div>
  );
}
