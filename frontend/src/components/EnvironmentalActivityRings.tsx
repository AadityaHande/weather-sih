"use client";

import React, { useState, useEffect } from "react";
import { Droplets, Wind, Eye } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { translateHumidityStatus } from "@/lib/i18n/weatherFormatters";

interface RingData {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradientEnd: string;
  size: number;
  strokeWidth: number;
  value: number;
  displayValue: string;
  unit: string;
  subtext: string;
}

interface EnvironmentalActivityRingsProps {
  precipitationTotalMm?: number | null; // current.precipitation (total, mm)
  rainMm?: number | null; // current.rain (rain-specific, mm)
  humidity?: number | null; // current.relative_humidity_2m
  humidityStatus?: string | null;
  windSpeed?: string | null; // current.wind_speed_10m (formatted, e.g. "24.1 kph")
  windSpeedNum?: number | null; // current.wind_speed_10m (numeric)
  windDirection?: string | null;
  className?: string;
}

/** Shown in place of a metric the weather service did not return. */
const DASH = "—";

export default function EnvironmentalActivityRings({
  // Null/undefined means "not reported" — the ring empties and the readout shows
  // an em dash. These used to default to invented values (68% humidity,
  // "24.1 kph" wind), which rendered as real measurements during loading and
  // whenever a field was missing from the response.
  precipitationTotalMm,
  rainMm,
  humidity,
  humidityStatus,
  windSpeed,
  windSpeedNum,
  windDirection,
  className = "",
}: EnvironmentalActivityRingsProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const localizedHumidityStatus = humidityStatus
    ? translateHumidityStatus(humidityStatus, t)
    : DASH;

  // Dynamic progress values (0 - 100%). A missing reading leaves the ring empty
  // rather than drawing an arc that implies a value we do not have.
  const precipProgress =
    precipitationTotalMm !== null && precipitationTotalMm !== undefined
      ? Math.min(100, Math.max(0, Math.round(precipitationTotalMm * 20))) // scale 0 - 5mm
      : 0;
  const humidityProgress =
    humidity !== null && humidity !== undefined ? Math.min(100, Math.max(0, humidity)) : 0;
  const windProgress =
    windSpeedNum !== null && windSpeedNum !== undefined
      ? Math.min(100, Math.max(0, Math.round((windSpeedNum / 80) * 100))) // scale 0 - 80 kph
      : 0;

  const rings: RingData[] = [
    {
      label: t("weather.activityRings.precipitationLabel"),
      icon: Droplets,
      color: "#0284c7",
      gradientEnd: "#38bdf8",
      size: 180,
      strokeWidth: 14,
      value: precipProgress,
      displayValue:
        precipitationTotalMm !== null && precipitationTotalMm !== undefined
          ? `${precipitationTotalMm.toFixed(1)} mm`
          : DASH,
      unit:
        rainMm !== null && rainMm !== undefined
          ? `Rain: ${rainMm.toFixed(1)} mm`
          : `Rain: ${DASH}`,
      subtext: "Accumulation",
    },
    {
      label: t("weather.activityRings.humidityLabel"),
      icon: Eye,
      color: "#059669",
      gradientEnd: "#34d399",
      size: 142,
      strokeWidth: 14,
      value: humidityProgress,
      displayValue: humidity !== null && humidity !== undefined ? `${humidity}%` : DASH,
      unit: localizedHumidityStatus,
      subtext: t("weather.activityRings.humiditySub"),
    },
    {
      label: t("weather.activityRings.windLabel"),
      icon: Wind,
      color: "#d97706",
      gradientEnd: "#fbbf24",
      size: 104,
      strokeWidth: 14,
      value: windProgress,
      displayValue: windSpeed ?? DASH,
      unit: windDirection ?? DASH,
      subtext: t("weather.activityRings.windSub"),
    },
  ];

  return (
    <div
      className={`relative w-full bg-white dark:bg-[#1e1e1e] border border-slate-200/80 dark:border-white/5 rounded-[32px] p-6 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.75)] transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
        {/* Left Side: Concentric Rings SVG + Central Wind Speed Gauge */}
        <div className="relative w-[180px] h-[180px] shrink-0 flex items-center justify-center">
          {rings.map((ring, idx) => {
            const radius = (ring.size - ring.strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = mounted
              ? circumference - (ring.value / 100) * circumference
              : circumference;
            const gradId = `ring-grad-clean-${idx}`;

            return (
              <div
                key={ring.label}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <svg
                  className="-rotate-90 transform"
                  width={ring.size}
                  height={ring.size}
                  viewBox={`0 0 ${ring.size} ${ring.size}`}
                >
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={ring.color} />
                      <stop offset="100%" stopColor={ring.gradientEnd} />
                    </linearGradient>
                  </defs>

                  {/* Background Track Circle */}
                  <circle
                    cx={ring.size / 2}
                    cy={ring.size / 2}
                    r={radius}
                    fill="none"
                    stroke={ring.color}
                    strokeOpacity={0.18}
                    strokeWidth={ring.strokeWidth}
                  />

                  {/* Animated Progress Circle */}
                  <circle
                    cx={ring.size / 2}
                    cy={ring.size / 2}
                    r={radius}
                    fill="none"
                    stroke={`url(#${gradId})`}
                    strokeWidth={ring.strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{
                      transition: "stroke-dashoffset 1.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                    }}
                  />
                </svg>
              </div>
            );
          })}

          {/* Center Wind Speed Gauge Display (strictly bound to current.wind_speed_10m) */}
          <div className="z-10 text-center flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Wind Gauge
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
              {windSpeed}
            </span>
          </div>
        </div>

        {/* Right Side: 3 Stat Boxes with Dark Gray Theme */}
        <div className="flex-1 w-full flex flex-col justify-center gap-3">
          {rings.map((ring) => {
            const Icon = ring.icon;
            return (
              <div
                key={ring.label}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 dark:bg-[#1c1c1e] border border-slate-100 dark:border-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#252528] transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                    style={{ backgroundColor: `${ring.color}25`, color: ring.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#8e8e93] block">
                      {ring.label}
                    </span>
                    <span className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                      {ring.displayValue}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg inline-block shadow-2xs"
                    style={{
                      backgroundColor: `${ring.color}25`,
                      color: ring.color,
                    }}
                  >
                    {ring.unit}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-[#8e8e93] font-medium block mt-0.5">
                    {ring.subtext}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
