import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Card — §11: white surface, 8px radius, tonal shadow, no colored shadows. */
interface CardProps extends Omit<ComponentProps<"div">, "className"> {
  hover?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({ hover = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface shadow-sm",
        hover && "transition-shadow duration-200 hover:shadow-md",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Badge/Pill — rounded-full; color communicates semantic meaning ONLY. */
type BadgeTone = "neutral" | "success" | "warning" | "error" | "info" | "brand";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-container text-on-surface-variant",
  success: "bg-success-container text-on-success-container",
  warning: "bg-warning-container text-on-warning-container",
  error: "bg-error-container text-on-error-container",
  info: "bg-info-container text-on-info-container",
  brand: "bg-primary-container text-on-primary-container",
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-lg",
        tones[tone],
        className,
      )}
    >
      {icon && <IconInline name={icon} />}
      {children}
    </span>
  );
}

function IconInline({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      translate="no"
      className="material-symbols-outlined select-none text-[16px] leading-none"
      style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
    >
      {name}
    </span>
  );
}
