"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  fetchHomepage,
  fetchExplanation,
  updatePreferences,
  fetchPreferences,
  readCachedHomepage,
  CardResponse,
  ExplanationResponse,
} from "@/lib/api";
import { Toggle, ToggleGroup } from "@/components/animate-ui/components/base/toggle-group";
import { RippleButton, RippleButtonRipples } from "@/components/animate-ui/components/buttons/ripple";
import { MobileMenuTrigger } from "@/components/AppSidebar";
import PersonaInsightsSection from "@/components/PersonaInsightsSection";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useI18n } from "@/context/I18nContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { PullToRefresh } from "@/components/PullToRefresh";
import { OfflineBanner } from "@/components/OfflineBanner";
import { FreshnessIndicator, StaleDataBanner, deriveFeedSource } from "@/components/FreshnessIndicator";
import { DataErrorState, NoDataState, LocationFallbackNotice } from "@/components/StateViews";
import { ShareButton, type ForecastShareData } from "@/components/ShareButton";
import { Skeleton, SkeletonCardRow, SkeletonRegion } from "@/components/ui/skeleton";
import {
  translateConditionString,
  formatLocalizedWindDirectionSimple,
  formatLocalizedWmoCondition,
} from "@/lib/i18n/weatherFormatters";
import { formatLocalizedLocation } from "@/lib/i18n/localizeLocation";
import {
  CloudSun,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  LogOut,
  Sparkles,
  HeartPulse,
  Activity,
  Users,
  X,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Flame,
  Wind,
  Sun,
  MapPin,
  Shirt,
  Car,
  Plane,
  Flower2,
  CalendarCheck,
  Compass,
  Waves,
  ArrowRight,
  Sunrise,
  Sunset,
  Eye,
  Umbrella,
  Thermometer,
  Gauge,
  CheckCircle2,
  TrendingUp,
  Clock,
  Navigation,
} from "lucide-react";

export interface PersonaDef {
  id: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  activeBg: string;
}

export const ALL_PERSONAS: PersonaDef[] = [
  {
    id: "health",
    title: "Health-Conscious",
    shortTitle: "Health",
    subtitle: "AQI dial, UV index, pollen & humidity alerts",
    icon: HeartPulse,
    color: "text-emerald-600",
    activeBg: "bg-teal-600 text-white shadow-teal-600/25",
  },
  {
    id: "fitness",
    title: "Runner / Athlete",
    shortTitle: "Runner",
    subtitle: "Optimal running window, pace score & weather notes",
    icon: Activity,
    color: "text-amber-600",
    activeBg: "bg-amber-600 text-white shadow-amber-600/25",
  },
  {
    id: "beach",
    title: "Beachgoer / Surfer",
    shortTitle: "Beach & Surf",
    subtitle: "Tide chart, wave height & swell direction",
    icon: Waves,
    color: "text-cyan-600",
    activeBg: "bg-cyan-600 text-white shadow-cyan-600/25",
  },
  {
    id: "traveler",
    title: "Traveler",
    shortTitle: "Traveler",
    subtitle: "Multi-city cards, flight risk & packing tips",
    icon: Plane,
    color: "text-blue-600",
    activeBg: "bg-blue-600 text-white shadow-blue-600/25",
  },
  {
    id: "family",
    title: "Parent / Family",
    shortTitle: "Family",
    subtitle: "School commute rain alert, fog & storm warning",
    icon: Users,
    color: "text-sky-600",
    activeBg: "bg-sky-600 text-white shadow-sky-600/25",
  },
  {
    id: "agriculture",
    title: "Farmer / Gardener",
    shortTitle: "Gardener",
    subtitle: "Soil moisture, frost alert & rainfall prediction",
    icon: Flower2,
    color: "text-lime-700",
    activeBg: "bg-lime-700 text-white shadow-lime-700/25",
  },
  {
    id: "commuter",
    title: "Commuter",
    shortTitle: "Commuter",
    subtitle: "Visibility index & traffic delay integration",
    icon: Car,
    color: "text-purple-600",
    activeBg: "bg-purple-600 text-white shadow-purple-600/25",
  },
  {
    id: "event",
    title: "Event Planner",
    shortTitle: "Event",
    subtitle: "10-day forecast, rain probability & best timings",
    icon: CalendarCheck,
    color: "text-rose-600",
    activeBg: "bg-rose-600 text-white shadow-rose-600/25",
  },
];

