"use client";

import React, { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { Languages, Check, Search, X, Sparkles } from "lucide-react";
import { LocaleConfig } from "@/lib/i18n/config";

interface LanguageSelectorProps {
  variant?: "header" | "settings" | "sidebar";
  className?: string;
}

export function LanguageSelector({ variant = "header", className = "" }: LanguageSelectorProps) {
  const { locale, config, setLocale, t, supportedLocales } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLocales = supportedLocales.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  const phase1List = filteredLocales.filter((l) => l.phase === 1);
  const phase2List = filteredLocales.filter((l) => l.phase === 2);

  const handleSelect = (code: string) => {
    setLocale(code);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      {/* Trigger Button based on variant */}
      {variant === "header" && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`h-8 px-2.5 rounded-xl border border-slate-200 dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] text-slate-800 dark:text-white shadow-xs hover:border-sky-400 dark:hover:border-sky-500 flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-bold ${className}`}
          title={t("common.language")}
        >
          <Languages className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span className="truncate max-w-[70px] sm:max-w-[100px]">{config.nativeName}</span>
        </button>
      )}

      {variant === "settings" && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] text-slate-900 dark:text-white shadow-xs hover:border-sky-400 dark:hover:border-sky-500 flex items-center justify-between gap-3 transition-colors cursor-pointer text-xs sm:text-sm font-bold w-full ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
              <Languages className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="block font-bold">{config.nativeName}</span>
              {config.dir === "rtl" && (
                <span className="text-[11px] text-slate-500 dark:text-[#8e8e93] font-medium">
                  RTL Layout
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold underline">
            {t("settings.languageSection.switchBtn")}
          </span>
        </button>
      )}

      {variant === "sidebar" && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`w-full px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202023] text-slate-700 dark:text-slate-300 flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-sky-500" />
            <span>{config.nativeName}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono uppercase">{config.code}</span>
        </button>
      )}

      {/* Modal Dialog for Language Selection */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#28282b] rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#242427] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-50 dark:bg-[#1f1f22] text-sky-600 dark:text-sky-400 rounded-xl">
                  <Languages className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {t("common.selectLanguage")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8e8e93]">
                    {t("settings.languageSection.subtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search language..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2f2f33] rounded-xl text-slate-900 dark:text-white outline-none focus:border-sky-500"
                autoFocus
              />
            </div>

            {/* Language Lists */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Phase 1 Major Languages */}
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {t("settings.languageSection.phase1")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {phase1List.map((item) => {
                    const isSelected = item.code === locale;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleSelect(item.code)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 text-sky-900 dark:text-sky-200 font-bold"
                            : "bg-white dark:bg-[#1a1a1d] hover:bg-slate-50 dark:hover:bg-[#222226] border-slate-200/80 dark:border-[#28282c] text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                          <span>{item.nativeName}</span>
                          {item.dir === "rtl" && (
                            <span className="px-1 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold rounded">
                              RTL
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Phase 2 Languages */}
              {phase2List.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t("settings.languageSection.phase2")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {phase2List.map((item) => {
                      const isSelected = item.code === locale;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => handleSelect(item.code)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? "bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 text-sky-900 dark:text-sky-200 font-bold"
                              : "bg-white dark:bg-[#1a1a1d] hover:bg-slate-50 dark:hover:bg-[#222226] border-slate-200/80 dark:border-[#28282c] text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <div className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                            <span>{item.nativeName}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
