"use client";
import { useState } from "react";
type CaseData = {
  documents: {
    id: number;
    documentType: string;
    status: string;
    signedAccessUrl: string;
  }[];
  assurance: {
    email_verified_at: string | null;
    phone_verified_at: string | null;
  } | null;
  audit: {
    actor: string;
    action: string;
    reason: string | null;
    created_at: string;
  }[];
};
export function TrustCase({ agentId }: { agentId: number }) {
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const res = await fetch(`/api/admin/kyc?agentId=${agentId}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    setData(body);
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الإتمام");
    } finally {
      setBusy(false);
    }
  }
  async function review(id: number, decision: string) {
    const res = await fetch("/api/admin/kyc", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, reason }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    await load();
  }
  return (
    <div className="mt-4 space-y-3 border-t pt-3">
      <button
        disabled={busy}
        onClick={() => void run(load)}
        className="text-deep underline"
      >
        فتح مستندات وسجل التوثيق
      </button>
      {data && (
        <>
          <p>
            البريد: {data.assurance?.email_verified_at ? "متحقق" : "غير متحقق"}{" "}
            · الهاتف:{" "}
            {data.assurance?.phone_verified_at ? "متحقق" : "غير متحقق"}
          </p>
          <textarea
            aria-label="ملاحظة مراجعة المستند"
            placeholder="سبب قرار المستند — ١٠ أحرف على الأقل"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border p-2"
          />
          {data.documents.length === 0 && <p>لا توجد مستندات مقدمة.</p>}
          {data.documents.map((d) => (
            <div key={d.id} className="flex flex-wrap gap-3 rounded border p-3">
              <a href={d.signedAccessUrl} target="_blank" rel="noreferrer">
                فتح {d.documentType}
              </a>
              <span>{d.status}</span>
              {d.status === "pending" && (
                <>
                  <button
                    disabled={busy || reason.trim().length < 10}
                    onClick={() => void run(() => review(d.id, "verified"))}
                  >
                    اعتماد المستند
                  </button>
                  <button
                    disabled={busy || reason.trim().length < 10}
                    onClick={() => void run(() => review(d.id, "rejected"))}
                  >
                    رفض المستند
                  </button>
                </>
              )}
            </div>
          ))}
          {data.audit.map((a, i) => (
            <p key={i} className="text-xs">
              {a.created_at} · {a.actor} · {a.action} · {a.reason}
            </p>
          ))}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
