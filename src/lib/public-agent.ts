import type { Agent } from "@/db/schema";

export type PublicAgent = Pick<
  Agent,
  | "id"
  | "displayName"
  | "latinName"
  | "bio"
  | "photoUrl"
  | "city"
  | "country"
  | "licenseType"
  | "specialtyTags"
  | "languages"
  | "responseRate"
  | "avgResponseHours"
  | "totalTrips"
  | "joinedAt"
> & {
  hasLicense: boolean;
  verificationStatus: "verified";
  avgRating?: number;
  reviewCount?: number;
};

type PublicAgentInput = Agent & { avgRating?: number; reviewCount?: number };

/**
 * Explicit public projection for agent data.
 *
 * KYC/license identifiers and internal verification timestamps/statuses are
 * intentionally omitted. Callers must only expose currently verified agents.
 */
export function toPublicAgent(agent: PublicAgentInput): PublicAgent {
  if (agent.verificationStatus !== "verified") {
    throw new Error("Refusing to expose an unverified agent through a public projection");
  }

  return {
    id: agent.id,
    displayName: agent.displayName,
    latinName: agent.latinName,
    bio: agent.bio,
    photoUrl: agent.photoUrl,
    city: agent.city,
    country: agent.country,
    licenseType: agent.licenseType,
    hasLicense: Boolean(agent.licenseNumber),
    verificationStatus: "verified",
    specialtyTags: agent.specialtyTags,
    languages: agent.languages,
    responseRate: agent.responseRate,
    avgResponseHours: agent.avgResponseHours,
    totalTrips: agent.totalTrips,
    joinedAt: agent.joinedAt,
    ...(typeof agent.avgRating === "number" ? { avgRating: agent.avgRating } : {}),
    ...(typeof agent.reviewCount === "number" ? { reviewCount: agent.reviewCount } : {}),
  };
}
