"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Workspace = { id: number; name: string; membership: { role: string } };
type ApiError = { error?: string };
type Intent = {
  originCity: string | null;
  destinations: string[];
  departureDate: string | null;
  returnDate: string | null;
  travelers: { adults: number; children: number; infants: number };
};
type Opportunity = {
  id: number;
  stage: string;
  title: string | null;
  clientName: string;
  intentRevision: number;
  intent: Intent;
  quoteId: number | null;
  quoteVersionId: number | null;
  quoteVersion: number | null;
  currency: string | null;
  sellTotalMinor: number | null;
  grossProfitMinor: number | null;
  marginBps: number | null;
};
type MarketplaceInquiry = {
  id: number;
  travelerName: string;
  travelerCount: number;
  travelDates: string | null;
  message: string;
  status: string;
  createdAt: string;
  offerId: number;
  offerTitle: string;
  originCity: string;
  destinationCity: string;
  tripType: string;
  departureDate: string | null;
  durationDays: number | null;
  opportunityId: number | null;
};
type CommercialData = { opportunities: Opportunity[]; inquiries: MarketplaceInquiry[] };

const stageLabel: Record<string, string> = {
  new: "جديد",
  qualified: "مؤهل",
  sourcing: "تسعير",
  quoted: "عرض مُرسل",
  negotiating: "متابعة / تفاوض",
  won: "تم البيع",
  lost: "خسارة",
  cancelled: "ملغي",
};

async function fetchCommercialData(workspaceId: number): Promise<CommercialData> {
  const [pipelineResponse, inquiriesResponse] = await Promise.all([
    fetch(`/api/agency/workspaces/${workspaceId}/commercial`, { cache: "no-store" }),
    fetch(`/api/agency/workspaces/${workspaceId}/inquiries`, { cache: "no-store" }),
  ]);
  const pipeline = await pipelineResponse.json() as { opportunities?: Opportunity[] } & ApiError;
  const inbox = await inquiriesResponse.json() as { inquiries?: MarketplaceInquiry[] } & ApiError;
  if (!pipelineResponse.ok) throw new Error(pipeline.error ?? "تعذر تحميل خط المبيعات.");
  if (!inquiriesResponse.ok) throw new Error(inbox.error ?? "تعذر تحميل طلبات Marketplace.");
  return { opportunities: pipeline.opportunities ?? [], inquiries: inbox.inquiries ?? [] };
}

