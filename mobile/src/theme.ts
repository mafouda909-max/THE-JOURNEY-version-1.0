/**
 * SILA / صلة brand tokens mirrored from the web theme so web and mobile
 * remain one Arabic-first product system.
 */

export const palette = {
  deep: "#08264A",
  horizon: "#184F7B",
  wash: "#DFEBF1",
  inkwell: "#102A43",
  slate: "#5F6F7E",
  outline: "#DDE7ED",
  mist: "#F5F1E8",
  cloud: "#ffffff",
  low: "#F7F4EE",
  high: "#DFEBF1",
  stone: "#6F6258",
  sand: "#BFA58D",
  parchment: "#F5F1E8",
  gold: "#9A6700",
  amber: "#FFF3C4",
  verified: "#22634A",
  verifiedBg: "#E6F1EC",
  error: "#A42C32",
  errorBg: "#FBE9E8",
  inverse: "#071829",
  onInverse: "#F5F1E8",
  signal: "#2E6FD8",
  sky: "#7CC8E8",
  air: "#DFEBF1",
  dark: "#071829",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
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
