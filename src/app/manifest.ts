import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "الرحلة — THE JOURNEY",
    short_name: "الرحلة",
    description: "سوق ثقة عربي للسفر ونظام تشغيل للوكالات.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#19285f",
    lang: "ar",
    dir: "rtl",
    orientation: "portrait-primary",
    categories: ["travel", "business"],
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
