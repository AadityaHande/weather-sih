"use client";

import React from "react";
import { Info } from "lucide-react";
import { useI18n } from "@/context/I18nContext";

export function MapHint() {
  const { t } = useI18n();

  return (
    <div
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-2 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 text-[11px] font-medium text-slate-500 dark:text-slate-400 shadow-sm"
    >
      <Info className="w-3.5 h-3.5 text-ios-blue dark:text-ios-blue-dark shrink-0" />
      <span>{t("map.clickToInspect")}</span>
    </div>
  );
}
