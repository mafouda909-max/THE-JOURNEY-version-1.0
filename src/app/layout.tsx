import type { Metadata } from "next";
import type { ReactNode } from "react";
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
import { SITE_ORIGIN } from "@/lib/site";

const description =
  "الرحلة — منصّة عربية لعروض سفر من وكلاء موثّقين. افهم معلومات الثقة، استعرض العرض بعملته وشروطه المعلنة، وتواصل مع الوكيل قبل أن تقرر.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  applicationName: "الرحلة · THE JOURNEY",
  title: {
    default: "الرحلة · THE JOURNEY — عروض سفر من وكلاء موثّقين",
    template: "%s · الرحلة",
  },
  description,
  openGraph: {
    type: "website",
    locale: "ar_EG",
    url: "/",
    siteName: "الرحلة · THE JOURNEY",
    title: "الرحلة — عروض سفر من وكلاء موثّقين",
    description,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "الرحلة — عروض سفر من وكلاء موثّقين ومعلومات ثقة واضحة" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "الرحلة — عروض سفر من وكلاء موثّقين",
    description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
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
      </body>
    </html>
  );
}
