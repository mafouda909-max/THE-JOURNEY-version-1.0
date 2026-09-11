import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { Nav, Footer } from "@/components/chrome";
import { SITE_ORIGIN } from "@/lib/site";

const description =
  "الرحلة — سوق ثقة عربي للسفر ونظام تشغيل للوكالات. قارن عروضًا من وكلاء موثّقين، افهم مصدر وصلاحية المعلومات، وتواصل مع الوكيل قبل القرار.";

export const viewport: Viewport = {
  themeColor: "#19285f",
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  applicationName: "الرحلة · THE JOURNEY",
  title: {
    default: "الرحلة · THE JOURNEY — الثقة قبل قرار السفر",
    template: "%s · الرحلة",
  },
  description,
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  keywords: [
    "عروض سفر",
    "وكلاء سفر موثّقون",
    "سوق سفر عربي",
    "وكالة سفر",
    "travel marketplace",
    "travel agency software",
  ],
  openGraph: {
    type: "website",
    locale: "ar_EG",
    url: "/",
    siteName: "الرحلة · THE JOURNEY",
    title: "الرحلة — الدليل قبل الادعاء",
    description,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "الرحلة — سوق ثقة عربي للسفر" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "الرحلة — الدليل قبل الادعاء",
    description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "travel",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "الرحلة · THE JOURNEY",
    alternateName: "THE JOURNEY",
    url: SITE_ORIGIN,
    description,
    email: "hello@alrihla.travel",
    knowsAbout: ["travel marketplace", "travel agency operations", "travel trust and verification"],
  };

  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "الرحلة · THE JOURNEY",
    url: SITE_ORIGIN,
    inLanguage: "ar",
    description,
  };

  return (
    <html lang="ar" dir="rtl">
      <body className="bg-mist font-sans text-inkwell antialiased">
        <a
          href="#main-content"
          className="fixed start-4 top-3 z-[200] -translate-y-24 rounded-lg bg-deep px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-transform focus:translate-y-0"
        >
          انتقل إلى المحتوى
        </a>
        <Nav />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <Footer />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }} />
      </body>
    </html>
  );
}
