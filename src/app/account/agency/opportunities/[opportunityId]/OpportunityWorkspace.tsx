"use client";

import { useEffect, useMemo, useState } from "react";

type ApiError = { error?: string };
type TravelerIntent = {
  originCity: string | null;
  destinations: string[];
  departureDate: string | null;
  returnDate: string | null;
  flexibilityDays: number;
  travelers: { adults: number; children: number; infants: number };
  budgetAmountMinor: number | null;
  budgetCurrency: string | null;
  budgetBasis: string | null;
  tripType: string | null;
  priorities: string[];
  constraints: string[];
  notes: string | null;
};
type IntentVersion = { id: number; revision: number; intent: TravelerIntent; provenance: Record<string, unknown>; createdAt: string };
type SupplierOption = {
  id: number;
  category: string;
  supplierName: string;
  description: string;
  currency: string;
  costAmountMinor: number;
  commissionExpectedMinor: number;
  sourceType: string;
  sourceRef: string | null;
  observedAt: string;
  validUntil: string | null;
  status: string;
  freshness: "fresh" | "expiring" | "stale" | "unbounded";
  createdAt: string;
};
type QuoteVersion = {
  quoteId: number;
  status: string;
  quoteVersionId: number;
  version: number;
  intentVersionId: number;
  currency: string;
  costTotalMinor: number;
  sellTotalMinor: number;
  commissionExpectedMinor: number;
  grossProfitMinor: number;
  marginBps: number;
  markupBps: number;
  lines: Array<Record<string, unknown>>;
  validUntil: string | null;
  integrityDigest: string;
  createdAt: string;
};
type Signal = { kind: string; severity: "info" | "attention" | "high"; score: number; explanation: string; recommendedAction: string; createdAt?: string };
type Activity = { id: number; activityType: string; channel: string | null; metadata: Record<string, unknown>; occurredAt: string };
type AuditEvent = { id: number; eventType: string; payload: Record<string, unknown>; createdAt: string };
type Detail = {
  opportunity: {
    id: number;
    source: string;
    stage: string;
    title: string | null;
    outcomeReason: string | null;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
  };
  intentVersions: IntentVersion[];
  supplierOptions: SupplierOption[];
  quoteVersions: QuoteVersion[];
  activities: Activity[];
  intelligence: { live: Signal[]; recorded: Signal[] };
  auditTrail: AuditEvent[];
};

const categoryLabel: Record<string, string> = {
  flight: "طيران",
  hotel: "فندق",
  transfer: "انتقالات",
  activity: "نشاط",
  insurance: "تأمين",
  visa: "تأشيرة",
  fee: "رسوم",
  other: "أخرى",
};
const sourceLabel: Record<string, string> = {
  supplier_quote: "عرض مورد",
  booking_engine: "محرك حجز / API",
  contract: "عقد",
  manual: "إدخال يدوي موثق",
  platform: "منصة",
};
const freshnessLabel = { fresh: "حديث", expiring: "ينتهي قريبًا", stale: "منتهي", unbounded: "غير مؤقت" } as const;

function majorToMinor(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("أدخل قيمة مالية صحيحة.");
  const minor = Math.round(parsed * 100);
  if (!Number.isSafeInteger(minor)) throw new Error("القيمة المالية أكبر من الحد المسموح.");
  return minor;
}

function money(minor: number | null, currency: string | null) {
  if (minor == null || !currency) return "—";
  try {
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency }).format(Number(minor) / 100);
  } catch {
    return `${(Number(minor) / 100).toFixed(2)} ${currency}`;
  }
}

function dateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

async function fetchDetail(workspaceId: number, opportunityId: number): Promise<Detail> {
  const response = await fetch(`/api/agency/workspaces/${workspaceId}/opportunities/${opportunityId}`, { cache: "no-store" });
  const data = await response.json() as Detail & ApiError;
  if (!response.ok) throw new Error(data.error ?? "تعذر تحميل مساحة الفرصة.");
  return data;
}

