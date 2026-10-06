import type { TravelerIntent } from "@/lib/commercial-domain";

export type AdvisorContextGate = {
  status: "NEEDS_CLIENT_CONTEXT";
  missing: Array<{
    id: "nationality" | "passport" | "travel_purpose" | "transit";
    label: string;
    why: string;
  }>;
  limitations: string[];
};

export type CommercialReadiness =
  | "NEEDS_SOURCING"
  | "NEEDS_REFRESH"
  | "READY_TO_QUOTE"
  | "QUOTE_ACTIVE"
  | "QUOTE_ATTENTION";

export type AgencyClientDossier = {
  generatedAt: string;
  trip: {
    originCity: string | null;
    destinations: string[];
    departureDate: string | null;
    returnDate: string | null;
    travelerCount: number;
    budget: {
      amountMinor: number;
      currency: string;
      basis: "total" | "per_person";
    } | null;
    priorities: string[];
    constraints: string[];
    notesPresent: boolean;
  };
  advisorContext: AdvisorContextGate;
  sourcing: {
    total: number;
    usable: number;
    fresh: number;
    expiring: number;
    stale: number;
    unbounded: number;
    sourceTypes: string[];
  };
  quote: {
    totalVersions: number;
    latestStatus: string | null;
    latestValidUntil: string | null;
    latestExpired: boolean;
    latestExpiringSoon: boolean;
  };
  commercialReadiness: CommercialReadiness;
  blockers: string[];
  warnings: string[];
  nextActions: string[];
};

export type DossierSupplierOption = {
  status: string;
  freshness: "fresh" | "expiring" | "stale" | "unbounded";
  sourceType: string;
};

export type DossierQuoteVersion = {
  status: string;
  validUntil: string | null;
};

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function travelerCount(intent: TravelerIntent | null): number {
  if (!intent) return 0;
  return intent.travelers.adults + intent.travelers.children + intent.travelers.infants;
}

function latestQuoteState(
  quotes: readonly DossierQuoteVersion[],
  now: Date,
): AgencyClientDossier["quote"] {
  const latest = quotes[0] ?? null;
  const validUntil = latest?.validUntil ?? null;
  const validAt = validUntil ? Date.parse(validUntil) : Number.NaN;
  const nowMs = now.getTime();
  const latestExpired = Number.isFinite(validAt) && validAt <= nowMs;
  const latestExpiringSoon =
    Number.isFinite(validAt) &&
    validAt > nowMs &&
    validAt <= nowMs + 24 * 60 * 60 * 1000;

  return {
    totalVersions: quotes.length,
    latestStatus: latest?.status ?? null,
    latestValidUntil: validUntil,
    latestExpired,
    latestExpiringSoon,
  };
}

