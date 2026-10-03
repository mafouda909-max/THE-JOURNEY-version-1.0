import type { Metadata } from "next";
import { getPublishedOffers } from "@/lib/data";
import { OffersBrowser } from "@/components/market/OffersBrowser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "العروض",
  description: "تصفّح عروض السفر المراجعة من وكلاء موثّقين — عمرة، باقات، تأشيرات، طيران، فنادق، ورحلات بحرية.",
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
  };
  const offers = await getPublishedOffers();

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <header className="mb-8">
        <div className="sila-eyebrow mb-3 text-[12px] font-semibold text-clay">
          عروض راجعها فريق الثقة
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          العروض المنشورة
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-slate">
          شوف السعر والمشمولات والوكيل قبل ما تبدأ التواصل. كل عرض منشور هنا
          مرّ على مراجعة قبل النشر، والتفاصيل الناقصة تفضل واضحة بدل ما تتخبّى.
        </p>
      </header>
      <OffersBrowser offers={offers} initial={initial} />
    </div>
  );
}
