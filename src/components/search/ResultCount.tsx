import { formatCount } from "@/lib/format";

/** Results count — always visible (SPEC §4.1). */
export function ResultCount({ total }: { total: number | null }) {
  return (
    <p aria-live="polite" className="text-body-sm text-on-surface-variant">
      {total === null ? "جارٍ العدّ…" : `${formatCount(total)} عرض`}
    </p>
  );
}
