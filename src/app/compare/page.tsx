import type { Metadata } from "next";
import Link from "next/link";
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
  if (process.env.FLIGHT_COMPARE_ENABLED !== "true") {
    return (
      <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-10 md:px-8 md:py-14">
        <SilaPageIntro
          eyebrow="Travel Intelligence · مورد الطيران"
          title="المقارنة الحية للطيران ليست متاحة بعد."
          description="لن تعرض صلة سعرًا أو توافرًا قبل اتصال مورد حي واختبار مصدره وتوقيت بياناته. عندما يصبح المصدر جاهزًا، ستظهر المقارنة هنا بدل أي نتائج افتراضية."
          meta={
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-full bg-low px-3 py-1.5 text-slate">مورد حي غير متصل بعد</span>
              <span className="rounded-full bg-low px-3 py-1.5 text-slate">لا نتائج افتراضية</span>
            </div>
          }
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/readiness" className="rounded-lg bg-deep px-5 py-3 text-sm font-bold text-white hover:bg-horizon">
            افحص جاهزية السفر
          </Link>
          <Link href="/trust" className="rounded-lg border border-outlinev bg-cloud px-5 py-3 text-sm font-bold text-deep hover:border-deep">
            كيف نتحقق من المعلومات؟
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const intentId = typeof params.intentId === "string" && Number.isSafeInteger(Number(params.intentId)) && Number(params.intentId) > 0
    ? Number(params.intentId)
    : null;

  let initial: {
    departureDate?: string | null;
    returnDate?: string | null;
    adults?: number | null;
    intentLabel?: string | null;
  } | undefined;

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
      const travelers = record(snap.travelers);
      if (rows[0]) {
        initial = {
          intentLabel: rows[0].label,
          ...(typeof snap.departureDate === "string" ? { departureDate: snap.departureDate } : {}),
          ...(typeof snap.returnDate === "string" ? { returnDate: snap.returnDate } : {}),
          ...(Number.isInteger(Number(travelers.adults)) ? { adults: Number(travelers.adults) } : {}),
        };
      }
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
            <span className="rounded-full bg-air px-3 py-1.5 text-deep">بحث الرحلات · قراءة فقط</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">مصدر + وقت تحقق</span>
            <span className="rounded-full bg-low px-3 py-1.5 text-slate">لا نتائج وهمية</span>
          </div>
        }
      />
      <FlightCompareWorkbench initial={initial} />
    </main>
  );
}
