"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import {
  FALLBACK_CITIES,
  filterFallbackPlaces,
  type PlaceOption,
} from "@/lib/search/places-fallback";

export interface PlaceSelection {
  slug?: string;
  name_ar: string;
}

/**
 * Accessible combobox over cities/airports (AD-11 autocomplete).
 * Phase A: local curated fallback. Phase C: inject `fetcher` → search_places RPC.
 */
export function CityAutocomplete({
  id,
  label,
  placeholder,
  value,
  onChange,
  fetcher,
  allowAnywhere = false,
  className,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: PlaceSelection | null;
  onChange: (v: PlaceSelection | null) => void;
  /** Async source (search_places RPC). Falls back to curated list when absent. */
  fetcher?: (q: string) => Promise<PlaceOption[]>;
  allowAnywhere?: boolean;
  className?: string;
}) {
  const listId = `${id}-listbox`;
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // resolve options (non-empty queries only; empty query = derived-closed)
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    (async () => {
      try {
        const res = fetcher ? await fetcher(q) : filterFallbackPlaces(q);
        if (!cancelled) {
          setOptions(res);
          setActive(res.length ? 0 : -1);
          setOpen(true);
        }
      } catch {
        if (!cancelled) setOpen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, fetcher]);

  const effectiveOpen = open && query.trim().length > 0;

  function commit(p: PlaceOption | null) {
    onChange(p ? { slug: p.slug, name_ar: p.name_ar } : null);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) commit(options[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const display = useMemo(() => value?.name_ar ?? "", [value]);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <label htmlFor={id} className="mb-1.5 block text-label-lg text-on-surface-variant">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={effectiveOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={value ? display : placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(options.length > 0)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-12 w-full rounded-md border border-outline-variant bg-surface ps-3 text-body-md text-on-surface shadow-xs",
            "placeholder:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            (value || allowAnywhere) && "pe-9",
          )}
        />
        {value && (
          <button
            type="button"
            aria-label="مسح"
            onClick={() => commit(null)}
            className="absolute inset-y-0 end-2 my-auto flex size-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        )}
      </div>

      {effectiveOpen && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-md bg-surface py-1 shadow-lg"
        >
          {allowAnywhere && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => commit(null)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-body-md hover:bg-surface-container-low"
              >
                <Icon name="public" className="text-[20px]" />
                أي مكان
              </button>
            </li>
          )}
          {options.map((p, i) => (
            <li key={`${p.kind}-${p.iata ?? p.slug ?? p.name_en}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(p)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start",
                  i === active ? "bg-surface-container-low" : "",
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    name={p.kind === "airport" ? "flight" : "location_city"}
                    className="text-[20px] text-on-surface-variant"
                  />
                  <span className="text-body-md text-on-surface">{p.name_ar}</span>
                  <span className="text-label-md text-on-surface-variant">
                    {p.country_ar}
                  </span>
                </span>
                {p.iata && (
                  <span dir="ltr" className="text-label-lg font-semibold tracking-wider text-on-surface-variant">
                    {p.iata}
                  </span>
                )}
              </button>
            </li>
          ))}
          {options.length === 0 && (
            <li className="px-3 py-3 text-body-sm text-on-surface-variant" role="status">
              لا توجد نتائج مطابقة
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export const FALLBACK_PLACES = FALLBACK_CITIES;
