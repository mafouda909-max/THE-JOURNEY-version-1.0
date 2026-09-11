import type { Metadata } from "next";
import { getPublishedOffers } from "@/lib/data";
import { OffersBrowser } from "@/components/market/OffersBrowser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "عروض السفر من وكلاء موثّقين",
  description: "تصفّح عروض سفر منشورة من وكلاء موثّقين — عمرة، باقات، تأشيرات، طيران، فنادق، ورحلات بحرية — مع السعر بعملته وأساس تسعيره المعلنين.",
};

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawTravelers = typeof params.travelers === "string" ? Number(params.travelers) : Number.NaN;
  const initial = {
    from: typeof params.from === "string" ? params.from : "",
    to: typeof params.to === "string" ? params.to : "",
    type: typeof params.type === "string" ? params.type : "",
    travelers: Number.isInteger(rawTravelers) && rawTravelers >= 1 && rawTravelers <= 14 ? rawTravelers : null,
  };
  const offers = await getPublishedOffers();

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          عروض سفر منشورة من وكلاء موثّقين
        </h1>
        <p className="mt-4 max-w-3xl leading-relaxed text-slate">
          كل عرض هنا اجتاز مراجعة سياسة النشر قبل الظهور العام. نعرض السعر بعملته وأساس تسعيره الحقيقي — للفرد، للمجموعة، أو «يبدأ من» — ونفصل ذلك بوضوح عن التحقق الخارجي اللحظي من السعر أو التوفر، وهو غير متاح لهذه العروض حاليًا.
        </p>
      </header>
      <OffersBrowser offers={offers} initial={initial} />
    </div>
  );
}
