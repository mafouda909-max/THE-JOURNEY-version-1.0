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
  overallScore: number;
  checklist: DynamicChecklistItem[];
  warnings: string[];
  missingInformation: string[];
  evaluatedAt: string;
}

export class TravelReadinessEngine {
  public async evaluateReadiness(
    input: TravelReadinessInput,
  ): Promise<TravelReadinessResult> {
    const evaluatedAt = new Date().toISOString();
    const warnings: string[] = [];
    const missing: string[] = [];
    const checklist: DynamicChecklistItem[] = [];

    let status: ReadinessStatus = "UNKNOWN";
    let evidencePoints = 0;
    let possibleEvidencePoints = 2;

    if (!input.nationality) missing.push("الجنسية الحالية للمسافر");
    if (!input.destination) missing.push("وجهة السفر المقررة");

    if (input.passportValidityMonths === undefined) {
      missing.push("مدة صلاحية الجواز بالأشهر");
    } else if (input.passportValidityMonths <= 0) {
      status = "BLOCKED";
      evidencePoints += 1;
      checklist.push({
        id: "passport_validity",
        title: "جواز السفر غير صالح بتاريخ التقييم",
        category: "PASSPORT",
        isMandatory: true,
        status: "BLOCKED",
        description:
          "القيمة المدخلة تشير إلى عدم وجود مدة صلاحية متبقية. يلزم جواز صالح قبل السفر الدولي.",
      });
    } else {
      evidencePoints += 1;
      checklist.push({
        id: "passport_validity",
        title: "صلاحية الجواز تحتاج مطابقة مع شرط الوجهة",
        category: "PASSPORT",
        isMandatory: true,
        status: "PENDING_ACTION",
        description:
          `المتبقي حسب إدخالك: ${input.passportValidityMonths} شهر. صلة لا تفترض حدًا عالميًا ثابتًا؛ يجب مطابقته مع القاعدة الرسمية للوجهة وتاريخ السفر.`,
      });
    }

    if (input.nationality && input.destination) {
      const visaRes = await travelIntelService.getVisaRequirements({
        nationality: input.nationality,
        travelDocument: "passport",
        destination: input.destination,
        transit: input.transitCountry,
        purpose: input.travelPurpose,
      });

      if (visaRes.visaRequired === true) {
        evidencePoints += 1;
        if (status !== "BLOCKED") status = "NEEDS_ATTENTION";
        checklist.push({
          id: "visa_requirement",
          title: `تأشيرة مسبقة مطلوبة لـ ${input.destination}`,
          category: "VISA",
          isMandatory: true,
          status: "PENDING_ACTION",
          description:
            "الحكم مبني على سجل حديث ذي أساس منظم ومصدر موثوق داخل طبقة معلومات السفر.",
        });
      } else if (visaRes.visaRequired === false) {
        evidencePoints += 1;
        if (status !== "BLOCKED") status = "READY";
        checklist.push({
          id: "visa_requirement",
          title: `لم يثبت احتياج تأشيرة مسبقة لـ ${input.destination}`,
          category: "VISA",
          isMandatory: false,
          status: "VERIFIED",
          description:
            "الحكم مبني على سجل حديث ذي أساس منظم ومصدر موثوق داخل طبقة معلومات السفر.",
        });
      } else {
        if (status !== "BLOCKED") status = "UNKNOWN";
        warnings.push(
          "لا توجد أدلة منظمة وكافية لإصدار حكم قطعي على التأشيرة. يلزم الرجوع للمصدر الرسمي المناسب.",
        );
      }
    }

    if (input.transitCountry) {
      possibleEvidencePoints += 1;
      if (status !== "BLOCKED") status = "UNKNOWN";
      checklist.push({
        id: "transit_visa",
        title: `التحقق من شروط العبور في ${input.transitCountry}`,
        category: "TRANSIT",
        isMandatory: true,
        status: "PENDING_ACTION",
        description:
          "وجود ترانزيت يضيف متطلبات محتملة مستقلة. لا يتم افتراض وجود أو عدم وجود تأشيرة عبور بدون دليل رسمي.",
      });
      warnings.push(
        "شروط الترانزيت غير محسومة من البيانات الحالية ويجب التحقق منها قبل السفر.",
      );
    }

    if (missing.length > 0 && status !== "BLOCKED") {
      status = "UNKNOWN";
    }

    const overallScore = Math.round(
      (evidencePoints / Math.max(possibleEvidencePoints, 1)) * 100,
    );

    return {
      status,
      overallScore,
      checklist,
      warnings,
      missingInformation: missing,
      evaluatedAt,
    };
  }
}

export const travelReadinessEngine = new TravelReadinessEngine();
