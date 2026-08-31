"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/context/I18nContext";
import {
  localizeRelativeTimeWindow,
  translateScheduleReason,
} from "@/lib/i18n/weatherFormatters";
import {
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  Sun,
  ShieldCheck,
  Activity,
  Waves,
  Flower2,
  Users,
  Plane,
  HeartPulse,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";

// ==========================================
// 1. CONFIG-DRIVEN PERSONA SCHEMA DEFINITION
// ==========================================

export type MetricKey = "temperature" | "humidity" | "wind" | "rain" | "uv" | "aqi";

export interface PersonaMetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface CandidateWindow {
  id: string;
  period: "morning" | "afternoon" | "evening";
  start: number;
  end: number;
  label: string;
  scoreOffset: number;
  reason: string;
}

export interface PersonaScheduleDef {
  morning: { start: number; end: number; label: string };
  afternoon: { start: number; end: number; label: string };
  avoid: { start: number; end: number; label: string; reason: string };
  shortReason: string;
  candidates: CandidateWindow[];
}

export interface PersonaConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  scoreLabel: string;
  windowLabel: string;
  avoidLabel: string;
  primaryFocus: string;
  metrics: PersonaMetricDef[];
  schedule: PersonaScheduleDef;
  calculateScore: (weather: { temp: number; humidity: number; wind: number; rain: number; aqi: number; uv: number }) => number;
}