export default function HomePage() {
  const { deviceId, user, logoutUser, loading: authLoading } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeExplanationRef, setActiveExplanationRef] = useState<string | null>(null);
  const [activeCardTitle, setActiveCardTitle] = useState<string>("");
  const [selectedPersona, setSelectedPersona] = useState<string>("health");

  // Geolocation. The hook keeps the previous Pune fallback so the page always
  // renders, but reports *why* it fell back so we can say so (see the
  // LocationFallbackNotice below) instead of silently showing another city.
  const {
    coords,
    locationName: locName,
    isLocating,
    isFallback: isLocationFallback,
    isPermanentlyDenied,
    retry: retryLocation,
  } = useGeolocation({ locale });

  const [locationNoticeDismissed, setLocationNoticeDismissed] = useState(false);

  const displayLocName = formatLocalizedLocation(
    isLocating ? t("common.loading") : locName,
    locale,
    t("common.loading")
  );

  // Fetch user preferences from backend
  const { data: userPrefs } = useQuery({
    queryKey: ["preferences", deviceId],
    queryFn: () => fetchPreferences(deviceId),
    enabled: !!deviceId,
  });

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

  const formatTemp = (celsius: number) => {
    if (tempUnit === "f") {
      return Math.round(celsius * 1.8 + 32);
    }
    return Math.round(celsius);
  };

  const formatWind = (kmh: number) => {
    if (windUnit === "mph") {
      return `${(kmh * 0.621371).toFixed(1)} mph`;
    }
    return `${kmh.toFixed(1)} kph`;
  };

  // Extract ONLY personas selected by the user in Settings (hide unselected personas)
  const userSelectedPersonaIds: string[] =
    userPrefs?.personas && userPrefs.personas.length > 0
      ? userPrefs.personas.filter((p: string) => p !== "default_general").slice(0, 3)
      : ["health"];

  const displayPersonaList =
    ALL_PERSONAS.filter((p) => userSelectedPersonaIds.includes(p.id)).length > 0
      ? ALL_PERSONAS.filter((p) => userSelectedPersonaIds.includes(p.id))
      : [ALL_PERSONAS[0]];

  // Keep selectedPersona synced to one of the user's selected personas
  useEffect(() => {
    if (userPrefs?.personas && userPrefs.personas.length > 0) {
      const filtered = userPrefs.personas.filter((p: string) => p !== "default_general");
      if (filtered.length > 0) {
        if (!filtered.includes(selectedPersona)) {
          setSelectedPersona(filtered[0]);
        }
      }
    }
  }, [userPrefs, selectedPersona]);

  const activeLat = coords.lat;
  const activeLon = coords.lon;

  // Fetch Homepage Data
  const {
    data: homepageData,
    isLoading: hpLoading,
    isRefetching,
    error: hpError,
    refetch: refetchHomepage,
  } = useQuery({
    queryKey: ["homepage", deviceId, activeLat, activeLon],
    queryFn: () => fetchHomepage(deviceId, activeLat, activeLon),
    enabled: !!deviceId,
  });

  /**
   * Last payload that genuinely came from the backend, persisted by
   * `fetchHomepage`. Used only when the live request failed, so an offline user
   * sees their real previous forecast (clearly labelled) instead of nothing —
   * and never the invented "Demo Mode" cards the API client used to synthesize.
   */
  const cachedHomepage = useMemo(
    () => (hpError && deviceId ? readCachedHomepage(deviceId) : null),
    [hpError, deviceId]
  );

  const feedData = homepageData ?? cachedHomepage?.payload;
  const feedGeneratedAt = homepageData?.generated_at ?? cachedHomepage?.payload.generated_at ?? null;
  // A cached payload is stale by definition, whatever its cards claim.
  const feedSource = homepageData
    ? deriveFeedSource(homepageData.cards)
    : cachedHomepage
      ? "stale"
      : null;

  // Fetch Live Real-Time Current Weather & Conditions for Active Location
  const {
    data: realTimeWeather,
    isLoading: rtLoading,
    error: rtError,
    refetch: refetchRealTime,
  } = useQuery({
    queryKey: ["realtime-weather", activeLat, activeLon, tempUnit, windUnit],
    queryFn: async () => {
      // [CURRENT BLOCK] Live instantaneous measurements & [DAILY BLOCK] Today's high/low and rain probability
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${activeLat}&longitude=${activeLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`
      );
      if (!res.ok) throw new Error("Failed to fetch current weather");
      const data = await res.json();

      const isDaytime = data.current?.is_day === 1;

      const degToCompass = (deg: number) => {
        const val = Math.floor(deg / 22.5 + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        return arr[val % 16];
      };

      // [CURRENT BLOCK]
      const code = data.current?.weather_code ?? 0;
      const windDeg = data.current?.wind_direction_10m ?? 240;
      const humidityVal = Math.round(data.current?.relative_humidity_2m ?? 65);
      const rawTemp = data.current?.temperature_2m ?? 28;
      const rawFeelsLike = data.current?.apparent_temperature ?? 29.5;
      const rawWindKmh = data.current?.wind_speed_10m ?? 18.5; // current.wind_speed_10m
      const rawPrecip = data.current?.precipitation ?? 0.0; // current.precipitation (total, mm)
      const rawRain = data.current?.rain ?? 0.0; // current.rain (rain-specific, mm)

      // [DAILY BLOCK]
      const rawHigh = data.daily?.temperature_2m_max?.[0] ?? 30;
      const rawLow = data.daily?.temperature_2m_min?.[0] ?? 22;
      const rawDailyRainProb = Math.round(data.daily?.precipitation_probability_max?.[0] ?? 10);

      return {
        // [CURRENT BLOCK]
        numericTemp: rawTemp,
        numericHumidity: humidityVal,
        numericWind: rawWindKmh,
        numericPrecip: rawPrecip,
        numericRain: rawRain,
        temp: formatTemp(rawTemp),
        unitSymbol: tempUnit === "f" ? "°F" : "°C",
        feelsLike: formatTemp(rawFeelsLike),
        isDay: isDaytime,
        humidity: humidityVal,
        humidityStatus: humidityVal > 75 ? "Humid" : humidityVal < 35 ? "Dry" : "Comfortable",
        precipitation: `${rawPrecip.toFixed(1)} mm`,
        rainFormatted: `${rawRain.toFixed(1)} mm`,
        windSpeed: formatWind(rawWindKmh),
        windDirection: `${degToCompass(windDeg)} Direction`,
        conditionStatus: formatLocalizedWmoCondition(code, isDaytime, t, rawPrecip),
        weatherCode: code,
        windDeg: windDeg,
        // [DAILY BLOCK]
        high: formatTemp(rawHigh),
        low: formatTemp(rawLow),
        dailyPrecipProb: rawDailyRainProb,
      };
    },
  });

  // Fetch Live Air Quality & UV Index (same Open-Meteo Air Quality integration used on the Map page)
  const { data: airQuality, refetch: refetchAirQuality } = useQuery({
    queryKey: ["air-quality", activeLat, activeLon],
    queryFn: async () => {
      const res = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${activeLat}&longitude=${activeLon}&current=us_aqi,uv_index`
      );
      if (!res.ok) throw new Error("Failed to fetch air quality data");
      const data = await res.json();
      return {
        aqi: data.current?.us_aqi ?? null,
        uvIndex: data.current?.uv_index ?? null,
      };
    },
  });

  // Fetch Explanation Sheet Data
  const { data: explanationData, isLoading: expLoading } = useQuery({
    queryKey: ["explain", activeExplanationRef],
    queryFn: () => fetchExplanation(activeExplanationRef!),
    enabled: !!activeExplanationRef,
  });

  // Persona quick-switch mutation (updates active preference on backend)
  const switchPersonaMutation = useMutation({
    mutationFn: async (newPersona: string) => {
      setSelectedPersona(newPersona);
      const currentFlags = userPrefs?.health_flags || [];
      // Keep existing selected personas list intact or put active first
      const otherPersonas = userSelectedPersonaIds.filter((p) => p !== newPersona);
      await updatePreferences({
        device_id: deviceId,
        personas: [newPersona, ...otherPersonas],
        health_flags: currentFlags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage", deviceId] });
      queryClient.invalidateQueries({ queryKey: ["preferences", deviceId] });
    },
  });

  /**
   * Single refresh path, shared by the pull gesture and the sidebar's refresh
   * button. Awaits every request so the pull indicator keeps spinning until the
   * screen is actually up to date rather than for a fixed timeout.
   */
  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
      refetchHomepage(),
      refetchRealTime(),
      refetchAirQuality(),
    ]);
  }, [refetchHomepage, refetchRealTime, refetchAirQuality]);

  // Listen for global sidebar refresh events. Location re-detection is handled
  // inside useGeolocation, so this only has to refresh the page's own data.
  useEffect(() => {
    const onGlobalRefresh = () => {
      void refreshAll();
    };
    window.addEventListener("mausam_refresh_location", onGlobalRefresh);
    window.addEventListener("mausam_refresh_weather", onGlobalRefresh);
    return () => {
      window.removeEventListener("mausam_refresh_location", onGlobalRefresh);
      window.removeEventListener("mausam_refresh_weather", onGlobalRefresh);
    };
  }, [refreshAll]);

  // Icon and badge styling matching Persona Index & Insights list items
  const getPersonaCardConfig = (card: CardResponse) => {
    const cid = card.card_id.toLowerCase();

    if (cid.includes("severe") || cid.includes("warning")) {
      return {
        title: "Severe Weather Warning",
        bg: "bg-red-600",
        icon: <AlertTriangle className="w-5 h-5 text-white" />,
        category: "Alert",
      };
    }
    if (cid.includes("sunrise") || cid.includes("sunset") || cid.includes("daylight")) {
      return {
        title: "Daylight Hours",
        bg: "bg-orange-500",
        icon: <Sunrise className="w-5 h-5 text-white" />,
        category: "Sun",
      };
    }
    if (cid.includes("aqi")) {
      return {
        title: "Air Quality Index",
        bg: "bg-teal-500",
        icon: <Wind className="w-5 h-5 text-white" />,
        category: "Air Quality",
      };
    }
    if (cid.includes("clothing") || cid.includes("general") || cid.includes("temp")) {
      return {
        title: "Clothing & Gear",
        bg: "bg-blue-600",
        icon: <Shirt className="w-5 h-5 text-white" />,
        category: "Comfort",
      };
    }
    if (cid.includes("activity") || cid.includes("fitness") || cid.includes("exercise")) {
      return {
        title: "Exercise & Workout",
        bg: "bg-amber-500",
        icon: <Activity className="w-5 h-5 text-white" />,
        category: "Fitness",
      };
    }
    if (cid.includes("uv") || cid.includes("sun") || cid.includes("skincare")) {
      return {
        title: "Skincare & Sun",
        bg: "bg-cyan-500",
        icon: <Sun className="w-5 h-5 text-white" />,
        category: "Skincare",
      };
    }
    if (cid.includes("rain") || cid.includes("commute") || cid.includes("driving")) {
      return {
        title: "Driving & Commute",
        bg: "bg-sky-500",
        icon: <Car className="w-5 h-5 text-white" />,
        category: "Commute",
      };
    }
    if (cid.includes("pollen")) {
      return {
        title: "Pollen Allergen Risk",
        bg: "bg-purple-500",
        icon: <Flower2 className="w-5 h-5 text-white" />,
        category: "Allergen",
      };
    }

    return {
      title: card.title,
      bg: "bg-indigo-500",
      icon: <CloudSun className="w-5 h-5 text-white" />,
      category: "Personalized",
    };
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-ios-grouped dark:bg-black flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-ios-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activePersonaObj =
    displayPersonaList.find((p) => p.id === selectedPersona) || displayPersonaList[0];

  const topWarning = feedData?.warnings_override?.[0];

  const shareData: ForecastShareData = {
    locationName: displayLocName,
    temperature: realTimeWeather?.numericTemp ?? null,
    unitSymbol: tempUnit === "f" ? "°F" : "°C",
    condition: realTimeWeather
      ? translateConditionString(realTimeWeather.conditionStatus, t)
      : null,
    high: realTimeWeather ? Number(realTimeWeather.high) : null,
    low: realTimeWeather ? Number(realTimeWeather.low) : null,
    rainProbability: realTimeWeather?.dailyPrecipProb ?? null,
    aqi: airQuality?.aqi ?? null,
    uvIndex: airQuality?.uvIndex ?? null,
    warning: topWarning
      ? { type: topWarning.type, severity: topWarning.severity, text: topWarning.text }
      : null,
  };

  return (
    <PullToRefresh onRefresh={refreshAll}>
    <div className="min-h-screen bg-ios-grouped dark:bg-black text-ios-label dark:text-ios-label-dark flex flex-col selection:bg-ios-blue selection:text-white pb-12 lg:pb-16 ios-safe-bottom transition-colors duration-300">
      {/* Top Action Bar — sticky iOS nav: transparent until content scrolls under it */}
      <header className="ios-nav sticky top-0 z-40 w-full px-4 sm:px-8 pb-2 ios-safe-top">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center">
            {/* Mobile: Hamburger menu button */}
            <MobileMenuTrigger />
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-5 flex-1 space-y-5">
        {/* Connectivity / freshness / permission notices. Each one is silent
            unless it applies, so a healthy session sees none of them. */}
        <OfflineBanner
          cachedAt={cachedHomepage?.cachedAt}
          hasFailedRequest={!!hpError}
          onRetry={() => void refreshAll()}
        />

        {isLocationFallback && !locationNoticeDismissed && (
          <LocationFallbackNotice
            fallbackName={locName}
            onRetry={isPermanentlyDenied ? undefined : retryLocation}
            onDismiss={() => setLocationNoticeDismissed(true)}
          />
        )}

        {/* Only warn about age when we are showing live (not cached) data —
            the OfflineBanner above already covers the cached case. */}
        {homepageData && (
          <StaleDataBanner
            source={feedSource}
            generatedAt={feedGeneratedAt}
            onRefresh={() => void refreshAll()}
          />
        )}

        {/* P0 Severe Warnings Bar */}
        {feedData?.warnings_override && feedData.warnings_override.length > 0 && (
          <div className="space-y-3">
            {feedData.warnings_override.map((w, idx) => (
              <div
                key={idx}
                className="p-4 sm:p-5 bg-ios-red text-white rounded-ios-card shadow-[0_8px_28px_-8px_rgba(255,59,48,0.55)] flex items-start gap-3.5"
              >
                <div className="p-2.5 bg-white/20 rounded-ios shrink-0">
                  <ShieldAlert className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-white text-ios-red font-semibold text-[10px] uppercase tracking-wider">
                      {t("home.p0Warning")}
                    </span>
                    <span className="text-[11px] text-white/80 font-semibold uppercase tracking-wide">
                      {w.type} • {w.severity}
                    </span>
                  </div>
                  <p className="text-white font-semibold text-[15px] leading-snug tracking-[-0.011em]">
                    {w.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Responsive Dashboard Grid: Primary Persona Column + Live Atmospheric Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Main Persona Section (col-span-7 on lg, col-span-8 on xl) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-5">
            <section className="ios-card overflow-hidden">
              {/* Persona Section Header */}
              <div className="p-5 border-b-[0.5px] border-[var(--ios-separator)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-ios-blue dark:bg-ios-blue-dark text-white rounded-ios">
                      <Sparkles className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <div>
                      <h2 className="ios-title text-[17px] text-ios-label dark:text-ios-label-dark">
                        {t("insights.personaIndexTitle")}
                      </h2>
                      <p className="ios-footnote">
                        {t("insights.personaIndexSubtitle")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <RippleButton
                      variant="outline"
                      size="icon"
                      onClick={() => router.push("/settings")}
                      className="ios-pressable h-9 w-9 rounded-full border-0 text-ios-blue dark:text-ios-blue-dark bg-ios-fill dark:bg-ios-fill-dark"
                      title={t("insights.managePersonas")}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <RippleButtonRipples color="rgba(0, 122, 255, 0.3)" />
                    </RippleButton>
                    <span className="ios-footnote font-semibold hidden sm:inline">
                      {t("insights.dynamicPriority")}
                    </span>
                  </div>
                </div>

                {/* Persona Switcher Toggle Group - ONLY SHOWS USER'S SELECTED PERSONAS */}
                <div className="pt-0.5 flex flex-wrap items-center gap-1.5 no-scrollbar overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <ToggleGroup
                    value={selectedPersona}
                    size="sm"
                    onValueChange={(val) => {
                      if (val && val !== selectedPersona) {
                        switchPersonaMutation.mutate(val);
                      }
                    }}
                    className="flex flex-wrap items-center gap-1.5 p-0 bg-transparent"
                  >
                    {displayPersonaList.map((p) => {
                      const Icon = p.icon;
                      return (
                        <Toggle
                          key={p.id}
                          value={p.id}
                          aria-label={`Select ${p.title} persona`}
                          disabled={switchPersonaMutation.isPending}
                          activeColor={p.activeBg}
                          className="ios-pressable h-8 px-3.5 py-1 text-[13px] font-semibold rounded-full min-w-0 shadow-none border-0 bg-ios-fill dark:bg-ios-fill-dark"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{t("personas." + p.id + ".shortTitle") || p.shortTitle}</span>
                        </Toggle>
                      );
                    })}
                  </ToggleGroup>
                </div>
              </div>

              {/* =============================================================== */}
              {/* RANKED, EXPLAINABLE PRIORITY CARDS — the personalization engine's */}
              {/* actual output for this persona (distinct from raw Weather page   */}
              {/* metrics: each card is already filtered, ranked and explainable). */}
              {/* =============================================================== */}
              <div className="p-4 sm:p-5 space-y-2 border-b-[0.5px] border-[var(--ios-separator)]">
                {hpLoading ? (
                  /* Skeleton rows match the real card geometry, so the list does
                     not jump when data lands. */
                  <SkeletonRegion label={t("common.loading")} className="space-y-2.5">
                    <SkeletonCardRow />
                    <SkeletonCardRow />
                    <SkeletonCardRow />
                  </SkeletonRegion>
                ) : hpError && !feedData ? (
                  /* Reachable for the first time: fetchHomepage used to swallow
                     every error and return fabricated "Demo Mode" cards. */
                  <DataErrorState error={hpError} onRetry={() => void refetchHomepage()} />
                ) : feedData?.cards && feedData.cards.length > 0 ? (
                  feedData.cards.map((card) => {
                    const cfg = getPersonaCardConfig(card);
                    const priorityStyles: Record<string, string> = {
                      P0: "bg-ios-red/12 text-ios-red",
                      P1: "bg-ios-orange/14 text-ios-orange",
                      P2: "bg-ios-blue/12 text-ios-blue dark:text-ios-blue-dark",
                      P3: "bg-ios-fill dark:bg-ios-fill-dark text-ios-label-2 dark:text-ios-label-2-dark",
                    };
                    return (
                      <button
                        key={card.card_id}
                        type="button"
                        onClick={() => {
                          setActiveCardTitle(cfg.title);
                          setActiveExplanationRef(card.explanation_ref);
                        }}
                        className="ios-pressable-card w-full flex items-center gap-3 p-3 rounded-ios bg-ios-fill/60 dark:bg-ios-fill-dark/60 text-left cursor-pointer"
                      >
                        <div className={`w-9 h-9 rounded-ios-sm ${cfg.bg} flex items-center justify-center shrink-0`}>
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[15px] font-semibold tracking-[-0.011em] text-ios-label dark:text-ios-label-dark truncate">
                              {cfg.title}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                priorityStyles[card.priority] ?? priorityStyles.P3
                              }`}
                            >
                              {card.priority}
                            </span>
                          </div>
                          <p className="ios-footnote truncate mt-0.5">
                            {card.value_summary}
                          </p>
                        </div>
                        <ChevronRight
                          className="w-4 h-4 text-ios-label-3 dark:text-ios-label-3-dark shrink-0"
                          strokeWidth={2.5}
                        />
                      </button>
                    );
                  })
                ) : (
                  <NoDataState
                    onChangeLocation={() => router.push("/map")}
                    onRetry={() => void refetchHomepage()}
                  />
                )}
              </div>

              {/* =============================================================== */}
              {/* DYNAMIC PERSONA WEATHER INSIGHTS & TIME WINDOWS (CONFIG DRIVEN)   */}
              {/* =============================================================== */}
              <div className="p-4 sm:p-5">
                {rtLoading || !realTimeWeather ? (
                  /* The insights engine derives windows and scores from these
                     numbers, so feeding it placeholders would produce confident
                     advice about weather that isn't happening. Wait instead. */
                  <SkeletonRegion label={t("common.loading")} className="space-y-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-16 w-full rounded-ios" />
                    <Skeleton className="h-16 w-full rounded-ios" />
                  </SkeletonRegion>
                ) : (
                  <PersonaInsightsSection
                    persona={selectedPersona}
                    currentTemp={realTimeWeather.numericTemp}
                    humidity={realTimeWeather.numericHumidity}
                    windSpeed={realTimeWeather.numericWind}
                    precipitation={realTimeWeather.numericPrecip}
                    rainProbability={realTimeWeather.dailyPrecipProb}
                    aqi={airQuality?.aqi ?? undefined}
                    uvIndex={airQuality?.uvIndex ?? undefined}
                    locationName={displayLocName}
                    conditionText={realTimeWeather.conditionStatus}
                    tempUnit={tempUnit}
                    windUnit={windUnit}
                  />
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Live Ambient Weather & Quick Atmospheric Overview (col-span-5 on lg, col-span-4 on xl) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            {/* Live Weather Card */}
            <div className="ios-card-raised p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-4 h-4 text-ios-blue dark:text-ios-blue-dark shrink-0" strokeWidth={2.25} />
                  <span className="text-[13px] font-semibold text-ios-label dark:text-ios-label-dark truncate max-w-[170px]">
                    {displayLocName}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isRefetching && (
                    <RefreshCw
                      className="w-3 h-3 text-ios-blue dark:text-ios-blue-dark animate-spin"
                      aria-label={t("refresh.refreshing")}
                    />
                  )}
                  <ShareButton data={shareData} />
                </div>
              </div>

              {/* Reports the backend's actual per-card source and age. This used
                  to be an unconditional green "Live" pill, shown even over
                  simulated fixture data. */}
              <FreshnessIndicator source={feedSource} generatedAt={feedGeneratedAt} className="-mt-3" />

              {/* Temperature & Vector Graphic */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  {rtLoading || !realTimeWeather ? (
                    <SkeletonRegion label={t("common.loading")} className="space-y-2">
                      <Skeleton className="h-11 sm:h-14 w-32" />
                      <Skeleton className="h-3 w-44" />
                      <Skeleton className="h-2.5 w-28" />
                    </SkeletonRegion>
                  ) : (
                    <>
                      <div className="ios-numeric text-[56px] sm:text-[64px] font-thin text-ios-label dark:text-ios-label-dark tracking-[-0.03em] leading-[0.95]">
                        {formatTemp(realTimeWeather.numericTemp)}°
                        <span className="text-[0.4em] font-light align-top ml-0.5">
                          {tempUnit.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[15px] font-medium text-ios-label-2 dark:text-ios-label-2-dark mt-1 tracking-[-0.011em]">
                        {/* feelsLike/high/low are already unit-converted by the
                            query — running formatTemp again would double-convert
                            (29.5°C would render as 185°F). */}
                        {translateConditionString(realTimeWeather.conditionStatus, t)}
                      </p>
                      <div className="ios-footnote mt-0.5 ios-numeric">
                        {t("common.feelsLike")} {realTimeWeather.feelsLike}° · {t("common.high")}{" "}
                        {realTimeWeather.high}° · {t("common.low")} {realTimeWeather.low}°
                      </div>
                    </>
                  )}
                </div>

                <div className="relative shrink-0 flex items-center justify-center">
                  {!realTimeWeather || realTimeWeather.isDay ? (
                    <svg viewBox="0 0 140 140" className="w-20 h-20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="homeSunGrad" x1="15%" y1="10%" x2="85%" y2="90%">
                          <stop offset="0%" stopColor="#FFB300" />
                          <stop offset="60%" stopColor="#FB8C00" />
                          <stop offset="100%" stopColor="#F57C00" />
                        </linearGradient>
                        <linearGradient id="homeCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FFFFFF" />
                          <stop offset="100%" stopColor="#E2E8F0" />
                        </linearGradient>
                      </defs>
                      <circle cx="56" cy="65" r="42" fill="url(#homeSunGrad)" />
                      <path
                        d="M62 88h36c6.6 0 12-5.4 12-12 0-5.8-4.2-10.7-9.8-11.8C108.6 57 101.4 50 92.5 50c-6.8 0-12.7 4.1-15.3 10-1.7-.6-3.4-1-5.2-1-7.7 0-14 6.3-14 14 0 .9.1 1.8.3 2.7C54.8 77.2 52 82.2 52 88z"
                        fill="url(#homeCloudGrad)"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 140 140" className="w-20 h-20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="homeMoonGrad" x1="20%" y1="10%" x2="80%" y2="90%">
                          <stop offset="0%" stopColor="#93c5fd" />
                          <stop offset="50%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                        <linearGradient id="homeNightCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FFFFFF" />
                          <stop offset="100%" stopColor="#CBD5E1" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M70 20 C46 28 36 50 42 74 C47 88 56 95 66 97 C52 88 47 72 52 56 C56 40 63 28 70 20 Z"
                        fill="url(#homeMoonGrad)"
                      />
                      <path
                        d="M58 88h40c6.6 0 12-5.4 12-12 0-5.8-4.2-10.7-9.8-11.8C98.6 57 91.4 50 82.5 50c-6.8 0-12.7 4.1-15.3 10-1.7-.6-3.4-1-5.2-1-7.7 0-14 6.3-14 14 0 .9.1 1.8.3 2.7C44.8 77.2 42 82.2 42 88z"
                        fill="url(#homeNightCloudGrad)"
                      />
                    </svg>
                  )}
                </div>
              </div>

              {/* Condensed one-line context — full metric breakdown lives on the
                  Weather page, so this stays a glance, not a duplicate grid. */}
              {rtLoading || !realTimeWeather ? (
                <Skeleton className="h-3 w-full" />
              ) : (
                <p className="ios-footnote leading-relaxed ios-numeric">
                  {t("metrics.humidity")} {realTimeWeather.numericHumidity}% ·{" "}
                  {t("metrics.wind")} {formatWind(realTimeWeather.numericWind)} ·{" "}
                  {t("metrics.rain")} {realTimeWeather.dailyPrecipProb}%
                  {airQuality?.uvIndex !== undefined && airQuality?.uvIndex !== null
                    ? ` · UV ${airQuality.uvIndex.toFixed(1)}`
                    : ""}
                </p>
              )}

              {rtError && (
                <DataErrorState error={rtError} onRetry={() => void refetchRealTime()} />
              )}

              {/* Action Button to Full Weather Dashboard */}
              <button
                type="button"
                onClick={() => router.push("/weather")}
                className="ios-pressable w-full py-3 px-4 bg-ios-blue dark:bg-ios-blue-dark text-white rounded-ios font-semibold text-[15px] tracking-[-0.011em] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{t("home.viewDashboard")}</span>
                <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* EXPLANATION DRAWER MODAL */}
      {activeExplanationRef && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/65 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="ios-card-raised max-w-lg w-full p-6 pb-8 sm:pb-6 rounded-t-[28px] rounded-b-none sm:rounded-ios-lg space-y-5 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 ios-safe-bottom">
            <div className="flex items-center justify-between border-b-[0.5px] border-[var(--ios-separator)] pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-ios-blue/12 rounded-ios text-ios-blue dark:text-ios-blue-dark shrink-0">
                  <Sparkles className="w-4 h-4" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h3 className="ios-headline text-ios-label dark:text-ios-label-dark">
                    Why this was ranked
                  </h3>
                  <p className="ios-footnote truncate">{activeCardTitle}</p>
                </div>
              </div>
              <RippleButton
                variant="ghost"
                size="icon"
                onClick={() => setActiveExplanationRef(null)}
                className="ios-pressable h-8 w-8 shrink-0 rounded-full bg-ios-fill dark:bg-ios-fill-dark text-ios-label-2 dark:text-ios-label-2-dark"
              >
                <X className="w-4 h-4" strokeWidth={2.25} />
                <RippleButtonRipples />
              </RippleButton>
            </div>

            {expLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2.5">
                <div className="w-6 h-6 border-2 border-ios-blue border-t-transparent rounded-full animate-spin" />
                <span className="ios-footnote">Computing decision audit...</span>
              </div>
            ) : explanationData ? (
              <div className="space-y-4">
                <div className="ios-inset p-3.5 text-[15px] text-ios-label dark:text-ios-label-dark leading-relaxed tracking-[-0.011em]">
                  {explanationData.text}
                </div>

                {/* Score Multipliers */}
                {explanationData.score_components && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="ios-inset p-2.5">
                      <div className="text-[10px] text-ios-label-2 dark:text-ios-label-2-dark font-semibold uppercase tracking-wide">
                        Persona Wt
                      </div>
                      <div className="ios-numeric font-semibold text-ios-label dark:text-ios-label-dark text-[17px] mt-0.5">
                        {explanationData.score_components.persona_weight?.toFixed(2) ?? "1.00"}
                      </div>
                    </div>
                    <div className="ios-inset p-2.5">
                      <div className="text-[10px] text-ios-label-2 dark:text-ios-label-2-dark font-semibold uppercase tracking-wide">
                        Urgency Mult
                      </div>
                      <div className="ios-numeric font-semibold text-ios-orange text-[17px] mt-0.5">
                        {explanationData.score_components.urgency_multiplier?.toFixed(2) ?? "1.00"}
                      </div>
                    </div>
                    <div className="ios-inset p-2.5">
                      <div className="text-[10px] text-ios-label-2 dark:text-ios-label-2-dark font-semibold uppercase tracking-wide">
                        Confidence
                      </div>
                      <div className="ios-numeric font-semibold text-ios-green text-[17px] mt-0.5">
                        {explanationData.score_components.confidence_factor?.toFixed(2) ?? "1.00"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="ios-footnote">Explanation details unavailable.</p>
            )}

            <RippleButton
              variant="default"
              size="lg"
              onClick={() => setActiveExplanationRef(null)}
              className="ios-pressable w-full py-3 rounded-ios font-semibold text-[15px] bg-ios-blue dark:bg-ios-blue-dark text-white border-0 shadow-none"
            >
              Close Audit
              <RippleButtonRipples />
            </RippleButton>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
