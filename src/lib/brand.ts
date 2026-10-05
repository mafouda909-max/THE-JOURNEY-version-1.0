import { SITE_ORIGIN } from "@/lib/site";

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

export function resolvePublicSiteUrl(...values: Array<string | undefined>): string {
  const candidate = firstNonEmpty(...values);
  if (!candidate) return SITE_ORIGIN;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return SITE_ORIGIN;
    return url.origin;
  } catch {
    return SITE_ORIGIN;
  }
}

export function resolvePublicEmail(value: string | undefined): string | null {
  const candidate = firstNonEmpty(value);
  return candidate && candidate.includes("@") ? candidate : null;
}

export const BRAND = {
  nameAr: "صلة",
  nameEn: "SILA",
  taglineAr: "بين المسافر والوكيل الموثوق",
  promiseAr: "اعرف قبل أن تختار",
  descriptionAr:
    "صلة منصّة عربية تربط المسافر بالوكيل الموثوق وتضع مصدر المعلومة وتاريخها ونطاق التحقق أمامه قبل القرار.",
  supportEmail: resolvePublicEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  agentsEmail: resolvePublicEmail(process.env.NEXT_PUBLIC_AGENTS_EMAIL),
  siteUrl: SITE_ORIGIN,
} as const;

export const BRAND_COLORS = {
  ink: "#08264A",
  paper: "#F5F1E8",
  signal: "#2E6FD8",
  sky: "#7CC8E8",
  air: "#DFEBF1",
  dark: "#071829",
} as const;
