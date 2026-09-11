import { ImageResponse } from "next/og";

export const alt = "THE JOURNEY — trusted Arabic travel marketplace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
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
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            TJ
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 42, fontWeight: 700 }}>THE JOURNEY</div>
            <div style={{ fontSize: 16, letterSpacing: 4, opacity: 0.62 }}>TRUSTED TRAVEL MARKETPLACE</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
          <div style={{ color: "#D8A63C", fontSize: 24, fontWeight: 700 }}>
            VERIFIED AGENTS · REVIEWED OFFERS · DIRECT CONTACT
          </div>
          <div style={{ fontSize: 66, lineHeight: 1.08, fontWeight: 700 }}>
            Compare the offer. Understand the trust. Contact the agent directly.
          </div>
          <div style={{ fontSize: 25, lineHeight: 1.45, opacity: 0.72 }}>
            An Arabic-first travel marketplace designed to make the seller and the offer easier to evaluate before you decide.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, opacity: 0.55 }}>
          <span>alrehlla.com</span>
          <span>Trust before booking</span>
        </div>
      </div>
    ),
    size,
  );
}
