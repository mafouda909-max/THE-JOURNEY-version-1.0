"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

import { CheckCheck } from "lucide-react";
import { accountAction } from "@/lib/account-action";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark() {
    setBusy(true);
    setError(null);
    try {
      await accountAction(
        "/api/notifications",
        { method: "PATCH" },
        "تعذر تحديث الإشعارات. حاول مرة أخرى.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الإشعارات.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => void mark()}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold text-deep underline-offset-4 hover:bg-low hover:underline disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <CheckCheck className="h-3.5 w-3.5" />
        )}
        تعليم الكل كمقروء
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs leading-6 text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await accountAction(
        "/api/auth/logout",
        { method: "POST" },
        "تعذر تسجيل الخروج. حاول مرة أخرى.",
      );
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الخروج.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => void logout()}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outlinev px-4 py-2 text-[13px] font-bold text-slate transition-colors hover:border-error/50 hover:text-error disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogOut className="h-3.5 w-3.5" />
        )}
        خروج
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-48 text-xs leading-6 text-error">
          {error}
        </p>
      )}
    </div>
  );
}
