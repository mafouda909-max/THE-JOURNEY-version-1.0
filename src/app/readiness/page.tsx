import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { travelerSavedIntents } from "@/db/schema";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { TravelReadinessWorkbench } from "@/components/market/TravelReadinessWorkbench";
import { accountFromCookies } from "@/lib/identity";
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
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <SilaPageIntro
        eyebrow="SILA Travel Advisor · اعرف قبل أن تختار"
        title="احكِ لنا رحلتك، ونكمّل الصورة معك."
        description="صلة تسألك عن التفاصيل المؤثرة، تراجع ما لديها من أدلة، وتوضح ما نعرفه وما يحتاج تأكيدًا وما الخطوة التالية قبل أن تحجز أو تختار عرضًا."
      />
      <TravelReadinessWorkbench initial={initial} />
    </main>
  );
}
