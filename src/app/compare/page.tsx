import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { FlightCompareWorkbench } from "@/components/market/FlightCompareWorkbench";
import { db } from "@/db";
import { travelerSavedIntents } from "@/db/schema";
import { accountFromCookies } from "@/lib/identity";

export const metadata: Metadata = {
  title: "قارن الرحلات",
  description:
    "قارن نتائج الرحلات من مصادر الموردين المتصلة مع مصدر وتوقيت واضحين قبل الالتزام.",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const account = await accountFromCookies();
  const intentId = typeof params.intentId === "string" ? Number(params.intentId) : 0;
  let initial: {
    departureDate?: string | null;
    returnDate?: string | null;
    adults?: number | null;
    intentLabel?: string | null;
  } | undefined;

  if (
    process.env.TRAVELER_WORKSPACE_ENABLED === "true" &&
    account?.role === "traveler" &&
    Number.isSafeInteger(intentId) &&
    intentId > 0
  ) {
    const rows = await db
      .select({
        label: travelerSavedIntents.label,
        intentSnapshot: travelerSavedIntents.intentSnapshot,
      })
      .from(travelerSavedIntents)
      .where(and(
        eq(travelerSavedIntents.id, intentId),
        eq(travelerSavedIntents.accountId, account.id),
        eq(travelerSavedIntents.status, "active"),
      ))
      .limit(1);
    const row = rows[0];
    if (row) {
      const intent = record(row.intentSnapshot);
      const travelers = record(intent.travelers);
      initial = {
        departureDate: typeof intent.departureDate === "string" ? intent.departureDate : null,
        returnDate: typeof intent.returnDate === "string" ? intent.returnDate : null,
        adults: Number.isFinite(Number(travelers.adults)) ? Number(travelers.adults) : 1,
        intentLabel: row.label,
      };
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <SilaPageIntro
        eyebrow="Travel Intelligence · مصادر حية"
        title="قارن المعلومة، مش السعر وحده."
        description="صلة توحّد نتائج الموردين في نموذج واحد وتوضح المصدر ووقت التحقق والمدة والتوقفات والأمتعة. النتيجة تساعد القرار؛ ولا تخفي حدود المصدر."
        meta={
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-air px-3 py-1.5 text-deep">GDS / NDC ready</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">مصدر + وقت تحقق</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">لا نتائج وهمية</span>
          </div>
        }
      />
      <FlightCompareWorkbench initial={initial} />
    </main>
  );
}
