import { cn } from "@/lib/cn";

/**
 * Google Material Symbols (BRAND_GUIDELINES §8): Outlined 400 standard,
 * filled only for active nav states (later). Decorative icons get aria-hidden.
 * Directional glyphs are mirrored case-by-case — never blindly (§13.2).
 */
export function Icon({
  name,
  className,
  filled = false,
  decorative = true,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  decorative?: boolean;
}) {
  return (
    <span
      {...(decorative ? { "aria-hidden": true } : {})}
      translate="no"
      className={cn("material-symbols-outlined select-none align-middle", className)}
      style={
        filled
          ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
          : undefined
      }
    >
      {name}
    </span>
  );
}
