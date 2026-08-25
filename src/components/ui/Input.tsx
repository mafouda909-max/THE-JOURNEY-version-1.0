import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Input — §11 semantics: 8px radius, clear RTL label, shadow-xs at rest,
 * semantic validation state, visible focus.
 */
interface InputProps extends Omit<ComponentProps<"input">, "className" | "id"> {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
  className?: string;
}

export function Input({
  label,
  id,
  error,
  hint,
  trailing,
  className,
  ...rest
}: InputProps) {
  return (
    <div className={cn("w-full", className)}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-label-lg text-on-surface-variant"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className={cn(
            "h-11 w-full rounded-md border bg-surface px-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60",
            "shadow-xs transition-shadow duration-100",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            error ? "border-error" : "border-outline-variant",
            trailing && "pe-10",
          )}
          {...rest}
        />
        {trailing && (
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-on-surface-variant">
            {trailing}
          </span>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-label-md text-on-surface-variant">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-label-md text-error">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends Omit<ComponentProps<"select">, "className" | "id"> {
  label: string;
  id: string;
  className?: string;
}

export function Select({ label, id, className, children, ...rest }: SelectProps) {
  return (
    <div className={cn("w-full", className)}>
      <label htmlFor={id} className="mb-1.5 block text-label-lg text-on-surface-variant">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          "h-11 w-full rounded-md border border-outline-variant bg-surface px-3 text-body-md text-on-surface shadow-xs",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
