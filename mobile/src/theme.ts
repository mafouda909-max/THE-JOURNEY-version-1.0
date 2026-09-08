/**
 * Brand tokens for the mobile app, taken verbatim from the web theme
 * (`src/app/globals.css` — "Ink & Horizon") so both surfaces stay recognisably
 * the same product.
 */

export const palette = {
  deep: "#1a2b6d",
  horizon: "#2643a8",
  wash: "#eef1fb",
  inkwell: "#141a2c",
  slate: "#545d73",
  outline: "#d2d6e3",
  mist: "#f6f7fa",
  cloud: "#ffffff",
  low: "#f3f4f8",
  high: "#e4e6ee",
  stone: "#7a6655",
  sand: "#a68c7a",
  parchment: "#f5efe9",
  gold: "#d4890a",
  amber: "#fdf2dc",
  verified: "#159050",
  verifiedBg: "#e5f7ed",
  error: "#be2a2a",
  errorBg: "#fbebeb",
  inverse: "#1d2748",
  onInverse: "#f0f1f7",
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
