import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { TravelReadinessWorkbench } from "@/components/market/TravelReadinessWorkbench";
import { db } from "@/db";
import { travelerSavedIntents } from "@/db/schema";
import { accountFromCookies } from "@/lib/identity";

export const metadata: Metadata = {
  title: "جاهزية السفر",
  description:
    "افحص جاهزية السفر حسب الجنسية والوجهة وصلاحية الجواز مع قائمة إجراءات واضحة.",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export default async function ReadinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const account = await accountFromCookies();
  const intentId = typeof params.intentId === "string" ? Number(params.intentId) : 0;
  let initial: { destination?: string | null; intentLabel?: string | null } | undefined;

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
      const destinations = Array.isArray(intent.destinations) ? intent.destinations.map(String) : [];
      initial = { destination: destinations[0] ?? null, intentLabel: row.label };
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <SilaPageIntro
        eyebrow="Travel Readiness · قرار قبل الحجز"
        title="هل أنت جاهز للسفر فعلًا؟"
        description="صلة تحول شروط السفر إلى Checklist مرتبطة بسياقك: الجواز، التأشيرة، الترانزيت وما يحتاج منك إجراء قبل الالتزام."
      />
      <TravelReadinessWorkbench initial={initial} />
    </main>
  );
}
