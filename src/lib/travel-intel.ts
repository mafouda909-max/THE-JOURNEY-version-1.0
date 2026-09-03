import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { travelKnowledge } from "@/db/schema";
import { travelWebProvider } from "@/lib/providers/web";
import { aiProvider } from "@/lib/providers/ai";

/**
 * SOURCE-BACKED TRAVEL INTELLIGENCE ENGINE
 *
 * Doctrine: Dynamic travel facts (visas, transit rules, passport validity) must be
 * backed by verified sources and track explicit provenance and freshness.
 * AI memory is never the sole source of truth for regulations.
 */

export type SourceType = "AGENT_REPORTED" | "VERIFIED" | "SOURCE_REPORTED" | "AI_INFERRED";
export type FreshnessStatus = "FRESH" | "AGING" | "STALE" | "EXPIRED" | "UNKNOWN" | "CONFLICTED";

export interface VisaRequirementQuery {
  nationality: string;
  travelDocument: "passport" | "diplomatic" | "laissez_passer";
  destination: string;
  transit?: string;
  purpose?: string;
}

export interface VisaRequirementResponse {
  requirements: string[];
  visaRequired: boolean | "VERIFICATION_REQUIRED";
  sourceType: SourceType;
  freshnessStatus: FreshnessStatus;
  sourceUrl?: string;
  checkedAt: string;
}

function rankAuthority(url: string): SourceType {
  const lower = url.toLowerCase();
  if (lower.includes(".gov.") || lower.includes(".gov") || lower.includes("mofa") || lower.includes("embassy") || lower.includes("visa.sa")) {
    return "VERIFIED";
  }
  if (lower.includes("saudia.com") || lower.includes("emirates.com") || lower.includes("iata")) {
    return "SOURCE_REPORTED";
  }
  return "AI_INFERRED";
}

export class TravelIntelService {
  /**
   * Source-backed Visa & Entry Requirement query.
   */
  public async getVisaRequirements(
    params: VisaRequirementQuery,
  ): Promise<VisaRequirementResponse> {
    const checkedAt = new Date().toISOString();

    // Step 1: Query Knowledge DB for verified source contract
    const existing = await db
      .select()
      .from(travelKnowledge)
      .where(
        and(
          eq(travelKnowledge.category, "visa"),
          eq(travelKnowledge.country, params.nationality),
          eq(travelKnowledge.destinationCountry, params.destination),
        ),
      )
      .limit(1);

    if (existing[0] && existing[0].freshnessStatus === "FRESH") {
      const payload = JSON.parse(existing[0].dataPayload);
      return {
        requirements: payload.requirements || [],
        visaRequired: payload.visaRequired,
        sourceType: existing[0].sourceType as SourceType,
        freshnessStatus: existing[0].freshnessStatus as FreshnessStatus,
        sourceUrl: existing[0].sourceUrl || undefined,
        checkedAt,
      };
    }

    // Step 2: Web Search for verified official sources
    if (!travelWebProvider.isConfigured()) {
      return {
        requirements: ["الرجاء مراجعة القنصلية الرسمية للتحقق من متطلبات الفيزا."],
        visaRequired: "VERIFICATION_REQUIRED",
        sourceType: "AGENT_REPORTED",
        freshnessStatus: "UNKNOWN",
        checkedAt,
      };
    }

    try {
      const searchRes = await travelWebProvider.search(
        `visa requirements for ${params.nationality} citizens traveling to ${params.destination}`,
        { maxResults: 3 },
      );

      if (searchRes.results.length === 0) {
        return {
          requirements: ["لم يتم العثور على مصدر رسمي مؤكد."],
          visaRequired: "VERIFICATION_REQUIRED",
          sourceType: "UNKNOWN" as any,
          freshnessStatus: "UNKNOWN",
          checkedAt,
        };
      }

      const topSource = searchRes.results[0];
      const sourceType = rankAuthority(topSource.url);

      // Persist knowledge entry
      await db.insert(travelKnowledge).values({
        category: "visa",
        country: params.nationality,
        destinationCountry: params.destination,
        dataPayload: JSON.stringify({
          visaRequired: true,
          requirements: [topSource.content.slice(0, 300)],
        }),
        sourceType,
        freshnessStatus: "FRESH",
        sourceUrl: topSource.url,
      });

      return {
        requirements: [topSource.content.slice(0, 300)],
        visaRequired: true,
        sourceType,
        freshnessStatus: "FRESH",
        sourceUrl: topSource.url,
        checkedAt,
      };
    } catch {
      return {
        requirements: ["تعذر التحقق من المصدر الخارجي حالياً."],
        visaRequired: "VERIFICATION_REQUIRED",
        sourceType: "AGENT_REPORTED",
        freshnessStatus: "UNKNOWN",
        checkedAt,
      };
    }
  }

  /**
   * General Travel Intelligence query.
   */
  public async queryTravelIntel(question: string) {
    const checkedAt = new Date().toISOString();

    if (!travelWebProvider.isConfigured()) {
      return {
        question,
        answer: "الخدمة تتطلب تفعيل مزوّد البحث المباشر (Tavily). يُنصح بمراجعة القنصلية الرسمية مباشرة.",
        confidence: "LOW",
        provenance: [],
        checkedAt,
      };
    }

    try {
      const searchRes = await travelWebProvider.search(question, { maxResults: 5 });
      const formattedContext = travelWebProvider.formatAsUntrustedContext(searchRes);

      const aiSynthesis = await aiProvider.synthesizeTravelIntel({
        question,
        untrustedWebContext: formattedContext,
      });

      return {
        question,
        answer: aiSynthesis.answer,
        confidence: aiSynthesis.confidence,
        provenance: searchRes.results.map((r) => ({
          title: r.title,
          url: r.url,
          sourceType: rankAuthority(r.url),
        })),
        checkedAt,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Travel research error";
      return {
        question,
        answer: `تعذر استرجاع البيانات المباشرة حالياً (${errorMsg}). يُرجى الرجوع للمصادر الحكومية الرسمية.`,
        confidence: "LOW",
        provenance: [],
        checkedAt,
      };
    }
  }
}

export const travelIntelService = new TravelIntelService();
