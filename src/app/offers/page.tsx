import type { Metadata } from "next";
import { getPublishedOffers } from "@/lib/data";
import { OffersBrowser } from "@/components/market/OffersBrowser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "العروض",
  description: "اقرأ عرض السفر كمعلومة لها مصدر ونطاق وصلاحية، وليس كسعر وصورة فقط.",
};

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initial = {
    from: typeof params.from === "string" ? params.from : "",
    to: typeof params.to === "string" ? params.to : "",
    type: typeof params.type === "string" ? params.type : "",
    travelers:
      typeof params.travelers === "string" &&
      Number.isInteger(Number(params.travelers)) &&
      Number(params.travelers) >= 1 &&
      Number(params.travelers) <= 14
        ? Number(params.travelers)
        : null,
    intentId:
      typeof params.intentId === "string" &&
      Number.isSafeInteger(Number(params.intentId)) &&
      Number(params.intentId) > 0
        ? Number(params.intentId)
        : null,
  };

  const offers = await getPublishedOffers();

  return (
    <main className="pb-24">
      <section className="border-b border-outlinev bg-cloud">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
          <div>
            <div className="sila-eyebrow text-[11px] font-bold">Marketplace · لكن بحدود واضحة</div>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-deep md:text-6xl">
              اقرأ العرض قبل ما تقارن السعر.
            </h1>
          </div>
          <div className="max-w-[760px]">
            <p className="text-[17px] leading-8 text-slate">
              كل نتيجة هنا لازم تجاوبك: ماذا يعرض الوكيل؟ لمن؟ ماذا يشمل؟ ماذا لا يشمل؟
              من أين جاءت المعلومة؟ ومتى تنتهي صلاحيتها؟
            </p>
            <div className="evidence-strip mt-7">
              <div>
                <div className="text-[10px] font-bold text-slate">Offer</div>
                <div className="mt-2 text-sm font-bold text-deep">السعر + المشمولات + الشروط</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate">Source</div>
                <div className="mt-2 text-sm font-bold text-deep">صاحب العرض ومسار المراجعة</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate">Scope</div>
                <div className="mt-2 text-sm font-bold text-deep">النطاق + الصلاحية</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1320px] px-5 pt-8 md:px-8 md:pt-10">
        <OffersBrowser offers={offers} initial={initial} />
      </div>
    </main>
  );
}
