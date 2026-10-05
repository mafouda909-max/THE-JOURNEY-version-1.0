"use client";

import { useMemo, useSyncExternalStore } from "react";
import { consumeRecoveryLink, readRecoveryLink } from "@/lib/recovery-link";

export function useRecoveryToken() {
  const store = useMemo(() => {
    let token: string | null = null;
    return {
      getSnapshot() {
        token ??= readRecoveryLink(window.location.href);
        return token;
      },
      subscribe() {
        // Subscription runs after rendering. Mutating Next's history inside a
        // snapshot/render would trigger a router update during another render.
        token ??= readRecoveryLink(window.location.href);
        consumeRecoveryLink(window.location, window.history);
        return () => {};
      },
    };
  }, []);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
}
