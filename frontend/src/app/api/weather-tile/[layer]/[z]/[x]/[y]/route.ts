import { NextRequest, NextResponse } from "next/server";

// 1x1 transparent PNG buffer for fallback
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

const OWM_LAYERS: Record<string, string> = {
  temp: "temp_new",
  temperature: "temp_new",
  wind: "wind_new",
  clouds: "clouds_new",
  pressure: "pressure_new",
  precipitation: "precipitation_new",
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  try {
    const { layer, z, x, y } = await context.params;
    const zoom = parseInt(z, 10);
    const tileX = parseInt(x, 10);
    const tileY = parseInt(y.replace(/\.png$/, ""), 10);

    if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
      return new NextResponse(TRANSPARENT_PNG, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }

    const apiKey =
      process.env.OPENWEATHER_API_KEY ||
      process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ||
      "886705b4c1182eb1c69f28eb8c520e20"; // Built-in verified active key

    // 1. Fetch from OpenWeatherMap with automatic coordinate scaling for zoom > 10
    if (apiKey && apiKey.trim().length > 0) {
      const owmLayer = OWM_LAYERS[layer] || "temp_new";
      let targetZ = zoom;
      let targetX = tileX;
      let targetY = tileY;

      // OpenWeatherMap native raster tile max zoom is 10
      if (targetZ > 10) {
        const shift = targetZ - 10;
        targetZ = 10;
        targetX = targetX >> shift;
        targetY = targetY >> shift;
      }

      const owmUrl = `https://tile.openweathermap.org/map/${owmLayer}/${targetZ}/${targetX}/${targetY}.png?appid=${apiKey.trim()}`;

      try {
        const res = await fetch(owmUrl, {
          headers: { "User-Agent": "MausamWeatherApp/1.0" },
          next: { revalidate: 1800 },
        });

        if (res.ok) {
          const buffer = await res.arrayBuffer();
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=1800, s-maxage=3600",
              "X-Weather-Provider": "OpenWeatherMap",
            },
          });
        }
      } catch (err) {
        console.warn("OpenWeatherMap fetch failed", err);
      }
    }

    // 2. Default transparent fallback (never shows broken image crosses)
    return new NextResponse(TRANSPARENT_PNG, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new NextResponse(TRANSPARENT_PNG, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  }
}
