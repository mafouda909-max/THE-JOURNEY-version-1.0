import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, Languages, MapPin, Star } from "lucide-react";
import { SilaIdentityIcon } from "@/components/brand/SilaIcons";
import { getAgentById, getPublishedOffers } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { OfferCard } from "@/components/market/OfferCard";
import { AgentTrustChip, AgentTrustPanel } from "@/components/market/AgentTrust";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const agent = await getAgentById(Number(id));
  if (!agent) return { title: "وكيل غير موجود" };
  return { title: agent.displayName, description: agent.bio.split("\n")[0] };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? "fill-gold text-gold" : "text-outlinev"}`}
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

  return (
    <main className="pb-24">
      <section className="border-b border-outlinev bg-cloud">
        <div className="mx-auto max-w-[1320px] px-5 py-9 md:px-8 md:py-12">
          <nav className="mb-8 flex items-center gap-2 text-[11px] font-semibold text-slate">
            <Link href="/agents" className="hover:text-deep">الوكلاء</Link>
            <span>/</span>
            <span className="text-deep">{agent.latinName}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[180px_1fr] lg:items-start">
            <div className="relative h-44 w-36 overflow-hidden rounded-[1.4rem] border border-outlinev bg-low md:h-52 md:w-44">
              <Image
                src={agent.photoUrl}
                alt={agent.displayName}
                fill
                sizes="176px"
                className="object-cover object-top"
              />
            </div>

            <div>
              <div className="text-[11px] font-bold text-signal">Trust Passport</div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <h1 className="text-4xl font-bold tracking-[-0.04em] text-deep md:text-6xl">
                  {agent.displayName}
                </h1>
                <AgentTrustChip trust={agent.trust} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-slate">
                <span className="font-mono uppercase tracking-[0.1em]">{agent.latinName}</span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-signal" />
                  {agent.city}، {agent.country}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Languages className="h-4 w-4 text-signal" />
                  {agent.languages.join("، ") || "اللغات غير مسجلة"}
                </span>
              </div>

              <p className="mt-6 max-w-[760px] text-[15px] leading-8 text-slate">
                {agent.bio}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1320px] gap-12 px-5 pt-10 md:px-8 lg:grid-cols-[.92fr_1.08fr]">
        <section>
          <div className="sila-eyebrow text-[11px] font-bold">نطاق الثقة</div>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-deep">
            اعرف ما الذي راجعته صلة، وما الذي لا تعنيه المراجعة.
          </h2>

          <div className="trust-passport mt-7">
            <div className="trust-passport__row">
              <div className="text-[11px] font-bold text-slate">الهوية</div>
              <div className="text-sm font-semibold text-deep">مرتبطة بسجل الثقة الحالي للوكيل.</div>
            </div>
            <div className="trust-passport__row">
              <div className="text-[11px] font-bold text-slate">النشاط / الكيان</div>
              <div className="text-sm leading-7 text-slate">
                يظهر ضمن نطاق المراجعة المسجل، ولا يعني ضمان كل خدمة أو كل عرض.
              </div>
            </div>
            <div className="trust-passport__row">
              <div className="text-[11px] font-bold text-slate">آخر مراجعة</div>
              <div className="text-sm font-semibold text-deep">
                {timeAgo(new Date(agent.trust.reviewedAt))}
              </div>
            </div>
            <div className="trust-passport__row">
              <div className="text-[11px] font-bold text-slate">التخصص</div>
              <div className="flex flex-wrap gap-2">
                {agent.specialtyTags.length ? agent.specialtyTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-outlinev bg-low px-3 py-1 text-[11px] font-semibold text-earth">
                    {tag}
                  </span>
                )) : <span className="text-sm text-slate">غير مسجل</span>}
              </div>
            </div>
          </div>

          <AgentTrustPanel trust={agent.trust} className="mt-6" />
        </section>

        <section>
          <div className="sila-eyebrow text-[11px] font-bold">ما ينشره هذا الوكيل</div>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-deep">
            عروض حالية لها ملف قرار.
          </h2>

          {offerCards.length ? (
            <div className="mt-7 space-y-4">
              {offerCards.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
            </div>
          ) : (
            <div className="mt-7 border-y border-outlinev py-9">
              <div className="text-lg font-bold text-deep">لا توجد عروض منشورة حاليًا.</div>
              <p className="mt-2 text-sm leading-7 text-slate">
                لا نستخدم عروضًا تجريبية لملء الملف. أي عرض جديد يظهر بعد دخوله مسار النشر والمراجعة.
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="mx-auto max-w-[1320px] px-5 pt-20 md:px-8">
        <div className="grid gap-8 border-t border-outlinev pt-10 lg:grid-cols-[.65fr_1.35fr]">
          <div>
            <div className="sila-eyebrow text-[11px] font-bold">تجارب مسجلة</div>
            <h2 className="mt-4 text-3xl font-bold text-deep">مراجعات حقيقية إن وُجدت.</h2>
            <p className="mt-3 text-[12px] leading-6 text-slate">
              شارة “تفاعل مؤكّد” تعني وجود تفاعل مسجل في النظام، وليست ضمانًا بأن الرحلة اكتملت أو نجحت.
            </p>
          </div>

          <div>
            {agent.reviews.length === 0 ? (
              <div className="border-y border-outlinev py-8 text-sm text-slate">
                لا توجد مراجعات مسجلة لهذا الوكيل حتى الآن.
              </div>
            ) : (
              <div className="divide-y divide-outlinev border-y border-outlinev">
                {agent.reviews.map((review) => (
                  <article key={review.id} className="py-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Stars rating={review.rating} />
                      {review.isVerifiedTransaction ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-verified">
                          <SilaIdentityIcon className="h-3.5 w-3.5" />
                          تفاعل مسجل
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-4 max-w-3xl text-[15px] leading-8 text-inkwell">“{review.content}”</p>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-slate">
                      <span className="font-bold text-deep">{review.reviewerName}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {timeAgo(review.createdAt)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
