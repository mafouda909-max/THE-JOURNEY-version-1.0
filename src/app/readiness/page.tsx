import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { travelerSavedIntents } from "@/db/schema";
import { SilaAdvisorEntry } from "@/components/market/SilaAdvisorEntry";
import { TravelReadinessWorkbench } from "@/components/market/TravelReadinessWorkbench";
import { accountFromCookies } from "@/lib/identity";
import { silaAdvisorCaseFromSnapshot } from "@/lib/sila-advisor-memory";
import type { SilaTravelCaseSnapshot } from "@/lib/sila-advisor-travel-case";
import { savedReadinessFromSnapshot } from "@/lib/traveler-readiness-memory";

export const metadata: Metadata = {
  title: "مستشار السفر",
  description:
    "احكِ لِصلة عن رحلتك لتحصل على تجهيزات وأسئلة ونقاط تحتاج تحققًا ومصادر وعروض مناسبة عندما تكون متاحة.",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function travelerTotal(value: unknown): number | null {
  const travelers = record(value);
  const total = ["adults", "children", "infants"].reduce((sum, key) => {
    const n = Number(travelers[key] ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  return total > 0 ? total : null;
}

export default async function ReadinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const intentId = typeof params.intentId === "string" && Number.isSafeInteger(Number(params.intentId)) && Number(params.intentId) > 0
    ? Number(params.intentId)
    : null;
  let initialAdvisorCase: SilaTravelCaseSnapshot | null = null;
  let persistentIntentId: number | null = null;
  let initial:
    | {
        intentId?: number | null;
        destination?: string | null;
        intentLabel?: string | null;
        nationality?: string | null;
        passportValidityMonths?: number | null;
        transitCountry?: string | null;
        travelPurpose?: string | null;
        travelDate?: string | null;
        originCity?: string | null;
        travelerCount?: number | null;
        budgetAmount?: number | null;
        budgetCurrency?: string | null;
        advisorAnswers?: Record<string, string>;
        saved?: {
          checkedAt: string;
          freshness: { status: "CURRENT" | "ATTENTION" | "UNKNOWN"; nearestValidUntil: string | null; reasons: string[] };
          change: { state: "FIRST_CHECK" | "UNCHANGED" | "CHANGED"; previousCheckedAt: string | null; changedKeys: string[] };
        } | null;
      }
    | undefined;

  if (process.env.TRAVELER_WORKSPACE_ENABLED === "true" && intentId) {
    const account = await accountFromCookies();
    if (account?.role === "traveler") {
      const rows = await db
        .select({ snapshot: travelerSavedIntents.intentSnapshot, label: travelerSavedIntents.label })
        .from(travelerSavedIntents)
        .where(and(
          eq(travelerSavedIntents.id, intentId),
          eq(travelerSavedIntents.accountId, account.id),
          eq(travelerSavedIntents.status, "active"),
        ))
        .limit(1);
      const snap = record(rows[0]?.snapshot);
      const destinations = Array.isArray(snap.destinations) ? snap.destinations.map(String) : [];
      const saved = savedReadinessFromSnapshot(snap);
      if (rows[0]) {
        persistentIntentId = intentId;
        initialAdvisorCase = silaAdvisorCaseFromSnapshot(snap);
        initial = {
          intentId,
          destination: saved?.input.destination ?? destinations[0] ?? null,
          intentLabel: rows[0].label,
          nationality: saved?.input.nationality ?? null,
          passportValidityMonths: saved?.input.passportValidityMonths ?? null,
          transitCountry: saved?.input.transitCountry ?? null,
          travelPurpose: saved?.input.travelPurpose ?? null,
          travelDate: saved?.input.travelDate ?? (typeof snap.departureDate === "string" ? snap.departureDate : null),
          originCity: saved?.input.originCity ?? (typeof snap.originCity === "string" ? snap.originCity : null),
          travelerCount: saved?.input.travelerCount ?? travelerTotal(snap.travelers),
          budgetAmount: saved?.input.budgetAmount ?? null,
          budgetCurrency: saved?.input.budgetCurrency ?? null,
          advisorAnswers: saved?.input.advisorAnswers,
          saved: saved
            ? {
                checkedAt: saved.checkedAt,
                freshness: saved.freshness,
                change: saved.change,
              }
            : null,
        };
      }
    }
  }

  return (
    <main className="min-h-[70vh] pb-24">
      <section className="border-b border-outlinev bg-cloud">
        <div className="mx-auto max-w-[1320px] px-5 py-12 md:px-8 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
            <div>
              <div className="sila-eyebrow text-[11px] font-bold">ابدأ رحلتك</div>
              <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-deep md:text-6xl">
                مش مطلوب منك تعرف كل التفاصيل.
              </h1>
            </div>
            <div className="max-w-[720px]">
              <p className="text-[17px] leading-8 text-slate">
                ابدأ من نقطة واحدة: لو عارف اللي عايزه قلّه، ولو مش متأكد احكِ المشكلة.
                صلة تجمع السياق، تسأل سؤالًا واحدًا مؤثرًا، وبعدها تنتقل للتحقق بالمصادر.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="border-t-2 border-signal pt-3">
                  <div className="text-sm font-bold text-deep">أعرف ماذا أريد</div>
                  <div className="mt-1 text-[12px] leading-6 text-slate">قول الوجهة أو نوع الرحلة أو الموعد.</div>
                </div>
                <div className="border-t-2 border-earth pt-3">
                  <div className="text-sm font-bold text-deep">لست متأكدًا</div>
                  <div className="mt-1 text-[12px] leading-6 text-slate">احكِ اللي محيرك، ونبدأ من أول سؤال يغيّر القرار.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 pt-10 md:px-8 md:pt-14">
        <SilaAdvisorEntry initialCase={initialAdvisorCase} persistentIntentId={persistentIntentId} />

        <details
          id="verification-check"
          className="mt-10 border-y border-outlinev bg-cloud"
          open={Boolean(initial)}
        >
          <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-5 px-1 py-4">
            <span>
              <span className="block text-[11px] font-bold text-signal">Verification workspace</span>
              <span className="mt-1 block text-xl font-bold text-deep">شغّل الفحص المدعوم بالمصادر</span>
              <span className="mt-1 block text-[12px] leading-6 text-slate">
                هنا ننتقل من فهم السياق إلى فحص المتطلبات والأدلة ونطاقها وصلاحيتها.
              </span>
            </span>
            <span className="shrink-0 text-2xl font-light text-signal" aria-hidden="true">+</span>
          </summary>
          <div className="border-t border-outlinev py-8">
            <TravelReadinessWorkbench initial={initial} />
          </div>
        </details>
      </div>
    </main>
  );;
}
