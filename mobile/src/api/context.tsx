import { createContext, useContext, useMemo, type ReactNode } from "react";

import { createApiClient, type ApiClient, type HttpResponseLite } from "../api/client";
import { resolveRuntimeConfig, type RuntimeConfig } from "../lib/runtime";

export interface ApiContextValue {
  client: ApiClient | null;
  config: RuntimeConfig;
}

const ApiContext = createContext<ApiContextValue | null>(null);

/**
 * `AbortSignal` is supported by RN's networking layer; older polyfills ignore
 * the extra field rather than failing, which keeps the client's timeout the
 * effective guard.
 */
const rnFetch = (url: string, init: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) =>
  globalThis.fetch(url, init as never) as unknown as Promise<HttpResponseLite>;

export function ApiProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ApiContextValue>(() => {
    const config = resolveRuntimeConfig();
    const client = config.baseUrl
      ? createApiClient({
          baseUrl: config.baseUrl,
          fetchImpl: rnFetch,
          timeoutMs: config.timeoutMs,
        })
      : null;
    return { client, config };
  }, []);

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApiContext(): ApiContextValue {
  const value = useContext(ApiContext);
  if (!value) {
    throw new Error("useApiContext() يجب أن يُستخدم داخل <ApiProvider>.");
  }
  return value;
}

/** `null` when the API origin is unconfigured — every screen must handle that. */
export function useApi(): ApiClient | null {
  return useApiContext().client;
}
