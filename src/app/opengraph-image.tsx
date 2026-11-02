import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = "Resume Builder: free, private, ATS-safe resumes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0a0a0a";
const TICK = "#256f82";

export default function OpengraphImage() {
  const line = (w: number, key: number) => (
    <div key={key} style={{ display: "flex", height: 14, width: w, background: INK, opacity: 0.85, marginBottom: 22 }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "#dedad3", padding: "0 90px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 340, height: 460, background: "#ffffff", border: "2px solid #c9c3b9", padding: "0 44px" }}>
          <div style={{ display: "flex", height: 26, width: 150, background: TICK, marginBottom: 40 }} />
          {[250, 200, 250, 150, 230].map((w, i) => line(w, i))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 80, flex: 1 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, color: INK, lineHeight: 1.05 }}>{SITE_NAME}</div>
          <div style={{ display: "flex", fontSize: 40, color: TICK, marginTop: 28 }}>Free. Private. ATS-safe.</div>
          <div style={{ display: "flex", fontSize: 28, color: "#56524c", marginTop: 24 }}>Single-column templates. Nothing leaves your browser.</div>
        </div>
      </div>
    ),
    size,
  );
}
