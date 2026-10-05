import type { Metadata } from "next";
import { getPublishedOffers } from "@/lib/data";
import { OffersBrowser } from "@/components/market/OffersBrowser";
import { SilaPageIntro } from "@/components/brand/SilaPageIntro";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "العروض",
  description: "تصفّح عروض السفر المراجعة من وكلاء بأدلة مُراجَعة ونطاق واضح — عمرة، باقات، تأشيرات، طيران، فنادق، ورحلات بحرية.",
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
    travelers: typeof params.travelers === "string" && Number.isInteger(Number(params.travelers)) && Number(params.travelers) >= 1 && Number(params.travelers) <= 14 ? Number(params.travelers) : null,
    intentId: typeof params.intentId === "string" && Number.isSafeInteger(Number(params.intentId)) && Number(params.intentId) > 0 ? Number(params.intentId) : null,
  };
  const offers = await getPublishedOffers();

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 md:px-8 md:pt-16">
      <SilaPageIntro
        eyebrow="عروض راجعها فريق الثقة"
        title="العروض المنشورة"
        description="شوف السعر والمشمولات والوكيل قبل ما تبدأ التواصل. كل عرض منشور هنا مرّ على مراجعة قبل النشر، والتفاصيل الناقصة تفضل واضحة بدل ما تتخبّى."
        meta={
          <div className="flex flex-wrap gap-2 text-[12px] font-semibold text-slate">
            <span className="rounded-full bg-air px-3 py-1.5 text-deep">مصدر العرض واضح</span>
            <span className="rounded-full bg-low px-3 py-1.5">المشمولات أمامك</span>
            <span className="rounded-full bg-low px-3 py-1.5">التواصل مباشر</span>
          </div>
        }
      />
      <OffersBrowser offers={offers} initial={initial} />
    </div>
  );
}
