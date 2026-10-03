"use client";

import { useEffect, useState } from "react";
import { CommercialMetrics } from "./CommercialMetrics";
import { CommercialPipelinePanel } from "./CommercialPipelinePanel";

type WorkspaceSummary = {
  id: number;
  name: string;
  status: string;
  membership: { id: number; role: string; status: string };
};

type ApiError = { error?: string };
type CreateWorkspaceResponse = ApiError & {
  workspace?: { id: number; name: string; status: string };
  membership?: { id: number; role: string; status: string };
};

export function AgencyWorkspacePanel({ canCreate }: { canCreate: boolean }) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    void fetch("/api/agency/workspaces", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { workspaces?: WorkspaceSummary[] } & ApiError;
        if (!response.ok) throw new Error(data.error ?? "تعذر تحميل مساحة الوكالة.");
        return data.workspaces ?? [];
      })
      .then((items) => {
        if (active) setWorkspaces(items);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "تعذر تحميل مساحة الوكالة.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  async function createWorkspace() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/agency/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = await response.json() as CreateWorkspaceResponse;
      if (!response.ok) throw new Error(data.error ?? "تعذر إنشاء مساحة الوكالة.");
      if (!data.workspace || !data.membership) throw new Error("استجابة إنشاء مساحة الوكالة غير مكتملة.");
      setWorkspaces([{ ...data.workspace, membership: data.membership }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء مساحة الوكالة.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-slate">جارٍ تحميل مساحة الوكالة…</p>;

  if (workspaces.length === 0) {
    return (
      <div className="space-y-4">
        {error && <div className="rounded-xl border border-error/20 bg-errorbg p-4 text-sm text-error">{error}</div>}
        <div className="rounded-2xl border border-dashed border-outlinev bg-cloud p-6">
          <p className="font-bold text-inkwell">لا توجد مساحة وكالة مرتبطة بحسابك.</p>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            إنشاء المساحة متاح فقط لحساب وكيل مؤسسي موثّق، ويُحدد المالك من جلسة الدخول الحالية على الخادم.
          </p>
          {canCreate && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void createWorkspace()}
              className="mt-4 min-h-11 rounded-lg bg-deep px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "جارٍ الإنشاء…" : "إنشاء مساحة الوكالة"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const workspace = workspaces[0]!;
  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-error/20 bg-errorbg p-4 text-sm text-error">{error}</div>}
      <div className="rounded-2xl border border-outlinev bg-cloud p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-inkwell">{workspace.name}</div>
            <div className="mt-1 font-mono text-xs text-slate">Workspace #{workspace.id}</div>
          </div>
          <span className="rounded-md bg-verifiedbg px-2.5 py-1 text-xs font-bold text-verified">
            {workspace.membership.role === "owner" ? "مالك المساحة" : "عضو"}
          </span>
        </div>
        <div className="mt-5 space-y-5">
          <CommercialMetrics workspaceId={workspace.id} />
          <CommercialPipelinePanel workspace={workspace} />
        </div>
      </div>
    </div>
  );
}