export function deriveAgencyClientDossier(input: {
  intent: TravelerIntent | null;
  supplierOptions: readonly DossierSupplierOption[];
  quoteVersions: readonly DossierQuoteVersion[];
  now?: Date;
}): AgencyClientDossier {
  const now = input.now ?? new Date();
  const intent = input.intent;
  const activeSuppliers = input.supplierOptions.filter((option) =>
    ["active", "selected"].includes(option.status),
  );
  const count = (freshness: DossierSupplierOption["freshness"]) =>
    activeSuppliers.filter((option) => option.freshness === freshness).length;

  const fresh = count("fresh");
  const expiring = count("expiring");
  const stale = count("stale");
  const unbounded = count("unbounded");
  const usable = fresh + expiring + unbounded;
  const quote = latestQuoteState(input.quoteVersions, now);

  const blockers: string[] = [];
  const warnings: string[] = [];
  const nextActions: string[] = [];

  if (!intent) {
    blockers.push("لا توجد نسخة Intent للعميل.");
    nextActions.push("سجّل سياق الرحلة الأساسي قبل طلب أسعار أو بناء عرض.");
  } else {
    if (!intent.originCity) warnings.push("مدينة الانطلاق غير مسجلة.");
    if (!intent.departureDate) warnings.push("تاريخ السفر غير محدد.");
    if (!intent.returnDate) warnings.push("تاريخ العودة غير محدد.");
    if (!intent.budgetAmountMinor || !intent.budgetCurrency || !intent.budgetBasis) {
      warnings.push("الميزانية غير مسجلة كرقم/عملة/أساس قابل للمقارنة.");
    }
  }

  const advisorMissing: AdvisorContextGate["missing"] = [
    {
      id: "nationality",
      label: "الجنسية ووثيقة السفر",
      why: "لا يجوز استنتاج قواعد الدخول من الاسم أو البريد أو الوجهة.",
    },
    {
      id: "passport",
      label: "نوع الجواز وصلاحيته",
      why: "صلاحية ونوع وثيقة السفر جزء من نطاق قرار الجاهزية.",
    },
    {
      id: "travel_purpose",
      label: "الغرض القانوني الأساسي من السفر",
      why: "السياحة والدراسة والعمل والعمرة وغيرها لا تُعامل كغرض واحد.",
    },
    {
      id: "transit",
      label: "هل يوجد ترانزيت؟ وما خط السير إن وُجد؟",
      why: "قواعد العبور والتعقيد التشغيلي تعتمدان على المسار الفعلي.",
    },
  ];

  nextActions.push("اجمع سياق Travel Advisor الناقص من العميل قبل تقديم متطلبات سفر كأنها مؤكدة.");

  if (activeSuppliers.length === 0) {
    blockers.push("لا يوجد Supplier Option نشط مرتبط بالفرصة.");
    nextActions.push("سجّل خيار مورد بمصدر ووقت ملاحظة وصلاحية قبل بناء Quote.");
  } else if (usable === 0 && stale > 0) {
    blockers.push("كل خيارات المورد الحالية منتهية.");
    nextActions.push("حدّث التسعير/المصدر قبل إنشاء نسخة عرض جديدة.");
  } else {
    if (stale > 0) warnings.push(`${stale} خيار مورد منتهي ولا يجب استخدامه في Quote جديد.`);
    if (expiring > 0) {
      warnings.push(`${expiring} خيار مورد ينتهي خلال 24 ساعة.`);
      nextActions.push("أكد صلاحية المصدر قبل إرسال عرض يمتد بعد صلاحية المورد.");
    }
  }

  if (quote.latestExpired) {
    warnings.push("أحدث Quote منتهي الصلاحية.");
    nextActions.push("أنشئ Quote Version جديدة من مصادر حالية بدل إعادة إرسال النسخة المنتهية.");
  } else if (quote.latestExpiringSoon) {
    warnings.push("أحدث Quote ينتهي خلال 24 ساعة.");
    nextActions.push("راجع صلاحية الأسعار قبل المتابعة أو إعادة الإرسال.");
  }

  let commercialReadiness: CommercialReadiness;
  if (activeSuppliers.length === 0) {
    commercialReadiness = "NEEDS_SOURCING";
  } else if (usable === 0) {
    commercialReadiness = "NEEDS_REFRESH";
  } else if (quote.totalVersions === 0) {
    commercialReadiness = "READY_TO_QUOTE";
    nextActions.push("يوجد مصدر تجاري قابل للاستخدام؛ يمكن بناء Quote Version مع الحفاظ على provenance.");
  } else if (quote.latestExpired || quote.latestExpiringSoon) {
    commercialReadiness = "QUOTE_ATTENTION";
  } else {
    commercialReadiness = "QUOTE_ACTIVE";
    nextActions.push("راجع تطابق أحدث Quote مع آخر Intent قبل الإرسال أو المتابعة.");
  }

  return {
    generatedAt: now.toISOString(),
    trip: {
      originCity: intent?.originCity ?? null,
      destinations: intent?.destinations ?? [],
      departureDate: intent?.departureDate ?? null,
      returnDate: intent?.returnDate ?? null,
      travelerCount: travelerCount(intent),
      budget:
        intent?.budgetAmountMinor && intent.budgetCurrency && intent.budgetBasis
          ? {
              amountMinor: intent.budgetAmountMinor,
              currency: intent.budgetCurrency,
              basis: intent.budgetBasis,
            }
          : null,
      priorities: intent?.priorities ?? [],
      constraints: intent?.constraints ?? [],
      notesPresent: Boolean(intent?.notes),
    },
    advisorContext: {
      status: "NEEDS_CLIENT_CONTEXT",
      missing: advisorMissing,
      limitations: [
        "هذه النسخة لا تستنتج الجنسية أو بيانات الجواز أو الغرض القانوني من بيانات العميل التجارية.",
        "سياق Travel Advisor سيصبح قابلًا للتشغيل فقط بعد إدخال هذه المعلومات صراحة أو مشاركتها من المسافر بموافقة.",
      ],
    },
    sourcing: {
      total: activeSuppliers.length,
      usable,
      fresh,
      expiring,
      stale,
      unbounded,
      sourceTypes: unique(activeSuppliers.map((option) => option.sourceType)),
    },
    quote,
    commercialReadiness,
    blockers: unique(blockers),
    warnings: unique(warnings),
    nextActions: unique(nextActions),
  };
}
