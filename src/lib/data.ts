import { and, desc, eq, gt, isNull, ne, or } from "drizzle-orm";
import type { QueryConfig } from "pg";
import { db, pool } from "@/db";
import { agents, contactRequests, events, offers, reviews } from "@/db/schema";
import type { Agent, ContactRequest, Offer, Review } from "@/db/schema";
import { toPublicAgent, type PublicAgent } from "@/lib/public-agent";
import { loadPublicAgentEvidence } from "@/lib/public-agent-evidence";

export const TRACKABLE_EVENTS = [
  "landing_view",
  "search_submitted",
  "search_filter_changed",
  "search_sort_changed",
  "offer_viewed",
  "offer_shared",
  "agent_viewed",
  "contact_started",
  "contact_submitted",
  "agent_responded",
  "review_submitted",
  "agent_signup_intent",
  "agent_signup_blocked",
  "agent_auth_started",
  "agent_identity_provisioned",
  "readiness_started",
  "readiness_completed",
] as const;
export type EventName = (typeof TRACKABLE_EVENTS)[number] | "capability_observed";

/** Fire-and-forget telemetry — must never break a user flow. */
export async function trackEvent(
  name: EventName,
  refs?: { offerId?: number | null; agentId?: number | null; meta?: string | null },
  queryTimeoutMs?: number,
): Promise<void> {
  try {
    if (queryTimeoutMs !== undefined) {
      const query: QueryConfig & { query_timeout: number } = { text: "INSERT INTO events(name,offer_id,agent_id,meta) VALUES($1,$2,$3,$4)", values: [name, refs?.offerId ?? null, refs?.agentId ?? null, refs?.meta ? refs.meta.slice(0,240) : null], query_timeout: queryTimeoutMs };
      await pool.query(query);
      return;
    }
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

async function attachRatings(
  rows: Agent[],
  observedAt = new Date(),
): Promise<AgentWithRating[]> {
  if (rows.length === 0) return [];
  const [rs, evidence] = await Promise.all([
    db.select().from(reviews).where(eq(reviews.isVisible, true)),
    loadPublicAgentEvidence(rows.map((agent) => agent.id)),
  ]);
  const projected: AgentWithRating[] = [];
  for (const agent of rows) {
    const mine = rs.filter((review) => review.agentId === agent.id);
    const avg = mine.length > 0
      ? mine.reduce((sum, review) => sum + review.rating, 0) / mine.length
      : 0;
    const avgRating = Math.round(avg * 10) / 10;
    try {
      projected.push({
        ...toPublicAgent(
          { ...agent, avgRating, reviewCount: mine.length },
          evidence.get(agent.id) ?? [],
          observedAt,
        ),
        avgRating,
        reviewCount: mine.length,
      });
    } catch {
      // A historical "verified" state without current scoped evidence is not
      // eligible for public discovery.
    }
  }
  return projected;
}

async function publicOffers(
  rows: Array<{ offer: Offer; agent: Agent }>,
  observedAt = new Date(),
): Promise<OfferWithAgent[]> {
  if (rows.length === 0) return [];
  const evidence = await loadPublicAgentEvidence(rows.map((row) => row.agent.id));
  const projected: OfferWithAgent[] = [];
  for (const row of rows) {
    try {
      projected.push({
        ...row.offer,
        agent: toPublicAgent(
          row.agent,
          evidence.get(row.agent.id) ?? [],
          observedAt,
        ),
      });
    } catch {
      // Keep public supply fail-closed if trust evidence is missing or stale.
    }
  }
  return projected;
}

export async function getPublishedOffers(): Promise<OfferWithAgent[]> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(activePublicOfferCondition())
    .orderBy(desc(offers.isFeatured), desc(offers.publishedAt));
  return publicOffers(rows);
}

export async function getFeaturedOffers(): Promise<OfferWithAgent[]> {
  const rows = await db
    .select({ offer: offers, agent: agents })
    .from(offers)
    .innerJoin(agents, eq(offers.agentId, agents.id))
    .where(and(activePublicOfferCondition(), eq(offers.isFeatured, true)))
    .orderBy(desc(offers.contactCount));
  return (await publicOffers(rows)).slice(0, 6);
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
  if (!rows[0]) return null;
  return (await publicOffers([rows[0]]))[0] ?? null;
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
    );
  return (await publicOffers(rows)).slice(0, 3);
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
  if (!withRating) return null;

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
  observedAt: number;
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
    observedAt: Date.now(),
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
  const [publicOffersRows, publicAgents, all, contacts] = await Promise.all([
    getPublishedOffers(),
    getAgentsWithRatings(),
    db.select({ status: offers.status }).from(offers),
    db.select({ id: contactRequests.id }).from(contactRequests),
  ]);
  return {
    published: publicOffersRows.length,
    pending: all.filter((offer) => offer.status === "pending_review").length,
    verifiedAgents: publicAgents.length,
    contactRequests: contacts.length,
  };
}

