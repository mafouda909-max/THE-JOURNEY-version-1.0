import { and, desc, eq, gt, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { agents, contactRequests, events, offers, reviews } from "@/db/schema";
import type { Agent, ContactRequest, Offer, Review } from "@/db/schema";
import { toPublicAgent, type PublicAgent } from "@/lib/public-agent";

export const TRACKABLE_EVENTS = [
  "landing_view",
  "search_submitted",
  "offer_viewed",
  "agent_viewed",
  "contact_started",
  "contact_submitted",
  "agent_responded",
  "review_submitted",
] as const;
export type EventName = (typeof TRACKABLE_EVENTS)[number];

/** Fire-and-forget telemetry — must never break a user flow. */
export async function trackEvent(
  name: EventName,
  refs?: { offerId?: number | null; agentId?: number | null; meta?: string | null },
): Promise<void> {
  try {
    await db.insert(events).values({
      name,
      offerId: refs?.offerId ?? null,
      agentId: refs?.agentId ?? null,
      meta: refs?.meta ? refs.meta.slice(0, 240) : null,
    });
  } catch {
    /* telemetry is not a request-blocking concern */
  }
}

export type OfferWithAgent = Offer & { agent: PublicAgent };
export type AdminOfferWithAgent = Offer & { agent: Agent };
export type AgentWithRating = PublicAgent & { avgRating: number; reviewCount: number };
export type ContactWithRefs = ContactRequest & {
  offerTitle: string;
  agentName: string;
};

function activePublicOfferCondition(now = new Date()) {
  return and(
    eq(offers.status, "published"),
    eq(agents.verificationStatus, "verified"),
    or(isNull(offers.expiresAt), gt(offers.expiresAt, now)),
  );
}

function activeOfferForVerifiedAgentCondition(agentId: number, now = new Date()) {
  return and(
    eq(offers.agentId, agentId),
    eq(offers.status, "published"),
    or(isNull(offers.expiresAt), gt(offers.expiresAt, now)),
  );
}

async function attachRatings(rows: Agent[]): Promise<AgentWithRating[]> {
  if (rows.length === 0) return [];
  const rs = await db
    .select()
    .from(reviews)
    .where(eq(reviews.isVisible, true));
  return rows.map((agent) => {
    const mine = rs.filter((review) => review.agentId === agent.id);
    const avg = mine.length > 0
      ? mine.reduce((sum, review) => sum + review.rating, 0) / mine.length
      : 0;
    const avgRating = Math.round(avg * 10) / 10;
    return {
      ...toPublicAgent({ ...agent, avgRating, reviewCount: mine.length }),
      avgRating,
      reviewCount: mine.length,
    };
  });
}

function publicOffer(row: { offer: Offer; agent: Agent }): OfferWithAgent {
  return { ...row.offer, agent: toPublicAgent(row.agent) };
}

export async function getPublishedOffers(): Promise<OfferWithAgent[]> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(activePublicOfferCondition())
    .orderBy(desc(offers.isFeatured), desc(offers.publishedAt));
  return rows.map(publicOffer);
}

export async function getFeaturedOffers(): Promise<OfferWithAgent[]> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(and(activePublicOfferCondition(), eq(offers.isFeatured, true)))
    .orderBy(desc(offers.contactCount))
    .limit(6);
  return rows.map(publicOffer);
}

/** Pure public read. View analytics are recorded only by the client visibility beacon. */
export async function getOfferById(id: number): Promise<OfferWithAgent | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(and(eq(offers.id, id), activePublicOfferCondition()))
    .limit(1);
  return rows[0] ? publicOffer(rows[0]) : null;
}

export async function getOtherOffersByAgent(
  agentId: number,
  excludeId: number,
): Promise<OfferWithAgent[]> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(
      and(
        activePublicOfferCondition(),
        eq(offers.agentId, agentId),
        ne(offers.id, excludeId),
      ),
    )
    .limit(3);
  return rows.map(publicOffer);
}

export async function getAgentsWithRatings(): Promise<AgentWithRating[]> {
  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.verificationStatus, "verified"))
    .orderBy(desc(agents.responseRate));
  return attachRatings(rows);
}

