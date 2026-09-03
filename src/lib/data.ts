import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, contactRequests, events, offers, reviews } from "@/db/schema";
import type { Agent, ContactRequest, Offer, Review } from "@/db/schema";

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

export type OfferWithAgent = Offer & { agent: Agent };
export type AgentWithRating = Agent & { avgRating: number; reviewCount: number };
export type ContactWithRefs = ContactRequest & {
  offerTitle: string;
  agentName: string;
};

async function attachRatings(rows: Agent[]): Promise<AgentWithRating[]> {
  if (rows.length === 0) return [];
  const rs = await db
    .select()
    .from(reviews)
    .where(eq(reviews.isVisible, true));
  return rows.map((a) => {
    const mine = rs.filter((r) => r.agentId === a.id);
    const avg =
      mine.length > 0
        ? mine.reduce((s, r) => s + r.rating, 0) / mine.length
        : 0;
    return {
      ...a,
      avgRating: Math.round(avg * 10) / 10,
      reviewCount: mine.length,
    };
  });
}

export async function getPublishedOffers(): Promise<OfferWithAgent[]> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(eq(offers.status, "published"))
    .orderBy(desc(offers.isFeatured), desc(offers.publishedAt));
  return rows.map((r) => ({ ...r.offer, agent: r.agent }));
}

export async function getFeaturedOffers(): Promise<OfferWithAgent[]> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(and(eq(offers.status, "published"), eq(offers.isFeatured, true)))
    .orderBy(desc(offers.contactCount))
    .limit(6);
  return rows.map((r) => ({ ...r.offer, agent: r.agent }));
}

export async function getOfferById(id: number): Promise<OfferWithAgent | null> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(and(eq(offers.id, id), eq(offers.status, "published")))
    .limit(1);
  if (!rows[0]) return null;

  // V1 analytics: every published detail view counts (spec §4.7). Views on
  // unpublished offers are intentionally not counted nor tracked.
  try {
    await db
      .update(offers)
      .set({ viewCount: sql`${offers.viewCount} + 1` })
      .where(eq(offers.id, id));
  } catch {
    /* analytics must never break the page */
  }
  void trackEvent("offer_viewed", { offerId: id, agentId: rows[0].agent.id });

  return { ...rows[0].offer, agent: rows[0].agent };
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
        eq(offers.agentId, agentId),
        eq(offers.status, "published"),
        ne(offers.id, excludeId),
      ),
    )
    .limit(3);
  return rows.map((r) => ({ ...r.offer, agent: r.agent }));
}

export async function getAgentsWithRatings(): Promise<AgentWithRating[]> {
  const rows = await db
    .select()
    .from(agents)
    .where(eq(agents.verificationStatus, "verified"))
    .orderBy(desc(agents.responseRate));
  return attachRatings(rows);
}

export async function getAgentById(
  id: number,
): Promise<
  (AgentWithRating & { offers: Offer[]; reviews: Review[] }) | null
> {
  const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  const agent = rows[0];
  if (!agent) return null;
  const [withRating] = await attachRatings([agent]);

  const agentOffers = await db
    .select()
    .from(offers)
    .where(and(eq(offers.agentId, id), eq(offers.status, "published")))
    .orderBy(desc(offers.isFeatured), desc(offers.publishedAt));

  const agentReviews = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.agentId, id), eq(reviews.isVisible, true)))
    .orderBy(desc(reviews.createdAt));

  void trackEvent("agent_viewed", { agentId: id });
  return { ...withRating, offers: agentOffers, reviews: agentReviews };
}

export async function getReviewQueue(): Promise<{
  pending: OfferWithAgent[];
  rejected: OfferWithAgent[];
}> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(ne(offers.status, "published"))
    .orderBy(desc(offers.createdAt));
  const all = rows.map((r) => ({ ...r.offer, agent: r.agent }));
  return {
    pending: all.filter((o) => o.status === "pending_review"),
    rejected: all.filter((o) => o.status === "rejected"),
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
  return rows.map((r) => ({
    ...r.cr,
    offerTitle: r.offerTitle,
    agentName: r.agentName,
  }));
}

export async function getMarketplaceStats() {
  const all = await db.select({ status: offers.status }).from(offers);
  const agentRows = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.verificationStatus, "verified"));
  const contacts = await db
    .select({ id: contactRequests.id })
    .from(contactRequests);
  return {
    published: all.filter((o) => o.status === "published").length,
    pending: all.filter((o) => o.status === "pending_review").length,
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
    count: rows.filter((r) => r.name === name).length,
  }));
  const views = rows.filter((r) => r.name === "offer_viewed").length;
  const contacts = rows.filter((r) => r.name === "contact_submitted").length;
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
  minPrice: number;
  currency: string;
  image: string;
};

export function slugifyEn(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " ")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getDestinations(): Promise<DestinationInfo[]> {
  const rows = await db
    .select()
    .from(offers)
    .where(eq(offers.status, "published"));
  const map = new Map<string, DestinationInfo>();
  for (const o of rows) {
    const key = o.destinationCountryEn.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        country: o.destinationCountry,
        countryEn: o.destinationCountryEn,
        slug: slugifyEn(o.destinationCountryEn),
        offerCount: 1,
        minPrice: o.priceAmount,
        currency: o.currency,
        image: o.heroImage,
      });
    } else {
      prev.offerCount += 1;
      if (o.priceAmount < prev.minPrice) {
        prev.minPrice = o.priceAmount;
        prev.currency = o.currency;
      }
      if (o.isFeatured) prev.image = o.heroImage;
    }
  }
  return [...map.values()].sort((a, b) => b.offerCount - a.offerCount);
}

export async function getOffersForDestination(slug: string) {
  const all = await getPublishedOffers();
  return all.filter((o) => slugifyEn(o.destinationCountryEn) === slug);
}
