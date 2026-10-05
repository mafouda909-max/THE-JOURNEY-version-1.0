import { travelIntelService, type TravelIntelService } from "@/lib/travel-intel";
import type { Evidence } from "@/lib/evidence";

export type ReadinessStatus = "READY" | "NEEDS_ATTENTION" | "NEEDS_CONFIRMATION" | "BLOCKED" | "UNKNOWN";
export interface TravelReadinessInput {
  nationality: string; passportValidityMonths?: number; destination: string;
  transitCountry?: string; travelPurpose?: string; travelDate?: string;
}
export interface DynamicChecklistItem {
  id: string; title: string; category: "PASSPORT" | "VISA" | "TRANSIT" | "HEALTH" | "DOCUMENT";
  isMandatory: boolean; status: "VERIFIED" | "PENDING_ACTION" | "PENDING_CONFIRMATION" | "BLOCKED" | "UNKNOWN";
  description: string; nextAction: string; evidence: Evidence;
}
export interface TravelReadinessResult {
  status: ReadinessStatus;
  /** Compatibility only: verified checklist coverage, never probability of entry. */
  overallScore: number;
  checklist: DynamicChecklistItem[]; warnings: string[]; missingInformation: string[]; evaluatedAt: string;
  decisionScope: { included: string[]; excluded: string[] };
}
export class TravelReadinessEngine {
  constructor(private readonly visa: Pick<TravelIntelService, "getVisaRequirements"> = travelIntelService) {}
  public async evaluateReadiness(input: TravelReadinessInput, signal?: AbortSignal): Promise<TravelReadinessResult> {
    const evaluatedAt = new Date().toISOString();
    const missing: string[] = [], warnings: string[] = [], checklist: DynamicChecklistItem[] = [];
    if (!input.nationality) missing.push("الجنسية الحالية للمسافر");
    if (!input.destination) missing.push("وجهة السفر المقررة");
    if (!input.travelDate) missing.push("تاريخ السفر لمطابقة القواعد المطبقة يوم الرحلة");
    if (!input.travelPurpose) missing.push("الغرض من السفر إذا كان يغيّر شرط التأشيرة");
    const passportEvidence: Evidence = {
      kind: "traveler_report", linkedEntity: null,
      source: { type: "TRAVELER_REPORTED", label: "إدخالك؛ لم يتم فحص جواز فعلي", reference: null },
      issuedAt: null, observedAt: evaluatedAt, checkedAt: null, verifiedAt: null, validUntil: null,
      scope: ["مدة الصلاحية المتبقية المدخلة فقط"], status: "REPORTED", reviewer: null,
      limitations: ["لم يُفحص مستند الجواز أو شرط صلاحيته للوجهة وتاريخ السفر."],
    };
    if (input.passportValidityMonths === undefined) {
      missing.push("مدة صلاحية الجواز بالأشهر");
      checklist.push({ id: "passport_validity", title: "صلاحية الجواز غير معروفة بعد", category: "PASSPORT", isMandatory: true, status: "UNKNOWN", description: "لم تدخل مدة الصلاحية المتبقية.", nextAction: "راجع تاريخ انتهاء الجواز وأدخل المدة المتبقية.", evidence: { ...passportEvidence, status: "UNKNOWN" } });
    } else if (input.passportValidityMonths <= 0) {
      checklist.push({ id: "passport_validity", title: "لا توجد صلاحية متبقية حسب إدخالك", category: "PASSPORT", isMandatory: true, status: "BLOCKED", description: "أدخلت صفرًا أو أقل لمدة صلاحية الجواز. هذه نتيجة مبنية على إدخالك فقط.", nextAction: "راجع بيانات الجواز أو جدده ثم أعد الفحص قبل الحجز.", evidence: passportEvidence });
    } else {
      checklist.push({ id: "passport_validity", title: "صلاحية الجواز تحتاج تأكيدًا", category: "PASSPORT", isMandatory: true, status: "PENDING_CONFIRMATION", description: "المتبقي حسب إدخالك: " + input.passportValidityMonths + " شهر. لا نفترض شرطًا عالميًا ثابتًا لصلاحية الجواز.", nextAction: "طابق الجواز مع قاعدة الوجهة الرسمية وتاريخ السفر.", evidence: passportEvidence });
    }
    if (input.nationality && input.destination) {
      const visa = await this.visa.getVisaRequirements({ nationality: input.nationality, destination: input.destination, travelDocument: "passport", transit: input.transitCountry, purpose: input.travelPurpose, travelDate: input.travelDate }, signal);
      if (visa.visaRequired === true) {
        checklist.push({ id: "visa_requirement", title: "تأشيرة مسبقة مطلوبة لـ " + input.destination + " ضمن نطاق المصدر", category: "VISA", isMandatory: true, status: "PENDING_ACTION", description: visa.requirements.join(" · ") || "المصدر المنظم يثبت شرط التأشيرة المسبقة ضمن نطاقه فقط.", nextAction: "راجع إجراءات التأشيرة من المصدر وتأكد من استيفائها قبل الالتزام.", evidence: visa.evidence });
      } else if (visa.visaRequired === false) {
        checklist.push({ id: "visa_requirement", title: "المصدر لا يشترط تأشيرة مسبقة ضمن النطاق المطابق", category: "VISA", isMandatory: false, status: "VERIFIED", description: visa.requirements.join(" · ") || "هذا الحكم يخص التأشيرة المسبقة فقط؛ لا يثبت استيفاء باقي شروط الدخول.", nextAction: "راجع بقية شروط الدخول وصلاحية الجواز قبل الحجز.", evidence: visa.evidence });
      } else {
        warnings.push("شرط التأشيرة غير محسوم من الأدلة الحالية؛ لا تعتبره إعفاءً أو رفضًا.");
        checklist.push({ id: "visa_requirement", title: "شرط التأشيرة غير معروف بعد", category: "VISA", isMandatory: true, status: "UNKNOWN", description: "المصدر غير كافٍ أو قديم أو لا يطابق نطاق الرحلة. لا نحول ذلك إلى حكم على التأشيرة.", nextAction: "راجع الجهة الرسمية وأكد الشرط حسب جنسيتك والجواز والغرض وتاريخ السفر.", evidence: visa.evidence });
      }
    }
    if (input.transitCountry) {
      checklist.push({ id: "transit_visa", title: "شروط العبور في " + input.transitCountry + " غير محسومة", category: "TRANSIT", isMandatory: true, status: "UNKNOWN", description: "شروط العبور مستقلة عن تأشيرة الوجهة؛ لا توجد أدلة كافية لإصدار حكم.", nextAction: "أكد قواعد العبور حسب خط السير ومدة التوقف ومغادرة المطار.", evidence: { ...passportEvidence, kind: "travel_requirement", source: { type: "UNKNOWN", label: "لا يوجد مصدر يثبت شرط العبور", reference: null }, observedAt: null, status: "UNKNOWN", scope: ["العبور فقط"], limitations: ["لم يتم التحقق من شرط تأشيرة العبور."] } });
    }
    const statuses = checklist.map(item => item.status);
    const status: ReadinessStatus = statuses.includes("BLOCKED") ? "BLOCKED" : !input.nationality || !input.destination || statuses.includes("UNKNOWN") ? "UNKNOWN" : statuses.includes("PENDING_ACTION") ? "NEEDS_ATTENTION" : statuses.includes("PENDING_CONFIRMATION") ? "NEEDS_CONFIRMATION" : "READY";
    return {
      status, overallScore: Math.round(checklist.filter(item => item.status === "VERIFIED").length / Math.max(checklist.length,1) * 100),
      checklist, warnings, missingInformation: missing, evaluatedAt,
      decisionScope: { included: ["الصلاحية المدخلة لجواز عادي", "التأشيرة المسبقة ضمن نطاق الدليل", ...(input.transitCountry ? ["نواقص التحقق من العبور"] : [])], excluded: ["الفحص الفعلي للجواز", "متطلبات الصحة والتأمين", "السعر والتوافر", "قرار شركة الطيران أو جهة الحدود"] },
    };
  }
}
export const travelReadinessEngine = new TravelReadinessEngine();
