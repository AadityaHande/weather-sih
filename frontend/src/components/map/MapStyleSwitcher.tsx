"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MAP_STYLES, type MapStyleKey } from "@/lib/mapData";
import { MAP_PANEL } from "./shared";

interface MapStyleSwitcherProps {
  active: MapStyleKey;
  onSelect: (key: MapStyleKey) => void;
}

export function MapStyleSwitcher({ active, onSelect }: MapStyleSwitcherProps) {
  return (
    <div
      className={cn("absolute top-28 right-3 z-20 p-1 flex flex-col gap-1", MAP_PANEL)}
      role="group"
      aria-label="Base map style"
    >
      {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => {
        const style = MAP_STYLES[key];
        const isSelected = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-pressed={isSelected}
            title={style.name}
            className={cn(
              "px-2.5 py-2 rounded-xl text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer",
              isSelected
                ? "bg-ios-blue dark:bg-ios-blue-dark text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c1c1e]"
            )}
          >
            <span aria-hidden>{style.icon}</span>
            <span className="hidden sm:inline">{style.name}</span>
          </button>
        );
      })}
    </div>
  );
}
