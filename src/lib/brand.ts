export const BRAND = {
  nameAr: "صلة",
  nameEn: "SILA",
  taglineAr: "بين المسافر والوكيل الموثوق",
  promiseAr: "اعرف قبل أن تختار",
  descriptionAr:
    "صلة منصّة عربية تربط المسافر بالوكيل الموثوق وتضع مصدر المعلومة وتاريخها ونطاق التحقق أمامه قبل القرار.",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "hello@alrihla.travel",
  agentsEmail: process.env.NEXT_PUBLIC_AGENTS_EMAIL ?? "agents@alrihla.travel",
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000",
} as const;

export const BRAND_COLORS = {
  ink: "#08264A",
  paper: "#F5F1E8",
  clay: "#B2462E",
  apricot: "#FFC5AB",
  air: "#DFEBF1",
  dark: "#071829",
} as const;
