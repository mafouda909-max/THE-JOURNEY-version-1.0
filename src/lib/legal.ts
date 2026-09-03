/**
 * LEGAL & BUSINESS COMPLIANCE REVIEW CHECKLIST
 *
 * Statuses:
 *   - DRAFTED: Policy text or disclosure drafted in repository.
 *   - REVIEW_REQUIRED: Pending formal legal review by qualified counsel.
 *   - APPROVED: Officially approved by legal counsel for live marketplace operation.
 */

export type LegalReviewStatus = "DRAFTED" | "REVIEW_REQUIRED" | "APPROVED";

export interface LegalReviewItem {
  id: string;
  topic: string;
  status: LegalReviewStatus;
  summary: string;
  disclaimerText?: string;
}

export interface LegalComplianceReport {
  overallStatus: "REVIEW_REQUIRED";
  items: LegalReviewItem[];
  evaluatedAt: string;
}

export class LegalComplianceService {
  public getLegalReviewChecklist(): LegalComplianceReport {
    return {
      overallStatus: "REVIEW_REQUIRED",
      evaluatedAt: new Date().toISOString(),
      items: [
        {
          id: "terms_of_service",
          topic: "شروط وأحكام استخدام المنصة (Terms of Service)",
          status: "REVIEW_REQUIRED",
          summary: "تحديد مسؤولية المنصة كمدقق ومربط بين المسافر والوكالات السياحية المعتمدة.",
          disclaimerText: "المنصة تعمل كمنصة وساطة تقنية وذكاء اصطناعي بين المسافرين والوكلاء المعتمدين.",
        },
        {
          id: "privacy_policy",
          topic: "سياسة الخصوصية وحماية البيانات (Privacy Policy)",
          status: "REVIEW_REQUIRED",
          summary: "الالتزام بعدم مشاركة الهويات الشخصية (PII) أو وثائق التوثيق الرسمية مع نموذج الذكاء الاصطناعي.",
          disclaimerText: "بيانات الهوية الجغرافية والوثائق تُحفظ في حاويات مشفرة ولا تدرج في استعلامات النماذج اللغوية.",
        },
        {
          id: "marketplace_responsibility",
          topic: "إخلاء مسؤولية معلومات السفر (AI Travel Information Disclaimer)",
          status: "REVIEW_REQUIRED",
          summary: "توضيح أن شروط التأشيرات والجوازات متغيرة ويلزم مراجعة السفارة أو القنصلية الرسمية.",
          disclaimerText: "معلومات التأشيرات والجوازات مسترجعة من مصادر رسمية وقت الاستعلام، وتخضع لتحديثات الجهات الحكومية.",
        },
        {
          id: "agent_verification_disclosure",
          topic: "إفصاح توثيق الوكالات السياحية (Agent KYB Disclosure)",
          status: "REVIEW_REQUIRED",
          summary: "إفصاح رسمي عن آلية التحقق من السجل التجاري والترخيص الرسمي للوكيل.",
          disclaimerText: "شارة الوكيل المعتمد تعني التحقق من سريان السجل التجاري والترخيص السياحي الحكومي.",
        },
        {
          id: "sponsored_placement_disclosure",
          topic: "إفصاح العروض المميزة والرعايات (Sponsored Placement Disclosure)",
          status: "REVIEW_REQUIRED",
          summary: "الالتزام بعدم دمج العروض المأجورة ضمن نتائج البحث العضوية المعتمدة على الخوارزميات.",
          disclaimerText: "العروض المميزة تظهر بشارة 'عرض مميز' مستقلة تماماً عن الترتيب الذكي القائم على الموثوقية.",
        },
        {
          id: "disputes_and_refunds",
          topic: "سياسة النزاعات والاسترجاع (Disputes & Refunds Policy)",
          status: "REVIEW_REQUIRED",
          summary: "تحديد إجراءات إلغاء الحجز والنزاعات المالية بين المسافر والوكالة.",
        },
      ],
    };
  }
}

export const legalComplianceService = new LegalComplianceService();
