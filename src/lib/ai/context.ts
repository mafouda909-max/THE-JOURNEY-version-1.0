/**
 * AI CONTEXT ASSEMBLY BUILDERS (STRICT PRIVACY & CONTEXT MINIMIZATION)
 *
 * Privacy & Safety Doctrine:
 *   - NEVER send provider-specific identifiers (Google sub, Apple sub, Meta app-scoped ID, internal accountId) to LLMs.
 *   - NEVER send raw birth dates, exact ages, emails, phone numbers, private KYC data, or secrets to LLMs.
 *   - Age information is strictly a separate safety/eligibility attribute (e.g. ageBracket, isAdult).
 *   - `isAdult` or age attributes MUST NEVER be used as proof of identity or assurance level.
 */

export interface TravelerContext {
  destinationCountry: string;
  travelerCount: number;
  hasFlexibleDates: boolean;
  travelerPreferences?: string[];
  ageBracket?: "MINOR" | "ADULT_18_24" | "ADULT_25_64" | "SENIOR_65_PLUS";
  isAdult?: boolean;
}

export interface ExternalUserProfilePayload {
  name?: string;
  id?: string;
  age_range?: { min?: number; max?: number };
  birthday?: string; // e.g. "04/15/1995" -> Raw PII (must be scrubbed!)
  email?: string;
  phone?: string;
}

export interface OfferContext {
  id: number;
  title: string;
  tripType: string;
  originCity: string;
  destinationCity: string;
  destinationCountry: string;
  priceAmount: number;
  currency: string;
  priceType: string;
  includes: string[];
  excludes: string[];
  descriptionSummary: string;
}

export interface AgentContext {
  id: number;
  licenseType: string;
  verificationStatus: string;
  responseRate: number;
  totalTrips: number;
}

export interface RiskContext {
  targetType: string;
  targetId: number;
  signalType: string;
  riskScore: number; // 0.0 - 1.0
}

export interface TravelFactContext {
  subject: string;
  attribute: string;
  value: string;
  sourceType: string;
  freshnessStatus: string;
}

export interface CampaignContext {
  name: string;
  objective: string;
  audience: string;
  channel: string;
}

export class AIContextAssembly {
  /**
   * Sanitize raw external identity provider payload into minimal, privacy-safe TravelerContext.
   * Excludes: Provider IDs, account IDs, raw birthdays, email addresses, and phone numbers.
   */
  public static sanitizeExternalProfile(payload: ExternalUserProfilePayload): TravelerContext {
    const ageMin = payload.age_range?.min ?? 18;
    const isAdult = ageMin >= 18;

    let ageBracket: "MINOR" | "ADULT_18_24" | "ADULT_25_64" | "SENIOR_65_PLUS" = "ADULT_25_64";
    if (ageMin < 18) ageBracket = "MINOR";
    else if (ageMin < 25) ageBracket = "ADULT_18_24";

    // Strict Privacy Guarantee: Provider ID, raw birthday, email, phone are COMPLETELY EXCLUDED
    return {
      destinationCountry: "UNKNOWN",
      travelerCount: 1,
      hasFlexibleDates: true,
      ageBracket,
      isAdult,
    };
  }

  public static buildOfferContext(offer: {
    id: number;
    title: string;
    tripType: string;
    originCity: string;
    destinationCity: string;
    destinationCountry: string;
    priceAmount: number;
    currency: string;
    priceType: string;
    includes: string[];
    excludes: string[];
    description: string;
  }): OfferContext {
    return {
      id: offer.id,
      title: offer.title,
      tripType: offer.tripType,
      originCity: offer.originCity,
      destinationCity: offer.destinationCity,
      destinationCountry: offer.destinationCountry,
      priceAmount: offer.priceAmount,
      currency: offer.currency,
      priceType: offer.priceType,
      includes: offer.includes,
      excludes: offer.excludes,
      descriptionSummary: offer.description.slice(0, 300),
    };
  }

  public static buildAgentContext(agent: {
    id: number;
    licenseType: string;
    verificationStatus: string;
    responseRate: number;
    totalTrips: number;
  }): AgentContext {
    return {
      id: agent.id,
      licenseType: agent.licenseType,
      verificationStatus: agent.verificationStatus,
      responseRate: agent.responseRate,
      totalTrips: agent.totalTrips,
    };
  }

  public static buildFactContext(fact: {
    subject: string;
    attribute: string;
    value: string;
    sourceType: string;
    freshnessStatus: string;
  }): TravelFactContext {
    return {
      subject: fact.subject,
      attribute: fact.attribute,
      value: fact.value,
      sourceType: fact.sourceType,
      freshnessStatus: fact.freshnessStatus,
    };
  }
}
