"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  MARKETPLACE_REQUEST_CATEGORIES,
  MARKETPLACE_REQUEST_CATEGORY_LABELS,
  type MarketplaceRequestCategory,
} from "@/lib/marketplace-request-matching";

type SavedIntentOption = { id: number; label: string; snapshot: Record<string, unknown> };
type Provider = {
  workspaceId: number;
  name: string;
  status: string;
  opportunityId: number | null;
  availableQuotes: number;
};
type MarketplaceRequest = {
  id: number;
  reference: string;
  status: string;
  category: MarketplaceRequestCategory | null;
  categoryLabel: string | null;
  intent: Record<string, unknown> | null;
  createdAt: string;
  providerCount: number;
  providers: Provider[];
};
type RequestsReply = { requests?: MarketplaceRequest[]; error?: string };
type CreateReply = {
  request?: { id: number; reference: string; providerCount: number; providers: Array<{ name: string; city: string; country: string }> };
  error?: string;
};

const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-outlinev bg-white px-3 py-2.5 text-sm text-inkwell outline-none transition focus:border-signal focus-visible:ring-4 focus-visible:ring-signal/15";
const fieldLabel = "block text-xs font-bold text-slate";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function fieldValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function providerStatus(status: string) {
  if (status === "accepted") return "قبلت الوكالة الطلب";
  if (status === "declined") return "اعتذرت عن تقديم عرض";
  if (status === "viewed") return "اطلعت على الطلب";
  if (status === "expired") return "انتهت مهلة الطلب";
  return "أُرسل الطلب إلى الوكالة";
}

