"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { MobileMenuTrigger } from "@/components/AppSidebar";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useI18n } from "@/context/I18nContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { PullToRefresh } from "@/components/PullToRefresh";
import { OfflineBanner } from "@/components/OfflineBanner";
import { DataErrorState, LocationFallbackNotice } from "@/components/StateViews";
import { ShareButton, type ForecastShareData } from "@/components/ShareButton";
import { FreshnessIndicator } from "@/components/FreshnessIndicator";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import {
  formatLocalizedWmoCondition,
  formatLocalizedWindDirection,
  translateUvLevel,
} from "@/lib/i18n/weatherFormatters";
import { formatLocalizedLocation } from "@/lib/i18n/localizeLocation";
import {
  CloudSun,
  MapPin,
  RefreshCw,
  Search,
  Sun,
  Moon,
  Droplets,
  Wind,
  Eye,
  Gauge,
  Sunrise,
  Sunset,
  Sparkles,
  Thermometer,
  Compass,
  Calendar,
  CloudRain,
  ShieldAlert,
} from "lucide-react";
import InteractiveForecastCard from "@/components/InteractiveForecastCard";
import EnvironmentalActivityRings from "@/components/EnvironmentalActivityRings";
import { GooeyInput } from "@/components/ui/gooey-input";

interface LocationSuggestion {
  name: string;
  subText: string;
  lat: number;
  lon: number;
}

const PRESET_LOCATIONS: LocationSuggestion[] = [
  { name: "Pune", subText: "Maharashtra, India", lat: 18.5204, lon: 73.8567 },
  { name: "Mumbai", subText: "Maharashtra, India", lat: 19.076, lon: 72.8777 },
  { name: "Delhi", subText: "National Capital Territory, India", lat: 28.6139, lon: 77.209 },
  { name: "Bengaluru", subText: "Karnataka, India", lat: 12.9716, lon: 77.5946 },
  { name: "Hyderabad", subText: "Telangana, India", lat: 17.385, lon: 78.4867 },
  { name: "Chennai", subText: "Tamil Nadu, India", lat: 13.0827, lon: 80.2707 },
  { name: "Kolkata", subText: "West Bengal, India", lat: 22.5726, lon: 88.3639 },
  { name: "Jaipur", subText: "Rajasthan, India", lat: 26.9124, lon: 75.7873 },
  { name: "London", subText: "United Kingdom", lat: 51.5074, lon: -0.1278 },
  { name: "New York", subText: "United States", lat: 40.7128, lon: -74.006 },
  { name: "Tokyo", subText: "Japan", lat: 35.6762, lon: 139.6503 },
  { name: "Dubai", subText: "United Arab Emirates", lat: 25.2048, lon: 55.2708 },
];

