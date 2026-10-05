import type { Agent } from "@/db/schema";

export type PublicAgentTrustClaimKind = "identity" | "activity" | "entity";

export type PublicAgentTrustClaim = {
  kind: PublicAgentTrustClaimKind;
  label: string;
  scope: string;
  verifiedAt: string;
  validUntil: string | null;
};

export type PublicAgentTrust = {
  status: "reviewed";
  claims: PublicAgentTrustClaim[];
  reviewedAt: string;
  validUntil: string | null;
  limitations: string[];
};

export type PublicAgentEvidence = {
  agentId: number;
  documentType: string;
  status: string;
  verifiedAt: Date | null;
  expiresAt: Date | null;
};

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
  /** Compatibility state only. Public UI must explain the scoped trust claims below. */
  verificationStatus: "verified";
  trust: PublicAgentTrust;
  avgRating?: number;
  reviewCount?: number;
  /** Explicitly forbidden on public projections. */
  licenseNumber?: never;
  verifiedAt?: never;
};

type PublicAgentInput = Agent & { avgRating?: number; reviewCount?: number };

type TrustEvaluation = {
  eligible: boolean;
  trust: PublicAgentTrust | null;
};

const CLAIMS: Record<
  "identity" | "license" | "commercial_register",
  Pick<PublicAgentTrustClaim, "kind" | "label" | "scope">
> = {
  identity: {
    kind: "identity",
    label: "هوية مُراجَعة",
    scope: "راجع فريق الثقة إثبات هوية رسميًا صالحًا لصاحب الحساب.",
  },
  license: {
    kind: "activity",
    label: "نشاط مهني مُراجع",
    scope: "راجع فريق الثقة مستندًا مهنيًا أو ترخيصًا يثبت نطاق النشاط السياحي المقدم.",
  },
  commercial_register: {
    kind: "entity",
    label: "كيان مُراجع",
    scope: "راجع فريق الثقة مستند الكيان أو السجل التجاري المرتبط ببيانات الوكالة.",
  },
};

function currentEvidence(
  evidence: PublicAgentEvidence[],
  agentId: number,
  documentType: keyof typeof CLAIMS,
  observedAt: Date,
): PublicAgentEvidence | null {
  return evidence
    .filter(
      (item) =>
        item.agentId === agentId &&
        item.documentType === documentType &&
        item.status === "verified" &&
        item.verifiedAt instanceof Date &&
        Number.isFinite(item.verifiedAt.getTime()) &&
        (!item.expiresAt || item.expiresAt.getTime() > observedAt.getTime()),
    )
    .sort(
      (a, b) =>
        (b.verifiedAt?.getTime() ?? 0) - (a.verifiedAt?.getTime() ?? 0),
    )[0] ?? null;
}

/**
 * Converts private verification evidence into the smallest public-safe trust
 * summary. Document identifiers, filenames, storage keys and license numbers
 * never cross this boundary.
 */
export function evaluatePublicAgentTrust(
  agent: PublicAgentInput,
  evidence: PublicAgentEvidence[],
  observedAt = new Date(),
): TrustEvaluation {
  if (agent.verificationStatus !== "verified") {
    return { eligible: false, trust: null };
  }

  const required: Array<keyof typeof CLAIMS> =
    agent.licenseType === "agency"
      ? ["identity", "license", "commercial_register"]
      : ["identity", "license"];

  const claims = required
    .map((documentType) => {
      const item = currentEvidence(evidence, agent.id, documentType, observedAt);
      if (!item?.verifiedAt) return null;
      return {
        ...CLAIMS[documentType],
        verifiedAt: item.verifiedAt.toISOString(),
        validUntil: item.expiresAt?.toISOString() ?? null,
      } satisfies PublicAgentTrustClaim;
    })
    .filter((claim): claim is PublicAgentTrustClaim => claim !== null);

  if (claims.length !== required.length) {
    return { eligible: false, trust: null };
  }

  const reviewedAt = claims
    .map((claim) => new Date(claim.verifiedAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  if (!reviewedAt) return { eligible: false, trust: null };

  const expiryTimes = claims
    .map((claim) => (claim.validUntil ? new Date(claim.validUntil).getTime() : null))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    eligible: true,
    trust: {
      status: "reviewed",
      claims,
      reviewedAt: new Date(reviewedAt).toISOString(),
      validUntil:
        expiryTimes.length > 0
          ? new Date(Math.min(...expiryTimes)).toISOString()
          : null,
      limitations: [
        "المراجعة تخص الهوية والنشاط والكيان وفق الأدلة الظاهرة هنا، ولا تعني اعتماد كل سعر أو فندق أو معلومة سفر.",
        "التوثيق لا يضمن نتيجة الرحلة أو الدفع أو تنفيذ الخدمة؛ راجع نطاق كل عرض قبل القرار.",
      ],
    },
  };
}

/**
 * Explicit public projection for agent data.
 *
 * A verified database state alone is not enough. Public exposure also requires
 * current, reviewed evidence for every trust-critical scope required by the
 * agent type.
 */
export function toPublicAgent(
  agent: PublicAgentInput,
  evidence: PublicAgentEvidence[],
  observedAt = new Date(),
): PublicAgent {
  const evaluated = evaluatePublicAgentTrust(agent, evidence, observedAt);
  if (!evaluated.eligible || !evaluated.trust) {
    throw new Error("Refusing to expose an agent without current scoped trust evidence");
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
    verificationStatus: "verified",
    trust: evaluated.trust,
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