export type FunnelStep = { name: string; count: number };

export async function getFunnel(): Promise<{
  steps: FunnelStep[];
  contactRatePct: number;
  searchRefinements: { filterChanges: number; sortChanges: number };
  shareCount: number;
  agentActivation: {
    steps: FunnelStep[];
    blocked: number;
    activationRatePct: number;
  };
  readiness: {
    started: number;
    completed: number;
    completionRatePct: number;
    resultCounts: Record<string, number>;
  };
}> {
  const rows = await db.select({ name: events.name, meta: events.meta }).from(events);
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
  const agentActivationOrder: EventName[] = [
    "agent_signup_intent",
    "agent_auth_started",
    "agent_identity_provisioned",
  ];
  const agentActivationSteps = agentActivationOrder.map((name) => ({
    name,
    count: rows.filter((row) => row.name === name).length,
  }));
  const agentSignupIntents = rows.filter((row) => row.name === "agent_signup_intent").length;
  const agentSignupBlocked = rows.filter((row) => row.name === "agent_signup_blocked").length;
  const agentIdentityProvisioned = rows.filter((row) => row.name === "agent_identity_provisioned").length;
  const readinessStarted = rows.filter((row) => row.name === "readiness_started").length;
  const readinessCompletedRows = rows.filter((row) => row.name === "readiness_completed");
  const readinessResultCounts = readinessCompletedRows.reduce<Record<string, number>>(
    (acc, row) => {
      try {
        const parsed = JSON.parse(row.meta ?? "{}") as { status?: unknown };
        const status = typeof parsed.status === "string" ? parsed.status : "UNKNOWN";
        acc[status] = (acc[status] ?? 0) + 1;
      } catch {
        acc.UNKNOWN = (acc.UNKNOWN ?? 0) + 1;
      }
      return acc;
    },
    {},
  );

  return {
    steps,
    contactRatePct: views > 0 ? Math.round((contacts / views) * 1000) / 10 : 0,
    agentActivation: {
      steps: agentActivationSteps,
      blocked: agentSignupBlocked,
      activationRatePct:
        agentSignupIntents > 0
          ? Math.round((agentIdentityProvisioned / agentSignupIntents) * 1000) / 10
          : 0,
    },
    readiness: {
      started: readinessStarted,
      completed: readinessCompletedRows.length,
      completionRatePct:
        readinessStarted > 0
          ? Math.round((readinessCompletedRows.length / readinessStarted) * 1000) / 10
          : 0,
      resultCounts: readinessResultCounts,
    },
    searchRefinements: {
      filterChanges: rows.filter((row) => row.name === "search_filter_changed").length,
      sortChanges: rows.filter((row) => row.name === "search_sort_changed").length,
    },
    shareCount: rows.filter((row) => row.name === "offer_shared").length,
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
  const rows = await getPublishedOffers();
  const map = new Map<string, DestinationInfo>();
  for (const offer of rows) {
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
