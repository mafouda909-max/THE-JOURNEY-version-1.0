import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { travelerSavedIntents } from "@/db/schema";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";
import { TravelReadinessWorkbench } from "@/components/market/TravelReadinessWorkbench";
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
  const intentId = typeof params.intentId === "string" && Number.isSafeInteger(Number(params.intentId)) && Number(params.intentId) > 0
    ? Number(params.intentId)
    : null;
  let initial: { destination?: string | null; intentLabel?: string | null } | undefined;

  if (intentId) {
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
      if (rows[0]) {
        initial = {
          destination: destinations[0] ?? null,
          intentLabel: rows[0].label,
        };
      }
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
