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

  if (loading) {
    return (
      <div className="border-y border-outlinev py-8 text-sm text-slate">
        جارٍ تحميل مسار تشغيل الوكالة…
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div>
        {error ? (
          <div className="border-y border-error/20 bg-errorbg px-4 py-3 text-sm text-error">{error}</div>
        ) : null}

        <section className="decision-board mt-5">
          <div className="p-6 md:p-8">
            <div className="decision-state decision-state--unknown">لا توجد مساحة وكالة</div>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.025em] text-deep">
              التشغيل التجاري لم يبدأ على هذا الحساب بعد.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate">
              إنشاء المساحة يربط الفرص والـSupplier Options والـQuotes بعضوية الخادم الفعلية.
              لا نعتمد على Workspace ID يرسله المتصفح لتحديد الصلاحية.
            </p>
            {canCreate ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void createWorkspace()}
                className="focus-action mt-6 disabled:opacity-50"
              >
                {busy ? "جارٍ الإنشاء…" : "إنشاء مساحة الوكالة"}
              </button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  const workspace = workspaces[0]!;
  return (
    <div>
      {error ? (
        <div className="mb-5 border-y border-error/20 bg-errorbg px-4 py-3 text-sm text-error">{error}</div>
      ) : null}

      <section className="decision-board">
        <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
          <div className="p-5 md:p-7">
            <div className="text-[11px] font-bold text-signal">مساحة التشغيل الحالية</div>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-deep">
              {workspace.name}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate">
              الطلبات والفرص والـQuotes في الأسفل تخص هذه المساحة فقط، ويُحسم الوصول من العضوية الفعلية على الخادم.
            </p>
          </div>

          <div className="border-t border-outlinev bg-low/40 p-5 lg:border-s lg:border-t-0">
            <div className="text-[10px] font-bold text-slate">الدور</div>
            <div className="mt-2 text-sm font-bold text-deep">
              {workspace.membership.role === "owner" ? "مالك المساحة" : "عضو"}
            </div>
            <div className="mt-3 font-mono text-[10px] text-slate">Workspace #{workspace.id}</div>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <CommercialPipelinePanel workspace={workspace} />
      </div>

      <div className="mt-8">
        <CommercialMetrics workspaceId={workspace.id} />
      </div>
    </div>
  );
}
