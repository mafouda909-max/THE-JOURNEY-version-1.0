"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { OfferCard } from "@/components/offers/OfferCard";
import { FilterChips } from "./FilterChips";
import { FilterBottomSheet, FilterSidebar } from "./FilterPanels";
import { ResultCount } from "./ResultCount";
import { SortControl } from "./SortControl";
import {
  DEFAULT_FILTERS,
  filtersToQuery,
  isEmptyFilters,
  parseFilters,
  type SearchFilters,
} from "@/lib/search/params";
import {
  listPublicOffersBrowser,
} from "@/lib/data/offers";
import { DataSourceUnavailableError } from "@/lib/data/types";
import type { PublicOfferRow } from "@/lib/data/types";

type Status = "idle" | "loading" | "ready" | "empty" | "error" | "unavailable";

/**
 * Results explorer — URL is the single source of truth; every control mutates
 * the URL and state derives from it. Load-more ×12 (ratified d).
 */
export function OffersExplorer() {
  const router = useRouter();
  const sp = useSearchParams();
  const filters = useMemo(() => parseFilters(Object.fromEntries(sp.entries())), [sp]);

  const [rows, setRows] = useState<PublicOfferRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>("loading");
  const [sheetOpen, setSheetOpen] = useState(false);

  const update = useCallback(
    (next: SearchFilters) => {
      router.replace(`/offers${filtersToQuery(next)}`, { scroll: false });
    },
    [router],
  );

  // Render-phase adjustment (React-approved): query identity change → reset pagination
  const [prevFilters, setPrevFilters] = useState(filters);
  if (prevFilters !== filters) {
    setPrevFilters(filters);
    setPage(1);
    setRows([]);
  }

  // Fetch on query change. All setState calls live inside promise callbacks;
  // "loading" is DERIVED (requestKey !== resolvedKey) — no setState-in-effect.
  const requestKey = `${filtersToQuery(filters)}#${page}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const loading = resolvedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    listPublicOffersBrowser(filters, page)
      .then(({ rows: r, total: t }) => {
        if (cancelled) return;
        setTotal(t);
        setRows((prev) => (page === 1 ? r : [...prev, ...r]));
        setStatus(r.length === 0 && page === 1 ? "empty" : "ready");
        setResolvedKey(requestKey);
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus(e instanceof DataSourceUnavailableError ? "unavailable" : "error");
        setResolvedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey encodes both inputs
  }, [requestKey]);

  const canLoadMore =
    !loading && status === "ready" && rows.length > 0 &&
    (total === null || rows.length < total);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-10">
      {/* Controls bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FilterBottomSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            filters={filters}
            airlines={[]}
            onChange={update}
          />
          <ResultCount total={loading ? null : total ?? rows.length} />
        </div>
        <SortControl filters={filters} onChange={update} />
      </div>

      <FilterChips filters={filters} labels={{ cities: {}, airlines: {} }} onChange={update} />

      {/* Body: sidebar (desktop) + results */}
      <div className="mt-4 flex gap-6">
        <FilterSidebar filters={filters} airlines={[]} onChange={update} />

        <section aria-label="نتائج البحث" className="min-w-0 flex-1">
          {loading && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="mt-3 h-7 w-3/4" />
                  <Skeleton className="mt-2 h-5 w-1/2" />
                  <Skeleton className="mt-6 h-9 w-32" />
                </Card>
              ))}
            </div>
          )}

          {(status === "ready" || status === "idle") && rows.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((o) => (
                  <OfferCard key={o.id} offer={o} />
                ))}
              </div>
              {canLoadMore && (
                <div className="mt-8 text-center">
                  <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
                    تحميل المزيد
                  </Button>
                </div>
              )}
            </>
          )}

          {status === "empty" ||
            (status === "ready" && rows.length === 0 && (
              <EmptyResults filters={filters} onChange={update} />
            ))}

          {status === "error" && (
            <ErrorState onRetry={() => setPage(1)} />
          )}

          {status === "unavailable" && (
            <EmptyState
              iconName="database"
              title="خدمة البحث غير مهيأة بعد"
              description="لم يتم ربط قاعدة البيانات في هذه البيئة بعد."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyResults({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (n: SearchFilters) => void;
}) {
  return isEmptyFilters(filters) ? (
    <EmptyState
      title="لا توجد عروض منشورة بعد"
      description="عروض الوكلاء الموثوقين ستظهر هنا فور نشرها."
    />
  ) : (
    <EmptyState
      title="لا توجد نتائج مطابقة"
      description="جرّب تخفيف الفلاتر أو استكشاف وجهات أخرى."
      actions={
        <Button variant="secondary" size="sm" onClick={() => onChange({ ...DEFAULT_FILTERS })}>
          مسح كل الفلاتر
        </Button>
      }
    />
  );
}
