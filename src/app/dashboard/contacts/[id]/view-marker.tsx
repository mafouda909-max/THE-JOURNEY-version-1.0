"use client";

import { useEffect, useRef } from "react";
import { markContactViewedAction } from "@/lib/contact/actions";

/**
 * Marks the request VIEWED once on open — idempotent server RPC
 * (new→viewed sets viewed_at once; revisits are silent no-ops).
 */
export function ViewMarker({ requestId }: { requestId: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void markContactViewedAction(requestId);
  }, [requestId]);
  return null;
}
