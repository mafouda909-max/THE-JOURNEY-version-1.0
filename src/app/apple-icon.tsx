import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "180px",
          height: "180px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#19285f",
          borderRadius: "40px",
        }}
      >
        <svg width="116" height="116" viewBox="0 0 32 32" fill="none">
          <path d="M6 27V9.25A4.25 4.25 0 0 1 10.25 5h11.5A4.25 4.25 0 0 1 26 9.25V27" stroke="#F5F7FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 27V13.75A2.75 2.75 0 0 1 14.75 11h2.5A2.75 2.75 0 0 1 20 13.75V27" stroke="#F3B849" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
