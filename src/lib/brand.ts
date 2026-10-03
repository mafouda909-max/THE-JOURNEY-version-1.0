function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

export function resolvePublicSiteUrl(...values: Array<string | undefined>): string {
  const candidate = firstNonEmpty(...values) ?? "http://localhost:3000";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "http://localhost:3000";
    }
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function resolvePublicEmail(value: string | undefined, fallback: string): string {
  const candidate = firstNonEmpty(value);
  return candidate && candidate.includes("@") ? candidate : fallback;
}

export const BRAND = {
  nameAr: "صلة",
  nameEn: "SILA",
  taglineAr: "بين المسافر والوكيل الموثوق",
  promiseAr: "اعرف قبل أن تختار",
  descriptionAr:
    "صلة منصّة عربية تربط المسافر بالوكيل الموثوق وتضع مصدر المعلومة وتاريخها ونطاق التحقق أمامه قبل القرار.",
  supportEmail: resolvePublicEmail(
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    "hello@alrihla.travel",
  ),
  agentsEmail: resolvePublicEmail(
    process.env.NEXT_PUBLIC_AGENTS_EMAIL,
    "agents@alrihla.travel",
  ),
  siteUrl: resolvePublicSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ),
} as const;

export const BRAND_COLORS = {
  ink: "#08264A",
  paper: "#F5F1E8",
  clay: "#B2462E",
  apricot: "#FFC5AB",
  air: "#DFEBF1",
  dark: "#071829",
} as const;
