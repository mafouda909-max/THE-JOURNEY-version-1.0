import type { MetadataRoute } from "next";
import { BRAND, BRAND_COLORS } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.nameAr} — ${BRAND.nameEn}`,
    short_name: BRAND.nameAr,
    description: BRAND.descriptionAr,
    start_url: "/",
    display: "standalone",
    background_color: BRAND_COLORS.paper,
    theme_color: BRAND_COLORS.ink,
    dir: "rtl",
    lang: "ar",
    icons: [
      {
        src: "/brand/sila-app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
