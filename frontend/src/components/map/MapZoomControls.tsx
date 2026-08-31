"use client";

import React from "react";
import { Plus, Minus, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/context/I18nContext";
import { MAP_PANEL } from "./shared";

interface MapZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  showRecenter: boolean;
  /** GPS fix accuracy in meters; shown as "±X m" while a fix is active. */
  accuracy?: number | null;
}

export function MapZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onRecenter,
  showRecenter,
  accuracy,
}: MapZoomControlsProps) {
  const { t } = useI18n();

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2">
      {/* Zoom level chip */}
      <span className="ios-material px-2 py-1 rounded-lg text-[10px] font-bold text-ios-label-2 dark:text-ios-label-2-dark tabular-nums">
        z{zoom}
      </span>

      {/* GPS fix accuracy, while a fix is active */}
      {showRecenter && accuracy != null && (
        <span className="ios-material px-1.5 py-0.5 rounded-lg text-[9px] font-semibold text-ios-blue dark:text-ios-blue-dark tabular-nums whitespace-nowrap">
          ±{Math.round(accuracy)} m
        </span>
      )}

      <div className={cn("flex flex-col overflow-hidden", MAP_PANEL)}>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label={t("map.zoomIn")}
          title={t("map.zoomIn")}
          className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <div className="mx-2 h-px bg-slate-200 dark:bg-white/10" />
        <button
          type="button"
          onClick={onZoomOut}
          aria-label={t("map.zoomOut")}
          title={t("map.zoomOut")}
          className="p-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
        >
          <Minus className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {showRecenter && (
        <button
          type="button"
          onClick={onRecenter}
          aria-label={t("map.recenter")}
          title={t("map.recenter")}
          className={cn(
            "p-2.5 rounded-full text-ios-blue dark:text-ios-blue-dark bg-white/95 dark:bg-[#141416]/95 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-2xl transition-all cursor-pointer active:scale-95",
            "hover:bg-white dark:hover:bg-[#1c1c1e]"
          )}
        >
          <Crosshair className="w-4 h-4" strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}
