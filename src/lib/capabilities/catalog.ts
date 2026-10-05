import type { CapabilityDefinition, CapabilityId } from "./contracts";

const READ_POLICY = { probeTimeoutMs: 4000, callTimeoutMs: 12000, retries: 0, failureThreshold: 3, cooldownMs: 30000, cacheMs: 30000 };
function definition(id: CapabilityId, label: string, description: string, overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
  return { id, label, description, implemented: false, sensitivity: "public", trust: "untrusted_external", actors: ["system", "admin"], readOnly: true, cost: { model: "contract", unitPrice: null }, fallback: "explicit_unavailable", freshness: overrides.implemented ? "runtime_observation" : "not_available", license: overrides.trust === "first_party" ? "first_party" : overrides.implemented ? "provider_terms" : "not_selected", vendorSla: null, policy: READ_POLICY, prerequisites: ["محول منفّذ واختبار اتصال وصلاحيات مناسبة"], ...overrides };
}

export const CAPABILITY_CATALOG: readonly CapabilityDefinition[] = [
  definition("database", "قاعدة البيانات", "سجل الحسابات والعروض والقرارات داخل صلة.", { implemented: true, trust: "first_party", sensitivity: "private", cost: { model: "none", unitPrice: null }, prerequisites: ["اتصال PostgreSQL مع التحقق من TLS"] }),
  definition("storage", "الملفات الخاصة", "رفع واسترجاع الوثائق بروابط قصيرة الصلاحية وبعد فحص الملكية.", { implemented: true, sensitivity: "private", readOnly: false, prerequisites: ["حاوية B2 خاصة ومفتاح بصلاحيات محدودة"] }),
  definition("ai", "مساعدة الذكاء الاصطناعي", "مراجعة وصياغة مساعدة؛ الاعتماد البشري يظل مصدر قرار التوثيق.", { implemented: true, sensitivity: "private", cost: { model: "per_call", unitPrice: null }, fallback: "deterministic", policy: { ...READ_POLICY, callTimeoutMs: 20000 }, prerequisites: ["مفتاح OpenRouter أو OpenAI وسياسة بيانات مناسبة"] }),
  definition("ai_documents", "مساعد تحليل الوثائق", "تحليل أدلة التوثيق بإعداد مستقل؛ نجاح الاتصال لا يعتمد الوكيل تلقائيًا.", { implemented: true, sensitivity: "private", readOnly: false, cost: { model: "per_call", unitPrice: null }, policy: { ...READ_POLICY, callTimeoutMs: 60000 }, prerequisites: ["تفعيل تحليل الوثائق ومفتاح OpenAI؛ موافقة صاحب الحساب والتحقق من ملكية الأدلة"] }),
  definition("web", "البحث عبر الويب", "مصادر وروابط مؤرخة؛ المحتوى الخارجي بيانات غير موثوقة.", { implemented: true, cost: { model: "credits", unitPrice: null }, prerequisites: ["مفتاح Tavily صالح؛ صلاحية الاستخدام لا تثبت صحة كل مصدر"] }),
  definition("email", "البريد المعاملاتي", "إرسال تأكيد الحساب والاسترجاع مع تمييز قبول الإرسال عن التسليم.", { implemented: true, trust: "delivery_channel", sensitivity: "account", readOnly: false, actors: ["system"], cost: { model: "per_call", unitPrice: null }, prerequisites: ["مفتاح Resend ومرسل من نطاق تحت السيطرة موثّق فعليًا"] }),
  definition("flights", "البحث عن الرحلات", "بحث أسعار Amadeus للقراءة فقط؛ لا إصدار تذاكر أو حجز أو دفع.", { implemented: true, trust: "supplier_evidence", cost: { model: "per_call", unitPrice: null }, prerequisites: ["مفاتيح Amadeus وتفعيل مقارنة الرحلات بعد التحقق"] }),
  definition("documents", "وثائق توثيق الوكيل", "حفظ الوثائق الخاصة وفحص الحجم والنوع والملكية؛ الاعتماد بشري.", { implemented: true, trust: "first_party", sensitivity: "private", readOnly: false, prerequisites: ["جدول الوثائق وتخزين خاص جاهز؛ حساب المالك أو صلاحية المراجع"] }),
  definition("notifications", "إشعارات الحساب", "إشعارات داخل الحساب محفوظة في قاعدة البيانات وبنطاق المالك.", { implemented: true, trust: "first_party", sensitivity: "account", readOnly: false, cost: { model: "none", unitPrice: null }, prerequisites: ["جدول الإشعارات وجلسة صاحب الحساب"] }),
  definition("email_risk", "مخاطر البريد", "فحص الصلاحية والمخاطر عند تنفيذ محول؛ لا يثبت ملكية صندوق البريد.", { sensitivity: "account", prerequisites: ["قرار الخصوصية والترخيص ومحـول اختُبر؛ Reacher لم يُثبت كاعتمادية"] }),
  definition("gds", "ربط GDS", "لا يوجد محول مستقل عامل لشبكات التوزيع العامة."),
  definition("ndc", "ربط NDC", "لا يوجد محول مستقل عامل لتوزيع شركات الطيران."),
  definition("hotels", "مورد الفنادق", "العروض اليدوية ليست اتصالًا بمورد فنادق حي."),
  definition("visa", "بيانات التأشيرات", "فحص الجاهزية الحالي لا يُمثل اتصالًا بمورد تأشيرات أو ضمان دخول."),
  definition("currency", "أسعار العملات", "الأسعار الحية والتحويل المعتمد يحتاجان مصدرًا مؤرخًا."),
  definition("geo", "الخرائط والمواقع", "الإحداثيات والخرائط الحية تحتاج محولًا وصلاحيات استخدام."),
  definition("payments", "المدفوعات", "لا تُحصّل صلة أموالًا أو تدّعي نجاح الدفع دون تكامل مثبت.", { sensitivity: "financial", readOnly: false, actors: ["admin"] }),
  definition("social", "النشر الاجتماعي", "النشر الخارجي يحتاج مراجعة وصلاحية مستقلة.", { readOnly: false, actors: ["admin"] }),
  definition("whatsapp", "رسائل WhatsApp", "لا توجد قناة إرسال منفّذة ومفعّلة في المنتج.", { readOnly: false, sensitivity: "account" }),
  definition("mcp", "MCP في الإنتاج", "أدوات إلهام التصميم تخص بيئة التطوير؛ ليست أدوات تشغيل للمستخدم."),
];
