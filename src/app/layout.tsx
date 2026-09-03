import type { Metadata } from "next";
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