function formatMoney(minor: number | null, currency: string | null) {
  if (minor == null || !currency) return "—";
  try {
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function CommercialPipelinePanel({ workspace }: { workspace: Workspace }) {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [inquiries, setInquiries] = useState<MarketplaceInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [followUps, setFollowUps] = useState<Record<number, string>>({});
  const [lostReasons, setLostReasons] = useState<Record<number, string>>({});
  const [lead, setLead] = useState({ name: "", email: "", origin: "", destination: "", departure: "", returnDate: "", adults: "2" });

  useEffect(() => {
    let cancelled = false;
    fetchCommercialData(workspace.id)
      .then((data) => {
        if (cancelled) return;
        setItems(data.opportunities);
        setInquiries(data.inquiries);
        setError("");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل مساحة العمل التجارية.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspace.id]);

  async function refresh() {
    const data = await fetchCommercialData(workspace.id);
    setItems(data.opportunities);
    setInquiries(data.inquiries);
    setError("");
  }

  async function run(payload: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/agency/workspaces/${workspace.id}/commercial`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as ApiError;
      if (!response.ok) throw new Error(data.error ?? "تعذر تنفيذ العملية.");
      await refresh();
      setSuccess(message);
    } finally {
      setBusy(false);
    }
  }

  async function adoptInquiry(inquiryId: number) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/agency/workspaces/${workspace.id}/inquiries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inquiryId }),
      });
      const data = await response.json() as ApiError & { opportunity?: { id?: number } };
      if (!response.ok) throw new Error(data.error ?? "تعذر تحويل الطلب إلى Opportunity.");
      await refresh();
      setSuccess("تم اعتماد الطلب كفرصة. افتح مساحة الفرصة لإكمال Intent والسourcing والتسعير.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحويل الطلب.");
    } finally {
      setBusy(false);
    }
  }

  async function createOpportunity() {
    try {
      const adults = Number(lead.adults);
      if (!lead.name.trim() || !lead.email.trim() || !lead.destination.trim() || !Number.isInteger(adults) || adults < 1) {
        throw new Error("اسم العميل والبريد والوجهة وعدد المسافرين مطلوبة.");
      }
      await run({
        command: "create_opportunity",
        source: "manual",
        title: `${lead.destination} — ${lead.name}`,
        client: { displayName: lead.name, email: lead.email },
        intent: {
          originCity: lead.origin || null,
          destinations: [lead.destination],
          departureDate: lead.departure || null,
          returnDate: lead.returnDate || null,
          flexibilityDays: 0,
          travelers: { adults, children: 0, infants: 0 },
          budgetAmountMinor: null,
          budgetCurrency: null,
          budgetBasis: null,
          tripType: "custom",
          priorities: [],
          constraints: [],
          notes: null,
        },
      }, "تم إنشاء Opportunity وربط Intent v1. افتح مساحة الفرصة لإكمال العمل.");
      setLead({ name: "", email: "", origin: "", destination: "", departure: "", returnDate: "", adults: "2" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الفرصة.");
    }
  }

  async function sendQuote(item: Opportunity) {
    if (!item.quoteId || !item.quoteVersionId) return;
    try {
      await run({ command: "send_quote", quoteId: item.quoteId, quoteVersionId: item.quoteVersionId, channel: "link" }, "تم تسجيل إرسال العرض الحالي.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل الإرسال.");
    }
  }

  async function followUp(item: Opportunity) {
    try {
      await run({
        command: "record_follow_up",
        opportunityId: item.id,
        quoteId: item.quoteId,
        quoteVersionId: item.quoteVersionId,
        channel: "manual",
        note: followUps[item.id] || null,
      }, "تم تسجيل المتابعة.");
      setFollowUps((current) => ({ ...current, [item.id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل المتابعة.");
    }
  }

  async function outcome(item: Opportunity, value: "won" | "lost") {
    try {
      if (value === "lost" && !lostReasons[item.id]?.trim()) throw new Error("سبب الخسارة مطلوب حتى تصبح النتيجة قابلة للتعلم.");
      await run({
        command: "record_outcome",
        opportunityId: item.id,
        outcome: value,
        quoteVersionId: value === "won" ? item.quoteVersionId : null,
        reason: value === "lost" ? lostReasons[item.id] : null,
      }, value === "won" ? "تم تسجيل البيع وربط النسخة المقبولة." : "تم تسجيل الخسارة وسببها.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تسجيل النتيجة.");
    }
  }

  const pendingInquiries = inquiries.filter((inquiry) => !inquiry.opportunityId);

  return (
    <div className="mt-5 space-y-5" dir="rtl">
      {error && <div role="alert" className="rounded-xl border border-error/20 bg-errorbg p-3 text-sm text-error">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-verified/20 bg-verifiedbg p-3 text-sm font-semibold text-verified">{success}</div>}

      <div className="rounded-xl border border-outlinev bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-bold text-inkwell">Marketplace Inbox</h3><p className="mt-1 text-xs text-slate">الـlead يبقى Inbox حتى تقرر الوكالة اعتماده؛ بعدها يصبح Opportunity canonical واحدة.</p></div>
          <span className="rounded-md bg-low px-2 py-1 text-xs font-bold text-deep">{pendingInquiries.length} غير معتمد</span>
        </div>
        <div className="mt-3 space-y-2">
          {pendingInquiries.length === 0 && <div className="rounded-lg border border-dashed border-outlinev p-3 text-xs text-slate">لا توجد طلبات Marketplace جديدة.</div>}
          {pendingInquiries.map((inquiry) => (
            <div key={inquiry.id} className="rounded-xl border border-outlinev p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><strong className="text-sm text-inkwell">{inquiry.travelerName}</strong><div className="mt-1 text-xs text-slate">{inquiry.offerTitle} · {inquiry.originCity} ← {inquiry.destinationCity} · {inquiry.travelerCount} مسافر</div>{inquiry.travelDates && <div className="mt-1 text-xs text-slate">{inquiry.travelDates}</div>}<p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate">{inquiry.message}</p></div>
                <button type="button" disabled={busy} onClick={() => void adoptInquiry(inquiry.id)} className="min-h-11 rounded-lg bg-deep px-3 py-2 text-xs font-bold text-white disabled:opacity-50">اعتماد كفرصة</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <details className="rounded-xl border border-outlinev bg-white p-4">
        <summary className="cursor-pointer font-bold text-inkwell">+ فرصة يدوية</summary>
        <p className="mt-2 text-xs text-slate">للإحالات، العملاء المتكررين، أو الطلبات التي وصلت خارج Marketplace.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="اسم العميل" value={lead.name} onChange={(value) => setLead({ ...lead, name: value })} />
          <Field label="البريد" type="email" value={lead.email} onChange={(value) => setLead({ ...lead, email: value })} />
          <Field label="مدينة المغادرة" value={lead.origin} onChange={(value) => setLead({ ...lead, origin: value })} />
          <Field label="الوجهة" value={lead.destination} onChange={(value) => setLead({ ...lead, destination: value })} />
          <Field label="تاريخ السفر" type="date" value={lead.departure} onChange={(value) => setLead({ ...lead, departure: value })} />
          <Field label="تاريخ العودة" type="date" value={lead.returnDate} onChange={(value) => setLead({ ...lead, returnDate: value })} />
          <Field label="عدد البالغين" type="number" value={lead.adults} onChange={(value) => setLead({ ...lead, adults: value })} />
        </div>
        <button type="button" disabled={busy} onClick={() => void createOpportunity()} className="mt-3 min-h-11 rounded-lg bg-deep px-4 py-2 text-sm font-bold text-white disabled:opacity-50">إنشاء Opportunity</button>
      </details>

      <div className="space-y-3">
        <div className="flex items-center justify-between"><div><h3 className="font-bold text-inkwell">Commercial Pipeline</h3><p className="mt-1 text-xs text-slate">للفرز والمتابعة السريعة. افتح الفرصة للتسعير والمصادر والنسخ والذكاء.</p></div>{loading && <span className="text-xs text-slate">تحديث…</span>}</div>
        {!loading && items.length === 0 && <div className="rounded-xl border border-dashed border-outlinev p-5 text-sm text-slate">لا توجد فرص بعد.</div>}
        {items.map((item) => {
          const terminal = ["won", "lost", "cancelled"].includes(item.stage);
          return (
            <article key={item.id} className="rounded-xl border border-outlinev bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><strong className="text-inkwell">{item.title || item.clientName}</strong><span className="rounded-md bg-low px-2 py-1 text-xs font-bold text-deep">{stageLabel[item.stage] ?? item.stage}</span></div>
                  <div className="mt-1 text-xs text-slate">{item.clientName} · {item.intent?.originCity ?? "—"} ← {item.intent?.destinations?.join("، ") ?? "—"} · Intent v{item.intentRevision}</div>
                </div>
                {item.quoteVersionId && <div className="text-left text-xs text-slate"><b className="text-inkwell">Quote v{item.quoteVersion}</b><br />بيع {formatMoney(item.sellTotalMinor, item.currency)} · ربح {formatMoney(item.grossProfitMinor, item.currency)}<br />Margin {item.marginBps == null ? "—" : `${(item.marginBps / 100).toFixed(1)}%`}</div>}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/account/agency/opportunities/${item.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-deep px-4 py-2 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-deep/20">فتح مساحة الفرصة</Link>
                {!terminal && item.quoteVersionId && <button type="button" disabled={busy} onClick={() => void sendQuote(item)} className="min-h-11 rounded-lg border border-deep px-3 py-2 text-xs font-bold text-deep disabled:opacity-50">تسجيل الإرسال</button>}
              </div>

              {!terminal && item.quoteVersionId && <div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-low p-3"><Field label="ملاحظة متابعة" value={followUps[item.id] ?? ""} onChange={(value) => setFollowUps((current) => ({ ...current, [item.id]: value }))} /><button type="button" disabled={busy} onClick={() => void followUp(item)} className="mt-2 min-h-11 rounded-lg border border-outlinev bg-white px-3 py-2 text-xs font-bold text-deep">تسجيل متابعة</button></div><div className="rounded-xl bg-low p-3"><Field label="سبب الخسارة عند الحاجة" value={lostReasons[item.id] ?? ""} onChange={(value) => setLostReasons((current) => ({ ...current, [item.id]: value }))} /><div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={() => void outcome(item, "won")} className="min-h-11 rounded-lg bg-verified px-3 py-2 text-xs font-bold text-white">تم البيع</button><button type="button" disabled={busy} onClick={() => void outcome(item, "lost")} className="min-h-11 rounded-lg border border-error/30 bg-white px-3 py-2 text-xs font-bold text-error">خسارة</button></div></div></div>}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-xs font-bold text-slate">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-outlinev bg-white px-3 py-2 text-sm font-normal text-inkwell outline-none focus:border-deep focus-visible:ring-4 focus-visible:ring-deep/15" /></label>;
}
