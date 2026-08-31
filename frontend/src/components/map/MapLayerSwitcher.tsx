"use client";

import React from "react";
import { CloudRain, Thermometer, Wind, Cloud, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/context/I18nContext";
import type { WeatherLayer } from "@/lib/mapData";
import { MAP_PANEL } from "./shared";

interface MapLayerSwitcherProps {
  layer: WeatherLayer;
  onSelectLayer: (layer: WeatherLayer) => void;
  cities: { name: string; lat: number; lon: number }[];
  activeCity: string;
  onSelectCity: (city: { name: string; lat: number; lon: number }) => void;
}

const LAYER_OPTIONS: {
  key: WeatherLayer;
  icon: React.ElementType | null;
  labelKey: string;
  activeClass: string;
}[] = [
  { key: "radar", icon: CloudRain, labelKey: "map.layers.radar", activeClass: "bg-ios-blue dark:bg-ios-blue-dark" },
  { key: "temp", icon: Thermometer, labelKey: "map.layers.temp", activeClass: "bg-amber-500" },
  { key: "wind", icon: Wind, labelKey: "map.layers.wind", activeClass: "bg-teal-600" },
  { key: "clouds", icon: Cloud, labelKey: "map.layers.clouds", activeClass: "bg-indigo-600" },
  { key: "pressure", icon: Gauge, labelKey: "map.layers.pressure", activeClass: "bg-purple-600" },
  { key: "none", icon: null, labelKey: "map.layers.none", activeClass: "bg-slate-800 dark:bg-slate-700" },
];

export function MapLayerSwitcher({
  layer,
  onSelectLayer,
  cities,
  activeCity,
  onSelectCity,
}: MapLayerSwitcherProps) {
  const { t } = useI18n();

  return (
    <div className="pointer-events-none absolute top-4 left-3 right-3 z-20 flex flex-col gap-2.5">
      {/* Quick city pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pointer-events-auto">
        {cities.map((city) => (
          <button
            key={city.name}
            type="button"
            onClick={() => onSelectCity(city)}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap backdrop-blur-md cursor-pointer",
              activeCity === city.name
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/25 scale-105"
                : "bg-white/90 dark:bg-[#1c1c1e]/90 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-[#2c2c2e] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#2c2c2e] shadow-xs"
            )}
          >
            {city.name}
          </button>
        ))}
      </div>

      {/* Weather overlay layer selector */}
      <div
        className={cn(
          "p-1.5 flex flex-wrap items-center gap-1.5 pointer-events-auto max-w-max",
          MAP_PANEL
        )}
        role="group"
        aria-label={t("map.layers.none")}
      >
        {LAYER_OPTIONS.map(({ key, icon: Icon, labelKey, activeClass }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectLayer(key)}
            aria-pressed={layer === key}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
              layer === key
                ? cn(activeClass, "text-white shadow-sm")
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c1c1e]"
            )}
          >
            {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
