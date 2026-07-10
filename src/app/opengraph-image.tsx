import { ImageResponse } from "next/og";

export const alt =
  "DuesDesk — dues collection for self-managed HOAs and small landlords";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0b2018",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#2c6446",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div style={{ color: "#dce9df", fontSize: "34px", fontWeight: 600 }}>
            DuesDesk
          </div>
        </div>
        <div
          style={{
            marginTop: "48px",
            color: "#ffffff",
            fontSize: "84px",
            fontWeight: 600,
            letterSpacing: "-2px",
            lineHeight: 1.05,
          }}
        >
          Dues collected. Community calm.
        </div>
        <div
          style={{
            marginTop: "28px",
            color: "#8fb79b",
            fontSize: "32px",
            lineHeight: 1.4,
            maxWidth: "900px",
          }}
        >
          Invoice members, take payment online, and keep the books — built for
          self-managed HOAs and small landlords.
        </div>
      </div>
    ),
    { ...size },
  );
}
