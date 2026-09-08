"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ContactActions({
  id,
  status,
  agent,
}: {
  id: number;
  status: string;
  agent: boolean;
}) {
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function act(next: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/contact-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, response }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الإتمام");
    } finally {
      setBusy(false);
    }
  }
  if (["closed", "cancelled"].includes(status)) return null;
  return (
    <div className="mt-3 space-y-2">
      {agent && status !== "responded" && (
        <>
          <textarea
            aria-label="رد الوكيل"
            placeholder="اكتب ردك للمسافر"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            maxLength={3000}
            className="w-full rounded-lg border p-3"
          />
          <button
            disabled={busy || response.trim().length < 10}
            onClick={() => void act("responded")}
            className="rounded-lg bg-deep px-4 py-2 text-white"
          >
            إرسال الرد
          </button>
        </>
      )}
      {agent && status === "responded" && (
        <button disabled={busy} onClick={() => void act("closed")}>
          إغلاق الطلب
        </button>
      )}
      {!agent && ["new", "viewed"].includes(status) && (
        <button disabled={busy} onClick={() => void act("cancelled")}>
          إلغاء الطلب
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