export const PERSONA_CONFIGS: Record<string, PersonaConfig> = {
  fitness: {
    id: "fitness",
    label: "Runner",
    icon: Activity,
    scoreLabel: "Running Score",
    windowLabel: "Next Window",
    avoidLabel: "Avoid",
    primaryFocus: "aerobic efficiency and thermal load",
    metrics: [
      { key: "temperature", label: "Temperature", unit: "°", icon: Thermometer },
      { key: "humidity", label: "Humidity", unit: "%", icon: Droplets },
      { key: "wind", label: "Wind Speed", unit: "", icon: Wind },
      { key: "rain", label: "Rain Chance", unit: "%", icon: CloudRain },
    ],
    schedule: {
      morning: { start: 6.0, end: 7.5, label: "6:00–7:30 AM" },
      afternoon: { start: 17.5, end: 19.0, label: "5:30–7:00 PM" },
      avoid: { start: 12.0, end: 15.5, label: "12:00–3:30 PM", reason: "Midday heat & peak UV" },
      shortReason: "Cool air & gentle breeze",
      candidates: [
        { id: "morning_prime", period: "morning", start: 6.0, end: 7.5, label: "6:00–7:30 AM", scoreOffset: 0, reason: "Cool air & gentle breeze" },
        { id: "evening_sunset", period: "evening", start: 17.5, end: 19.0, label: "5:30–7:00 PM", scoreOffset: -4, reason: "Post-sunset cooling" },
        { id: "early_dawn", period: "morning", start: 5.0, end: 6.0, label: "5:00–6:00 AM", scoreOffset: -2, reason: "Lowest daily temperature" },
        { id: "late_evening", period: "evening", start: 19.5, end: 20.75, label: "7:30–8:45 PM", scoreOffset: -7, reason: "Zero solar UV radiation" },
      ],
    },
    calculateScore: (w) =>
      Math.max(40, Math.min(96, Math.round(96 - Math.abs(w.temp - 19) * 1.6 - (w.humidity > 70 ? (w.humidity - 70) * 0.7 : 0) - w.rain * 0.4))),
  },
  health: {
    id: "health",
    label: "Health-Conscious",
    icon: HeartPulse,
    scoreLabel: "Health Score",
    windowLabel: "Next Window",
    avoidLabel: "Avoid",
    primaryFocus: "clean air and low particulate density",
    metrics: [
      { key: "aqi", label: "Air Quality", unit: " AQI", icon: ShieldCheck },
      { key: "uv", label: "UV Radiation", unit: " UV", icon: Sun },
      { key: "humidity", label: "Humidity", unit: "%", icon: Droplets },
      { key: "temperature", label: "Temperature", unit: "°", icon: Thermometer },
    ],
    schedule: {
      morning: { start: 9.5, end: 11.5, label: "9:30–11:30 AM" },
      afternoon: { start: 15.5, end: 17.0, label: "3:30–5:00 PM" },
      avoid: { start: 6.5, end: 8.5, label: "6:30–8:30 AM", reason: "Ground-level morning smog" },
      shortReason: "Dispersed PM2.5 & clean air",
      candidates: [
        { id: "mid_morning", period: "morning", start: 9.5, end: 11.5, label: "9:30–11:30 AM", scoreOffset: 0, reason: "Dispersed PM2.5 & clean air" },
        { id: "afternoon_clean", period: "afternoon", start: 15.5, end: 17.0, label: "3:30–5:00 PM", scoreOffset: -3, reason: "Fresh circulating air" },
        { id: "evening_fresh", period: "evening", start: 17.5, end: 19.0, label: "5:30–7:00 PM", scoreOffset: -5, reason: "Cooler balanced air" },
        { id: "early_afternoon", period: "afternoon", start: 13.0, end: 14.5, label: "1:00–2:30 PM", scoreOffset: -8, reason: "Low moisture & steady wind" },
      ],
    },
    calculateScore: (w) =>
      Math.max(35, Math.min(98, Math.round(98 - (w.aqi > 50 ? (w.aqi - 50) * 0.45 : 0) - (w.uv > 5 ? (w.uv - 5) * 5 : 0) - (w.humidity > 80 ? 6 : 0)))),
  },
  traveler: {
    id: "traveler",
    label: "Commuter & Traveler",
    icon: Plane,
    scoreLabel: "Transit Score",
    windowLabel: "Next Window",
    avoidLabel: "Avoid",
    primaryFocus: "road visibility and clear transit",
    metrics: [
      { key: "rain", label: "Precipitation", unit: " mm", icon: CloudRain },
      { key: "wind", label: "Wind Speed", unit: "", icon: Wind },
      { key: "temperature", label: "Temperature", unit: "°", icon: Thermometer },
      { key: "humidity", label: "Humidity", unit: "%", icon: Droplets },
    ],
    schedule: {
      morning: { start: 10.0, end: 12.0, label: "10:00 AM–12:00 PM" },
      afternoon: { start: 13.5, end: 15.5, label: "1:30–3:30 PM" },
      avoid: { start: 8.0, end: 9.5, label: "8:00–9:30 AM", reason: "Rush hour traffic delays" },
      shortReason: "Clear roads & dry transit",
      candidates: [
        { id: "post_rush_morning", period: "morning", start: 10.0, end: 12.0, label: "10:00 AM–12:00 PM", scoreOffset: 0, reason: "Clear roads & dry transit" },
        { id: "afternoon_offpeak", period: "afternoon", start: 13.5, end: 15.5, label: "1:30–3:30 PM", scoreOffset: -3, reason: "Free-flowing highway lanes" },
        { id: "post_rush_night", period: "evening", start: 20.0, end: 21.5, label: "8:00–9:30 PM", scoreOffset: -5, reason: "Minimal evening traffic volume" },
        { id: "early_morning", period: "morning", start: 6.0, end: 7.3, label: "6:00–7:15 AM", scoreOffset: -6, reason: "Pre-rush hour clear lanes" },
      ],
    },
    calculateScore: (w) =>
      Math.max(45, Math.min(98, Math.round(96 - w.rain * 0.55 - (w.wind > 20 ? (w.wind - 20) * 1.2 : 0)))),
  },
  beach: {
    id: "beach",
    label: "Beach & Surf",
    icon: Waves,
    scoreLabel: "Surf & Beach Score",
    windowLabel: "Next Window",
    avoidLabel: "Avoid",
    primaryFocus: "offshore breeze and gentle surf",
    metrics: [
      { key: "temperature", label: "Air Temp", unit: "°", icon: Thermometer },
      { key: "uv", label: "UV Index", unit: " UV", icon: Sun },
      { key: "wind", label: "Wind", unit: "", icon: Wind },
      { key: "rain", label: "Rain Chance", unit: "%", icon: CloudRain },
    ],
    schedule: {
      morning: { start: 7.5, end: 10.0, label: "7:30–10:00 AM" },
      afternoon: { start: 16.0, end: 18.0, label: "4:00–6:00 PM" },
      avoid: { start: 11.5, end: 15.0, label: "11:30 AM–3:00 PM", reason: "Choppy winds & intense UV" },
      shortReason: "Offshore breeze & mild sun",
      candidates: [
        { id: "morning_glass", period: "morning", start: 7.5, end: 10.0, label: "7:30–10:00 AM", scoreOffset: 0, reason: "Offshore breeze & mild sun" },
        { id: "afternoon_tide", period: "afternoon", start: 16.0, end: 18.0, label: "4:00–6:00 PM", scoreOffset: -4, reason: "Clean swell & low sun angle" },
        { id: "dawn_patrol", period: "morning", start: 6.0, end: 7.25, label: "6:00–7:15 AM", scoreOffset: -3, reason: "Glassy water surface" },
        { id: "sunset_coastal", period: "evening", start: 18.0, end: 19.25, label: "6:00–7:15 PM", scoreOffset: -7, reason: "Calm coastal twilight" },
      ],
    },
    calculateScore: (w) =>
      Math.max(40, Math.min(98, Math.round(95 - (w.uv > 7 ? (w.uv - 7) * 4 : 0) - (w.wind > 22 ? (w.wind - 22) * 1.5 : 0) - w.rain * 0.4))),
  },
  agriculture: {
    id: "agriculture",
    label: "Gardener",
    icon: Flower2,
    scoreLabel: "Gardening Score",
    windowLabel: "Next Window",
    avoidLabel: "Avoid",
    primaryFocus: "deep root moisture and low evaporation",
    metrics: [
      { key: "rain", label: "Precipitation", unit: " mm", icon: CloudRain },
      { key: "humidity", label: "Air Moisture", unit: "%", icon: Droplets },
      { key: "temperature", label: "Soil & Air Temp", unit: "°", icon: Thermometer },
      { key: "wind", label: "Wind", unit: "", icon: Wind },
    ],
    schedule: {
      morning: { start: 6.5, end: 8.5, label: "6:30–8:30 AM" },
      afternoon: { start: 17.0, end: 18.5, label: "5:00–6:30 PM" },
      avoid: { start: 11.0, end: 14.5, label: "11:00 AM–2:30 PM", reason: "High evaporation heat" },
      shortReason: "Deep soil root uptake",
      candidates: [
        { id: "morning_root", period: "morning", start: 6.5, end: 8.5, label: "6:30–8:30 AM", scoreOffset: 0, reason: "Deep soil root uptake" },
        { id: "evening_soak", period: "evening", start: 17.0, end: 18.5, label: "5:00–6:30 PM", scoreOffset: -4, reason: "Moisture retention overnight" },
        { id: "dawn_mist", period: "morning", start: 5.5, end: 6.5, label: "5:30–6:30 AM", scoreOffset: -3, reason: "Zero solar evaporation" },
        { id: "cloud_afternoon", period: "afternoon", start: 14.0, end: 15.5, label: "2:00–3:30 PM", scoreOffset: -9, reason: "Diffused solar watering" },
      ],
    },
    calculateScore: (w) =>
      Math.max(40, Math.min(98, Math.round(92 - (w.temp > 30 ? (w.temp - 30) * 1.5 : 0) - (w.wind > 25 ? 10 : 0)))),
  },
  family: {
    id: "family",
    label: "Parent & Family",
    icon: Users,
    scoreLabel: "Family Score",
    windowLabel: "Next Window",
    avoidLabel: "Avoid",
    primaryFocus: "shaded park play comfort",
    metrics: [
      { key: "temperature", label: "Temperature", unit: "°", icon: Thermometer },
      { key: "rain", label: "Rain Chance", unit: "%", icon: CloudRain },
      { key: "uv", label: "UV Index", unit: " UV", icon: Sun },
      { key: "wind", label: "Wind", unit: "", icon: Wind },
    ],
    schedule: {
      morning: { start: 9.0, end: 11.0, label: "9:00–11:00 AM" },
      afternoon: { start: 16.5, end: 18.5, label: "4:30–6:30 PM" },
      avoid: { start: 12.0, end: 15.5, label: "12:00–3:30 PM", reason: "Peak heat & direct UV" },
      shortReason: "Mild park playtime weather",
      candidates: [
        { id: "morning_park", period: "morning", start: 9.0, end: 11.0, label: "9:00–11:00 AM", scoreOffset: 0, reason: "Mild park playtime weather" },
        { id: "afternoon_shade", period: "afternoon", start: 16.5, end: 18.5, label: "4:30–6:30 PM", scoreOffset: -3, reason: "Shaded park playground" },
        { id: "early_morning_walk", period: "morning", start: 8.0, end: 9.25, label: "8:00–9:15 AM", scoreOffset: -5, reason: "Quiet morning park grounds" },
        { id: "sunset_stroll", period: "evening", start: 18.5, end: 19.75, label: "6:30–7:45 PM", scoreOffset: -6, reason: "Comfortable evening breeze" },
      ],
    },
    calculateScore: (w) =>
      Math.max(40, Math.min(98, Math.round(95 - w.rain * 0.5 - (w.temp > 28 ? (w.temp - 28) * 2 : 0) - (w.uv > 7 ? (w.uv - 7) * 4 : 0)))),
  },
};

