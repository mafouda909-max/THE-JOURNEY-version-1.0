import { travelIntelService } from "@/lib/travel-intel";

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
  /** Completion signal for the checklist, not a probability of successful entry. */
  overallScore: number;
  checklist: DynamicChecklistItem[];
  warnings: string[];
  missingInformation: string[];
  evaluatedAt: string;
}

function checklistScore(items: DynamicChecklistItem[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => {
    if (item.status === "VERIFIED") return sum + 100;
    if (item.status === "PENDING_ACTION") return sum + 40;
    return sum;
  }, 0);
  return Math.round(total / items.length);
}

export class TravelReadinessEngine {
  public async evaluateReadiness(input: TravelReadinessInput): Promise<TravelReadinessResult> {
    const evaluatedAt = new Date().toISOString();
    const warnings: string[] = [];
    const missing: string[] = [];
    const checklist: DynamicChecklistItem[] = [];
    let status: ReadinessStatus = "UNKNOWN";

    if (!input.nationality?.trim()) missing.push("الجنسية الحالية للمسافر");
    if (!input.destination?.trim()) missing.push("وجهة السفر المقررة");

    if (input.passportValidityMonths === undefined) {
      missing.push("مدة صلاحية الجواز بالأشهر");
    } else if (input.passportValidityMonths <= 0) {
      status = "BLOCKED";
      warnings.push("الجواز منتهي الصلاحية بحسب البيانات المدخلة.");
      checklist.push({
        id: "passport_validity",
        title: "تجديد جواز السفر",
        category: "PASSPORT",
        isMandatory: true,
        status: "BLOCKED",
        description: "لا يمكن الاعتماد على جواز منتهي للسفر الدولي.",
      });
    } else {
      checklist.push({
        id: "passport_validity",
        title: "مطابقة صلاحية الجواز مع شرط الوجهة",
        category: "PASSPORT",
        isMandatory: true,
        status: "PENDING_ACTION",
        description: `المسافر أدخل صلاحية متبقية قدرها ${input.passportValidityMonths} شهرًا. الحد المطلوب يختلف حسب الوجهة ووثيقة السفر، لذلك يلزم تأكيده من المصدر الرسمي.`,
      });
    }

    if (input.nationality?.trim() && input.destination?.trim()) {
      const visaRes = await travelIntelService.getVisaRequirements({
        nationality: input.nationality.trim(),
        travelDocument: "passport",
        destination: input.destination.trim(),
        transit: input.transitCountry?.trim() || undefined,
      });

      if (visaRes.visaRequired === true) {
        if (status !== "BLOCKED") status = "NEEDS_ATTENTION";
        checklist.push({
          id: "visa_requirement",
          title: `متطلب تأشيرة دخول إلى ${input.destination}`,
          category: "VISA",
          isMandatory: true,
          status: "PENDING_ACTION",
          description: `المصدر المنظم الحالي يشير إلى أن التأشيرة مطلوبة لمواطني ${input.nationality}. راجع المصدر قبل اتخاذ إجراء نهائي.`,
        });
      } else if (visaRes.visaRequired === false) {
        checklist.push({
          id: "visa_requirement",
          title: `حالة التأشيرة إلى ${input.destination}`,
          category: "VISA",
          isMandatory: false,
          status: "VERIFIED",
          description: "يوجد سجل structured حديث من مصدر موثوق يشير إلى عدم الحاجة لتأشيرة مسبقة ضمن هذا السياق.",
        });
      } else {
        if (status !== "BLOCKED") status = "UNKNOWN";
        warnings.push("لم يتوفر حكم structured موثوق حول التأشيرة؛ تم العثور على معلومات للمراجعة فقط إن وجدت.");
        checklist.push({
          id: "visa_requirement",
          title: `تحقق يدوي من متطلبات دخول ${input.destination}`,
          category: "VISA",
          isMandatory: true,
          status: "PENDING_ACTION",
          description: visaRes.sourceUrl
            ? `راجع المصدر مباشرة: ${visaRes.sourceUrl}`
            : "راجع الجهة الحكومية/القنصلية الرسمية قبل الحجز أو السفر.",
        });
      }
    }

    if (input.transitCountry?.trim()) {
      if (status !== "BLOCKED") status = "NEEDS_ATTENTION";
      checklist.push({
        id: "transit_visa",
        title: `التحقق من متطلبات العبور في ${input.transitCountry}`,
        category: "TRANSIT",
        isMandatory: true,
        status: "PENDING_ACTION",
        description: "متطلبات الترانزيت تعتمد على الجنسية والمطار ومدة/طبيعة العبور؛ لا تُفترض تلقائيًا.",
      });
    }

    if (missing.length > 0 && status !== "BLOCKED") status = "UNKNOWN";

    // READY is deliberately reserved for a future state where all mandatory
    // checks have explicit verified evidence. Current generic passport-validity
    // input is not enough to claim that outcome.
    const mandatory = checklist.filter((item) => item.isMandatory);
    if (
      status !== "BLOCKED" &&
      missing.length === 0 &&
      mandatory.length > 0 &&
      mandatory.every((item) => item.status === "VERIFIED")
    ) {
      status = "READY";
    }

    return {
      status,
      overallScore: checklistScore(checklist),
      checklist,
      warnings,
      missingInformation: missing,
      evaluatedAt,
    };
  }
}

export const travelReadinessEngine = new TravelReadinessEngine();