export default function WeatherPage() {
  const { deviceId } = useAuth();
  const { t, locale } = useI18n();

  // Geolocation, shared with Home/Map via the same hook — including the honest
  // "we fell back to a default city" reporting the old inline copy lacked.
  const {
    coords,
    locationName: locName,
    isLocating,
    isFallback: isLocationFallback,
    isPermanentlyDenied,
    retry: retryLocation,
    setManualLocation,
  } = useGeolocation({ locale });
  const [locationNoticeDismissed, setLocationNoticeDismissed] = useState(false);

  // Search Bar state (using Map section GooeyInput)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search query resolution
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const queryLower = searchQuery.trim().toLowerCase();

      // Quick filter on preset major cities
      const quickMatches = PRESET_LOCATIONS.filter(
        (c) =>
          c.name.toLowerCase().includes(queryLower) ||
          c.subText.toLowerCase().includes(queryLower)
      );

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery.trim()
          )}&limit=5&addressdetails=1`
        );
        if (res.ok) {
          const data = await res.json();
          const remoteResults: LocationSuggestion[] = (data || []).map((item: any) => {
            const parts = item.display_name.split(",");
            const mainName = parts[0]?.trim() || item.name;
            const sub = parts.slice(1, 3).join(",").trim() || "";
            return {
              name: mainName,
              subText: sub,
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon),
            };
          });

          const combined = [...quickMatches];
          for (const rem of remoteResults) {
            if (!combined.some((q) => q.name.toLowerCase() === rem.name.toLowerCase())) {
              combined.push(rem);
            }
          }
          setSuggestions(combined.slice(0, 6));
        } else {
          setSuggestions(quickMatches);
        }
      } catch (err) {
        setSuggestions(quickMatches);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectLocation = (loc: LocationSuggestion) => {
    setManualLocation({
      lat: loc.lat,
      lon: loc.lon,
      name: `${loc.name}${loc.subText ? `, ${loc.subText.split(",")[0]}` : ""}`,
    });
    setShowSuggestions(false);
    setSearchQuery("");
  };

  const handleDirectSubmit = (query: string) => {
    if (!query.trim()) return;
    if (suggestions.length > 0) {
      handleSelectLocation(suggestions[0]);
    } else {
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query.trim()
        )}&limit=1`
      )
        .then((r) => r.json())
        .then((data) => {
          if (data && data.length > 0) {
            const first = data[0];
            const mainName = first.display_name.split(",")[0];
            handleSelectLocation({
              name: mainName,
              subText: first.display_name.split(",").slice(1, 3).join(","),
              lat: parseFloat(first.lat),
              lon: parseFloat(first.lon),
            });
          }
        })
        .catch(console.warn);
    }
  };

  // Display Units state synced with settings
  const [tempUnit, setTempUnit] = useState<"c" | "f">("c");
  const [windUnit, setWindUnit] = useState<"kmh" | "mph">("kmh");

  useEffect(() => {
    const updateUnits = () => {
      const storedTemp = localStorage.getItem("mausam_temp_unit") as "c" | "f" | null;
      const storedWind = localStorage.getItem("mausam_wind_unit") as "kmh" | "mph" | null;
      if (storedTemp) setTempUnit(storedTemp);
      if (storedWind) setWindUnit(storedWind);
    };
    updateUnits();
    window.addEventListener("mausam_units_changed", updateUnits);
    window.addEventListener("storage", updateUnits);
    return () => {
      window.removeEventListener("mausam_units_changed", updateUnits);
      window.removeEventListener("storage", updateUnits);
    };
  }, []);

  const displayLocName = formatLocalizedLocation(
    isLocating ? t("common.loading") : locName,
    locale,
    t("common.loading")
  );

  const activeLat = coords.lat;
  const activeLon = coords.lon;

  const formatTemp = (celsius: number) => {
    if (tempUnit === "f") return Math.round(celsius * 1.8 + 32);
    return Math.round(celsius);
  };

  const formatWind = (kmh: number) => {
    if (windUnit === "mph") return `${(kmh * 0.621371).toFixed(1)} mph`;
    return `${kmh.toFixed(1)} kph`;
  };

  // Fetch Comprehensive Live Weather & Celestial Data from Open-Meteo
  const {
    data: weatherData,
    isLoading,
    error: weatherError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["deep-weather", activeLat, activeLon, tempUnit, windUnit],
    queryFn: async () => {
      // 1. OPEN-METEO API FETCH:
      // - current: live instantaneous sensor readings
      // - hourly: 1-hour modeled intervals (includes uv_index for current hour)
      // - daily: day aggregations and ephemeris
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${activeLat}&longitude=${activeLon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
        `&hourly=uv_index,temperature_2m,precipitation_probability,precipitation,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max` +
        `&timezone=auto`
      );
      if (!res.ok) throw new Error("Failed to fetch weather data");
      const data = await res.json();

      const degToCompass = (deg: number) => {
        const val = Math.floor(deg / 22.5 + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        return arr[val % 16];
      };

      // =========================================================================
      // BLOCK 1: CURRENT CONDITIONS (Instantaneous readings strictly from "current")
      // =========================================================================
      // Temperature is the one field the whole page is built around. If the
      // response arrived without it, the response is unusable — throw so the
      // error state shows, rather than inventing a plausible-looking 28 °C.
      if (typeof data.current?.temperature_2m !== "number") {
        throw new Error("Weather service returned an incomplete reading");
      }

      // Everything else is rendered as "—" when absent (see `orDash` below), so
      // these stay nullable instead of falling back to invented numbers.
      const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

      const isDaytime = data.current?.is_day === 1;
      const code = data.current?.weather_code ?? 0;
      const rawTemp: number = data.current.temperature_2m;
      const rawFeels = num(data.current?.apparent_temperature);
      const rawPrecipMm = num(data.current?.precipitation) ?? 0; // total precipitation (mm)
      const rawRainMm = num(data.current?.rain) ?? 0; // rain-specific (mm)
      const humidityVal = num(data.current?.relative_humidity_2m);
      const rawWindSpeedKmh = num(data.current?.wind_speed_10m);
      const rawGustsKmh = num(data.current?.wind_gusts_10m);
      const windDeg = num(data.current?.wind_direction_10m);
      const surfacePressure = num(data.current?.surface_pressure);
      const cloudCover = num(data.current?.cloud_cover);

      // Condition badge text: only report "Drizzle" if active precipitation > 0
      const currentConditionText = formatLocalizedWmoCondition(code, isDaytime, t, rawPrecipMm);

      // =========================================================================
      // BLOCK 2: HOURLY MODEL (1-hour forecast intervals strictly from "hourly")
      // =========================================================================
      const hourlyTimes: string[] = data.hourly?.time || [];
      const currentIso: string = data.current?.time || "";
      let currentHourIdx = 0;
      if (currentIso && hourlyTimes.length > 0) {
        const found = hourlyTimes.findIndex((t) => t.startsWith(currentIso.slice(0, 13)));
        if (found !== -1) currentHourIdx = found;
      }

      // UV Index: Open-Meteo has NO current.uv_index. Sourced from hourly.uv_index for the current hour
      const currentHourUv = num(data.hourly?.uv_index?.[currentHourIdx]);
      const currentHourTimeStr = hourlyTimes[currentHourIdx]
        ? new Date(hourlyTimes[currentHourIdx]).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : null;

      // =========================================================================
      // BLOCK 3: DAILY EPHEMERIS & FORECAST (Aggregations strictly from "daily")
      // =========================================================================
      const rawHigh = num(data.daily?.temperature_2m_max?.[0]);
      const rawLow = num(data.daily?.temperature_2m_min?.[0]);
      const dailyPrecipProbMax = num(data.daily?.precipitation_probability_max?.[0]);
      const dailyPrecipSum = num(data.daily?.precipitation_sum?.[0]);
      const dailyUvMax = num(data.daily?.uv_index_max?.[0]) ?? currentHourUv;

      const formatIsoTime = (isoString?: string) => {
        if (!isoString) return null;
        const d = new Date(isoString);
        if (Number.isNaN(d.getTime())) return null;
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      };

      const sunriseStr = formatIsoTime(data.daily?.sunrise?.[0]);
      const sunsetStr = formatIsoTime(data.daily?.sunset?.[0]);
      const daylightSec = num(data.daily?.daylight_duration?.[0]);
      const daylightHours = daylightSec !== null ? (daylightSec / 3600).toFixed(1) : null;

      return {
        /** When this payload was actually retrieved — drives the freshness label. */
        fetchedAt: new Date().toISOString(),
        // [CURRENT BLOCK] Instantaneous Live Telemetry
        current: {
          temp: formatTemp(rawTemp),
          feelsLike: rawFeels !== null ? formatTemp(rawFeels) : null,
          unitSymbol: tempUnit === "f" ? "°F" : "°C",
          isDay: isDaytime,
          weatherCode: code,
          conditionStatus: currentConditionText,
          precipitationMm: rawPrecipMm,
          rainMm: rawRainMm,
          precipitationFormatted: `${rawPrecipMm.toFixed(1)} mm`,
          rainFormatted: `${rawRainMm.toFixed(1)} mm`,
          humidity: humidityVal !== null ? Math.round(humidityVal) : null,
          humidityStatus:
            humidityVal === null
              ? null
              : humidityVal > 75
                ? "Humid"
                : humidityVal < 35
                  ? "Dry"
                  : "Comfortable",
          windSpeed: rawWindSpeedKmh !== null ? formatWind(rawWindSpeedKmh) : null,
          windSpeedRaw: rawWindSpeedKmh,
          windGusts: rawGustsKmh !== null ? formatWind(rawGustsKmh) : null,
          windDirection:
            windDeg !== null ? `${degToCompass(windDeg)} Direction (${windDeg}°)` : null,
          windDeg: windDeg,
          surfacePressure:
            surfacePressure !== null ? `${Math.round(surfacePressure)} hPa` : null,
          cloudCover: cloudCover !== null ? `${Math.round(cloudCover)}%` : null,
        },
        // [HOURLY BLOCK] Current Hour Modeled Data (tagged with time reference)
        hourly: {
          currentHourIndex: currentHourIdx,
          timeReference: currentHourTimeStr,
          uvIndex: currentHourUv !== null ? currentHourUv.toFixed(1) : null,
          uvIndexRaw: currentHourUv,
          uvLevel:
            currentHourUv === null
              ? null
              : currentHourUv >= 8
                ? "Very High"
                : currentHourUv >= 6
                  ? "High"
                  : currentHourUv >= 3
                    ? "Moderate"
                    : "Low",
        },
        // [DAILY BLOCK] Full-Day Forecast Aggregations & Ephemeris
        daily: {
          high: rawHigh !== null ? formatTemp(rawHigh) : null,
          low: rawLow !== null ? formatTemp(rawLow) : null,
          rainChanceLaterToday:
            dailyPrecipProbMax !== null ? `${Math.round(dailyPrecipProbMax)}%` : null,
          rainChanceProbability: dailyPrecipProbMax,
          precipitationSumMm: dailyPrecipSum,
          uvIndexMax: dailyUvMax !== null ? dailyUvMax.toFixed(1) : null,
          sunrise: sunriseStr,
          sunset: sunsetStr,
          daylightDuration: daylightHours !== null ? `${daylightHours} hrs` : null,
        },
      };
    },
  });

  /** Placeholder for a metric the response genuinely did not include. */
  const DASH = "—";

  const refreshAll = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const shareData: ForecastShareData = {
    locationName: locName,
    temperature: weatherData?.current.temp ?? null,
    unitSymbol: weatherData?.current.unitSymbol ?? (tempUnit === "f" ? "°F" : "°C"),
    condition: weatherData?.current.conditionStatus ?? null,
    high: weatherData?.daily.high ?? null,
    low: weatherData?.daily.low ?? null,
    rainProbability: weatherData?.daily.rainChanceProbability ?? null,
    uvIndex: weatherData?.hourly.uvIndexRaw ?? null,
  };

  // The sidebar's refresh buttons broadcast these. Re-detecting the location is
  // handled inside useGeolocation, so this only has to refetch the forecast.
  useEffect(() => {
    const handleGlobalRefresh = () => {
      void refreshAll();
    };
    window.addEventListener("mausam_refresh_location", handleGlobalRefresh);
    window.addEventListener("mausam_refresh_weather", handleGlobalRefresh);
    return () => {
      window.removeEventListener("mausam_refresh_location", handleGlobalRefresh);
      window.removeEventListener("mausam_refresh_weather", handleGlobalRefresh);
    };
  }, [refreshAll]);

  return (
    <PullToRefresh onRefresh={refreshAll}>
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-white flex flex-col font-sans pb-12 lg:pb-16 transition-colors duration-300">
      {/* Top Action Bar: Location Search & Theme Toggle */}
      <header className="w-full px-4 sm:px-8 pt-3.5 pb-2 transition-colors relative z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center">
            {/* Mobile: Hamburger menu button */}
            <MobileMenuTrigger />
          </div>

          {/* Map Section Searchbar UI (Gooey Animated Capsule with Suggestions Dropdown) */}
          <div
            className="flex-1 flex justify-center relative min-w-[200px] max-w-sm sm:max-w-md mx-auto"
            ref={searchContainerRef}
          >
            <GooeyInput
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onSubmitQuery={(q) => handleDirectSubmit(q)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleDirectSubmit(searchQuery);
                }
              }}
              placeholder="Search locality, city or coordinates..."
            />

            {/* Autocomplete Suggestions Dropdown */}
            {showSuggestions && (suggestions.length > 0 || isSearching) && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-72 sm:w-84 bg-white/95 dark:bg-[#18181b]/95 border border-slate-200 dark:border-[#2c2c2e] rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/60 z-50 overflow-hidden py-1.5 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                  <span>Suggested Locations</span>
                  {isSearching && <RefreshCw className="w-2.5 h-2.5 animate-spin text-sky-500" />}
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                  {suggestions.map((loc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 hover:bg-sky-50 dark:hover:bg-white/10 transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-sky-500 group-hover:text-white transition-colors text-slate-600 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {loc.name}
                        </p>
                        {loc.subText && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {loc.subText}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Share the forecast for the location currently on screen */}
          <div className="w-9 sm:w-10 shrink-0 flex justify-end">
            <ShareButton data={shareData} />
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        <OfflineBanner hasFailedRequest={!!weatherError} onRetry={() => void refetch()} />

        {isLocationFallback && !locationNoticeDismissed && (
          <LocationFallbackNotice
            fallbackName={displayLocName}
            onRetry={isPermanentlyDenied ? undefined : retryLocation}
            onDismiss={() => setLocationNoticeDismissed(true)}
          />
        )}

        {/* The whole page is one Open-Meteo payload, so a failure takes over
            rather than leaving a dozen sections showing em dashes. */}
        {weatherError && !weatherData ? (
          <DataErrorState error={weatherError} onRetry={() => void refetch()} />
        ) : (
          <>
        {/* Weather Hero Card (Light in White Theme, Black in Dark Theme) */}
        <div className="bg-white dark:bg-[#1e1e1e] border border-slate-200/80 dark:border-white/5 rounded-[32px] p-6 sm:p-8 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.75)] flex flex-col sm:flex-row items-center justify-between gap-6 transition-all">
          <div className="flex items-center gap-6">
            {/* Dynamic Day / Night Vector Artwork */}
            <div className="relative shrink-0 flex items-center justify-center">
              {!weatherData || weatherData.current.isDay ? (
                /* Daytime Sun & Cloud */
                <svg
                  viewBox="0 0 140 140"
                  className="w-24 h-24 sm:w-28 sm:h-28"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="weatherSunGrad" x1="15%" y1="10%" x2="85%" y2="90%">
                      <stop offset="0%" stopColor="#FFB300" />
                      <stop offset="60%" stopColor="#FB8C00" />
                      <stop offset="100%" stopColor="#F57C00" />
                    </linearGradient>
                    <linearGradient id="weatherCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="100%" stopColor="#E2E8F0" />
                    </linearGradient>
                    <filter id="weatherCloudShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.25" />
                    </filter>
                  </defs>
                  <circle cx="56" cy="65" r="45" fill="url(#weatherSunGrad)" />
                  <g filter="url(#weatherCloudShadow)">
                    <path
                      d="M62 88h36c6.6 0 12-5.4 12-12 0-5.8-4.2-10.7-9.8-11.8C108.6 57 101.4 50 92.5 50c-6.8 0-12.7 4.1-15.3 10-1.7-.6-3.4-1-5.2-1-7.7 0-14 6.3-14 14 0 .9.1 1.8.3 2.7C54.8 77.2 52 82.2 52 88z"
                      fill="url(#weatherCloudGrad)"
                    />
                  </g>
                </svg>
              ) : (
                /* Nighttime Moon & Cloud (Exact Reference Match) */
                <svg
                  viewBox="0 0 140 140"
                  className="w-24 h-24 sm:w-28 sm:h-28"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="weatherMoonGrad" x1="20%" y1="10%" x2="80%" y2="90%">
                      <stop offset="0%" stopColor="#93c5fd" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                    <linearGradient id="weatherNightCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="70%" stopColor="#E2E8F0" />
                      <stop offset="100%" stopColor="#CBD5E1" />
                    </linearGradient>
                    <filter id="weatherNightCloudShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodOpacity="0.3" />
                    </filter>
                  </defs>
                  {/* Smooth Glowing Blue Crescent Moon */}
                  <path
                    d="M70 20 C46 28 36 50 42 74 C47 88 56 95 66 97 C52 88 47 72 52 56 C56 40 63 28 70 20 Z"
                    fill="url(#weatherMoonGrad)"
                  />
                  {/* Foreground Soft Cloud with Drop Shadow */}
                  <g filter="url(#weatherNightCloudShadow)">
                    <path
                      d="M58 88h40c6.6 0 12-5.4 12-12 0-5.8-4.2-10.7-9.8-11.8C98.6 57 91.4 50 82.5 50c-6.8 0-12.7 4.1-15.3 10-1.7-.6-3.4-1-5.2-1-7.7 0-14 6.3-14 14 0 .9.1 1.8.3 2.7C44.8 77.2 42 82.2 42 88z"
                      fill="url(#weatherNightCloudGrad)"
                    />
                  </g>
                </svg>
              )}
            </div>

            {/* Temperature & Locality (Current Block) */}
            <div className="space-y-1">
              {isLoading || !weatherData ? (
                <SkeletonRegion label={t("common.loading")} className="space-y-2">
                  <Skeleton className="h-11 sm:h-12 w-36" />
                  <Skeleton className="h-4 w-28" />
                </SkeletonRegion>
              ) : (
                <>
                  <div className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
                    {weatherData.current.temp} {weatherData.current.unitSymbol}
                  </div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {displayLocName}
                  </p>
                  {/* Open-Meteo answered, so this reading is live as of the fetch */}
                  <FreshnessIndicator source="live" generatedAt={weatherData.fetchedAt} />
                </>
              )}
            </div>
          </div>

          {/* High/Low, Feels Like & Condition Info */}
          <div className="space-y-1.5 text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-white/10">
            {isLoading || !weatherData ? (
              <SkeletonRegion label={t("common.loading")} className="space-y-2 sm:flex sm:flex-col sm:items-end">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-6 w-24 rounded-xl" />
              </SkeletonRegion>
            ) : (
              <>
                {/* Daily Forecast Range (explicitly labeled as today's forecast) */}
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span className="font-semibold text-slate-400 dark:text-[#8e8e93]">Today&apos;s Range: </span>
                  {t("common.high")}:{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {weatherData.daily.high !== null
                      ? `${weatherData.daily.high}${weatherData.current.unitSymbol}`
                      : DASH}
                  </span>{" "}
                  | {t("common.low")}:{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {weatherData.daily.low !== null
                      ? `${weatherData.daily.low}${weatherData.current.unitSymbol}`
                      : DASH}
                  </span>
                </div>
                {/* Current Apparent Temperature (Current Block) */}
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {t("common.feelsLike")}:{" "}
                  <span className="font-bold text-sky-600 dark:text-sky-400">
                    {weatherData.current.feelsLike !== null
                      ? `${weatherData.current.feelsLike}${weatherData.current.unitSymbol}`
                      : DASH}
                  </span>
                </div>
                {/* Live Condition Badge: mapped from current.weather_code & current.precipitation */}
                <span className="inline-block px-3 py-1 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold rounded-xl mt-1">
                  {weatherData.current.conditionStatus}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Forecast-Labeled Section with Visible Time Reference & Dual Metric Display (Chance % and Total Expected Volume mm) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-sky-50/70 dark:bg-[#18181b] border border-sky-200/70 dark:border-[#2c2c2e] text-xs transition-all shadow-2xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
            <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white font-extrabold text-[10px] uppercase tracking-wider">
              Today&apos;s Forecast
            </span>
            {isLoading || !weatherData ? (
              <SkeletonRegion label={t("common.loading")}>
                <Skeleton className="h-3 w-56" />
              </SkeletonRegion>
            ) : (
              <span>
                {weatherData.daily.rainChanceLaterToday ?? DASH} max rain chance ·{" "}
                {weatherData.daily.precipitationSumMm !== null
                  ? weatherData.daily.precipitationSumMm.toFixed(1)
                  : DASH}{" "}
                mm expected today
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
            {isRefetching && <RefreshCw className="w-3 h-3 animate-spin text-sky-500" />}
            <span>
              Modeled Reference: {weatherData?.hourly.timeReference ?? DASH}
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Activity Rings & Hourly/Daily Curve */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Current Conditions Gauge: Bound strictly to current measurements */}
            <EnvironmentalActivityRings
              precipitationTotalMm={weatherData?.current.precipitationMm}
              rainMm={weatherData?.current.rainMm}
              humidity={weatherData?.current.humidity}
              humidityStatus={weatherData?.current.humidityStatus}
              windSpeed={weatherData?.current.windSpeed}
              windSpeedNum={weatherData?.current.windSpeedRaw}
              windDirection={weatherData?.current.windDirection}
            />

            <InteractiveForecastCard
              lat={activeLat}
              lon={activeLon}
              tempUnit={tempUnit}
              windUnit={windUnit}
            />
          </div>

          {/* RIGHT: Atmospheric & Celestial Insights Grid */}
          <div className="lg:col-span-5 space-y-6">
            {/* Atmospheric Metrics Grid */}
            <section className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#27272a] rounded-3xl p-6 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.6)] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-[#27272a] pb-3">
                <div className="p-2 bg-sky-50 dark:bg-[#1c1c1e] text-sky-600 dark:text-sky-400 rounded-xl border border-sky-100 dark:border-[#2c2c2e]">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">{t("weather.title")}</h2>
                  <p className="text-xs text-slate-500 dark:text-[#8e8e93]">{t("weather.subtitle")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {isLoading || !weatherData ? (
                  <SkeletonRegion label={t("common.loading")} className="contents">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="p-4 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e] space-y-2"
                      >
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-2.5 w-24" />
                      </div>
                    ))}
                  </SkeletonRegion>
                ) : (
                  <>
                {/* UV Index Card: Sourced from hourly.uv_index for current hour (Open-Meteo has no current.uv_index) */}
                <div className="p-4 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e] space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-[#8e8e93] text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>{t("metrics.uv")}</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Current Hour
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {weatherData.hourly.uvIndex ?? DASH}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      {weatherData.hourly.uvLevel
                        ? translateUvLevel(weatherData.hourly.uvLevel, t)
                        : DASH}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-[#8e8e93]">
                      Modeled
                    </span>
                  </div>
                </div>

                {/* Wind Gusts Card: Sourced strictly from current.wind_gusts_10m (separate from wind speed gauge) */}
                <div className="p-4 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e] space-y-1">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-[#8e8e93] text-xs font-semibold">
                    <Wind className="w-4 h-4 text-sky-500" />
                    <span>{t("weather.windGusts")}</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {weatherData.current.windGusts ?? DASH}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-[#8e8e93]">
                    {weatherData.current.windDirection ?? DASH}
                  </span>
                </div>

                {/* Surface Pressure Card: current.surface_pressure */}
                <div className="p-4 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e] space-y-1">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-[#8e8e93] text-xs font-semibold">
                    <Gauge className="w-4 h-4 text-purple-500" />
                    <span>{t("weather.pressure")}</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {weatherData.current.surfacePressure ?? DASH}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-[#8e8e93]">{t("weather.surfaceMsl")}</span>
                </div>

                {/* Cloud Cover Card: current.cloud_cover */}
                <div className="p-4 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e] space-y-1">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-[#8e8e93] text-xs font-semibold">
                    <Eye className="w-4 h-4 text-teal-500" />
                    <span>{t("weather.cloudCover")}</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {weatherData.current.cloudCover ?? DASH}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-[#8e8e93]">{t("weather.overcastIndex")}</span>
                </div>
                  </>
                )}
              </div>
            </section>

            {/* Sun & Moon Celestial Timings (Daily Block) */}
            <section className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#27272a] rounded-3xl p-6 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.6)] space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-[#27272a] pb-3">
                <div className="p-2 bg-amber-50 dark:bg-[#1c1c1e] text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-[#2c2c2e]">
                  <Sunrise className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">{t("weather.celestialTitle")}</h2>
                  <p className="text-xs text-slate-500 dark:text-[#8e8e93]">{t("weather.celestialSubtitle")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-4 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e] flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                    <Sunrise className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-[#8e8e93] font-semibold block">{t("weather.sunrise")}</span>
                    {isLoading || !weatherData ? (
                      <Skeleton className="h-4 w-20 mt-1" />
                    ) : (
                      <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                        {weatherData.daily.sunrise ?? DASH}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e] flex items-center gap-3">
                  <div className="p-2.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-xl">
                    <Sunset className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 dark:text-[#8e8e93] font-semibold block">{t("weather.sunset")}</span>
                    {isLoading || !weatherData ? (
                      <Skeleton className="h-4 w-20 mt-1" />
                    ) : (
                      <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                        {weatherData.daily.sunset ?? DASH}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e] flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-[#8e8e93]">{t("weather.daylightDuration")}:</span>
                {isLoading || !weatherData ? (
                  <Skeleton className="h-3 w-16" />
                ) : (
                  <span className="font-bold text-slate-900 dark:text-white">
                    {weatherData.daily.daylightDuration ?? DASH}
                  </span>
                )}
              </div>
            </section>
          </div>
        </div>
          </>
        )}
      </main>
    </div>
    </PullToRefresh>
  );
}
