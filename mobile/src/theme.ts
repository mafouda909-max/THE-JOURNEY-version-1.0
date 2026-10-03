import { generatedBrandTokens as t } from "./generated-brand-tokens";

/**
 * SILA / صلة brand tokens mirrored from the web theme so web and mobile
 * remain one Arabic-first product system.
 */

export const palette = {
  deep: t.colors.ink,
  horizon: t.colors.horizon,
  wash: t.colors.air,
  inkwell: t.colors.text,
  slate: t.colors.muted,
  outline: t.colors.outline,
  mist: t.colors.paper,
  cloud: t.colors.cloud,
  low: "#F7F4EE",
  high: "#DFEBF1",
  stone: "#6F6258",
  sand: "#BFA58D",
  parchment: t.colors.paper,
  gold: t.colors.warning,
  amber: t.colors.warningBg,
  verified: t.colors.verified,
  verifiedBg: t.colors.verifiedBg,
  error: t.colors.error,
  errorBg: t.colors.errorBg,
  inverse: t.colors.dark,
  onInverse: t.colors.paper,
  signal: t.colors.signal,
  sky: t.colors.sky,
  air: t.colors.air,
  dark: t.colors.dark,
} as const;

export const spacing = {
  xs: t.spacing["1"],
  sm: t.spacing["2"],
  md: t.spacing["3"],
  lg: t.spacing["4"],
  xl: t.spacing["6"],
  xxl: t.spacing["8"],
} as const;

export const radius = {
  sm: t.radius.sm,
  md: t.radius.md,
  lg: t.radius.lg,
  xl: t.radius.window,
  pill: t.radius.pill,
} as const;

export const typography = {
  title: { fontSize: 22, fontWeight: "700" as const, color: palette.inkwell },
  section: { fontSize: 17, fontWeight: "700" as const, color: palette.deep },
  body: { fontSize: 15, fontWeight: "400" as const, color: palette.inkwell },
  muted: { fontSize: 13, fontWeight: "400" as const, color: palette.slate },
  label: { fontSize: 12, fontWeight: "600" as const, color: palette.slate },
  price: { fontSize: 18, fontWeight: "700" as const, color: palette.horizon },
} as const;

/** RTL-aware text alignment for the Arabic-first UI (no I18nManager toggle). */
export const rtl = {
  writingDirection: "rtl" as const,
  textAlign: "right" as const,
};

export const layout = {
  /** Extra top clearance for the status bar / notch without a safe-area module. */
  androidStatusBarHeight: 24,
  headerHeight: 56,
  tabBarHeight: 58,
  minTouchTarget: 44,
} as const;
