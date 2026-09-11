"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { OfferWithAgent } from "@/lib/data";
import { TRIP_TYPES } from "@/lib/format";
import { OfferCard } from "@/components/market/OfferCard";

type Sort = "relevant" | "newest" | "response";

const SORTS: { key: Sort; label: string }[] = [
  { key: "relevant", label: "الأكثر ملاءمة" },
  { key: "newest", label: "الأحدث" },
  { key: "response", label: "الأسرع استجابة" },
];

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function OffersBrowser({
  offers,
  initial,
}: {
  offers: OfferWithAgent[];
  initial: { from: string; to: string; type: string };
}) {
  const [query, setQuery] = useState(initial.to);
  const [types, setTypes] = useState<string[]>(initial.type ? [initial.type] : []);
  const [sort, setSort] = useState<Sort>("relevant");
  const [fastOnly, setFastOnly] = useState(false);

  function recordSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const meta = [initial.from ? `from:${initial.from}` : "", query ? `query:${query}` : "", ...types.map((type) => `type:${type}`)]
      .filter(Boolean)
      .join(" | ");
    if (!meta) return;
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "search_submitted", meta }),
    }).catch(() => undefined);
  }

  const shown = useMemo(() => {
    const origin = normalise(initial.from);
    const needle = normalise(query);
    let list = offers.filter((offer) => {
      if (types.length > 0 && !types.includes(offer.tripType)) return false;
      if (fastOnly && offer.agent.responseRate < 95) return false;
      if (origin && !normalise(offer.originCity).includes(origin)) return false;
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

    switch (sort) {
      case "newest":
        list = [...list].sort(
          (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
        );
        break;
      case "response":
        list = [...list].sort((a, b) => b.agent.responseRate - a.agent.responseRate);
        break;
      default:
        list = [...list].sort(
          (a, b) =>
            Number(b.isFeatured) - Number(a.isFeatured) ||
            b.contactCount - a.contactCount,
        );
    }
    return list;
  }, [offers, initial.from, types, fastOnly, query, sort]);

  const activeFilters = types.length + (fastOnly ? 1 : 0) + (query.trim() ? 1 : 0);

  function reset() {
    setQuery("");
    setTypes([]);
    setFastOnly(false);
    setSort("relevant");
  }

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20 ${
      active
        ? "border-deep bg-deep text-white"
        : "border-outlinev bg-cloud text-slate hover:border-deep/50 hover:text-deep"
    }`;

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-5 border-b border-outlinev bg-mist/90 px-5 py-4 backdrop-blur-md md:top-[72px] md:-mx-8 md:px-8">
        <form onSubmit={recordSearch} className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">ابحث في الوجهات والوكلاء والعروض</span>
            <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="وجهة، وكيل، أو نوع رحلة…"
              className="w-full rounded-lg border border-outlinev bg-cloud py-3 pe-4 ps-10 text-[15px] font-medium outline-none transition-colors placeholder:text-slate/50 focus:border-deep focus:ring-4 focus:ring-deep/10"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-deep px-4 py-3 text-[13px] font-bold text-white transition-colors hover:bg-horizon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            بحث
          </button>
          <label>
            <span className="sr-only">ترتيب العروض</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="min-h-11 w-full rounded-lg border border-outlinev bg-cloud px-3 py-3 text-[13px] font-semibold text-slate outline-none focus:border-deep focus:ring-4 focus:ring-deep/10 sm:w-auto"
            >
              {SORTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </form>

        <div className="flex flex-wrap items-center gap-2" aria-label="فلاتر العروض">
          <SlidersHorizontal className="h-4 w-4 text-slate" aria-hidden="true" />
          {TRIP_TYPES.map((tripType) => {
            const active = types.includes(tripType.key);
            return (
              <button
                key={tripType.key}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setTypes((previous) =>
                    previous.includes(tripType.key)
                      ? previous.filter((item) => item !== tripType.key)
                      : [...previous, tripType.key],
                  )
                }
                className={chip(active)}
              >
                {tripType.label}
              </button>
            );
          })}
          <span className="mx-1 hidden h-5 w-px bg-outlinev sm:block" aria-hidden="true" />
          <button
            type="button"
            aria-pressed={fastOnly}
            onClick={() => setFastOnly((value) => !value)}
            className={chip(fastOnly)}
          >
            استجابة ٩٥٪+
          </button>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-amber px-4 py-2 text-[13px] font-semibold text-gold transition-colors hover:bg-gold hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gold/20"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              مسح ({activeFilters})
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate/80">
          لا نرتّب الأسعار بين عملات مختلفة بدون تحويل موثوق ومؤرّخ؛ لذلك تعرض هذه الصفحة السعر بعملته الأصلية وتترك المقارنة السعرية للسياق المتجانس فقط.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between" aria-live="polite">
        <div className="tnum text-sm font-semibold text-slate">
          {shown.length} {shown.length === 1 ? "عرض" : "عروض"} مطابِقة
          {initial.from ? ` · انطلاقاً من ${initial.from}` : ""}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-outlinev bg-cloud px-8 py-20 text-center">
          <p className="text-2xl font-bold text-inkwell">لا نتائج بهذه الدقة.</p>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-slate">
            جرّب توسيع البحث أو إزالة بعض الفلاتر. لا نعرض عرضًا لم يعد منشورًا أو لوكيل فقد حالة التوثيق الحالية.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-deep px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-horizon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20"
          >
            عرض كل العروض
          </button>
        </div>
      ) : (
        <motion.div layout className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {shown.map((offer) => (
              <motion.div
                key={offer.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <OfferCard offer={offer} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
