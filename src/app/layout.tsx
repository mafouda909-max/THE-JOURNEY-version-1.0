import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Nav, Footer } from "@/components/chrome";
import { SpeedInsights } from "@vercel/speed-insights/next";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "الرحلة · THE JOURNEY — سافر مع من تثق به",
    template: "%s · الرحلة",
  },
  description:
    "الرحلة — منصّة تربط المسافرين بوكلاء سفر موثّقين. عروض حقيقية، هويّات مُتحقّق منها، وتواصل مباشر بلا وسطاء على السعر.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${plexMono.variable}`}
    >
      <body className="bg-mist font-sans text-inkwell antialiased">
        <SmoothScroll>
          <Nav />
          <main>{children}</main>
          <Footer />
        </SmoothScroll>
        <SpeedInsights />
      </body>
    </html>
  );
}
