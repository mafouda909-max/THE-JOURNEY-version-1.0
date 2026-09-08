import { useCallback, useEffect, useRef, useState } from "react";

import { isApiError, type ApiError } from "../api/client";
import type { CacheEntry, TtlCache } from "../lib/cache";

export type ResourceState = "idle" | "loading" | "refreshing" | "ready" | "error";

export interface Resource<T> {
  data: T | null;
  error: ApiError | null;
  state: ResourceState;
  /** True while the visible payload came from disk, not the network. */
  fromCache: boolean;
  /** True when a failed refresh left stale data on screen. */
  isStale: boolean;
  updatedAt: number | null;
  refresh: (options?: { force?: boolean }) => Promise<void>;
}

export interface UseApiResourceOptions<T> {
  cache?: TtlCache<T>;
  enabled?: boolean;
  /** Change these to reload (e.g. the active trip-type filter). */
  deps?: readonly unknown[];
}

/**
 * Cache-first loading with stale-while-revalidate and in-flight cancellation.
 * A failed refresh that has cached data keeps the data visible and marks it
 * stale — a traveler on airport Wi-Fi still sees the offer they came for.
 */
export function useApiResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  options: UseApiResourceOptions<T> = {},
): Resource<T> {
  const { cache, enabled = true, deps } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [state, setState] = useState<ResourceState>(enabled ? "loading" : "idle");
  const [meta, setMeta] = useState<{ fromCache: boolean; updatedAt: number | null }>({
    fromCache: false,
    updatedAt: null,
  });

  const loadRef = useRef(load);
  loadRef.current = load;
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(
    async (mode: "initial" | "manual") => {
      if (!enabled) return;
      const store = cacheRef.current;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      let cached: CacheEntry<T> | null = null;
      if (store) {
        cached = await store.read().catch(() => null);
        if (!mountedRef.current || controller.signal.aborted) return;
        if (cached) {
          setData(cached.value);
          setMeta({ fromCache: true, updatedAt: cached.fetchedAt });
        }
      }

      // A fresh cache entry short-circuits the network on first paint only;
      // an explicit pull-to-refresh always hits the server.
      if (cached?.state === "fresh" && mode === "initial") {
        setState("ready");
        setError(null);
        return;
      }

      setState(cached ? "refreshing" : "loading");
      try {
        const next = await loadRef.current(controller.signal);
        if (!mountedRef.current || controller.signal.aborted) return;
        const fetchedAt = store ? await store.write(next) : Date.now();
        if (!mountedRef.current || controller.signal.aborted) return;
        setData(next);
        setMeta({ fromCache: false, updatedAt: fetchedAt });
        setError(null);
        setState("ready");
      } catch (cause: unknown) {
        if (!mountedRef.current || controller.signal.aborted) return;
        const apiError: ApiError = isApiError(cause)
          ? cause
          : {
              kind: "unknown",
              message: cause instanceof Error ? cause.message : "خطأ غير متوقع.",
              retryable: false,
            };
        setError(apiError);
        // Cached data stays on screen (stale) instead of flashing an error page.
        setState(cached ? "ready" : "error");
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [enabled],
  );

  const hasStaleData = data !== null && error !== null;

  useEffect(() => {
    void run("initial");
  }, [run, enabled, ...(deps ?? [])]);

  const refresh = useCallback(
    async (refreshOptions?: { force?: boolean }) => {
      await run(refreshOptions?.force === false ? "initial" : "manual");
    },
    [run],
  );

  return {
    data,
    error,
    state,
    fromCache: meta.fromCache,
    isStale: hasStaleData,
    updatedAt: meta.updatedAt,
    refresh,
  };
}
