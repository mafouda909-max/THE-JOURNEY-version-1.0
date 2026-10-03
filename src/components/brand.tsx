import type { CSSProperties } from "react";

/**
 * THE JOURNEY — Passage mark
 *
 * Two nested thresholds create a forward passage without relying on planes,
 * globes, map pins, or route-line clichés. The open lower edge keeps the mark
 * directional and human: trust is a passage into a decision, not a stamp that
 * pretends uncertainty disappeared.
 */
export function PassageMark({
  className = "h-7 w-7",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
    >
      <path
        d="M6 27V9.25A4.25 4.25 0 0 1 10.25 5h11.5A4.25 4.25 0 0 1 26 9.25V27"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 27V13.75A2.75 2.75 0 0 1 14.75 11h2.5A2.75 2.75 0 0 1 20 13.75V27"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLockup({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  const primary = inverse ? "text-white" : "text-deep";
  const secondary = inverse ? "text-oninverse/58" : "text-slate";

  return (
    <span className="inline-flex items-center gap-3">
      <PassageMark className={`${compact ? "h-6 w-6" : "h-8 w-8"} ${primary}`} />
      <span className="leading-none">
        <span className={`block font-bold tracking-[-0.025em] ${compact ? "text-lg" : "text-[22px]"} ${primary}`}>
          الرحلة
        </span>
        <span className={`mt-1 block font-mono text-[9px] font-semibold uppercase tracking-[0.28em] ${secondary}`}>
          The Journey
        </span>
      </span>
    </span>
  );
}

export function TrustGlyph({
  className = "h-5 w-5",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden fill="none">
      <rect x="4.5" y="4.5" width="15" height="15" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 12.5 9.2 16.7 19 6.9" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
