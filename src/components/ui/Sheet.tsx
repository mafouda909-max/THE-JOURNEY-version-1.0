"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Sheet — mobile bottom sheet (SPEC §4.1: filters in a bottom sheet).
 * Motion: MD/300ms decelerate-in (BRAND_GUIDELINES §11); no bounce.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      {/* backdrop */}
      <button
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-surface-dim/70 backdrop-blur-[2px]"
      />
      {/* panel — slides up, ease-out */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-xl bg-surface shadow-lg",
          "transition-transform duration-300 ease-out",
        )}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <span aria-hidden className="absolute start-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-outline-variant" />
          <h2 className="text-title-md text-on-surface">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="إغلاق"
            className="flex size-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="border-t border-outline-variant px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
