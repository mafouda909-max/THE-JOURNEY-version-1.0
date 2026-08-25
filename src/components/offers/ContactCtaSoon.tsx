"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Ratified interim (Slice1-b): CTA renders per UX with a non-blocking notice.
 * Slice 3 replaces this component with the real contact modal — single swap point.
 */
export function ContactCtaSoon() {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          setShow(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setShow(false), 2500);
        }}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-secondary-container text-body-md font-medium text-on-secondary-container transition-colors duration-100 hover:bg-secondary-container/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="forum" />
        تواصل مع الوكيل
      </button>
      <p
        role="status"
        hidden={!show}
        className="mt-2 rounded-sm bg-surface-container px-3 py-2 text-label-md text-on-surface-variant"
      >
        التواصل يفتح قريبًا
      </p>
    </div>
  );
}
