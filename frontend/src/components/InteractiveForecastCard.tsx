"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/context/I18nContext";

type MetricTab = "temperature" | "precipitation" | "wind";

export interface HourlyPoint {
  time: string;
  isNow?: boolean;
  temp: number;
  precip: number; // percentage (0-100%)
  precipMm: number; // expected volume in mm (keep 1 decimal)
  speed: string;
  speedNum: number;
  rotation: number; // degrees
  weatherCode: number;
  condition: "rain" | "partly-cloudy" | "cloudy" | "sunny";
}

export interface DailyPoint {
  day: string;
  condition: "rain" | "partly-cloudy" | "cloudy" | "sunny";
  high: number;
  low: number;
}

export function InteractiveForecastCard({
  lat = 18.4635,
  lon = 73.8732,
  tempUnit = "c",
  windUnit = "kmh",
  className = "",
}: {
  lat?: number;
  lon?: number;
  tempUnit?: "c" | "f";
  windUnit?: "kmh" | "mph";
  className?: string;
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<MetricTab>("temperature");
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [hourlySpan, setHourlySpan] = useState<"8h" | "24h">("8h");
  const [hourlyData, setHourlyData] = useState<HourlyPoint[]>([]);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [rawApiData, setRawApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const convertTemp = (celsius: number) => {
    if (tempUnit === "f") return Math.round(celsius * 1.8 + 32);
    return Math.round(celsius);
  };

  const convertWindSpeed = (kmh: number) => {
    if (windUnit === "mph") return Math.round(kmh * 0.621371);
    return Math.round(kmh);
  };

  const formatWindLabel = (kmh: number) => {
    if (windUnit === "mph") return `${Math.round(kmh * 0.621371)} mph`;
    return `${Math.round(kmh)} km/h`;
  };

  // Helper to extract and format points for any selected day & span
  const buildHourlyPoints = (
    data: any,
    dayIdx: number,
    span: "8h" | "24h"
  ): HourlyPoint[] => {
    if (!data?.hourly?.time || data.hourly.time.length === 0) return [];

    const times: string[] = data.hourly.time;
    const currentIso: string = data.current?.time || "";
    let currentHourIdx = 0;
    if (currentIso && times.length > 0) {
      const found = times.findIndex((t: string) => t.startsWith(currentIso.slice(0, 13)));
      if (found !== -1) currentHourIdx = found;
    }

    const selectedDayDate: string = data.daily?.time?.[dayIdx] || times[0].slice(0, 10);
    const dayIndices = times
      .map((t: string, i: number) => (t.startsWith(selectedDayDate) ? i : -1))
      .filter((i: number) => i !== -1);

    let startIdx = 0;
    let count = 8;

    if (dayIdx === 0) {
      // TODAY
      if (span === "8h") {
        startIdx = currentHourIdx;
        count = Math.min(8, times.length - startIdx);
      } else {
        // Full 24 Hours of Today
        startIdx = dayIndices.length > 0 ? dayIndices[0] : 0;
        count = dayIndices.length > 0 ? dayIndices.length : 24;
      }
    } else {
      // FUTURE DAYS (e.g. Sunday, Monday)
      if (span === "8h") {
        // Start from 8:00 AM of that day to show daylight hours
        const morningIdx = dayIndices.length >= 9 ? dayIndices[8] : (dayIndices[0] ?? dayIdx * 24);
        startIdx = Math.min(morningIdx, times.length - 8);
        count = 8;
      } else {
        startIdx = dayIndices.length > 0 ? dayIndices[0] : dayIdx * 24;
        count = dayIndices.length > 0 ? dayIndices.length : 24;
      }
    }

    const points: HourlyPoint[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.min(startIdx + i, times.length - 1);
      const rawTime = times[idx];

      // Exact deterministic hour parsing from ISO string (immune to browser timezone offset)
      const rawHour = parseInt(rawTime.slice(11, 13), 10);
      const ampm = rawHour >= 12 ? "pm" : "am";
      const displayHour = rawHour % 12 || 12;
      const formattedTime = `${displayHour} ${ampm}`;

      const isNow = dayIdx === 0 && idx === currentHourIdx;

      // Live sensor calibration for the current hour "Now"
      const rawTempC = isNow
        ? (data.current?.temperature_2m ?? data.hourly.temperature_2m?.[idx] ?? 25)
        : (data.hourly.temperature_2m?.[idx] ?? 25);
      const temp = convertTemp(rawTempC);

      const precip = Math.round(data.hourly.precipitation_probability?.[idx] ?? 0);
      const precipMm = Number(
        (isNow
          ? (data.current?.precipitation ?? data.hourly.precipitation?.[idx] ?? 0)
          : (data.hourly.precipitation?.[idx] ?? 0)
        ).toFixed(1)
      );

      const rawWindKmh = isNow
        ? (data.current?.wind_speed_10m ?? data.hourly.wind_speed_10m?.[idx] ?? 15)
        : (data.hourly.wind_speed_10m?.[idx] ?? 15);
      const speedNum = convertWindSpeed(rawWindKmh);
      const speedLabel = formatWindLabel(rawWindKmh);

      const rawDir = isNow
        ? (data.current?.wind_direction_10m ?? data.hourly.wind_direction_10m?.[idx] ?? 90)
        : (data.hourly.wind_direction_10m?.[idx] ?? 90);
      const rotation = (rawDir - 270 + 360) % 360;

      const wCode = isNow
        ? (data.current?.weather_code ?? data.hourly.weather_code?.[idx] ?? 0)
        : (data.hourly.weather_code?.[idx] ?? 0);

      // Hourly condition classification
      let condition: HourlyPoint["condition"] = "partly-cloudy";
      if ((wCode >= 51 && wCode <= 67) || (wCode >= 80 && wCode <= 82) || wCode >= 95 || precipMm >= 0.1) {
        condition = "rain";
      } else if (wCode === 3 || wCode === 45 || wCode === 48 || (precip >= 35 && precipMm === 0)) {
        condition = "cloudy";
      } else if (wCode === 0) {
        condition = "sunny";
      } else {
        condition = "partly-cloudy";
      }

      points.push({
        time: formattedTime,
        isNow,
        temp,
        precip,
        precipMm,
        speed: speedLabel,
        speedNum,
        rotation,
        weatherCode: wCode,
        condition,
      });
    }

    return points;
  };

  // Fetch real-time live forecast data from Open-Meteo
  useEffect(() => {
    let isMounted = true;

    async function fetchLiveForecast() {
      try {
        setIsLoading(true);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,uv_index_max,uv_index_clear_sky_max,sunrise,sunset,daylight_duration,sunshine_duration,rain_sum,showers_sum,snowfall_sum,precipitation_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,pressure_msl,surface_pressure,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=auto`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch live weather forecast");
        const data = await res.json();

        if (!isMounted) return;
        setRawApiData(data);

        // 1. Process Hourly Forecast for active day & span
        const hourlyPoints = buildHourlyPoints(data, selectedDayIdx, hourlySpan);
        setHourlyData(hourlyPoints);

        // 2. Process Daily Forecast (Next 7-8 days)
        const dailyDates: string[] = data.daily?.time || [];
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dailyPoints: DailyPoint[] = [];

        for (let d = 0; d < Math.min(dailyDates.length, 8); d++) {
          const dateObj = new Date(dailyDates[d]);
          const dayName = daysOfWeek[dateObj.getDay()];
          const code = data.daily.weather_code?.[d] ?? 0;
          const precipProb = data.daily.precipitation_probability_max?.[d] ?? 0;
          const precipSum = (data.daily.precipitation_sum?.[d] ?? data.daily.rain_sum?.[d] ?? 0);

          let condition: DailyPoint["condition"] = "partly-cloudy";
          const isModerateToHeavyRain = (code >= 61 && code <= 67) || code >= 95;
          const isLightDrizzleOrShower = (code >= 80 && code <= 82) || (code >= 51 && code <= 55);

          if (isModerateToHeavyRain && (precipSum >= 1.0 || precipProb >= 50)) {
            condition = "rain";
          } else if (isLightDrizzleOrShower && precipSum >= 2.0 && precipProb >= 60) {
            condition = "rain";
          } else if (code === 3 || code === 45 || code === 48 || isLightDrizzleOrShower || (precipProb >= 35 && precipSum < 2.0)) {
            condition = "cloudy";
          } else if (code === 0) {
            condition = "sunny";
          } else {
            condition = "partly-cloudy";
          }

          dailyPoints.push({
            day: dayName,
            condition,
            high: convertTemp(data.daily.temperature_2m_max?.[d] ?? 28),
            low: convertTemp(data.daily.temperature_2m_min?.[d] ?? 22),
          });
        }
        setDailyData(dailyPoints);
      } catch (err) {
        console.warn("Live forecast API error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchLiveForecast();
    return () => {
      isMounted = false;
    };
  }, [lat, lon, tempUnit, windUnit]);

  // When user clicks a different day
  const handleDaySelect = (idx: number) => {
    setSelectedDayIdx(idx);
    if (!rawApiData) return;
    const pts = buildHourlyPoints(rawApiData, idx, hourlySpan);
    setHourlyData(pts);
  };

  // When user switches between Next 8 Hours and 24 Hours
  const handleSpanChange = (span: "8h" | "24h") => {
    setHourlySpan(span);
    if (!rawApiData) return;
    const pts = buildHourlyPoints(rawApiData, selectedDayIdx, span);
    setHourlyData(pts);
  };

  // Safe fallback data arrays
  const safeHourly = hourlyData.length > 0 ? hourlyData : [
    { time: "Now", isNow: true, temp: 25, precip: 25, precipMm: 0.2, speed: "21 km/h", speedNum: 21, rotation: 0, weatherCode: 53, condition: "rain" as const },
    { time: "4 pm", temp: 24, precip: 15, precipMm: 0.0, speed: "18 km/h", speedNum: 18, rotation: 0, weatherCode: 3, condition: "cloudy" as const },
    { time: "5 pm", temp: 24, precip: 10, precipMm: 0.0, speed: "16 km/h", speedNum: 16, rotation: 0, weatherCode: 3, condition: "cloudy" as const },
    { time: "6 pm", temp: 23, precip: 10, precipMm: 0.0, speed: "16 km/h", speedNum: 16, rotation: 0, weatherCode: 3, condition: "cloudy" as const },
    { time: "7 pm", temp: 23, precip: 10, precipMm: 0.0, speed: "15 km/h", speedNum: 15, rotation: 0, weatherCode: 2, condition: "partly-cloudy" as const },
    { time: "8 pm", temp: 22, precip: 15, precipMm: 0.1, speed: "14 km/h", speedNum: 14, rotation: 0, weatherCode: 2, condition: "partly-cloudy" as const },
    { time: "9 pm", temp: 22, precip: 20, precipMm: 0.0, speed: "14 km/h", speedNum: 14, rotation: 0, weatherCode: 1, condition: "sunny" as const },
    { time: "10 pm", temp: 22, precip: 20, precipMm: 0.0, speed: "13 km/h", speedNum: 13, rotation: 0, weatherCode: 0, condition: "sunny" as const },
  ];

  const safeDaily = dailyData.length > 0 ? dailyData : [
    { day: "Sat", condition: "partly-cloudy" as const, high: 28, low: 22 },
    { day: "Sun", condition: "rain" as const, high: 27, low: 21 },
    { day: "Mon", condition: "cloudy" as const, high: 26, low: 20 },
    { day: "Tue", condition: "sunny" as const, high: 29, low: 21 },
    { day: "Wed", condition: "partly-cloudy" as const, high: 28, low: 22 },
    { day: "Thu", condition: "sunny" as const, high: 30, low: 23 },
    { day: "Fri", condition: "cloudy" as const, high: 27, low: 22 },
  ];

  // Dynamic SVG Width Calculation for 8h vs 24h scrollable canvas
  const isExpandedView = safeHourly.length > 8;
  const svgWidth = isExpandedView ? Math.max(700, safeHourly.length * 62) : 700;
  const svgHeight = 70;
  const paddingX = isExpandedView ? 28 : 35;
  const paddingY = 18;

  const tempVals = safeHourly.map((h) => h.temp);
  const minTemp = Math.min(...tempVals) - 1;
  const maxTemp = Math.max(...tempVals) + 1;
  const tempRange = maxTemp - minTemp || 1;

  const tempPoints = safeHourly.map((pt, idx) => {
    const x = paddingX + (idx / Math.max(1, safeHourly.length - 1)) * (svgWidth - paddingX * 2);
    const normalized = (pt.temp - minTemp) / tempRange;
    const y = svgHeight - paddingY - normalized * (svgHeight - paddingY * 2);
    return { x, y, temp: pt.temp, isNow: pt.isNow };
  });

  const makeSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
  };

  const tempLinePath = makeSmoothPath(tempPoints);
  const tempAreaPath = `${tempLinePath} L ${tempPoints[tempPoints.length - 1].x},${svgHeight} L ${tempPoints[0].x},${svgHeight} Z`;

  // Render weather icon matching user reference screenshot
  const renderWeatherIcon = (condition: DailyPoint["condition"]) => {
    switch (condition) {
      case "rain":
        return (
          <div className="relative flex items-center justify-center w-8 h-8">
            <svg viewBox="0 0 36 36" className="w-8 h-8">
              <defs>
                <linearGradient id="rainCloudDarkGrad4" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
              </defs>
              <path
                d="M9 22h18c3 0 5.5-2.5 5.5-5.5 0-2.6-1.8-4.8-4.4-5.3C27.5 7.8 24.2 5 20 5c-3.1 0-5.8 1.8-7 4.5-.8-.3-1.6-.5-2.5-.5-3.6 0-6.5 2.9-6.5 6.5 0 .4.1.8.2 1.2C2.6 17.5 1.5 19.6 1.5 22z"
                fill="url(#rainCloudDarkGrad4)"
              />
              <circle cx="18" cy="27" r="1.8" fill="#38bdf8" />
            </svg>
          </div>
        );
      case "partly-cloudy":
        return (
          <div className="relative flex items-center justify-center w-8 h-8">
            <svg viewBox="0 0 36 36" className="w-8 h-8">
              <defs>
                <radialGradient id="sun3DGrad4" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#FFD54F" />
                  <stop offset="60%" stopColor="#FF9800" />
                  <stop offset="100%" stopColor="#F57C00" />
                </radialGradient>
                <linearGradient id="cloud3DGrad4" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#E2E8F0" />
                </linearGradient>
                <filter id="cloudShad4" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity="0.2" />
                </filter>
              </defs>
              <circle cx="16" cy="15" r="10" fill="url(#sun3DGrad4)" />
              <g filter="url(#cloudShad4)">
                <path
                  d="M13 25h16c2.8 0 5-2.2 5-5 0-2.4-1.7-4.4-4-4.9C29.4 12 26.4 9.5 22.8 9.5c-2.8 0-5.2 1.6-6.3 4-.7-.3-1.4-.4-2.2-.4-3.1 0-5.7 2.5-5.7 5.7 0 .4.1.7.2 1.1-1.3.7-2.1 2.1-2.1 3.6z"
                  fill="url(#cloud3DGrad4)"
                />
              </g>
            </svg>
          </div>
        );
      case "cloudy":
        return (
          <div className="relative flex items-center justify-center w-8 h-8">
            <svg viewBox="0 0 36 36" className="w-8 h-8">
              <defs>
                <linearGradient id="overcast3DGrad4" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#cbd5e1" />
                  <stop offset="100%" stopColor="#94a3b8" />
                </linearGradient>
              </defs>
              <path
                d="M9 23h18c3 0 5.5-2.5 5.5-5.5 0-2.6-1.8-4.8-4.4-5.3C27.5 8.8 24.2 6 20 6c-3.1 0-5.8 1.8-7 4.5-.8-.3-1.6-.5-2.5-.5-3.6 0-6.5 2.9-6.5 6.5 0 .4.1.8.2 1.2C2.6 18.5 1.5 20.6 1.5 23z"
                fill="url(#overcast3DGrad4)"
              />
            </svg>
          </div>
        );
      case "sunny":
        return (
          <div className="relative flex items-center justify-center w-8 h-8">
            <svg viewBox="0 0 36 36" className="w-8 h-8">
              <defs>
                <radialGradient id="pureSun3DGrad4" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#FFF59D" />
                  <stop offset="60%" stopColor="#FBC02D" />
                  <stop offset="100%" stopColor="#F57F17" />
                </radialGradient>
              </defs>
              <circle cx="18" cy="18" r="13" fill="url(#pureSun3DGrad4)" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div
      className={`bg-white dark:bg-[#1e1e1e] rounded-[32px] p-6 sm:p-7 text-slate-900 dark:text-white shadow-[0_16px_36px_-6px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.75)] border border-slate-200/80 dark:border-white/5 space-y-5 transition-all ${className}`}
    >
      {/* 1. Header Navigation Tabs & Hourly Span Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium">
        <div className="flex items-center gap-4">
          {/* Tab: Temperature */}
          <button
            type="button"
            onClick={() => setActiveTab("temperature")}
            className={`relative pb-1.5 transition-colors cursor-pointer select-none ${
              activeTab === "temperature"
                ? "text-slate-900 dark:text-white font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>{t("weather.forecastTabs.temperature")}</span>
            {activeTab === "temperature" && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#f59e0b] rounded-full" />
            )}
          </button>

          <span className="text-slate-300 dark:text-white/20 text-xs select-none">|</span>

          {/* Tab: Precipitation */}
          <button
            type="button"
            onClick={() => setActiveTab("precipitation")}
            className={`relative pb-1.5 transition-colors cursor-pointer select-none ${
              activeTab === "precipitation"
                ? "text-slate-900 dark:text-white font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>{t("weather.forecastTabs.precipitation")}</span>
            {activeTab === "precipitation" && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#f59e0b] rounded-full" />
            )}
          </button>

          <span className="text-slate-300 dark:text-white/20 text-xs select-none">|</span>

          {/* Tab: Wind */}
          <button
            type="button"
            onClick={() => setActiveTab("wind")}
            className={`relative pb-1.5 transition-colors cursor-pointer select-none ${
              activeTab === "wind"
                ? "text-slate-900 dark:text-white font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>{t("weather.forecastTabs.wind")}</span>
            {activeTab === "wind" && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#f59e0b] rounded-full" />
            )}
          </button>
        </div>

        {/* View Span Toggle: Next 8h vs All 24 Hours */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#121214] p-1 rounded-xl border border-slate-200/80 dark:border-[#27272a] text-xs">
          <button
            type="button"
            onClick={() => handleSpanChange("8h")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              hourlySpan === "8h"
                ? "bg-white dark:bg-[#27272a] text-slate-900 dark:text-white shadow-2xs font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            Next 8h
          </button>
          <button
            type="button"
            onClick={() => handleSpanChange("24h")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              hourlySpan === "24h"
                ? "bg-white dark:bg-[#27272a] text-slate-900 dark:text-white shadow-2xs font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            }`}
          >
            24 Hours
          </button>
        </div>
      </div>

      {/* 2. Interactive Main Visualization Area */}
      <div className="relative w-full min-h-[120px] flex flex-col justify-end pt-1">
        {/* ========================================================================= */}
        {/* VIEW 1: TEMPERATURE (GOLDEN AREA CURVE)                                   */}
        {/* ========================================================================= */}
        {activeTab === "temperature" && (
          <div className="w-full overflow-x-auto no-scrollbar pb-1">
            <div style={{ minWidth: isExpandedView ? `${svgWidth}px` : undefined }} className="w-full space-y-1">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-20 overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="tempAreaGradReal4" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Translucent Golden Area Fill */}
                <path d={tempAreaPath} fill="url(#tempAreaGradReal4)" />

                {/* Crisp Golden Curve Line */}
                <path
                  d={tempLinePath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Labels and dots on curve */}
                {tempPoints.map((pt, idx) => (
                  <g key={idx}>
                    {/* Glowing halo dot on "Now" point */}
                    {pt.isNow && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="7"
                        className="fill-amber-400/30 animate-ping"
                      />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={pt.isNow ? "4.5" : "3"}
                      className={pt.isNow ? "fill-amber-500 stroke-2 stroke-white dark:stroke-black" : "fill-[#f59e0b]"}
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 8}
                      textAnchor="middle"
                      className="fill-slate-900 dark:fill-white text-[12px] font-bold select-none font-mono"
                    >
                      {pt.temp}°
                    </text>
                  </g>
                ))}
              </svg>

              {/* Timestamps Row */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-2 pt-2">
                {safeHourly.map((pt, idx) => (
                  <div
                    key={idx}
                    className={`text-center flex-1 min-w-[48px] flex flex-col items-center select-none ${
                      pt.isNow ? "text-amber-600 dark:text-amber-400 font-bold" : ""
                    }`}
                  >
                    {pt.isNow ? (
                      <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded text-[8px] font-extrabold uppercase leading-tight mb-0.5">
                        Now
                      </span>
                    ) : null}
                    <span>{pt.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: PRECIPITATION (STEPPED BLUE HISTOGRAM BARS)                        */}
        {/* ========================================================================= */}
        {activeTab === "precipitation" && (
          <div className="w-full space-y-2.5">
            {/* Axis / Section Title Clarification */}
            <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                Rain Chance & Expected Volume
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Chance (%) · Volume (mm)
              </span>
            </div>

            {/* Scrollable Container for 8h / 24h Bars */}
            <div className="w-full overflow-x-auto no-scrollbar pb-1">
              <div style={{ minWidth: isExpandedView ? `${svgWidth}px` : undefined }} className="w-full space-y-2">
                {/* Dual Metric Labels Row: % (bold primary) and mm (secondary line beneath) */}
                <div className="flex items-center justify-between text-center px-2">
                  {safeHourly.map((pt, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1 min-w-[48px] select-none">
                      {/* Primary bold probability percentage */}
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-300 leading-tight">
                        {pt.precip}%
                      </span>
                      {/* Secondary mm line (always visible) */}
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {pt.precipMm.toFixed(1)}mm
                      </span>
                    </div>
                  ))}
                </div>

                {/* Stepped Blue Horizontal Cap Bars (height tied to probability %) */}
                <div className="flex gap-0.5 items-end h-10 px-2">
                  {safeHourly.map((pt, idx) => {
                    const maxPrecipVal = Math.max(1, ...safeHourly.map((h) => h.precip));
                    const barHeight = Math.max(8, (pt.precip / Math.max(40, maxPrecipVal)) * 34);
                    return (
                      <div key={idx} className="flex flex-col justify-end items-center h-full flex-1 min-w-[48px]">
                        <div
                          className={`w-full border-t-2 transition-all duration-300 rounded-t-xs ${
                            pt.isNow
                              ? "border-sky-400 bg-sky-500/35 ring-1 ring-sky-400/40"
                              : "border-sky-500 dark:border-sky-400 bg-sky-500/20 dark:bg-sky-900/35"
                          }`}
                          style={{ height: `${barHeight}px` }}
                          title={`${pt.time}: ${pt.precip}% probability, ${pt.precipMm.toFixed(1)}mm expected`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Timestamps Row */}
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-2 pt-1">
                  {safeHourly.map((pt, idx) => (
                    <div
                      key={idx}
                      className={`text-center flex-1 min-w-[48px] flex flex-col items-center select-none ${
                        pt.isNow ? "text-sky-600 dark:text-sky-400 font-bold" : ""
                      }`}
                    >
                      {pt.isNow ? (
                        <span className="px-1.5 py-0.2 bg-sky-500 text-white rounded text-[8px] font-extrabold uppercase leading-tight mb-0.5">
                          Now
                        </span>
                      ) : null}
                      <span>{pt.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: WIND (DIRECTIONAL ROTATED VECTORS & SPEEDS)                       */}
        {/* ========================================================================= */}
        {activeTab === "wind" && (
          <div className="w-full overflow-x-auto no-scrollbar pb-1">
            <div style={{ minWidth: isExpandedView ? `${svgWidth}px` : undefined }} className="w-full space-y-2">
              {/* Wind Speed Values Row */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 px-2">
                {safeHourly.map((pt, idx) => (
                  <span key={idx} className="text-center flex-1 min-w-[48px]">
                    {pt.speed}
                  </span>
                ))}
              </div>

              {/* Dynamic Sized & Rotated Wind Vector Arrows */}
              <div className="flex items-center justify-between px-2 h-10">
                {safeHourly.map((pt, idx) => {
                  const isHighSpeed = pt.speedNum >= 20;
                  const isMediumSpeed = pt.speedNum >= 12;

                  return (
                    <div
                      key={idx}
                      className="flex-1 min-w-[48px] flex items-center justify-center transition-transform duration-500"
                      style={{
                        transform: `rotate(${pt.rotation}deg)`,
                      }}
                    >
                      {isHighSpeed ? (
                        /* Large Arrow */
                        <svg viewBox="0 0 32 32" className="w-7 h-7 text-amber-500 dark:text-amber-400">
                          <path
                            d="M4 16h20m-7-7 7 7-7 7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : isMediumSpeed ? (
                        /* Medium Arrow */
                        <svg viewBox="0 0 32 32" className="w-6 h-6 text-slate-500 dark:text-[#94a3b8]">
                          <path
                            d="M6 16h15m-6-6 6 6-6 6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        /* Small Arrow */
                        <svg viewBox="0 0 32 32" className="w-5 h-5 text-slate-400 dark:text-[#94a3b8]">
                          <path
                            d="M8 16h12m-5-5 5 5-5 5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Timestamps Row */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-2 pt-1">
                {safeHourly.map((pt, idx) => (
                  <div
                    key={idx}
                    className={`text-center flex-1 min-w-[48px] flex flex-col items-center select-none ${
                      pt.isNow ? "text-teal-600 dark:text-teal-400 font-bold" : ""
                    }`}
                  >
                    {pt.isNow ? (
                      <span className="px-1.5 py-0.2 bg-teal-500 text-white rounded text-[8px] font-extrabold uppercase leading-tight mb-0.5">
                        Now
                      </span>
                    ) : null}
                    <span>{pt.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Daily Forecast Carousel / Row */}
      <div
        className={`grid gap-2 pt-2 border-t border-slate-100 dark:border-white/10 ${
          safeDaily.length === 7
            ? "grid-cols-4 sm:grid-cols-7"
            : "grid-cols-4 sm:grid-cols-8"
        }`}
      >
        {safeDaily.map((item, idx) => {
          const isSelected = selectedDayIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDaySelect(idx)}
              className={`flex flex-col items-center justify-between py-3 px-1 rounded-2xl transition-all cursor-pointer select-none space-y-2 ${
                isSelected
                  ? "bg-sky-50 dark:bg-white/10 border border-sky-200 dark:border-white/15 shadow-xs dark:shadow-inner"
                  : "hover:bg-slate-50 dark:hover:bg-white/5"
              }`}
            >
              {/* Day Name */}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.day}</span>

              {/* Weather Icon with colorful 3D sun/cloud matching screenshot */}
              <div className="my-0.5">{renderWeatherIcon(item.condition)}</div>

              {/* High / Low Temperature */}
              <div className="flex items-center gap-1 text-xs font-bold">
                <span className="text-slate-900 dark:text-white">{item.high}°</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">{item.low}°</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default InteractiveForecastCard;
