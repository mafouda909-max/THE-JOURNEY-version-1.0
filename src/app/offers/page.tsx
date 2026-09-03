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
        <h1 className="text-4xl font-bold tracking-tight text-inkwell md:text-6xl">
          العروض المنشورة
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-slate">
          كل عرض هنا اجتاز مراجعة فريق الثقة: السعر معلن بلا خداع «ابتداءً من»
          مبهمة، والمشمولات مفصلة، ولا أرقام تواصل خارج المنصة.
        </p>
      </header>
      <OffersBrowser offers={offers} initial={initial} />
    </div>
  );
}
