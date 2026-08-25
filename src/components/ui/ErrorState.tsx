"use client";

import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * ErrorState — clear recovery path (MVP_SCOPE P0). Retry is a real action.
 */
export function ErrorState({
  title = "حدث خطأ غير متوقع",
  description = "تعذر تحميل المحتوى. تحقق من الاتصال ثم أعد المحاولة.",
  retryLabel = "إعادة المحاولة",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg bg-surface px-6 py-14 text-center shadow-sm",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full bg-error-container"
      >
        <span
          translate="no"
          aria-hidden
          className="material-symbols-outlined select-none text-[32px] text-on-error-container"
        >
          cloud_off
        </span>
      </span>
      <h2 className="text-title-lg text-on-surface">{title}</h2>
      <p className="max-w-sm text-body-sm text-on-surface-variant">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
