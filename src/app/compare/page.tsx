import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { travelerSavedIntents } from "@/db/schema";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { FlightCompareWorkbench } from "@/components/market/FlightCompareWorkbench";
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
  const intentId = typeof params.intentId === "string" && Number.isSafeInteger(Number(params.intentId)) && Number(params.intentId) > 0
    ? Number(params.intentId)
    : null;

  let initial: {
    intentId: number | null;
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
    adults?: number;
  } = { intentId };

  if (intentId) {
    const account = await accountFromCookies();
    if (account?.role === "traveler") {
      const rows = await db
        .select({ snapshot: travelerSavedIntents.intentSnapshot })
        .from(travelerSavedIntents)
        .where(and(
          eq(travelerSavedIntents.id, intentId),
          eq(travelerSavedIntents.accountId, account.id),
          eq(travelerSavedIntents.status, "active"),
        ))
        .limit(1);
      const snap = record(rows[0]?.snapshot);
      const travelers = record(snap.travelers);
      const destinations = Array.isArray(snap.destinations) ? snap.destinations.map(String) : [];
      initial = {
        intentId,
        ...(typeof snap.originCity === "string" ? { origin: snap.originCity } : {}),
        ...(destinations[0] ? { destination: destinations[0] } : {}),
        ...(typeof snap.departureDate === "string" ? { departureDate: snap.departureDate } : {}),
        ...(typeof snap.returnDate === "string" ? { returnDate: snap.returnDate } : {}),
        ...(Number.isInteger(Number(travelers.adults)) ? { adults: Number(travelers.adults) } : {}),
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
