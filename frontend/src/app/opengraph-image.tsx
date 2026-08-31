import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/siteConfig";

/**
 * Social share card, generated at build/request time.
 *
 * Rendered with satori (via `next/og`), which supports only a subset of CSS:
 * flexbox but no grid, no external stylesheets, and every element with more than
 * one child needs an explicit `display: flex`. Keep it simple — this file is not
 * a place to reuse app components.
 */

export const alt = `${SITE_NAME} — personalized weather intelligence`;

/** 1200×630 is the size Twitter/X, WhatsApp, Slack and LinkedIn all crop from. */
export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0c4a6e 0%, #0284c7 55%, #0ea5e9 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 68,
              height: 68,
              borderRadius: 20,
              background: "rgba(255,255,255,0.16)",
              border: "2px solid rgba(255,255,255,0.28)",
              fontSize: 38,
            }}
          >
            ☁
          </div>
          <div
            style={{
              marginLeft: 24,
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -2.5,
              maxWidth: 900,
            }}
          >
            Weather that knows what matters to you.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.82)",
              maxWidth: 820,
            }}
          >
            Air quality, UV, rain and severe-warning alerts — ranked for your day,
            with a reason behind every card.
          </div>
        </div>

        {/* Signal chips */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {["Air quality", "UV index", "Rain windows", "Severe warnings"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                marginRight: 16,
                padding: "12px 24px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.24)",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
