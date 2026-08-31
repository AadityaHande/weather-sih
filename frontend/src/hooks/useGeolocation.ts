"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reverseGeocode, formatCoords } from "@/lib/geocode";

/**
 * Centralized geolocation.
 *
 * Home, Weather, Map and Chatbot each carried their own copy of this logic, and
 * every copy handled denial the same wrong way: silently substitute Pune and
 * carry on, giving the user no signal that they were looking at the weather for
 * a city they are not in.
 *
 * This hook keeps the same fallback (the app stays usable without permission)
 * but reports *why* it fell back via `status` and `isFallback`, so callers can
 * render `LocationFallbackNotice` / `LocationDeniedState`.
 */

/** Default when permission is denied or unavailable. Matches prior behaviour. */
export const FALLBACK_LOCATION = {
  lat: 18.4635,
  lon: 73.8732,
  name: "Ward 1, Pune",
} as const;

export type GeolocationStatus =
  | "locating"
  | "granted"
  | "denied"
  | "unavailable"
  | "manual";

export interface Coords {
  lat: number;
  lon: number;
}

export interface UseGeolocationResult {
  /** Always populated — falls back to `FALLBACK_LOCATION` so pages can render. */
  coords: Coords;
  locationName: string;
  status: GeolocationStatus;
  /** True while the very first fix is being acquired. */
  isLocating: boolean;
  /** True when `coords` are NOT the device's real position. */
  isFallback: boolean;
  /**
   * True when the browser reported PERMISSION_DENIED. A page cannot re-prompt
   * after this, so "try again" should be hidden or clearly best-effort.
   */
  isPermanentlyDenied: boolean;
  /** Re-runs detection. Safe to call from a refresh button or pull gesture. */
  retry: () => void;
  /** Overrides detection with an explicit place (search result, saved location). */
  setManualLocation: (place: { name: string; lat: number; lon: number }) => void;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
};

export function useGeolocation(options?: {
  /** Listen for the sidebar's `mausam_refresh_location` event. Default true. */
  listenForGlobalRefresh?: boolean;
  /** Locale passed to reverse geocoding, so the label matches the UI language. */
  locale?: string;
}): UseGeolocationResult {
  const { listenForGlobalRefresh = true, locale = "en" } = options ?? {};

  const [coords, setCoords] = useState<Coords>({
    lat: FALLBACK_LOCATION.lat,
    lon: FALLBACK_LOCATION.lon,
  });
  const [locationName, setLocationName] = useState<string>(FALLBACK_LOCATION.name);
  const [status, setStatus] = useState<GeolocationStatus>("locating");
  const [isLocating, setIsLocating] = useState(true);
  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState(false);

  // Guards against a slow reverse-geocode from an earlier attempt overwriting a
  // newer one (e.g. user hits refresh twice, or switches location mid-flight).
  const attemptRef = useRef(0);
  // A manual selection must not be clobbered by a late-arriving GPS fix.
  const isManualRef = useRef(false);

  const applyPosition = useCallback(
    async (lat: number, lon: number, attempt: number) => {
      setCoords({ lat, lon });
      setStatus("granted");
      setIsLocating(false);

      const place = await reverseGeocode(lat, lon, locale);
      if (attempt !== attemptRef.current || isManualRef.current) return;
      setLocationName(place?.label ?? formatCoords(lat, lon));
    },
    [locale]
  );

  const detect = useCallback(() => {
    isManualRef.current = false;
    const attempt = ++attemptRef.current;

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      setIsLocating(false);
      setCoords({ lat: FALLBACK_LOCATION.lat, lon: FALLBACK_LOCATION.lon });
      setLocationName(FALLBACK_LOCATION.name);
      return;
    }

    setIsLocating(true);
    setStatus("locating");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (attempt !== attemptRef.current) return;
        void applyPosition(pos.coords.latitude, pos.coords.longitude, attempt);
      },
      (err) => {
        if (attempt !== attemptRef.current) return;
        // PERMISSION_DENIED (1) is terminal for this page load; POSITION_UNAVAILABLE
        // (2) and TIMEOUT (3) are transient and worth offering a retry for.
        const denied = err.code === err.PERMISSION_DENIED;
        setIsPermanentlyDenied(denied);
        setStatus(denied ? "denied" : "unavailable");
        setIsLocating(false);
        setCoords({ lat: FALLBACK_LOCATION.lat, lon: FALLBACK_LOCATION.lon });
        setLocationName(FALLBACK_LOCATION.name);
      },
      GEO_OPTIONS
    );
  }, [applyPosition]);

  const setManualLocation = useCallback(
    (place: { name: string; lat: number; lon: number }) => {
      attemptRef.current++;
      isManualRef.current = true;
      setCoords({ lat: place.lat, lon: place.lon });
      setLocationName(place.name);
      setStatus("manual");
      setIsLocating(false);
    },
    []
  );

  // Re-detect when the locale changes so the place label is re-localized,
  // matching the previous per-page `useEffect(..., [locale])` behaviour.
  //
  // `detect()` is exactly the case the lint rule carves out — it drives an
  // external platform API (navigator.geolocation) and the synchronous setState
  // calls only record that the request is in flight, which is already the
  // initial state on mount, so no cascading render occurs.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    detect();
  }, [detect, locale]);

  // The sidebar's refresh button broadcasts these; every page used to wire them
  // up by hand. Centralized here so a page only has to refetch its own data.
  useEffect(() => {
    if (!listenForGlobalRefresh) return;
    const onRefresh = () => detect();
    window.addEventListener("mausam_refresh_location", onRefresh);
    return () => window.removeEventListener("mausam_refresh_location", onRefresh);
  }, [detect, listenForGlobalRefresh]);

  // Publish the resolved name so the sidebar's location subtitle stays in sync.
  useEffect(() => {
    if (status === "locating") return;
    try {
      localStorage.setItem("mausam_detected_location", locationName);
    } catch {
      /* private mode / quota — the sidebar just keeps its previous label */
    }
    window.dispatchEvent(
      new CustomEvent("mausam_location_updated", { detail: { name: locationName } })
    );
  }, [locationName, status]);

  return {
    coords,
    locationName,
    status,
    isLocating,
    isFallback: status === "denied" || status === "unavailable",
    isPermanentlyDenied,
    retry: detect,
    setManualLocation,
  };
}
