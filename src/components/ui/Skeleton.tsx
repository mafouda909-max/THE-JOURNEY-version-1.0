import { cn } from "@/lib/cn";

/** Skeleton — loading placeholder; prevents layout shift (MVP_SCOPE P0). */
export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-container", className)}
    />
  );
}
