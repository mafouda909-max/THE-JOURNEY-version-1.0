import { travelIntelService, SourceType, FreshnessStatus } from "@/lib/travel-intel";

/**
 * TRAVEL READINESS ENGINE & DYNAMIC CHECKLIST
 *
 * Evaluates travel readiness based on traveler nationality, passport validity,
 * destination, transit points, and selected offer.
 *
 * Statuses:
 *   - READY: All mandatory conditions met and verified by authoritative sources.
 *   - NEEDS_ATTENTION: Minor requirements missing (e.g. passport validity < 6 months or visa required).
 *   - BLOCKED: Critical block (e.g. expired passport, travel advisory ban, missing mandatory visa).
 *   - UNKNOWN: Authoritative data unavailable (requires explicit manual verification).
 */

export type ReadinessStatus = "READY" | "NEEDS_ATTENTION" | "BLOCKED" | "UNKNOWN";

export interface TravelReadinessInput {
  nationality: string;
  passportValidityMonths?: number;
  destination: string;
  transitCountry?: string;
  travelPurpose?: string;
  travelDate?: string;
}

export interface DynamicChecklistItem {
  id: string;
  title: string;
  category: "PASSPORT" | "VISA" | "TRANSIT" | "HEALTH" | "DOCUMENT";
  isMandatory: boolean;
  status: "VERIFIED" | "PENDING_ACTION" | "BLOCKED";
  description: string;
}

export interface TravelReadinessResult {
  status: ReadinessStatus;
  overallScore: number; // 0 - 100
  checklist: DynamicChecklistItem[];
  warnings: string[];
  missingInformation: string[];
  evaluatedAt: string;
}

export class TravelReadinessEngine {
  public async evaluateReadiness(input: TravelReadinessInput): Promise<TravelReadinessResult> {
    const evaluatedAt = new Date().toISOString();
    const warnings: string[] = [];
    const missing: string[] = [];
    const checklist: DynamicChecklistItem[] = [];

    let status: ReadinessStatus = "READY";
    let score = 100;

    // Check 1: Nationality & Passport Validity
    if (!input.nationality) {
      missing.push("الجنسية الحالية للمسافر");
    }

    if (input.passportValidityMonths !== undefined) {
      if (input.passportValidityMonths < 3) {
        status = "BLOCKED";
        score -= 50;
        warnings.push("صلاحية الجواز أقل من 3 أشهر — معظم الوجهات تمنع الدخول بحد أدنى 6 أشهر.");
        checklist.push({
          id: "passport_validity",
          title: "تجديد جواز السفر",
          category: "PASSPORT",
          isMandatory: true,
          status: "BLOCKED",
          description: "يلزم تجديد جواز السفر قبل حجز رحلة دولية.",
        });
      } else if (input.passportValidityMonths < 6) {
        status = "NEEDS_ATTENTION";
        score -= 20;
        warnings.push("صلاحية الجواز أقل من 6 أشهر — يفضل التجديد قبل السفر لتفادي الرفض.");
        checklist.push({
          id: "passport_validity",
          title: "مراجعة صلاحية الجواز",
          category: "PASSPORT",
          isMandatory: true,
          status: "PENDING_ACTION",
          description: "صلاحية الجواز تقترب من الحد الأدنى المقبول دولياً.",
        });
      } else {
        checklist.push({
          id: "passport_validity",
          title: "جواز السفر ساري المفعول",
          category: "PASSPORT",
          isMandatory: true,
          status: "VERIFIED",
          description: "صلاحية الجواز تتجاوز 6 أشهر من تاريخ السفر.",
        });
      }
    } else {
      missing.push("مدة صلاحية الجواز بالأشهر");
    }

    // Check 2: Destination & Visa Requirements via TravelIntelService
    if (input.nationality && input.destination) {
      const visaRes = await travelIntelService.getVisaRequirements({
        nationality: input.nationality,
        travelDocument: "passport",
        destination: input.destination,
        transit: input.transitCountry,
      });

      if (visaRes.visaRequired === true) {
        if (status === "READY") status = "NEEDS_ATTENTION";
        score -= 15;
        checklist.push({
          id: "visa_requirement",
          title: `استخراج تأشيرة دخول إلى ${input.destination}`,
          category: "VISA",
          isMandatory: true,
          status: "PENDING_ACTION",
          description: `يتطلب دخول ${input.destination} الحصول على تأشيرة مسبقة لمواطني ${input.nationality}.`,
        });
      } else if (visaRes.visaRequired === false) {
        checklist.push({
          id: "visa_requirement",
          title: `إعفاء من التأشيرة أو تأشيرة عند الوصول لـ ${input.destination}`,
          category: "VISA",
          isMandatory: false,
          status: "VERIFIED",
          description: "لا تتطلب هذه الوجهة تأشيرة مسبقة للمسافرين.",
        });
      } else {
        if (status === "READY") status = "UNKNOWN";
        warnings.push("تعذر التأكد من متطلبات التأشيرة من مصدر حكومي مؤكد — يلزم المراجعة المباشرة.");
      }
    } else if (!input.destination) {
      missing.push("وجهة السفر المقررة");
    }

    // Check 3: Transit Requirements
    if (input.transitCountry) {
      checklist.push({
        id: "transit_visa",
        title: `التحقق من تأشيرة العبور (Transit) في ${input.transitCountry}`,
        category: "TRANSIT",
        isMandatory: true,
        status: "PENDING_ACTION",
        description: "يلزم التأكد من عدم حاجة المسافر لتأشيرة ترانزيت في المطار الإنتقالي.",
      });
    }

    if (missing.length > 0 && status === "READY") {
      status = "NEEDS_ATTENTION";
    }

    return {
      status,
      overallScore: Math.max(0, score),
      checklist,
      warnings,
      missingInformation: missing,
      evaluatedAt,
    };
  }
}

export const travelReadinessEngine = new TravelReadinessEngine();
