import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "الرحلة | THE JOURNEY",
  description:
    "الرحلة منصة موثوقة لاكتشاف عروض السفر والتواصل مع وكلاء سفر موثوقين.",
};

/** Material Symbols (BRAND_GUIDELINES §8) — runtime stylesheet, no build dep. */
const MATERIAL_SYMBOLS_HREF =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block";

import { AdvisorDrawer } from "@/components/advisor/AdvisorDrawer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_HREF} />
      </head>
      <body className={`${ibmPlexSansArabic.variable} font-sans antialiased`}>
        {children}
        <AdvisorDrawer />
      </body>
    </html>
  );
}
