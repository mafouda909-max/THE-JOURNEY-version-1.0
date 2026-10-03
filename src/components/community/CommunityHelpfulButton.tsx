"use client";

import { useState } from "react";

export function CommunityHelpfulButton({
  postId,
  initialCount,
}: {
  postId: number;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function markHelpful() {
    if (done || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/helpful`, {
        method: "POST",
      });
      if (res.ok) {
        const json = (await res.json()) as { added?: boolean };
        if (json.added) setCount((value) => value + 1);
        setDone(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void markHelpful()}
      disabled={busy || done}
      className="sila-interactive rounded-full border border-outlinev bg-cloud px-3 py-1.5 text-[11px] font-bold text-slate hover:border-sky hover:text-signal disabled:opacity-70"
    >
      {done ? "مفيد ✓" : "مفيد"} · <span className="tnum">{count}</span>
    </button>
  );
}
