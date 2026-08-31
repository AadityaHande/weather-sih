"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import {
  ALL_LOCALES,
  PHASE_1_LOCALES,
  DEFAULT_LOCALE,
  LocaleConfig,
  getLocaleConfig,
} from "@/lib/i18n/config";

// Direct dictionary imports for zero-latency instantaneous UI rendering
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import mr from "../../messages/mr.json";
import ta from "../../messages/ta.json";
import te from "../../messages/te.json";
import kn from "../../messages/kn.json";
import bn from "../../messages/bn.json";
import gu from "../../messages/gu.json";
import ml from "../../messages/ml.json";
import pa from "../../messages/pa.json";
import ur from "../../messages/ur.json";
import orDict from "../../messages/or.json";

const DICTIONARIES: Record<string, any> = {
  en,
  hi,
  mr,
  ta,
  te,
  kn,
  bn,
  gu,
  ml,
  pa,
  ur,
  or: orDict,
};

interface I18nContextType {
  locale: string;
  config: LocaleConfig;
  isRTL: boolean;
  setLocale: (code: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatNumber: (val: number, opts?: Intl.NumberFormatOptions) => string;
  formatDate: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;
  formatTime: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;
  supportedLocales: LocaleConfig[];
}

const I18nContext = createContext<I18nContextType | null>(null);

function resolveNestedKey(obj: any, path: string): any {
  if (!obj) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<string>(DEFAULT_LOCALE);

  // Sync from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mausam_locale");
      if (saved && (DICTIONARIES[saved] || ALL_LOCALES.some((l) => l.code === saved))) {
        setLocaleState(saved);
      }
    } catch (e) {
      console.warn("Could not load locale from storage", e);
    }
  }, []);

  const config = useMemo(() => getLocaleConfig(locale), [locale]);
  const isRTL = config.dir === "rtl";

  // Apply lang and dir to documentElement whenever locale changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = config.dir;
      // Also apply RTL class helper if needed
      if (config.dir === "rtl") {
        document.documentElement.classList.add("rtl");
      } else {
        document.documentElement.classList.remove("rtl");
      }
    }
  }, [locale, config]);

  const setLocale = (newLocale: string) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("mausam_locale", newLocale);
      window.dispatchEvent(new CustomEvent("mausam_locale_changed", { detail: newLocale }));
    } catch (e) {
      console.warn("Could not save locale", e);
    }
  };

  // Translation function with silent English fallback
  const t = (key: string, params?: Record<string, string | number>): string => {
    const activeDict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
    let val = resolveNestedKey(activeDict, key);

    // Silent fallback to English if missing or not a string
    if (typeof val !== "string") {
      val = resolveNestedKey(DICTIONARIES[DEFAULT_LOCALE], key);
    }

    if (typeof val !== "string") {
      // Last-resort fallback to last segment of key
      return key.split(".").pop() || key;
    }

    // Param interpolation: {name} -> value
    if (params) {
      Object.keys(params).forEach((p) => {
        val = val.replace(new RegExp(`\\{${p}\\}`, "g"), String(params[p]));
      });
    }

    return val;
  };

  // Locale-aware formatting
  const formatNumber = (val: number, opts?: Intl.NumberFormatOptions): string => {
    try {
      return new Intl.NumberFormat(locale, opts).format(val);
    } catch (e) {
      return new Intl.NumberFormat(DEFAULT_LOCALE, opts).format(val);
    }
  };

  const formatDate = (d: Date | string | number, opts?: Intl.DateTimeFormatOptions): string => {
    try {
      const dateObj = d instanceof Date ? d : new Date(d);
      return new Intl.DateTimeFormat(locale, opts).format(dateObj);
    } catch (e) {
      return new Intl.DateTimeFormat(DEFAULT_LOCALE, opts).format(new Date(d));
    }
  };

  const formatTime = (d: Date | string | number, opts?: Intl.DateTimeFormatOptions): string => {
    try {
      const dateObj = d instanceof Date ? d : new Date(d);
      return new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "numeric",
        ...opts,
      }).format(dateObj);
    } catch (e) {
      return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        hour: "numeric",
        minute: "numeric",
        ...opts,
      }).format(new Date(d));
    }
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        config,
        isRTL,
        setLocale,
        t,
        formatNumber,
        formatDate,
        formatTime,
        supportedLocales: ALL_LOCALES,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