export function OpportunityWorkspace({
  workspaceId,
  opportunityId,
  membershipRole,
}: {
  workspaceId: number;
  opportunityId: number;
  membershipRole: "owner" | "member";
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingIntent, setEditingIntent] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [supplier, setSupplier] = useState({ category: "hotel", supplierName: "", description: "", currency: "USD", cost: "", commission: "0", sourceType: "supplier_quote", sourceRef: "", validUntil: "" });
  const [quote, setQuote] = useState({ quantity: "1", sell: "", validUntil: "" });
  const [intent, setIntent] = useState({ origin: "", destination: "", departure: "", returnDate: "", adults: "1", children: "0", infants: "0", flexibility: "0", tripType: "custom", priorities: "", constraints: "", notes: "" });

  async function refresh() {
    const next = await fetchDetail(workspaceId, opportunityId);
    setDetail(next);
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    fetchDetail(workspaceId, opportunityId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setError("");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "تعذر تحميل الفرصة.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceId, opportunityId]);

  const latestIntent = detail?.intentVersions[0]?.intent ?? null;
  const terminal = detail ? ["won", "lost", "cancelled"].includes(detail.opportunity.stage) : false;
  const liveSignals = detail?.intelligence.live ?? [];
  const selectedOption = detail?.supplierOptions.find((option) => option.id === selectedSupplier) ?? null;
  const selectableSuppliers = useMemo(
    () => detail?.supplierOptions.filter((option) => ["fresh", "expiring", "unbounded"].includes(option.freshness) && ["active", "selected"].includes(option.status)) ?? [],
    [detail],
  );

  async function command(payload: Record<string, unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/agency/workspaces/${workspaceId}/commercial`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as ApiError;
      if (!response.ok) throw new Error(data.error ?? "تعذر تنفيذ العملية.");
      await refresh();
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تنفيذ العملية.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function beginIntentRevision() {
    if (!latestIntent) return;
    setIntent({
      origin: latestIntent.originCity ?? "",
      destination: latestIntent.destinations[0] ?? "",
      departure: latestIntent.departureDate ?? "",
      returnDate: latestIntent.returnDate ?? "",
      adults: String(latestIntent.travelers.adults),
      children: String(latestIntent.travelers.children),
      infants: String(latestIntent.travelers.infants),
      flexibility: String(latestIntent.flexibilityDays ?? 0),
      tripType: latestIntent.tripType ?? "custom",
      priorities: latestIntent.priorities.join("، "),
      constraints: latestIntent.constraints.join("، "),
      notes: latestIntent.notes ?? "",
    });
    setEditingIntent(true);
  }

  async function saveIntentRevision() {
    const adults = Number(intent.adults);
    const children = Number(intent.children);
    const infants = Number(intent.infants);
    const flexibility = Number(intent.flexibility);
    if (!intent.destination.trim() || ![adults, children, infants, flexibility].every(Number.isInteger) || adults < 1 || children < 0 || infants < 0 || flexibility < 0) {
      setError("راجع الوجهة وأعداد المسافرين والمرونة.");
      return;
    }
    try {
      await command({
        command: "add_intent_version",
        opportunityId,
        intent: {
          originCity: intent.origin || null,
          destinations: [intent.destination],
          departureDate: intent.departure || null,
          returnDate: intent.returnDate || null,
          flexibilityDays: flexibility,
          travelers: { adults, children, infants },
          budgetAmountMinor: latestIntent?.budgetAmountMinor ?? null,
          budgetCurrency: latestIntent?.budgetCurrency ?? null,
          budgetBasis: latestIntent?.budgetBasis ?? null,
          tripType: intent.tripType || null,
          priorities: intent.priorities.split(/[،,]/).map((value) => value.trim()).filter(Boolean),
          constraints: intent.constraints.split(/[،,]/).map((value) => value.trim()).filter(Boolean),
          notes: intent.notes || null,
        },
      }, "تم حفظ Intent Version جديدة دون تعديل التاريخ السابق.");
      setEditingIntent(false);
    } catch {
      // Error state is set by command().
    }
  }

  async function addSupplierOption() {
    const volatile = ["flight", "hotel", "transfer", "activity"].includes(supplier.category);
    if (!supplier.supplierName.trim() || !supplier.description.trim() || !supplier.sourceRef.trim()) {
      setError("اسم المورد والوصف ومرجع المصدر مطلوبة.");
      return;
    }
    if (volatile && !supplier.validUntil) {
      setError("الطيران/الفندق/الانتقالات/الأنشطة تحتاج وقت صلاحية حقيقي للمصدر.");
      return;
    }
    const validUntil = supplier.validUntil ? new Date(supplier.validUntil).toISOString() : null;
    try {
      await command({
        command: "record_supplier_option",
        opportunityId,
        category: supplier.category,
        supplierName: supplier.supplierName,
        description: supplier.description,
        currency: supplier.currency.toUpperCase(),
        costAmountMinor: majorToMinor(supplier.cost),
        commissionExpectedMinor: majorToMinor(supplier.commission || "0"),
        sourceType: supplier.sourceType,
        sourceRef: supplier.sourceRef,
        observedAt: new Date().toISOString(),
        validUntil,
      }, "تم تسجيل Supplier Option مع provenance وصلاحية المصدر.");
      setSupplier({ category: "hotel", supplierName: "", description: "", currency: supplier.currency, cost: "", commission: "0", sourceType: "supplier_quote", sourceRef: "", validUntil: "" });
    } catch {
      // Error state is set by command().
    }
  }

  function chooseSupplier(option: SupplierOption) {
    setSelectedSupplier(option.id);
    setQuote({
      quantity: "1",
      sell: "",
      validUntil: toLocalInput(option.validUntil),
    });
  }

  async function createSupplierBackedQuote() {
    if (!selectedOption) return;
    const quantity = Number(quote.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || !quote.validUntil) {
      setError("الكمية وصلاحية العرض مطلوبة.");
      return;
    }
    const validUntil = new Date(quote.validUntil).toISOString();
    if (selectedOption.validUntil && new Date(validUntil).getTime() > new Date(selectedOption.validUntil).getTime()) {
      setError("صلاحية العرض لا يمكن أن تتجاوز صلاحية مصدر السعر.");
      return;
    }
    try {
      await command({
        command: "create_quote_version",
        opportunityId,
        validUntil,
        clientFacingTerms: "هذه النسخة مرتبطة بالمصدر والصلاحية الموضحين في Supplier Option.",
        lines: [{
          kind: selectedOption.category,
          label: selectedOption.description,
          quantity,
          currency: selectedOption.currency,
          costUnitMinor: Number(selectedOption.costAmountMinor),
          sellUnitMinor: majorToMinor(quote.sell),
          commissionExpectedMinor: Number(selectedOption.commissionExpectedMinor),
          supplierOptionId: selectedOption.id,
          provenance: {
            sourceType: selectedOption.sourceType,
            sourceRef: selectedOption.sourceRef,
            observedAt: new Date(selectedOption.observedAt).toISOString(),
            validUntil: selectedOption.validUntil ? new Date(selectedOption.validUntil).toISOString() : null,
          },
        }],
      }, "تم إنشاء Quote Version مرتبطة بالـSupplier Option دون إمكانية تزوير المصدر أو التكلفة.");
      setSelectedSupplier(null);
    } catch {
      // Error state is set by command().
    }
  }

  if (loading) return <div className="rounded-2xl border border-outlinev bg-white p-8 text-sm text-slate">جارٍ تحميل مساحة الفرصة…</div>;
  if (!detail) return <div className="rounded-2xl border border-error/20 bg-errorbg p-6 text-sm text-error">{error || "الفرصة غير متاحة."}</div>;

  return (
    <div className="space-y-6" dir="rtl">
      {error && <div role="alert" className="rounded-xl border border-error/20 bg-errorbg p-4 text-sm text-error">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-verified/20 bg-verifiedbg p-4 text-sm font-semibold text-verified">{success}</div>}

      <header className="rounded-2xl bg-inverse p-5 text-oninverse sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-oninverse/55">{detail.opportunity.source} · {membershipRole}</div>
            <h1 className="mt-2 text-2xl font-bold sm:text-4xl">{detail.opportunity.title || detail.opportunity.clientName}</h1>
            <p className="mt-3 text-sm text-oninverse/70">{detail.opportunity.clientName}{detail.opportunity.clientEmail ? ` · ${detail.opportunity.clientEmail}` : ""}</p>
          </div>
          <span className="rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-bold">{detail.opportunity.stage}</span>
        </div>
        {liveSignals.length > 0 && (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {liveSignals.map((signal) => (
              <div key={`${signal.kind}-${signal.explanation}`} className={`rounded-xl border p-4 ${signal.severity === "high" ? "border-error/35 bg-error/10" : signal.severity === "attention" ? "border-goldbright/35 bg-goldbright/8" : "border-white/10 bg-white/5"}`}>
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-oninverse/60">{signal.kind}</div>
                <p className="mt-1 text-sm font-semibold">{signal.explanation}</p>
                <p className="mt-2 text-xs leading-relaxed text-oninverse/65">{signal.recommendedAction}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      <section className="rounded-2xl border border-outlinev bg-white p-5 sm:p-6" aria-labelledby="intent-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="intent-title" className="text-xl font-bold text-inkwell">Traveler Intent</h2><p className="mt-1 text-xs text-slate">كل تعديل نسخة جديدة؛ لا نكتب فوق ما طلبه العميل سابقًا.</p></div>
          {!terminal && <button type="button" disabled={busy} onClick={beginIntentRevision} className="rounded-lg border border-deep px-3 py-2 text-xs font-bold text-deep">نسخة Intent جديدة</button>}
        </div>
        {detail.intentVersions[0] && (
          <div className="mt-4 grid gap-3 rounded-xl bg-cloud sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={`Intent v${detail.intentVersions[0].revision}`} value={`${detail.intentVersions[0].intent.originCity ?? "—"} ← ${detail.intentVersions[0].intent.destinations.join("، ")}`} />
            <Stat label="التواريخ" value={`${detail.intentVersions[0].intent.departureDate ?? "مرن"} → ${detail.intentVersions[0].intent.returnDate ?? "مرن"}`} />
            <Stat label="المسافرون" value={`${detail.intentVersions[0].intent.travelers.adults} بالغ · ${detail.intentVersions[0].intent.travelers.children} طفل`} />
            <Stat label="عدد النسخ" value={String(detail.intentVersions.length)} />
          </div>
        )}
        {editingIntent && latestIntent && (
          <div className="mt-5 rounded-xl bg-low p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="المغادرة" value={intent.origin} onChange={(value) => setIntent({ ...intent, origin: value })} />
              <Field label="الوجهة" value={intent.destination} onChange={(value) => setIntent({ ...intent, destination: value })} />
              <Field label="تاريخ السفر" type="date" value={intent.departure} onChange={(value) => setIntent({ ...intent, departure: value })} />
              <Field label="تاريخ العودة" type="date" value={intent.returnDate} onChange={(value) => setIntent({ ...intent, returnDate: value })} />
              <Field label="بالغون" type="number" value={intent.adults} onChange={(value) => setIntent({ ...intent, adults: value })} />
              <Field label="أطفال" type="number" value={intent.children} onChange={(value) => setIntent({ ...intent, children: value })} />
              <Field label="رضع" type="number" value={intent.infants} onChange={(value) => setIntent({ ...intent, infants: value })} />
              <Field label="مرونة بالأيام" type="number" value={intent.flexibility} onChange={(value) => setIntent({ ...intent, flexibility: value })} />
              <Field label="نوع الرحلة" value={intent.tripType} onChange={(value) => setIntent({ ...intent, tripType: value })} />
              <Field label="الأولويات — بفواصل" value={intent.priorities} onChange={(value) => setIntent({ ...intent, priorities: value })} />
              <Field label="القيود — بفواصل" value={intent.constraints} onChange={(value) => setIntent({ ...intent, constraints: value })} />
              <Field label="ملاحظات" value={intent.notes} onChange={(value) => setIntent({ ...intent, notes: value })} />
            </div>
            <div className="mt-4 flex gap-2"><button type="button" disabled={busy} onClick={() => void saveIntentRevision()} className="rounded-lg bg-deep px-4 py-2 text-xs font-bold text-white">حفظ نسخة جديدة</button><button type="button" onClick={() => setEditingIntent(false)} className="rounded-lg border border-outlinev px-4 py-2 text-xs font-bold text-slate">إلغاء</button></div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-outlinev bg-white p-5 sm:p-6" aria-labelledby="sourcing-title">
        <div><h2 id="sourcing-title" className="text-xl font-bold text-inkwell">Supplier Sourcing</h2><p className="mt-1 text-xs text-slate">التكلفة ليست “حقيقة” بلا مصدر ووقت ملاحظة وصلاحية.</p></div>
        {!terminal && (
          <div className="mt-5 rounded-xl bg-low p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Select label="الفئة" value={supplier.category} onChange={(value) => setSupplier({ ...supplier, category: value })} options={Object.entries(categoryLabel)} />
              <Field label="اسم المورد" value={supplier.supplierName} onChange={(value) => setSupplier({ ...supplier, supplierName: value })} />
              <Field label="الوصف" value={supplier.description} onChange={(value) => setSupplier({ ...supplier, description: value })} />
              <Field label="العملة" value={supplier.currency} onChange={(value) => setSupplier({ ...supplier, currency: value.toUpperCase().slice(0, 3) })} />
              <Field label="التكلفة" type="number" value={supplier.cost} onChange={(value) => setSupplier({ ...supplier, cost: value })} />
              <Field label="عمولة متوقعة" type="number" value={supplier.commission} onChange={(value) => setSupplier({ ...supplier, commission: value })} />
              <Select label="نوع المصدر" value={supplier.sourceType} onChange={(value) => setSupplier({ ...supplier, sourceType: value })} options={Object.entries(sourceLabel)} />
              <Field label="مرجع المصدر / Offer ID / URL" value={supplier.sourceRef} onChange={(value) => setSupplier({ ...supplier, sourceRef: value })} />
              <Field label="صالح حتى" type="datetime-local" value={supplier.validUntil} onChange={(value) => setSupplier({ ...supplier, validUntil: value })} />
            </div>
            <button type="button" disabled={busy} onClick={() => void addSupplierOption()} className="mt-4 rounded-lg bg-deep px-4 py-2 text-xs font-bold text-white disabled:opacity-50">تسجيل Supplier Option</button>
          </div>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {detail.supplierOptions.length === 0 && <div className="rounded-xl border border-dashed border-outlinev p-4 text-sm text-slate">لا توجد خيارات موردين بعد.</div>}
          {detail.supplierOptions.map((option) => (
            <article key={option.id} className={`rounded-xl border p-4 ${option.freshness === "stale" ? "border-error/25 bg-errorbg/40" : option.freshness === "expiring" ? "border-gold/25 bg-amber/45" : "border-outlinev bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div><div className="text-xs font-bold text-slate">{categoryLabel[option.category] ?? option.category} · {sourceLabel[option.sourceType] ?? option.sourceType}</div><h3 className="mt-1 font-bold text-inkwell">{option.supplierName}</h3><p className="mt-1 text-xs leading-relaxed text-slate">{option.description}</p></div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${option.freshness === "stale" ? "bg-errorbg text-error" : option.freshness === "expiring" ? "bg-amber text-gold" : "bg-verifiedbg text-verified"}`}>{freshnessLabel[option.freshness]}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate"><span>تكلفة <b className="text-inkwell">{money(Number(option.costAmountMinor), option.currency)}</b></span><span>عمولة <b className="text-inkwell">{money(Number(option.commissionExpectedMinor), option.currency)}</b></span><span>لوحظ {dateTime(option.observedAt)}</span><span>صالح حتى {dateTime(option.validUntil)}</span></div>
              <div className="mt-2 break-all rounded-md bg-low px-2 py-1.5 font-mono text-[10px] text-slate">{option.sourceRef || "No source reference"}</div>
              {!terminal && selectableSuppliers.some((candidate) => candidate.id === option.id) && <button type="button" onClick={() => chooseSupplier(option)} className="mt-3 rounded-lg border border-deep px-3 py-2 text-xs font-bold text-deep">استخدم في Quote</button>}
            </article>
          ))}
        </div>

        {selectedOption && (
          <div className="mt-5 rounded-xl border border-deep/20 bg-wash p-4">
            <div className="font-bold text-deep">Quote من {selectedOption.supplierName}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="الكمية" type="number" value={quote.quantity} onChange={(value) => setQuote({ ...quote, quantity: value })} /><Field label={`سعر البيع / ${selectedOption.currency}`} type="number" value={quote.sell} onChange={(value) => setQuote({ ...quote, sell: value })} /><Field label="صلاحية العرض" type="datetime-local" value={quote.validUntil} onChange={(value) => setQuote({ ...quote, validUntil: value })} /></div>
            <p className="mt-2 text-xs text-slate">التكلفة والعمولة والمصدر لا تُعاد كتابتها هنا؛ تُؤخذ من Supplier Option وتتحقق منها قاعدة البيانات.</p>
            <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void createSupplierBackedQuote()} className="rounded-lg bg-deep px-4 py-2 text-xs font-bold text-white">إنشاء Quote Version</button><button type="button" onClick={() => setSelectedSupplier(null)} className="rounded-lg border border-outlinev px-4 py-2 text-xs font-bold text-slate">إلغاء</button></div>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-outlinev bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold text-inkwell">Quote Versions</h2>
          <div className="mt-4 space-y-3">
            {detail.quoteVersions.length === 0 && <p className="text-sm text-slate">لا توجد نسخ عروض بعد.</p>}
            {detail.quoteVersions.map((version) => (
              <div key={version.quoteVersionId} className="rounded-xl border border-outlinev p-4">
                <div className="flex items-center justify-between gap-3"><b className="text-inkwell">Quote #{version.quoteId} · v{version.version}</b><span className="rounded-md bg-low px-2 py-1 text-[11px] font-bold text-slate">{version.status}</span></div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate"><span>بيع {money(Number(version.sellTotalMinor), version.currency)}</span><span>ربح {money(Number(version.grossProfitMinor), version.currency)}</span><span>Margin {(Number(version.marginBps) / 100).toFixed(1)}%</span><span>صالح حتى {dateTime(version.validUntil)}</span></div>
                <div className="mt-2 truncate font-mono text-[9px] text-slate" title={version.integrityDigest}>digest {version.integrityDigest}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-outlinev bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold text-inkwell">Intelligence</h2>
          <p className="mt-1 text-xs text-slate">قواعد تفسيرية فوق البيانات؛ ليست مصدر حقيقة للسعر أو التوفر.</p>
          <div className="mt-4 space-y-3">
            {[...detail.intelligence.live, ...detail.intelligence.recorded].length === 0 && <p className="text-sm text-slate">لا توجد إشارات مهمة حاليًا.</p>}
            {[...detail.intelligence.live, ...detail.intelligence.recorded].map((signal, index) => (
              <div key={`${signal.kind}-${index}`} className={`rounded-xl border p-4 ${signal.severity === "high" ? "border-error/25 bg-errorbg/40" : signal.severity === "attention" ? "border-gold/25 bg-amber/45" : "border-outlinev"}`}>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate">{signal.kind} · {Math.round(Number(signal.score) * 100)}%</div>
                <p className="mt-1 text-sm font-semibold text-inkwell">{signal.explanation}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate">الخطوة المقترحة: {signal.recommendedAction}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-outlinev bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold text-inkwell">Activity & Audit</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div><h3 className="text-sm font-bold text-deep">Commercial activity</h3><ol className="mt-3 space-y-2">{detail.activities.length === 0 && <li className="text-xs text-slate">لا نشاط بعد.</li>}{detail.activities.map((activity) => <li key={activity.id} className="rounded-lg bg-low p-3 text-xs text-slate"><b className="text-inkwell">{activity.activityType}</b> · {dateTime(activity.occurredAt)}{activity.channel ? ` · ${activity.channel}` : ""}</li>)}</ol></div>
          <details><summary className="cursor-pointer text-sm font-bold text-deep">Domain audit trail ({detail.auditTrail.length})</summary><ol className="mt-3 space-y-2">{detail.auditTrail.map((event) => <li key={event.id} className="rounded-lg bg-low p-3 text-xs text-slate"><b className="text-inkwell">{event.eventType}</b> · {dateTime(event.createdAt)}</li>)}</ol></details>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-xs font-bold text-slate">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-outlinev bg-white px-3 py-2 text-sm font-normal text-inkwell outline-none focus:border-deep focus-visible:ring-4 focus-visible:ring-deep/15" /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="text-xs font-bold text-slate">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-outlinev bg-white px-3 py-2 text-sm font-normal text-inkwell outline-none focus:border-deep focus-visible:ring-4 focus-visible:ring-deep/15">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-low p-3"><div className="text-[11px] font-bold text-slate">{label}</div><div className="mt-1 text-sm font-semibold text-inkwell">{value}</div></div>;
}
