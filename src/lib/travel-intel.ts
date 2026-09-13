import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { travelKnowledge } from "@/db/schema";
import { travelWebProvider } from "@/lib/providers/web";
import { aiProvider } from "@/lib/providers/ai";

/**
 * SOURCE-BACKED TRAVEL INTELLIGENCE ENGINE
 *
 * Dynamic travel facts must be backed by explicit evidence. Generic search
 * results are useful discovery inputs, but they are never converted into a
 * visa/no-visa determination by inference alone.
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

function parseStructuredVisaPayload(raw: string): { visaRequired: boolean; requirements: string[] } | null {
  try {
    const payload = JSON.parse(raw) as {
      schemaVersion?: unknown;
      determinationMethod?: unknown;
      visaRequired?: unknown;
      requirements?: unknown;
    };
    if (payload.schemaVersion !== 2 || payload.determinationMethod !== "structured_evidence") return null;
    if (typeof payload.visaRequired !== "boolean") return null;
    const requirements = Array.isArray(payload.requirements)
      ? payload.requirements.filter((item): item is string => typeof item === "string").slice(0, 20)
      : [];
    return { visaRequired: payload.visaRequired, requirements };
  } catch {
    return null;
  }
}

export class TravelIntelService {
  public async getVisaRequirements(params: VisaRequirementQuery): Promise<VisaRequirementResponse> {
    const checkedAt = new Date().toISOString();

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

    const cached = existing[0];
    const structured = cached ? parseStructuredVisaPayload(cached.dataPayload) : null;
    if (
      cached &&
      structured &&
      cached.freshnessStatus === "FRESH" &&
      (cached.sourceType === "VERIFIED" || cached.sourceType === "SOURCE_REPORTED")
    ) {
      return {
        requirements: structured.requirements,
        visaRequired: structured.visaRequired,
        sourceType: cached.sourceType as SourceType,
        freshnessStatus: "FRESH",
        sourceUrl: cached.sourceUrl || undefined,
        checkedAt,
      };
    }

    if (!travelWebProvider.isConfigured()) {
      return {
        requirements: ["راجع الجهة الحكومية أو القنصلية الرسمية لمتطلبات الدخول الخاصة بجنسيتك ووثيقة سفرك."],
        visaRequired: "VERIFICATION_REQUIRED",
        sourceType: "AI_INFERRED",
        freshnessStatus: "UNKNOWN",
        checkedAt,
      };
    }

    try {
      const searchRes = await travelWebProvider.search(
        `official visa requirements ${params.nationality} passport ${params.destination}`,
        { maxResults: 5 },
      );

      const authoritative = searchRes.results
        .map((result) => ({ result, sourceType: rankAuthority(result.url) }))
        .find(({ sourceType }) => sourceType === "VERIFIED" || sourceType === "SOURCE_REPORTED");

      if (!authoritative) {
        return {
          requirements: ["لم يعثر البحث الحالي على مصدر رسمي/ناقل موثوق يمكن الاعتماد عليه للحكم."],
          visaRequired: "VERIFICATION_REQUIRED",
          sourceType: "AI_INFERRED",
          freshnessStatus: "UNKNOWN",
          checkedAt,
        };
      }

      return {
        requirements: [
          authoritative.result.content.slice(0, 500),
          "هذا مقتطف مصدر للمراجعة، وليس حكمًا آليًا بأن التأشيرة مطلوبة أو غير مطلوبة.",
        ],
        visaRequired: "VERIFICATION_REQUIRED",
        sourceType: authoritative.sourceType,
        freshnessStatus: "FRESH",
        sourceUrl: authoritative.result.url,
        checkedAt,
      };
    } catch {
      return {
        requirements: ["تعذر الوصول إلى مصدر خارجي موثوق حاليًا. راجع الجهة الرسمية مباشرة."],
        visaRequired: "VERIFICATION_REQUIRED",
        sourceType: "AI_INFERRED",
        freshnessStatus: "UNKNOWN",
        checkedAt,
      };
    }
  }

  public async queryTravelIntel(question: string) {
    const checkedAt = new Date().toISOString();

    if (!travelWebProvider.isConfigured()) {
      return {
        question,
        answer: "البحث المباشر غير مفعّل حاليًا. للأسئلة التنظيمية الحساسة راجع المصدر الحكومي/القنصلي الرسمي.",
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
        provenance: searchRes.results.map((result) => ({
          title: result.title,
          url: result.url,
          sourceType: rankAuthority(result.url),
        })),
        checkedAt,
      };
    } catch {
      return {
        question,
        answer: "تعذر استرجاع البيانات المباشرة حاليًا. للأسئلة الحساسة يُرجى الرجوع للمصادر الحكومية الرسمية.",
        confidence: "LOW",
        provenance: [],
        checkedAt,
      };
    }
  }
}

export const travelIntelService = new TravelIntelService();
