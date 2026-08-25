import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * EmptyState — actionable, never blank (MVP_SCOPE P0 / AD-11 empty behavior).
 * Illustration assets pending (BRAND_GUIDELINES §10) — icon + copy interim.
 */
export function EmptyState({
  iconName = "search_off",
  title,
  description,
  actions,
  suggestions,
  className,
}: {
  iconName?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Staged-relaxation hints (AD-11): sibling destinations, popular picks… */
  suggestions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg bg-surface px-6 py-14 text-center shadow-sm",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full bg-surface-container-low"
      >
        <Icon name={iconName} className="text-[32px] text-on-surface-variant" />
      </span>
      <h2 className="text-title-lg text-on-surface">{title}</h2>
      {description && (
        <p className="max-w-sm text-body-sm text-on-surface-variant">{description}</p>
      )}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>}
      {suggestions && <div className="mt-4 w-full max-w-md">{suggestions}</div>}
    </div>
  );
}