export function MultiProviderMarketplace({ savedIntents }: { savedIntents: SavedIntentOption[] }) {
  const [category, setCategory] = useState<MarketplaceRequestCategory>("package");
  const [savedIntentId, setSavedIntentId] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [destinations, setDestinations] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [flexibilityDays, setFlexibilityDays] = useState("0");
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [infants, setInfants] = useState("0");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("EGP");
  const [budgetBasis, setBudgetBasis] = useState<"total" | "per_person">("total");
  const [priorities, setPriorities] = useState("");
  const [constraints, setConstraints] = useState("");
  const [notes, setNotes] = useState("");
  const [shareWithProviders, setShareWithProviders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState<CreateReply["request"] | null>(null);
  const [requests, setRequests] = useState<MarketplaceRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestError, setRequestError] = useState("");

  const loadRequests = useCallback(async () => {
    const response = await fetch("/api/traveler/requests", { cache: "no-store" });
    const data = await response.json() as RequestsReply;
    if (!response.ok) throw new Error(data.error ?? "تعذر تحميل طلبات السوق.");
    return data.requests ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await loadRequests();
        if (!cancelled) {
          setRequests(data);
          setRequestError("");
        }
      } catch (error) {
        if (!cancelled) setRequestError(error instanceof Error ? error.message : "تعذر تحميل طلبات السوق.");
      } finally {
        if (!cancelled) setLoadingRequests(false);
      }
    };
    void refresh();
    return () => { cancelled = true; };
  }, [loadRequests]);

  async function refreshRequests() {
    try {
      setRequests(await loadRequests());
      setRequestError("");
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "تعذر تحديث طلبات السوق.");
    }
  }

  function loadSavedIntent(id: string) {
    setSavedIntentId(id);
    if (!id) return;
    const selected = savedIntents.find((item) => String(item.id) === id);
    if (!selected) return;
    const intent = object(selected.snapshot);
    const travelers = object(intent.travelers);
    setOriginCity(fieldValue(intent.originCity));
    setDestinations(list(intent.destinations).join("، "));
    setDepartureDate(fieldValue(intent.departureDate));
    setReturnDate(fieldValue(intent.returnDate));
    setFlexibilityDays(String(intent.flexibilityDays ?? 0));
    setAdults(String(travelers.adults ?? 1));
    setChildren(String(travelers.children ?? 0));
    setInfants(String(travelers.infants ?? 0));
    setBudgetAmount(intent.budgetAmountMinor == null ? "" : (Number(intent.budgetAmountMinor) / 100).toFixed(2));
    setBudgetCurrency(fieldValue(intent.budgetCurrency) || "EGP");
    setBudgetBasis(intent.budgetBasis === "per_person" ? "per_person" : "total");
    setPriorities(list(intent.priorities).join("\n"));
    setConstraints(list(intent.constraints).join("\n"));
    setNotes(fieldValue(intent.notes));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    setSuccess(null);

    const destinationList = destinations.split(/[،,\n]/).map((item) => item.trim()).filter(Boolean);
    const amount = budgetAmount.trim() ? Number(budgetAmount) : null;
    const budgetAmountMinor = amount == null ? null : Math.round(amount * 100);
    const travelerCounts = {
      adults: Number(adults),
      children: Number(children),
      infants: Number(infants),
    };
    const intent = {
      originCity: originCity.trim() || null,
      destinations: destinationList,
      departureDate: departureDate || null,
      returnDate: returnDate || null,
      flexibilityDays: Number(flexibilityDays),
      travelers: travelerCounts,
      budgetAmountMinor,
      budgetCurrency: budgetAmountMinor == null ? null : budgetCurrency,
      budgetBasis: budgetAmountMinor == null ? null : budgetBasis,
      tripType: category,
      priorities: priorities.split("\n").map((item) => item.trim()).filter(Boolean),
      constraints: constraints.split("\n").map((item) => item.trim()).filter(Boolean),
      notes: notes.trim() || null,
    };

    if (destinationList.length === 0) {
      setFormError("اكتب وجهة واحدة على الأقل.");
      setSubmitting(false);
      return;
    }
    if (!Number.isFinite(travelerCounts.adults) || travelerCounts.adults < 1 ||
        !Number.isSafeInteger(travelerCounts.children) || travelerCounts.children < 0 ||
        !Number.isSafeInteger(travelerCounts.infants) || travelerCounts.infants < 0) {
      setFormError("راجع أعداد البالغين والأطفال والرضع.");
      setSubmitting(false);
      return;
    }
    if (budgetAmountMinor != null && (!Number.isSafeInteger(budgetAmountMinor) || budgetAmountMinor <= 0)) {
      setFormError("قيمة الميزانية غير صحيحة.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/traveler/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          intent,
          savedIntentId: savedIntentId || null,
          shareWithProviders,
        }),
      });
      const data = await response.json() as CreateReply;
      if (!response.ok || !data.request) throw new Error(data.error ?? "تعذر إرسال طلب السوق.");
      setSuccess(data.request);
      setShareWithProviders(false);
      try {
        setRequests(await loadRequests());
        setRequestError("");
      } catch (refreshError) {
        setRequestError(refreshError instanceof Error ? refreshError.message : "تم إرسال الطلب لكن تعذر تحديث قائمة الطلبات.");
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "تعذر إرسال الطلب.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8 space-y-5" aria-labelledby="multi-provider-market-title" dir="rtl">
      <div className="rounded-2xl border border-outlinev bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-signal">سوق صلة · طلب واحد لعدة جهات</div>
            <h2 id="multi-provider-market-title" className="mt-2 text-2xl font-bold text-inkwell">اطلب عروضًا مناسبة من شبكة مقدمي الخدمة</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate">
              اكتب احتياجك مرة واحدة. نوجّه التفاصيل الأساسية إلى ما يصل إلى خمس وكالات نشطة، مؤهلة، ولديها تخصص معلن مطابق. كل وكالة تُعد عرضها بشكل مستقل، وتختار أنت ما يناسبك.
            </p>
          </div>
          <span className="rounded-lg bg-low px-3 py-2 text-[11px] font-bold text-slate">حتى 5 جهات مطابقة</span>
        </div>

        {success && (
          <div className="mt-5 rounded-xl border border-verified/20 bg-verifiedbg p-4" role="status">
            <div className="font-bold text-verified">تم إرسال طلبك إلى {success.providerCount} جهات.</div>
            <div className="mt-1 text-sm text-slate">مرجع الطلب {success.reference}. لم يتم إنشاء حجز أو دفع؛ انتظر عروض الجهات داخل حسابك.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {success.providers.map((provider, index) => (
                <span key={provider.name + index} className="rounded-lg border border-verified/15 bg-white px-3 py-2 text-xs font-semibold text-inkwell">
                  {provider.name} · {provider.city}، {provider.country}
                </span>
              ))}
            </div>
            <Link href={`/account/travel/requests/${success.id}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-deep px-4 py-2 text-xs font-bold text-white">
              متابعة الطلب والعروض
            </Link>
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          {savedIntents.length > 0 && (
            <label className={fieldLabel}>
              ابدأ من نية سفر محفوظة — اختياري
              <select value={savedIntentId} onChange={(event) => loadSavedIntent(event.target.value)} className={inputClass}>
                <option value="">إدخال تفاصيل طلب جديد</option>
                {savedIntents.map((intent) => <option key={intent.id} value={intent.id}>{intent.label}</option>)}
              </select>
            </label>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldLabel}>
              نوع الخدمة
              <select data-testid="multi-provider-category-select" value={category} onChange={(event) => setCategory(event.target.value as MarketplaceRequestCategory)} className={inputClass}>
                {MARKETPLACE_REQUEST_CATEGORIES.map((value) => <option key={value} value={value}>{MARKETPLACE_REQUEST_CATEGORY_LABELS[value]}</option>)}
              </select>
            </label>
            <label className={fieldLabel}>
              مدينة المغادرة
              <input value={originCity} onChange={(event) => setOriginCity(event.target.value)} maxLength={120} className={inputClass} placeholder="مثال: القاهرة" />
            </label>
          </div>

          <label className={fieldLabel}>
            الوجهات المطلوبة
            <input required value={destinations} onChange={(event) => setDestinations(event.target.value)} maxLength={500} className={inputClass} placeholder="مثال: إسطنبول، طرابزون" />
            <span className="mt-1 block font-normal text-[11px] leading-5 text-slate">يمكنك كتابة أكثر من وجهة وفصلها بفاصلة.</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className={fieldLabel}>تاريخ المغادرة<input type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} className={inputClass} /></label>
            <label className={fieldLabel}>تاريخ العودة<input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} min={departureDate || undefined} className={inputClass} /></label>
            <label className={fieldLabel}>مرونة التاريخ بالأيام<input type="number" min={0} max={30} value={flexibilityDays} onChange={(event) => setFlexibilityDays(event.target.value)} className={inputClass} /></label>
          </div>

          <div>
            <div className={fieldLabel}>المسافرون</div>
            <div className="mt-1 grid grid-cols-3 gap-3">
              <label className={fieldLabel}>بالغون<input type="number" min={1} max={40} value={adults} onChange={(event) => setAdults(event.target.value)} className={inputClass} /></label>
              <label className={fieldLabel}>أطفال<input type="number" min={0} max={40} value={children} onChange={(event) => setChildren(event.target.value)} className={inputClass} /></label>
              <label className={fieldLabel}>رضع<input type="number" min={0} max={20} value={infants} onChange={(event) => setInfants(event.target.value)} className={inputClass} /></label>
            </div>
          </div>

          <div>
            <div className={fieldLabel}>الميزانية — اختياري</div>
            <div className="mt-1 grid gap-3 sm:grid-cols-3">
              <label className={fieldLabel}>القيمة<input type="number" min="0" step="0.01" value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} className={inputClass} placeholder="مثال: 25000" /></label>
              <label className={fieldLabel}>العملة<select value={budgetCurrency} onChange={(event) => setBudgetCurrency(event.target.value)} className={inputClass}><option>EGP</option><option>USD</option><option>SAR</option><option>EUR</option><option>AED</option></select></label>
              <label className={fieldLabel}>أساس الميزانية<select value={budgetBasis} onChange={(event) => setBudgetBasis(event.target.value as "total" | "per_person")} className={inputClass}><option value="total">إجمالي الرحلة</option><option value="per_person">للفرد الواحد</option></select></label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={fieldLabel}>الأولويات — كل أولوية في سطر<textarea rows={3} maxLength={1200} value={priorities} onChange={(event) => setPriorities(event.target.value)} className={inputClass} placeholder="موقع الفندق\nرحلات مباشرة" /></label>
            <label className={fieldLabel}>القيود أو الشروط — كل شرط في سطر<textarea rows={3} maxLength={1200} value={constraints} onChange={(event) => setConstraints(event.target.value)} className={inputClass} placeholder="عدم تغيير مدينة المغادرة\nغرفة عائلية" /></label>
          </div>

          <label className={fieldLabel}>تفاصيل إضافية<textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="ما الذي تريد من الوكالات مراعاته؟" /></label>

          <label className="flex items-start gap-3 rounded-xl border border-outlinev bg-low/45 p-4">
            <input type="checkbox" checked={shareWithProviders} onChange={(event) => setShareWithProviders(event.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-signal" />
            <span className="text-xs leading-6 text-slate">
              أوافق على مشاركة نوع الخدمة وتفاصيل خطة السفر والميزانية والأولويات التي كتبتها مع ما يصل إلى خمس جهات مؤهلة مطابقة. لا تشارك صلة بريدي أو رقم هاتفي أو بيانات الجاهزية الخاصة بي مع الجهات المستلمة.
            </span>
          </label>

          {formError && <p role="alert" className="rounded-lg border border-error/20 bg-errorbg p-3 text-xs text-error">{formError}</p>}
          <button type="submit" disabled={submitting || !shareWithProviders} className="min-h-12 w-full rounded-xl bg-deep px-5 py-3 text-sm font-bold text-white transition hover:bg-signal disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? "جارٍ توجيه الطلب للجهات المطابقة…" : "أرسل الطلب إلى مقدمي الخدمة"}
          </button>
          <p className="text-[11px] leading-5 text-slate">إذا لم توجد جهة تستوفي التخصص ومتطلبات الثقة الحالية، لن ننشئ الطلب أو ندّعي إرساله. إرسال الطلب ليس حجزًا أو تأكيد توافر.</p>
        </form>
      </div>

      <section className="rounded-2xl border border-outlinev bg-white p-5 sm:p-6" aria-labelledby="my-marketplace-requests-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="my-marketplace-requests-title" className="text-lg font-bold text-inkwell">طلباتك المرسلة إلى الشبكة</h3>
            <p className="mt-1 text-xs text-slate">تابع الجهات المستلمة والعروض التي جهزتها كل وكالة.</p>
          </div>
          <button type="button" onClick={() => void refreshRequests()} className="min-h-10 rounded-lg border border-outlinev px-3 py-2 text-xs font-bold text-deep">تحديث</button>
        </div>
        {loadingRequests ? <p role="status" className="mt-4 text-sm text-slate">جارٍ تحميل طلباتك…</p> :
          requestError ? <p role="alert" className="mt-4 rounded-lg bg-errorbg p-3 text-xs text-error">{requestError}</p> :
          requests.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-outlinev p-4 text-sm text-slate">لم ترسل طلب سوق متعدد الجهات بعد.</p> :
          <div className="mt-4 space-y-3">
            {requests.map((item) => (
              <article key={item.id} className="rounded-xl border border-outlinev p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-inkwell">{item.reference} · {item.categoryLabel ?? "طلب خدمة"}</div>
                    <div className="mt-1 text-xs text-slate">استُلم الطلب لدى {item.providerCount} جهات</div>
                  </div>
                  <Link href={`/account/travel/requests/${item.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-air px-3 py-2 text-xs font-bold text-deep">مراجعة العروض</Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.providers.map((provider) => (
                    <span key={provider.workspaceId} className="rounded-lg bg-low px-3 py-2 text-[11px] text-slate">
                      <b className="text-inkwell">{provider.name}</b> · {providerStatus(provider.status)} · {provider.availableQuotes} عرض
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>}
      </section>
    </section>
  );
}
