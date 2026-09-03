"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

import { CheckCheck } from "lucide-react";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function mark() {
    setBusy(true);
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => undefined);
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      onClick={() => void mark()}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-[12px] font-bold text-deep underline-offset-4 hover:underline disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
      تعليم الكل كمقروء
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={() => void logout()}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-outlinev px-4 py-2 text-[13px] font-bold text-slate transition-colors hover:border-error/50 hover:text-error disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      خروج
    </button>
  );
}
