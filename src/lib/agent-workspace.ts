export type AgentProfile = {
  id: number;
  displayName: string;
  latinName: string;
  bio: string;
  city: string;
  country: string;
  licenseType: string;
  licenseNumber: string | null;
  verificationStatus: string;
};

export function confirmedAgentProfile(value: unknown, expectedId: number): AgentProfile | null {
  if (!value || typeof value !== "object" || A…274 tokens truncated…0643ل عرض يحتاج اعتمادًا مستقلًا قبل النشر.",
        action: "إدارة العروض",
        href: "/account/offers",
      };
    case "in_review":
      return {
        label: "قيد المراجعة",
        tone: "review",
        title: "ملف الوكيل قيد المراجعة",
        note: "تقدر تتابع بياناتك ومستنداتك من ملف التوثيق. يظهر ملفك للمسافرين بعد اعتماد فريق الثقة.",
        action: "متابعة ملف التوثيق",
        href: "/account/verification",
      };
    case "rejected":
      return {
        label: "يحتاج مراجعة",
        tone: "error",
        title: "راجع ملاحظات التوثيق",
        note: "راجع ملاحظات المستندات قبل إعادة التقديم. إعادة التقديم تخضع لسياسة مراجعة الوكلاء.",
        action: "مراجعة الملاحظات",
        href: "/account/verification",
      };
    case "suspended":
      return {
        label: "موقوف",
        tone: "error",
        title: "الظهور العام موقوف",
        note: "يمكنك الاطلاع على بيانات حسابك. الظهور والعروض متوقفان حتى مراجعة قرار الإيقاف.",
        action: "عرض ملف التوثيق",
        href: "/account/verification",
      };
    case "pending":
      return {
        label: "لم يبدأ بعد",
        tone: "neutral",
        title: "حسابك مفتوح. جهّز ملفك على راحتك",
        note: "أضف نبذتك ومكان عملك الآن. ابدأ التوثيق عندما تختار الظهور للمسافرين وإرسال عروضك للمراجعة.",
        action: "تجهيز الملف المهني",
        href: "/account/profile",
      };
    default:
      return {
        label: "تحتاج مراجعة",
        tone: "neutral",
        title: "تعذر تحديد حالة اعتماد الوكيل",
        note: "بيانات حسابك متاحة؛ لا يمكن تأكيد ظهوره العام أو إتاحة إرسال العروض قبل مراجعة الحالة.",
        action: "أمان الحساب",
        href: "/account/security",
      };
  }
}

export function profilePreparation(profile: AgentProfile) {
  const present = (value: string) =>
    Boolean(value.trim()) && !["—", "غير محدد"].includes(value.trim());
  const checks = [
    {
      label: "اسم مهني واضح",
      done: present(profile.displayName) && present(profile.latinName),
    },
    {
      label: "الدولة والمدينة",
      done:
        present(profile.country) &&
        present(profile.city) &&
        profile.country !== "غير محدد" &&
        profile.city !== "غير محدد",
    },
    {
      label: "نبذة عن خدماتك",
      done:
        profile.bio.trim().length >= 30 &&
        !profile.bio.includes("بانتظار استكمال"),
    },
    {
      label: "نوع النشاط والترخيص عند الحاجة",
      done:
        profile.licenseType === "individual" ||
        (profile.licenseType === "agency" &&
          present(profile.licenseNumber ?? "")),
    },
  ];
  return {
    checks,
    completed: checks.filter((item) => item.done).length,
    total: checks.length,
  };
}

export const OFFER_STATUS_LABELS: Record<string, string> = {
  blocked: "محجوب لحين اعتماد الوكيل",
  draft: "مسودة",
  pending_review: "قيد المراجعة",
  published: "منشور",
  expired: "منتهي",
  rejected: "يحتاج تعديلًا",
  archived: "مؤرشف",
};
export const CONTACT_STATUS_LABELS: Record<string, string> = {
  new: "طلب جديد",
  viewed: "تم الاطلاع",
  responded: "تم الرد",
  closed: "مغلق",
};
