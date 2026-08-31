"use client";

import React from "react";
import { MapPin, RefreshCw, CloudRain, Wind, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/context/I18nContext";
import {
  decodeWMO,
  getAQIDescriptor,
  type MapLiveWeather,
} from "@/lib/mapData";
import { MAP_PANEL } from "./shared";

interface MapWeatherCardProps {
  weather: MapLiveWeather | null;
  locName: string;
  loading: boolean;
  onRefresh: () => void;
}

export function MapWeatherCard({
  weather,
  locName,
  loading,
  onRefresh,
}: MapWeatherCardProps) {
  const { t } = useI18n();

  const condition = decodeWMO(weather?.weatherCode);
  const ConditionIcon = condition.icon;
  const aqiInfo = getAQIDescriptor(weather?.aqi);
  const showSkeleton = loading && !weather;

  return (
    <div className={cn("relative p-4", MAP_PANEL)}>
      <button
        type="button"
        onClick={onRefresh}
        aria-label={t("map.refreshWeather")}
        title={t("map.refreshWeather")}
        className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-ios-blue dark:hover:text-ios-blue-dark transition-colors cursor-pointer"
      >
        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
      </button>

      {showSkeleton ? (
        <div className="space-y-2.5 animate-pulse">
          <div className="h-3 w-32 rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-8 w-20 rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{locName}</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {weather ? Math.round(weather.temp ?? 0) : "—"}°
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("map.feels")}{" "}
                  {weather ? Math.round(weather.feelsLike ?? weather.temp ?? 0) : "—"}°
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <ConditionIcon className="w-3.5 h-3.5 text-ios-blue dark:text-ios-blue-dark" />
                <span>{condition.text}</span>
              </div>
            </div>
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0",
                aqiInfo.color
              )}
            >
              {t("map.aqi")} {weather?.aqi ?? "—"} · {aqiInfo.text}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/10">
            <div className="flex flex-col items-center gap-0.5">
              <CloudRain className="w-3.5 h-3.5 text-ios-blue dark:text-ios-blue-dark" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {weather?.hourly?.[0]?.rainProb ?? 0}%
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400">{t("map.rain")}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Wind className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {Math.round(weather?.wind ?? 0)} km/h
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400">{t("map.wind")}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {weather?.uv?.toFixed(1) ?? "—"}
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400">{t("map.uv")}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
