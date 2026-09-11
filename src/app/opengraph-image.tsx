import { ImageResponse } from "next/og";

export const alt = "THE JOURNEY — evidence before claims, freshness before promises";
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
          background: "#17213D",
          color: "#F5F7FF",
          padding: "62px 72px",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0",
            display: "flex",
            opacity: 0.08,
            border: "1px solid #F5F7FF",
            transform: "translate(84px, 84px)",
            width: "1032px",
            height: "462px",
            borderRadius: "48px 48px 0 0",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 24, zIndex: 1 }}>
          <div
            style={{
              width: 66,
              height: 66,
              borderRadius: 16,
              background: "#19285F",
              border: "1px solid rgba(255,255,255,.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="46" height="46" viewBox="0 0 32 32" fill="none">
              <path d="M6 27V9.25A4.25 4.25 0 0 1 10.25 5h11.5A4.25 4.25 0 0 1 26 9.25V27" stroke="#F5F7FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 27V13.75A2.75 2.75 0 0 1 14.75 11h2.5A2.75 2.75 0 0 1 20 13.75V27" stroke="#F3B849" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>THE JOURNEY</div>
            <div style={{ marginTop: 5, fontSize: 15, letterSpacing: 4, color: "#AEB8D7" }}>TRAVEL TRUST + AGENCY OS</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 980, zIndex: 1 }}>
          <div style={{ color: "#F3B849", fontSize: 21, fontWeight: 700, letterSpacing: 1.5 }}>
            EVIDENCE BEFORE CLAIMS · FRESHNESS BEFORE PROMISES
          </div>
          <div style={{ fontSize: 65, lineHeight: 1.07, fontWeight: 700, letterSpacing: -2.4 }}>
            A clearer path from travel intent to a trusted commercial decision.
          </div>
          <div style={{ fontSize: 24, lineHeight: 1.45, color: "#C8D0E6", maxWidth: 900 }}>
            Verified agency identity, source-aware travel information, supplier-backed quotes, and direct traveler–agency contact.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 17, color: "#9EABC9", zIndex: 1 }}>
          <span>alrehlla.com</span>
          <span style={{ color: "#5BD69A" }}>Trust is explicit, not implied.</span>
        </div>
      </div>
    ),
    size,
  );
}
