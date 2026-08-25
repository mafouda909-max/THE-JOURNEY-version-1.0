import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Button — DESIGN_SYSTEM_AUDIT §11: rounded-md (8px), Deep Ink primary,
 * destructive = ERROR semantics only. Min 44px touch target (SPEC §9).
 * Focus ring always visible (accessibility §13).
 */
type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/90",
  secondary:
    "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80",
  ghost: "text-on-surface hover:bg-surface-container",
  destructive: "bg-error text-on-error hover:bg-error/90",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-label-lg",
  md: "min-h-11 px-4 text-label-lg", // 44px touch target
  lg: "min-h-12 px-6 text-body-md",
};

interface ButtonProps extends Omit<ComponentProps<"button">, "className"> {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

/** Same visual language for navigational actions. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