/** Pure public read. KYC identifiers and internal verification timestamps never leave this boundary. */
export async function getAgentById(
  id: number,
): Promise<(AgentWithRating & { offers: Offer[]; reviews: Review[] }) | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const rows = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.verificationStatus, "verified")))
    .limit(1);
  const agent = rows[0];
  if (!agent) return null;
  const [withRating] = await attachRatings([agent]);

  const agentOffers = await db
    .select()
    .from(offers)
    .where(activeOfferForVerifiedAgentCondition(id))
    .orderBy(desc(offers.isFeatured), desc(offers.publishedAt));

  const agentReviews = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.agentId, id), eq(reviews.isVisible, true)))
    .orderBy(desc(reviews.createdAt));

  return { ...withRating, offers: agentOffers, reviews: agentReviews };
}

export async function getReviewQueue(): Promise<{
  pending: AdminOfferWithAgent[];
  rejected: AdminOfferWithAgent[];
}> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(ne(offers.status, "published"))
    .orderBy(desc(offers.createdAt));
  const all = rows.map((row) => ({ ...row.offer, agent: row.agent }));
  return {
    pending: all.filter((offer) => offer.status === "pending_review"),
    rejected: all.filter((offer) => offer.status === "rejected"),
  };
}

export async function getRecentContactRequests(
  limit = 10,
): Promise<ContactWithRefs[]> {
  const rows = await db
    .select({
      cr: contactRequests,
      offerTitle: offers.title,
      agentName: agents.displayName,
    })
    .from(contactRequests)
    .innerJoin(offers, eq(contactRequests.offerId, offers.id))
    .innerJoin(agents, eq(contactRequests.agentId, agents.id))
    .orderBy(desc(contactRequests.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    ...row.cr,
    offerTitle: row.offerTitle,
    agentName: row.agentName,
  }));
}

export async function getMarketplaceStats() {
  const all = await db.select({ status: offers.status }).from(offers);
  const agentRows = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.verificationStatus, "verified"));
  const contacts = await db.select({ id: contactRequests.id }).from(contactRequests);
  return {
    published: all.filter((offer) => offer.status === "published").length,
    pending: all.filter((offer) => offer.status === "pending_review").length,
    verifiedAgents: agentRows.length,
    contactRequests: contacts.length,
  };
}

export type FunnelStep = { name: string; count: number };

export async function getFunnel(): Promise<{
  steps: FunnelStep[];
  contactRatePct: number;
}> {
  const rows = await db.select({ name: events.name }).from(events);
  const order: EventName[] = [
    "landing_view",
    "search_submitted",
    "offer_viewed",
    "agent_viewed",
    "contact_started",
    "contact_submitted",
  ];
  const steps = order.map((name) => ({
    name,
    count: rows.filter((row) => row.name === name).length,
  }));
  const views = rows.filter((row) => row.name === "offer_viewed").length;
  const contacts = rows.filter((row) => row.name === "contact_submitted").length;
  return {
    steps,
    contactRatePct: views > 0 ? Math.round((contacts / views) * 1000) / 10 : 0,
  };
}

export type DestinationInfo = {
  country: string;
  countryEn: string;
  slug: string;
  offerCount: number;
  currencies: string[];
  image: string;
};

export function slugifyEn(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " ")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getDestinations(): Promise<DestinationInfo[]> {
  const rows = await db
    .select({ offer: offers })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(activePublicOfferCondition());
  const map = new Map<string, DestinationInfo>();
  for (const row of rows) {
    const offer = row.offer;
    const key = offer.destinationCountryEn.toLowerCase();
    const previous = map.get(key);
    if (!previous) {
      map.set(key, {
        country: offer.destinationCountry,
        countryEn: offer.destinationCountryEn,
        slug: slugifyEn(offer.destinationCountryEn),
        offerCount: 1,
        currencies: [offer.currency],
        image: offer.heroImage,
      });
    } else {
      previous.offerCount += 1;
      if (!previous.currencies.includes(offer.currency)) previous.currencies.push(offer.currency);
      if (offer.isFeatured) previous.image = offer.heroImage;
    }
  }
  return [...map.values()].sort((a, b) => b.offerCount - a.offerCount);
}

export async function getOffersForDestination(slug: string) {
  const all = await getPublishedOffers();
  return all.filter((offer) => slugifyEn(offer.destinationCountryEn) === slug);
}
