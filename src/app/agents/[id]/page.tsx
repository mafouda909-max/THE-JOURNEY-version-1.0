import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, Languages, MapPin, Star, ShieldCheck } from "lucide-react";
import { getAgentById, getPublishedOffers } from "@/lib/data";
import { OfferCard, VerifiedChip } from "@/components/market/OfferCard";
import { AnalyticsBeacon } from "@/components/AnalyticsBeacon";
import { Reveal } from "@/components/Reveal";

export const dynamic = "force-dynamic";

const CURRENT_YEAR = new Date().getFullYear();

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const agent = await getAgentById(Number(id));
  if (!agent) return { title: "وكيل غير موجود" };
  return { title: agent.displayName, description: agent.bio.split("\n")[0] };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr" aria-label={`التقييم ${rating} من 5`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index <= rating ? "fill-gold text-gold" : "text-outlinev"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default async function AgentProfilePage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const agent = await getAgentById(Number(id));
  if (!agent) notFound();

  const allOffers = await getPublishedOffers();
  const offerCards = agent.offers
    .map((offer) => allOffers.find((candidate) => candidate.id === offer.id))
    .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer));

  const years = Math.max(1, CURRENT_YEAR - agent.joinedAt.getFullYear());
  const accountType = agent.licenseType === "agency" ? "وكالة سفر" : "وكيل سفر";

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-10 md:px-8">
      <AnalyticsBeacon name="agent_viewed" agentId={agent.id} />
      <nav className="mb-8 flex items-center gap-2 font-mono text-[12px] text-slate" aria-label="مسار التنقل">
        <Link href="/agents" className="transition-colors hover:text-deep">الوكلاء</Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-deep">{agent.latinName}</span>
      </nav>

      <Reveal>
        <div className="rounded-2xl border border-outlinev bg-cloud p-6 md:p-10">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="relative h-52 w-full shrink-0 overflow-hidden rounded-2xl bg-low md:h-64 md:w-52">
              <Image src={agent.photoUrl} alt={agent.displayName} fill sizes="208px" className="object-cover object-top" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-inkwell md:text-4xl">{agent.displayName}</h1>
                <VerifiedChip licenseType={agent.licenseType} hasLicense={agent.hasLicense} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate">
                <span className="font-mono uppercase tracking-[0.12em]">{agent.latinName}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-deep" aria-hidden="true" /> {agent.city}، {agent.country}
                </span>
                <span>{accountType}</span>
              </div>
              <p className="mt-5 max-w-3xl leading-[1.9] text-inkwell/80">{agent.bio}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {agent.specialtyTags.map((tag) => (
                  <span key={tag} className="rounded-md bg-wash px-3 py-1.5 text-[12px] font-semibold text-deep">{tag}</span>
                ))}
                <span className="mx-1 hidden h-4 w-px bg-outlinev sm:block" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5 text-[12px] text-slate">
                  <Languages className="h-4 w-4" aria-hidden="true" />{agent.languages.join("، ")}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-low pt-8 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { value: `${agent.avgRating}`, label: `التقييم ★ (${agent.reviewCount})` },
              { value: `${agent.responseRate}%`, label: "معدل الاستجابة" },
              { value: `${agent.avgResponseHours} س`, label: "متوسط زمن الرد" },
              { value: agent.totalTrips.toLocaleString("en-US"), label: "رحلة مكتملة" },
              { value: `${years}`, label: "سنوات على المنصة" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-low px-3 py-4 text-center">
                <div className="tnum truncate text-lg font-bold text-deep">{stat.value}</div>
                <div className="mt-1 text-[11px] text-slate">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-verified/20 bg-verifiedbg/40 p-4 text-[12px] leading-relaxed text-slate">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-verified" aria-hidden="true" />
            <span>
              شارة التوثيق تعني أن THE JOURNEY راجع أدلة الهوية والنشاط المطلوبة لهذا الحساب وحالته الحالية موثّقة. لا ننشر أرقام الرخص أو مستندات KYC للعامة.
            </span>
          </div>
        </div>
      </Reveal>

      <section className="mt-20">
        <h2 className="mb-8 text-2xl font-bold text-inkwell md:text-3xl">العروض المنشورة ({offerCards.length})</h2>
        {offerCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-8 py-14 text-center text-slate">
            لا عروض منشورة لهذا الوكيل حالياً.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {offerCards.map((offer) => <OfferCard key={offer.id} offer={offer} rating={agent.avgRating} />)}
          </div>
        )}
      </section>

      <section className="mt-20">
        <h2 className="mb-8 flex flex-wrap items-center gap-3 text-2xl font-bold text-inkwell md:text-3xl">
          التقييمات <span className="tnum text-lg font-semibold text-slate">★ {agent.avgRating} · {agent.reviewCount}</span>
        </h2>
        {agent.reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outlinev bg-cloud px-8 py-14 text-center text-slate">
            لا تقييمات منشورة لهذا الوكيل بعد.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {agent.reviews.map((review, index) => (
              <Reveal key={review.id} delay={Math.min(index * 0.05, 0.2)}>
                <div className="flex h-full flex-col rounded-xl border border-outlinev bg-cloud p-6">
                  <div className="flex items-center justify-between gap-3">
                    <Stars rating={review.rating} />
                    {review.isVerifiedTransaction && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-verifiedbg px-2 py-1 text-[11px] font-semibold text-verified">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />تفاعل مؤكّد
                      </span>
                    )}
                  </div>
                  <p className="mt-4 flex-1 leading-[1.85] text-inkwell/85">“{review.content}”</p>
                  <div className="mt-5 flex items-center justify-between border-t border-low pt-4 text-[12px] text-slate">
                    <span className="font-semibold text-inkwell">{review.reviewerName}</span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      {review.createdAt.toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
