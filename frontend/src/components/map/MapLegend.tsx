"use client";

import React from "react";
import { useI18n } from "@/context/I18nContext";
import type { WeatherLayer } from "@/lib/mapData";
import { cn } from "@/lib/utils";
import { MAP_PANEL } from "./shared";

interface MapLegendProps {
  layer: Exclude<WeatherLayer, "radar" | "none">;
}

const LEGENDS: Record<
  Exclude<WeatherLayer, "radar" | "none">,
  { titleKey: string; fromKey: string; toKey: string; bar: string }
> = {
  temp: {
    titleKey: "map.tempHeatmap",
    fromKey: "map.freezing",
    toKey: "map.hot",
    bar: "bg-gradient-to-r from-blue-500 via-emerald-400 via-amber-400 to-rose-600",
  },
  wind: {
    titleKey: "map.windVelocity",
    fromKey: "map.calm",
    toKey: "map.gale",
    bar: "bg-gradient-to-r from-teal-200 via-teal-500 to-emerald-700",
  },
  clouds: {
    titleKey: "map.cloudCover",
    fromKey: "map.clear",
    toKey: "map.overcast",
    bar: "bg-gradient-to-r from-transparent via-slate-300 to-white",
  },
  pressure: {
    titleKey: "map.pressureMap",
    fromKey: "map.lowPressure",
    toKey: "map.highPressure",
    bar: "bg-gradient-to-r from-indigo-500 via-purple-400 to-amber-500",
  },
};

export function MapLegend({ layer }: MapLegendProps) {
  const { t } = useI18n();
  const legend = LEGENDS[layer];
  // Defensive: "radar" (while its frames are still loading) and any future
  // layer without a legend map to undefined here. Render nothing rather than
  // crash the map.
  if (!legend) return null;
  const { titleKey, fromKey, toKey, bar } = legend;

  return (
    <div className={cn("space-y-2.5", MAP_PANEL)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 truncate">
            {t(titleKey)}
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1e1e20] px-2 py-0.5 rounded-md border border-slate-200/70 dark:border-[#2a2a2d] whitespace-nowrap">
          {t("map.liveOverlay")}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold pt-0.5">
        <span>{t(fromKey)}</span>
        <div className={cn("h-2 w-28 rounded-full shadow-inner", bar)} />
        <span>{t(toKey)}</span>
      </div>
    </div>
  );
}
