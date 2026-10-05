import type { TravelKnowledge } from "@/db/schema";
import { travelWebProvider, aiProvider } from "@/lib/provider-gateway";
import { groundedVisaDecision, visaFreshness, visaScopeMatches } from "@/lib/travel-visa-grounding";
import { evidenceSourceUrl, evidenceTimestamp, type Evidence } from "@/lib/evidence";
import { readVisaKnowledge } from "@/lib/travel-knowledge-read";

export type SourceType = "AGENT_REPORTED" | "VERIFIED" | "SOURCE_REPORTED" | "AI_INFERRED" | "UNKNOWN";
export type FreshnessStatus = "FRESH" | "AGING" | "STALE" | "EXPIRED" | "UNKNOWN" | "CONFLICTED";
export interface VisaRequirementQuery {
  nationality: string; travelDocument: "passport" | "diplomatic" | "laissez_passer";
  destination: string; transit?: string; purpose?: string; travelDate?: string;
}
export interface VisaRequirementResponse {
  requirements: string[]; visaRequired: boolean | "VERIFICATION_REQUIRED";
  sourceType: SourceType; freshnessStatus: FreshnessStatus; sourceUrl?: string;
  checkedAt: string | null; evaluatedAt: string; evidence: Evidence;
}
export class TravelIntelUnavailable extends Error {
  constructor(public readonly code: "DATA_UNAVAILABLE" | "PROVIDER_UNAVAILABLE" | "TIMEOUT") {
    super(code); this.name = "TravelIntelUnavailable";
  }
}
function rankAuthority(url: string): SourceType {
  // A retrieved URL is a candidate, never verification. Hostname keywords
  // cannot establish that a travel rule is authoritative.
  return evidenceSourceUrl(url) ? "SOURCE_REPORTED" : "UNKNOWN";
}
function payload(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}
function emptyEvidence(): Evidence {
  return {
    kind: "travel_requirement", linkedEntity: null,
    source: { type: "UNKNOWN", label: "لا يوجد مصدر يثبت الحكم", reference: null },
    issuedAt: null, observedAt: null, checkedAt: null, verifiedAt: null, validUntil: null,
    scope: [], status: "UNKNOWN", reviewer: null,
    limitations: ["لا يوجد حكم مؤكد للتأشيرة أو شروط الدخول."],
  };
}
export class TravelIntelService {
  constructor(
    private readonly lookup: (nationality: string, destination: string) => Promise<TravelKnowledge[]> = readVisaKnowledge,
    private readonly web: Pick<typeof travelWebProvider, "isConfigured" | "search"> = travelWebProvider,
    private readonly now: () => number = Date.now,
  ) {}
  public async getVisaRequirements(params: VisaRequirementQuery, signal?: AbortSignal): Promise<VisaRequirementResponse> {
    let rows: TravelKnowledge[];
    try { rows = await this.lookup(params.nationality, params.destination); }
    catch { throw new TravelIntelUnavailable("DATA_UNAVAILABLE"); }
    signal?.throwIfAborted();
    const now = this.now(), evaluatedAt = new Date(now).toISOString();
    const assessments = rows.map(row => {
      const data = payload(row.dataPayload);
      const freshness = visaFreshness(row.checkedAt, row.validUntil, row.freshnessStatus, now) as FreshnessStatus;
      const reference = evidenceSourceUrl(row.sourceUrl);
      const scoped = row.country === params.nationality && row.destinationCountry === params.destination && visaScopeMatches(data.scope, params);
      const decision = scoped ? groundedVisaDecision({
        visaRequired: data.visaRequired, sourceType: row.sourceType, freshnessStatus: row.freshnessStatus,
        decisionBasis: data.decisionBasis, checkedAt: row.checkedAt, validUntil: row.validUntil,
        sourceUrl: row.sourceUrl, scope: data.scope, query: params, now,
      }) : null;
      const scope = data.scope && typeof data.scope === "object" ? data.scope as Record<string, unknown> : {};
      const verified = evidenceTimestamp(data.verifiedAt);
      const evidence: Evidence = {
        kind: "travel_requirement", linkedEntity: { type: "travel_knowledge", id: String(row.id) },
        source: { type: row.sourceType, label: typeof data.sourceName === "string" ? data.sourceName.slice(0,180) : "مصدر سجل متطلبات السفر", reference },
        issuedAt: evidenceTimestamp(data.issuedAt), observedAt: evidenceTimestamp(row.retrievedAt), checkedAt: evidenceTimestamp(row.checkedAt),
        verifiedAt: verified && Date.parse(verified) <= now ? verified : null, validUntil: evidenceTimestamp(row.validUntil), reviewer: null,
        scope: [
          "التأشيرة المسبقة فقط", "الجنسية: " + row.country, "الوجهة: " + (row.destinationCountry ?? "غير محددة"),
          "وثيقة السفر: " + (typeof scope.travelDocument === "string" ? scope.travelDocument : "غير محددة"),
          "الغرض: " + (typeof scope.purpose === "string" ? scope.purpose : "غير محدد"),
          "فترة التطبيق: " + (scope.travelDates === "any" ? "غير مقيدة في السجل" : "يجب أن تطابق تاريخ الرحلة"),
        ],
        status: decision !== null ? "VERIFIED" : freshness === "EXPIRED" ? "EXPIRED" : freshness === "STALE" ? "STALE" : freshness === "CONFLICTED" ? "CONFLICTED" : "UNCONFIRMED",
        limitations: [
          "لا يشمل صلاحية الجواز أو الترانزيت أو التوافر أو قرار السماح بالدخول.",
          "القواعد قد تتغير قبل موعد الرحلة؛ أعد تأكيدها قبل الحجز والسفر.",
          ...(!scoped ? ["نطاق السجل لا يثبت انطباق الحكم على وثيقة السفر والغرض والتاريخ المدخل."] : []),
          ...(decision === null ? ["لا يكفي هذا السجل لإصدار حكم قطعي."] : []),
        ],
      };
      return { row, data, freshness, decision, evidence };
    });
    const grounded = assessments.filter(item => item.decision !== null);
    const conflicting = new Set(grounded.map(item => item.decision)).size > 1 ||
      assessments.some(item => item.freshness === "CONFLICTED" && (!item.data.scope || visaScopeMatches(item.data.scope, params)));
    const selected = grounded[0] ?? assessments[0];
    if (selected) {
      const evidence = selected.evidence;
      if (conflicting) evidence.status = "CONFLICTED";
      if (rows.length > 50) {
        evidence.status = "UNCONFIRMED";
        evidence.limitations.push("عدد المصادر يتجاوز حد المقارنة الآمنة؛ يلزم مراجعة التعارضات.");
      }
      return {
        requirements: Array.isArray(selected.data.requirements) ? selected.data.requirements.filter((value): value is string => typeof value === "string").slice(0,20) : [],
        visaRequired: conflicting || rows.length > 50 || selected.decision === null ? "VERIFICATION_REQUIRED" : selected.decision,
        sourceType: (["VERIFIED","SOURCE_REPORTED","AGENT_REPORTED","AI_INFERRED"].includes(selected.row.sourceType) ? selected.row.sourceType : "UNKNOWN") as SourceType,
        freshnessStatus: conflicting ? "CONFLICTED" : selected.freshness,
        ...(evidence.source.reference ? { sourceUrl: evidence.source.reference } : {}), checkedAt: evidence.checkedAt, evaluatedAt, evidence,
      };
    }
    const evidence = emptyEvidence();
    if (this.web.isConfigured()) {
      let results: Awaited<ReturnType<typeof travelWebProvider.search>>;
      try {
        results = await this.web.search("visa requirements for " + params.nationality + " citizens traveling to " + params.destination, { maxResults: 3 }, signal);
      } catch { throw new TravelIntelUnavailable(signal?.aborted ? "TIMEOUT" : "PROVIDER_UNAVAILABLE"); }
      const candidate = results.results.find(item => evidenceSourceUrl(item.url));
      if (candidate) {
        evidence.source = { type: "SOURCE_REPORTED", label: "مصدر مرشح للمراجعة، لم يثبت الحكم", reference: evidenceSourceUrl(candidate.url) };
        evidence.observedAt = evidenceTimestamp(results.retrievedAt); evidence.status = "UNCONFIRMED";
      }
    }
    return {
      requirements: ["لا توجد أدلة منظمة كافية للحكم. راجع الجهة الرسمية المختصة."],
      visaRequired: "VERIFICATION_REQUIRED", sourceType: evidence.source.type as SourceType, freshnessStatus: "UNKNOWN",
      ...(evidence.source.reference ? { sourceUrl: evidence.source.reference } : {}), checkedAt: null, evaluatedAt, evidence,
    };
  }

  /**
   * General Travel Intelligence query.
   */
  public async queryTravelIntel(question: string) {
    const checkedAt = new Date().toISOString();

    if (!travelWebProvider.isConfigured()) {
      return {
        question,
        answer:
          "الخدمة تتطلب تفعيل مزوّد البحث المباشر (Tavily). يُنصح بمراجعة الجهة الرسمية المناسبة مباشرة.",
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
    } catch {
      return {
        question,
        answer: "تعذر استرجاع البيانات المباشرة حالياً. يُرجى الرجوع للمصدر الرسمي المناسب.",
        confidence: "LOW",
        provenance: [],
        checkedAt,
      };
    }
  }
}

export const travelIntelService = new TravelIntelService();
