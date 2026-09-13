import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "64px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#19285f",
          borderRadius: "16px",
        }}
      >
        <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
          <path d="M6 27V9.25A4.25 4.25 0 0 1 10.25 5h11.5A4.25 4.25 0 0 1 26 9.25V27" stroke="#F5F7FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 27V13.75A2.75 2.75 0 0 1 14.75 11h2.5A2.75 2.75 0 0 1 20 13.75V27" stroke="#F3B849" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
