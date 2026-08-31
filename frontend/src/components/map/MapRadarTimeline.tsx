"use client";

import React from "react";
import { Play, Pause } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { cn } from "@/lib/utils";
import { MAP_PANEL, formatFrameTime } from "./shared";

interface MapRadarTimelineProps {
  playing: boolean;
  onTogglePlay: () => void;
  frames: { time?: number }[];
  currentIndex: number;
  onScrub: (index: number) => void;
}

export function MapRadarTimeline({
  playing,
  onTogglePlay,
  frames,
  currentIndex,
  onScrub,
}: MapRadarTimelineProps) {
  const { t } = useI18n();
  const frame = frames[currentIndex];
  const timeLabel = formatFrameTime(frame?.time) ?? t("map.live");

  return (
    <div className={cn("space-y-3", MAP_PANEL)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-ios-red animate-ping shrink-0" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 truncate">
            {t("map.radarLoop")}
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-ios-blue dark:text-ios-blue-dark bg-ios-blue/10 px-2 py-0.5 rounded-lg border border-ios-blue/15 whitespace-nowrap">
          {timeLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? t("map.pause") : t("map.play")}
          className="p-2.5 bg-ios-blue dark:bg-ios-blue-dark text-white font-bold rounded-xl shadow-md shadow-ios-blue/20 transition-all cursor-pointer active:scale-95"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={currentIndex}
          onChange={(e) => onScrub(parseInt(e.target.value, 10))}
          aria-label={t("map.radarLoop")}
          className="flex-1 accent-ios-blue h-2 bg-slate-200 dark:bg-[#27272a] rounded-lg cursor-pointer"
        />
      </div>

      {/* Rain intensity legend */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold pt-1">
        <span>{t("map.light")}</span>
        <div className="h-2 w-32 rounded-full bg-gradient-to-r from-sky-300 via-amber-400 to-rose-600 shadow-inner" />
        <span>{t("map.heavy")}</span>
      </div>
    </div>
  );
}
