"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_KEY = "theme";
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Persist the *resolved* theme (light/dark) as a cookie so the server can paint
 * the correct theme on the next load without any theme-init script. The user's
 * raw preference (light/dark/system) stays in localStorage for the Settings UI.
 */
function writeThemeCookie(resolved: "light" | "dark") {
  try {
    document.cookie = `${THEME_KEY}=${resolved};path=/;max-age=${COOKIE_TTL_SECONDS};SameSite=Lax`;
  } catch {
    // Cookie unavailable (e.g. private mode) — theme still works client-side.
  }
}

/** Read the stored preference, defaulting to the OS scheme on cold start. */
function readStoredPreference(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (stored && ["light", "dark", "system"].includes(stored)) return stored;
  } catch {
    // localStorage unavailable — fall through to OS default.
  }
  return systemPrefersDark() ? "dark" : "light";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [isDark, setIsDark] = useState<boolean>(false);
  // Latest mode for event handlers; avoids stale closures without re-running
  // the mount effect on every theme change.
  const themeRef = useRef<ThemeMode>("light");

  const applyTheme = (mode: ThemeMode) => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const darkActive = mode === "system" ? systemPrefersDark() : mode === "dark";

    if (darkActive) {
      root.classList.add("dark");
      root.classList.remove("light");
      document.body?.classList.add("dark");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      document.body?.classList.remove("dark");
    }

    setIsDark(darkActive);
    themeRef.current = mode;
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      // localStorage unavailable — theme still applies for this session.
    }
    writeThemeCookie(darkActive ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("theme-change", { detail: mode }));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    applyTheme(mode);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    // Defer the initial apply so the react-compiler lint rule (no synchronous
    // setState in an effect body) is satisfied. The DOM class is still set on
    // the same frame for returning users because the server already painted the
    // correct theme from the cookie.
    const timer = window.setTimeout(() => {
      const initialMode = readStoredPreference();
      setThemeState(initialMode);
      applyTheme(initialMode);
    }, 0);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && e.newValue) {
        const newMode = e.newValue as ThemeMode;
        setThemeState(newMode);
        applyTheme(newMode);
      }
    };

    const handleThemeChange = (e: CustomEvent<ThemeMode>) => {
      if (e.detail && e.detail !== themeRef.current) {
        setThemeState(e.detail);
        applyTheme(e.detail);
      }
    };

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      if (themeRef.current === "system") applyTheme("system");
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("theme-change", handleThemeChange as EventListener);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("theme-change", handleThemeChange as EventListener);
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
