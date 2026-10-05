import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// Self-hosted fonts (bundled locally by @fontsource) — deterministic build,
// no runtime/build-time dependency on fonts.googleapis.com.
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Nav, Footer } from "@/components/chrome";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BRAND, BRAND_COLORS } from "@/lib/brand";
import { publicIndexingEnabled } from "@/lib/public-indexing";

const productionObservability = process.env.VERCEL_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  applicationName: `${BRAND.nameAr} — ${BRAND.nameEn}`,
  title: {
    default: `${BRAND.nameAr} · ${BRAND.nameEn} — ${BRAND.promiseAr}`,
    template: `%s · ${BRAND.nameAr}`,
  },
  description: BRAND.descriptionAr,
  robots: publicIndexingEnabled
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "ar_EG",
    siteName: `${BRAND.nameAr} — ${BRAND.nameEn}`,
    title: `${BRAND.nameAr} · ${BRAND.nameEn} — ${BRAND.promiseAr}`,
    description: BRAND.descriptionAr,
  },
  twitter: {
    card: "summary",
    title: `${BRAND.nameAr} · ${BRAND.nameEn}`,
    description: BRAND.descriptionAr,
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.ink,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-mist font-sans text-inkwell antialiased">
        <SmoothScroll>
          <Nav />
          <main>{children}</main>
          <Footer />
        </SmoothScroll>
        {productionObservability ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
