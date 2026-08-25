"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import {
  CityAutocomplete,
  type PlaceSelection,
} from "./CityAutocomplete";
import { filterFallbackPlaces } from "@/lib/search/places-fallback";
import { filtersToQuery, TRIP_TYPES } from "@/lib/search/params";
import type { TripType } from "@/lib/search/params";

/**
 * Hero SearchModule — rounded-xl/16px per DESIGN.md Shapes & Radius.
 * Embodies the core question: «مسافر منين ورايح فين؟»
 * Destination is the primary intent; origin optional ("anywhere").
 */
export function SearchModule() {
  const router = useRouter();
  const [dest, setDest] = useState<PlaceSelection | null>(null);
  const [origin, setOrigin] = useState<PlaceSelection | null>(null);
  const [tripTypes, setTripTypes] = useState<TripType[]>([]);

  // RPC source built client-side (RSC-safe): on failure, degrade to curated list.
  const rpcFetcher = useMemo(
    () => async (q: string) => {
      try {
        const { searchPlaces } = await import("@/lib/data/places");
        return await searchPlaces(q);
      } catch {
        return filterFallbackPlaces(q);
      }
    },
    [],
  );

  function toggleType(t: TripType) {
    setTripTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function search() {
    const qs = filtersToQuery({
      destinationCityId: dest?.slug,
      originCityId: origin?.slug,
      tripTypes,
      sort: "relevance",
    });
    router.push(`/offers${qs}`);
  }

  return (
    <section
      aria-label="ابحث عن رحلتك"
      className="rounded-xl bg-surface p-4 shadow-lg md:p-6"
    >
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <CityAutocomplete
          id="hero-dest"
          label="إلى أين؟"
          placeholder="اختر الوجهة"
          value={dest}
          onChange={setDest}
          fetcher={rpcFetcher}
        />
        <CityAutocomplete
          id="hero-origin"
          label="من أين؟ (اختياري)"
          placeholder="أي مكان"
          value={origin}
          onChange={setOrigin}
          allowAnywhere
          fetcher={rpcFetcher}
        />
        <Button size="lg" onClick={search} className="h-12 w-full md:w-auto">
          <Icon name="search" />
          ابحث
        </Button>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-2 text-label-lg text-on-surface-variant">
          نوع الرحلة
        </legend>
        <div className="flex flex-wrap gap-2" dir="rtl">
          {TRIP_TYPES.map((t) => {
            const activeTrip = tripTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={activeTrip}
                onClick={() => toggleType(t)}
                className={
                  "min-h-11 rounded-full px-4 text-label-lg transition-colors duration-100 " +
                  (activeTrip
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high")
                }
              >
                {TRIP_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  flight: "طيران",
  package: "برامج سياحية",
  visa: "تأشيرات",
  umrah: "عمرة",
  hotel: "فنادق",
  cruise: "رحلات بحرية",
  custom: "مخصص",
};
