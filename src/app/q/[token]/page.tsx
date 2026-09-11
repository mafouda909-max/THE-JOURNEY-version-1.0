import type { Metadata } from "next";
import { getPublicQuoteDelivery } from "@/lib/quote-delivery-service";
import { QuoteClientActions } from "./QuoteClientActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "عرض رحلتك | THE JOURNEY",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Params = { token: string };
type PublicLine = {
  kind: string;
  label: string;
  quantity: number;
  currency: string;
  sellUnitMinor: number;
  lineTotalMinor: number;
};
type PublicDelivery = {
  status: "active" | "responded";
  response: "approved" | "declined" | "changes_requested" | null;
  respondedAt: string | null;
  agency: { name: string };
  trip: {
    originCity: string | null;
    destinations: string[];
    departureDate: string | null;
    returnDate: string | null;
    travelers: { adults: number; children: number; infants: number };
  };
  quote: {
    version: number;
    currency: string;
    sellTotalMinor: number;
    lines: PublicLine[];
    clientFacingTerms: string | null;
    validUntil: string;
  };
  expiresAt: string;
};

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat("ar-EG", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

function dateOnly(value: string | null) {
  if (!value) return "مرن";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function dateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function travelerSummary(travelers: PublicDelivery["trip"]["travelers"]) {
  const parts = [`${travelers.adults} بالغ`];
  if (travelers.children > 0) parts.push(`${travelers.children} طفل`);
  if (travelers.infants > 0) parts.push(`${travelers.infants} رضيع`);
  return parts.join(" · ");
}

export default async function QuotePage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const result = await getPublicQuoteDelivery(token);

  if (result.status >= 400) {
    const message = "error" in result.body ? String(result.body.error) : "هذا الرابط غير متاح.";
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-16 sm:px-6" dir="rtl">
        <section className="w-full rounded-3xl border border-outlinev bg-white p-7 text-center shadow-sm sm:p-10">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-low font-black text-deep">J</div>
          <h1 className="mt-5 text-2xl font-bold text-inkwell">العرض غير متاح الآن</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate">{message}</p>
          <p className="mt-4 text-xs leading-relaxed text-slate">تواصل مع وكالة السفر التي أرسلت لك الرابط للحصول على نسخة حديثة.</p>
        </section>
      </main>
    );
  }

  const delivery = result.body as unknown as PublicDelivery;
  const destination = delivery.trip.destinations.join("، ") || "رحلتك";

  return (
    <main className="min-h-screen bg-canvas" dir="rtl">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="overflow-hidden rounded-3xl bg-inverse p-6 text-oninverse sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-oninverse/55">THE JOURNEY · عرض خاص</div>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{destination}</h1>
              <p className="mt-3 text-sm text-oninverse/70">مقدم من {delivery.agency.name}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-left">
              <div className="text-[11px] font-bold text-oninverse/55">الإجمالي</div>
              <div className="mt-1 text-xl font-bold">{money(delivery.quote.sellTotalMinor, delivery.quote.currency)}</div>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Summary label="المسار" value={`${delivery.trip.originCity ?? "—"} ← ${destination}`} />
            <Summary label="التواريخ" value={`${dateOnly(delivery.trip.departureDate)} → ${dateOnly(delivery.trip.returnDate)}`} />
            <Summary label="المسافرون" value={travelerSummary(delivery.trip.travelers)} />
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-outlinev bg-white p-5 sm:p-7" aria-labelledby="quote-items-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="quote-items-title" className="text-xl font-bold text-inkwell">تفاصيل العرض</h2>
              <p className="mt-1 text-xs text-slate">Quote v{delivery.quote.version} · صالح حتى {dateTime(delivery.quote.validUntil)}</p>
            </div>
            <div className="text-lg font-bold text-deep">{money(delivery.quote.sellTotalMinor, delivery.quote.currency)}</div>
          </div>

          <div className="mt-5 divide-y divide-outlinev">
            {delivery.quote.lines.map((line, index) => (
              <div key={`${line.kind}-${line.label}-${index}`} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <div className="font-semibold text-inkwell">{line.label}</div>
                  <div className="mt-1 text-xs text-slate">الكمية {line.quantity}</div>
                </div>
                <div className="shrink-0 text-sm font-bold text-inkwell">{money(line.lineTotalMinor, line.currency)}</div>
              </div>
            ))}
          </div>

          {delivery.quote.clientFacingTerms && (
            <div className="mt-6 rounded-xl bg-low p-4">
              <div className="text-xs font-bold text-deep">شروط العرض</div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate">{delivery.quote.clientFacingTerms}</p>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-gold/20 bg-amber/40 p-4 text-xs leading-relaxed text-slate">
            الأسعار والتوفر مرتبطان بصلاحية هذا الإصدار. انتهاء الصلاحية لا يعني وجود حجز مؤكد، وأي حجز نهائي يحتاج تأكيد الوكالة للتوفر والدفع.
          </div>
        </section>

        <div className="mt-6">
          <QuoteClientActions token={token} initialResponse={delivery.response} />
        </div>

        <footer className="mt-7 text-center text-[11px] leading-relaxed text-slate">
          هذا الرابط خاص بمن استلمه. لا تشاركه مع أشخاص آخرين. لا تظهر THE JOURNEY تكلفة المورد أو عمولة الوكالة أو هامشها في صفحة العميل.
        </footer>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] font-bold text-oninverse/50">{label}</div>
      <div className="mt-1 text-sm font-semibold text-oninverse">{value}</div>
    </div>
  );
}
