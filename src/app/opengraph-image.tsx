import { ImageResponse } from "next/og";

export const alt = "الرحلة — عروض سفر من وكلاء موثّقين";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        dir="rtl"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0F2742",
          color: "#F7F4EE",
          padding: "64px 72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 58,
              height: 58,
              border: "3px solid #D8A63C",
              borderRadius: 29,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#D8A63C",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            ج
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 42, fontWeight: 700 }}>الرحلة</div>
            <div style={{ fontSize: 17, letterSpacing: 5, opacity: 0.62 }}>THE JOURNEY</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 930 }}>
          <div style={{ color: "#D8A63C", fontSize: 24, fontWeight: 700 }}>
            عروض واضحة · وكلاء موثّقون · تواصل مباشر
          </div>
          <div style={{ fontSize: 68, lineHeight: 1.15, fontWeight: 700 }}>
            قارن عرض السفر، وافهم من تقف خلفه قبل أن تقرر.
          </div>
          <div style={{ fontSize: 26, lineHeight: 1.55, opacity: 0.72 }}>
            سوق سفر عربي يضع معلومات الثقة والمراجعة بجانب السعر بدل أن يترك القرار للتخمين.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, opacity: 0.55 }}>
          <span>alrehlla.com</span>
          <span>الثقة قبل الحجز</span>
        </div>
      </div>
    ),
    size,
  );
}
