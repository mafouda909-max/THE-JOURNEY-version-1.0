"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { OfferWithAgent } from "@/lib/data";
import { TRIP_TYPES } from "@/lib/format";
import { OfferCard } from "@/components/market/OfferCard";

type Sort = "relevant" | "newest" | "priceAsc" | "response";
type Band = "all" | "low" | "mid" | "high";

const SORTS: { key: Sort; label: string }[] = [
  { key: "relevant", label: "الأكثر ملاءمة" },
  { key: "newest", label: "الأحدث" },
  { key: "priceAsc", label: "السعر: الأقل أولاً" },
  { key: "response", label: "الأسرع استجابة" },
];

const BANDS: { key: Band; label: string }[] = [
  { key: "all", label: "كل الأسعار" },
  { key: "low", label: "اقتصادي · أقل من ٤٠٠٠" },
  { key: "mid", label: "متوسط · ٤٠٠٠–٨٠٠٠" },
  { key: "high", label: "فاخر · أكثر من ٨٠٠٠" },
];

export function OffersBrowser({
  offers,
  initial,
}: {
  offers: OfferWithAgent[];
  initial: { from: string; to: string; type: string };
}) {
  const [query, setQuery] = useState(initial.to);
  const [types, setTypes] = useState<string[]>(
    initial.type ? [initial.type] : [],
  );
  const [band, setBand] = useState<Band>("all");
  const [sort, setSort] = useState<Sort>("relevant");
  const [fastOnly, setFastOnly] = useState(false);
  const firstRun = useRef(true);

  // Funnel telemetry: search_submitted (debounced, skipped on first paint)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "search_submitted",
          meta: [query, ...types, band, fastOnly ? "fast" : "", sort]
            .filter(Boolean)
            .join(" | "),
        }),
      }).catch(() => undefined);
    }, 700);
    return () => clearTimeout(t);
  }, [query, types, band, fastOnly, sort]);

  const shown = useMemo(() => {
    let list = offers.filter((o) => {
      if (types.length > 0 && !types.includes(o.tripType)) return false;
      if (band !== "all") {
        const p = o.priceAmount;
        if (band === "low" && p >= 4000) return false;
        if (band === "mid" && (p < 4000 || p > 8000)) return false;
        if (band === "high" && p <= 8000) return false;
      }
      if (fastOnly && o.agent.responseRate < 95) return false;
      if (query.trim()) {
        const q = query.trim();
        const haystack = [
          o.title, o.titleEn ?? "", o.destinationCity, o.destinationCountry,
          o.destinationCountryEn, o.agent.displayName, o.description,
        ].join(" ");
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    switch (sort) {
      case "newest":
        list = [...list].sort(
          (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
        );
        break;
      case "priceAsc":
        list = [...list].sort((a, b) => a.priceAmount - b.priceAmount);
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
  }, [offers, types, band, fastOnly, query, sort]);

  const activeFilters =
    types.length + (band !== "all" ? 1 : 0) + (fastOnly ? 1 : 0) + (query.trim() ? 1 : 0);

  function reset() {
    setQuery("");
    setTypes([]);
    setBand("all");
    setFastOnly(false);
    setSort("relevant");
  }

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${
      active
        ? "border-deep bg-deep text-white"
        : "border-outlinev bg-cloud text-slate hover:border-deep/50 hover:text-deep"
    }`;

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-5 border-b border-outlinev bg-mist/90 px-5 py-4 backdrop-blur-md md:top-[72px] md:-mx-8 md:px-8">
        <div className="mb-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="وجهة، وكيل، أو نوع رحلة…"
              className="w-full rounded-lg border border-outlinev bg-cloud py-3 pe-4 ps-10 text-[15px] font-medium outline-none transition-colors placeholder:text-slate/50 focus:border-deep focus:ring-4 focus:ring-deep/10"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-lg border border-outlinev bg-cloud px-3 py-3 text-[13px] font-semibold text-slate outline-none focus:border-deep"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate" />
          {TRIP_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() =>
                setTypes((prev) =>
                  prev.includes(t.key)
                    ? prev.filter((x) => x !== t.key)
                    : [...prev, t.key],
                )
              }
              className={chip(types.includes(t.key))}
            >
              {t.label}
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-outlinev sm:block" />
          <select
            value={band}
            onChange={(e) => setBand(e.target.value as Band)}
            className={`rounded-full border px-4 py-2 text-[13px] font-semibold outline-none transition-all ${
              band !== "all"
                ? "border-deep bg-deep text-white"
                : "border-outlinev bg-cloud text-slate"
            }`}
          >
            {BANDS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
          <button onClick={() => setFastOnly((v) => !v)} className={chip(fastOnly)}>
            استجابة ٩٥٪+
          </button>
          {activeFilters > 0 && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-amber px-4 py-2 text-[13px] font-semibold text-gold transition-colors hover:bg-gold hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              مسح ({activeFilters})
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="tnum text-sm font-semibold text-slate">
          {shown.length} {shown.length === 1 ? "عرض" : "عروض"} مطابِقة
          {initial.from ? ` · انطلاقاً من ${initial.from}` : ""}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-outlinev bg-cloud px-8 py-20 text-center">
          <p className="text-2xl font-bold text-inkwell">لا نتائج بهذه الدقة.</p>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-slate">
            جرّب توسيع البحث: أزل نوع الرحلة، أو غيّر نطاق السعر — العروض تتجدد
            يومياً بعد مراجعة الثقة.
          </p>
          <button
            onClick={reset}
            className="mt-6 rounded-lg bg-deep px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-horizon"
          >
            عرض كل العروض
          </button>
        </div>
      ) : (
        <motion.div layout className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {shown.map((o) => (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <OfferCard offer={o} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
