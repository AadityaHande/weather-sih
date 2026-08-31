/**
 * Reverse geocoding via OpenStreetMap Nominatim.
 *
 * Extracted from the near-identical copies that lived inline in the Home,
 * Weather, Map and Chatbot pages so the locality-naming rules (and the
 * Nominatim usage policy: one request, generous timeout, honest failure) exist
 * once.
 */

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const GEOCODE_TIMEOUT_MS = 8_000;

export interface ResolvedPlace {
  /** "Suburb, City" when both are known, otherwise the best available label. */
  label: string;
  city: string | null;
  suburb: string | null;
}

/**
 * Resolves coordinates to a human label. Returns null on any failure — callers
 * fall back to formatted coordinates rather than showing a wrong place name.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
  locale: string = "en"
): Promise<ResolvedPlace | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  try {
    const url =
      `${NOMINATIM_ENDPOINT}?format=json&lat=${lat}&lon=${lon}` +
      `&zoom=16&addressdetails=1&accept-language=${encodeURIComponent(locale)},en`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const data = await res.json();
    const addr = data?.address;
    if (!addr) return null;

    const suburb =
      addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || addr.village || null;
    const city = addr.city || addr.town || addr.state_district || addr.state || null;

    const label = [suburb, city].filter(Boolean).join(", ") || data?.display_name || null;
    if (!label) return null;

    return { label, city, suburb };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fallback label when reverse geocoding fails but we do have coordinates. */
export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}