interface PersonaInsightsProps {
  persona: string;
  currentTemp?: number;
  humidity?: number;
  windSpeed?: number;
  precipitation?: number;
  rainProbability?: number;
  aqi?: number;
  uvIndex?: number;
  locationName?: string;
  conditionText?: string;
  tempUnit?: "c" | "f";
  windUnit?: "kmh" | "mph";
}

interface InsightsApiResponse {
  persona_id: string;
  persona_label: string;
  score_label: string;
  score: number;
  score_reason: string;
  best_window: string;
  best_day_tag: string;
  best_relative: string;
  is_today: boolean;
  avoid_window: string;
  avoid_day_tag: string;
  avoid_relative: string;
  avoid_reason: string;
  metric_notes: Record<string, string>;
  candidates?: Array<{
    id: string;
    period: "morning" | "afternoon" | "evening";
    time_window: string;
    relative_tag: string;
    score_offset: number;
    short_reason: string;
  }>;
  source?: string;
}

export default function PersonaInsightsSection({
  persona,
  currentTemp = 28,
  humidity = 68,
  windSpeed = 12,
  precipitation = 0,
  rainProbability = 10,
  aqi = 65,
  uvIndex = 6.5,
  locationName = "Pune",
  conditionText = "Partly Cloudy",
  tempUnit = "c",
  windUnit = "kmh",
}: PersonaInsightsProps) {
  const { t, config, locale } = useI18n();
  const activeConfig =
    PERSONA_CONFIGS[persona] ||
    PERSONA_CONFIGS.fitness;

  // Local state for inline "Not this time?" controls
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [activeConstraint, setActiveConstraint] = useState<"all" | "evening" | "afternoon" | "morning">("all");
  const [showAlternativeControls, setShowAlternativeControls] = useState(false);

  // Reset controls when persona changes
  useEffect(() => {
    setSelectedCandidateIndex(0);
    setActiveConstraint("all");
    setShowAlternativeControls(false);
  }, [persona]);

  const clientTimeStr = useMemo(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  }, []);

  const clientHour = useMemo(() => {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  }, []);

  // Filter candidates based on active quick chip
  const availableCandidates = useMemo(() => {
    const all = activeConfig.schedule.candidates;
    if (activeConstraint === "all") return all;
    const filtered = all.filter((c) => c.period === activeConstraint);
    return filtered.length > 0 ? filtered : all;
  }, [activeConfig, activeConstraint]);

  const activeCandidate = availableCandidates[selectedCandidateIndex % availableCandidates.length];

  // Fetch backend-first with Groq fallback
  const { data: insightsData, isFetching } = useQuery<InsightsApiResponse>({
    queryKey: [
      "persona_insights",
      activeConfig.id,
      locale,
      currentTemp,
      humidity,
      windSpeed,
      precipitation,
      rainProbability,
      aqi,
      uvIndex,
      tempUnit,
      windUnit,
      clientTimeStr,
    ],
    queryFn: async () => {
      const res = await fetch("/api/persona-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: activeConfig.id,
          userLanguage: config.name,
          locale: config.code,
          aiChatSupported: config.aiChatSupported,
          personaConfig: {
            id: activeConfig.id,
            label: t("personas." + activeConfig.id + ".title"),
            scoreLabel: activeConfig.scoreLabel,
            windowLabel: t("insights.nextWindow"),
            avoidLabel: t("insights.avoid"),
            primaryFocus: activeConfig.primaryFocus,
            metrics: activeConfig.metrics.map((m) => ({
              key: m.key,
              label: t("metrics." + m.key),
              unit: m.unit,
            })),
          },
          weatherData: {
            temp: currentTemp,
            humidity,
            wind: windSpeed,
            precip: precipitation,
            rainChance: rainProbability,
            aqi,
            uv: uvIndex,
            location: locationName,
            condition: conditionText,
          },
          clientCurrentTime: clientTimeStr,
          tempUnit,
          windUnit,
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const defaultScore = activeConfig.calculateScore({
    temp: currentTemp,
    humidity,
    wind: windSpeed,
    rain: rainProbability,
    aqi,
    uv: uvIndex,
  });

  // Dynamic calculation for the active candidate
  const currentCandidateDisplay = useMemo(() => {
    const rawScore = insightsData?.score ?? defaultScore;
    const finalScore = Math.max(20, Math.min(99, rawScore + (activeCandidate?.scoreOffset || 0)));

    let winLabel = activeCandidate?.label || activeConfig.schedule.morning.label;
    if (activeCandidate) {
      if (activeCandidate.period === "morning") {
        winLabel = clientHour > activeCandidate.start ? `Tomorrow, ${activeCandidate.label}` : `Today, ${activeCandidate.label}`;
      } else if (activeCandidate.period === "afternoon") {
        winLabel = clientHour > activeCandidate.start ? `Tomorrow, ${activeCandidate.label}` : `Today, ${activeCandidate.label}`;
      } else if (activeCandidate.period === "evening") {
        winLabel = clientHour > activeCandidate.start ? `Tomorrow, ${activeCandidate.label}` : `Tonight, ${activeCandidate.label}`;
      }
    }

    const rawReason =
      insightsData?.score_reason ||
      activeCandidate?.reason ||
      activeConfig.schedule.shortReason;

    return {
      windowTime: localizeRelativeTimeWindow(winLabel, t),
      score: finalScore,
      shortReason: translateScheduleReason(rawReason, t),
      relativeTag: activeCandidate?.period ? t("insights.filters." + activeCandidate.period) : t("insights.filters.morning"),
    };
  }, [insightsData, defaultScore, activeCandidate, activeConfig, clientHour, t]);

  // Compute Avoid window display
  const avoidDisplay = useMemo(() => {
    const avoidCfg = activeConfig.schedule.avoid;
    const rawAvoidWindow = clientHour > avoidCfg.start ? `Tomorrow, ${avoidCfg.label}` : `Today, ${avoidCfg.label}`;
    const rawAvoidReason = insightsData?.avoid_reason || avoidCfg.reason;

    return {
      avoidWindow: localizeRelativeTimeWindow(rawAvoidWindow, t),
      avoidReason: translateScheduleReason(rawAvoidReason, t),
      avoidRelative: t("insights.avoid"),
    };
  }, [activeConfig, insightsData, clientHour, t]);

  // Safe concise notes under 30 chars
  const getMetricDisplay = (key: MetricKey) => {
    switch (key) {
      case "temperature":
        return {
          value: `${currentTemp}°${tempUnit.toUpperCase()}`,
          note:
            insightsData?.metric_notes?.temperature ||
            (currentTemp > 28 ? t("metrics.notes.warm") : t("metrics.notes.idealThermal")),
        };
      case "humidity":
        return {
          value: `${humidity}%`,
          note:
            insightsData?.metric_notes?.humidity ||
            (humidity > 70 ? t("metrics.notes.elevatedMoisture") : t("metrics.notes.comfortableMoisture")),
        };
      case "wind":
        return {
          value: `${windSpeed} ${windUnit === "mph" ? "mph" : "km/h"}`,
          note:
            insightsData?.metric_notes?.wind ||
            (windSpeed > 20 ? t("metrics.notes.moderateWind") : t("metrics.notes.lightWind")),
        };
      case "rain":
        return {
          value: `${rainProbability}%`,
          note:
            insightsData?.metric_notes?.rain ||
            (rainProbability > 25 ? t("metrics.notes.scatteredRain") : t("metrics.notes.dryConditions")),
        };
      case "uv":
        return {
          value: `${uvIndex} UV`,
          note:
            insightsData?.metric_notes?.uv ||
            (uvIndex > 6 ? t("metrics.notes.highUv") : t("metrics.notes.safeUv")),
        };
      case "aqi":
        return {
          value: `${aqi} AQI`,
          note:
            insightsData?.metric_notes?.aqi ||
            (aqi > 100 ? t("metrics.notes.moderateAqi") : t("metrics.notes.cleanAqi")),
        };
    }
  };

  const PersonaIcon = activeConfig.icon;

  return (
    <section className="w-full bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#202023] rounded-2xl p-3.5 sm:p-4 transition-colors">
      {/* 1. Header with Persona Name & Subtle AI Indicator */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-[#1c1c1f]">
        <div className="flex items-center gap-2">
          <PersonaIcon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t("personas." + activeConfig.id + ".title")} {t("insights.headerSuffix")}
          </h2>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-[#71717a]">
          <Sparkles className="w-3 h-3 text-sky-500" />
          <span>{t("insights.aiPowered")}</span>
          {isFetching && <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />}
        </div>
      </div>

      {/* 2. 4 Metric Cards (Clean, under-30 chars notes, no ellipsis truncation) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 my-2.5">
        {activeConfig.metrics.map((metric) => {
          const Icon = metric.icon;
          const display = getMetricDisplay(metric.key);

          return (
            <div
              key={metric.key}
              className="bg-slate-50/70 dark:bg-[#161618] border border-slate-200/80 dark:border-[#222225] rounded-xl p-2.5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-slate-500 dark:text-[#8e8e93] text-xs font-normal mb-0.5">
                <span>{t("metrics." + metric.key)}</span>
                <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-[#71717a]" />
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {display.value}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-[#a1a1aa] font-normal leading-tight mt-1">
                {display.note}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Redesigned Minimal Window & Avoid Cards with Inline Alternative Control */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-0.5">
        {/* Card 1: Next Window */}
        <div className="bg-slate-50/70 dark:bg-[#161618] border border-slate-200/80 dark:border-[#222225] rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8e8e93]">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {t("insights.nextWindow")}
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {currentCandidateDisplay.score}<span className="text-slate-400 font-normal text-[11px]">/100</span>
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap overflow-hidden">
              {currentCandidateDisplay.windowTime}
            </div>
            <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
              {currentCandidateDisplay.relativeTag}
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-[#a1a1aa] font-medium">
            {currentCandidateDisplay.shortReason}
          </div>

          {/* Inline Alternative Control Trigger */}
          <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-[#222225] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowAlternativeControls((prev) => !prev)}
              className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 cursor-pointer transition-colors select-none"
            >
              <span>{t("insights.notThisTime")}</span>
              <span className="text-[9px] opacity-80">{showAlternativeControls ? t("insights.closeAlternative") : t("insights.suggestAnother")}</span>
            </button>

            {showAlternativeControls && (
              <span className="text-[10px] font-medium text-slate-400 dark:text-[#71717a]">
                {t("insights.optionOf", { current: (selectedCandidateIndex % availableCandidates.length) + 1, total: availableCandidates.length })}
              </span>
            )}
          </div>

          {/* Expandable compact inline row */}
          {showAlternativeControls && (
            <div className="pt-2 flex flex-wrap items-center gap-1 animate-in fade-in duration-150">
              {/* Option A: One-tap Next Best button */}
              <button
                type="button"
                onClick={() => setSelectedCandidateIndex((prev) => prev + 1)}
                className="px-2 py-1 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800/60 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Cycle to next ranked window"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                {t("insights.nextBest")}
              </button>

              {/* Option B: Preset Constraint chips */}
              <button
                type="button"
                onClick={() => { setActiveConstraint("evening"); setSelectedCandidateIndex(0); }}
                className={`px-2 py-1 rounded-lg text-[10px] transition-colors cursor-pointer border ${
                  activeConstraint === "evening"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold"
                    : "bg-white dark:bg-[#1a1a1c] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#2c2c2f] hover:bg-slate-100 dark:hover:bg-[#252528]"
                }`}
              >
                {t("insights.filters.evening")}
              </button>

              <button
                type="button"
                onClick={() => { setActiveConstraint("afternoon"); setSelectedCandidateIndex(0); }}
                className={`px-2 py-1 rounded-lg text-[10px] transition-colors cursor-pointer border ${
                  activeConstraint === "afternoon"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold"
                    : "bg-white dark:bg-[#1a1a1c] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#2c2c2f] hover:bg-slate-100 dark:hover:bg-[#252528]"
                }`}
              >
                {t("insights.filters.afternoon")}
              </button>

              <button
                type="button"
                onClick={() => { setActiveConstraint("morning"); setSelectedCandidateIndex(0); }}
                className={`px-2 py-1 rounded-lg text-[10px] transition-colors cursor-pointer border ${
                  activeConstraint === "morning"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold"
                    : "bg-white dark:bg-[#1a1a1c] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#2c2c2f] hover:bg-slate-100 dark:hover:bg-[#252528]"
                }`}
              >
                {t("insights.filters.morning")}
              </button>

              {(activeConstraint !== "all" || selectedCandidateIndex !== 0) && (
                <button
                  type="button"
                  onClick={() => { setActiveConstraint("all"); setSelectedCandidateIndex(0); }}
                  className="px-1.5 py-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {t("insights.filters.reset")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Avoid Time */}
        <div className="bg-slate-50/70 dark:bg-[#161618] border border-slate-200/80 dark:border-[#222225] rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8e8e93]">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {t("insights.avoid")}
            </span>
          </div>

          <div className="my-1.5">
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap overflow-hidden">
              {avoidDisplay.avoidWindow}
            </div>
            <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
              {avoidDisplay.avoidRelative}
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-[#a1a1aa] font-medium">
            {avoidDisplay.avoidReason}
          </div>
        </div>
      </div>
    </section>
  );
}
