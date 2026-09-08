"use client";
import { useState } from "react";
export function RequestTracking({ id }: { id: string }) {
  const [request, setRequest] = useState<{
    status: string;
    response: string | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const token = new URLSearchParams(window.location.hash.slice(1)).get(
        "token",
      );
      const res = await fetch(`/api/contact-requests/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequest(data.request);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر فتح الطلب");
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    new: "جديد",
    viewed: "شاهده الوكيل",
    responded: "رد الوكيل",
    closed: "مغلق",
    cancelled: "ملغي",
  };
  return (
    <section dir="rtl" className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">متابعة طلب التواصل</h1>
      <p>احفظ رابط هذه الصفحة؛ يتيح الاطلاع على رد الوكيل.</p>
      <button
        disabled={busy}
        onClick={() => void refresh()}
        className="rounded-lg bg-deep p-3 text-white"
      >
        عرض آخر حالة
      </button>
      {request && (
        <>
          <p>الحالة: {labels[request.status] ?? request.status}</p>
          {request.response && (
            <p className="whitespace-pre-wrap rounded-lg bg-wash p-4">
              {request.response}
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
