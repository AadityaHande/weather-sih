"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { fetchPreferences, updatePreferences } from "@/lib/api";
import { RippleButton, RippleButtonRipples } from "@/components/animate-ui/components/buttons/ripple";
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";
import { MobileMenuTrigger } from "@/components/AppSidebar";
import {
  Settings,
  HeartPulse,
  Activity,
  Users,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  CheckCircle2,
  Save,
  RotateCcw,
  LogOut,
  User,
  MapPin,
  Flame,
  Wind,
  Flower2,
  Check,
  Sun,
  Moon,
  Languages,
} from "lucide-react";

import { useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
  const { deviceId, user, isGuest, logoutUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { theme, isDark, setTheme } = useTheme();

  const [selectedPersonas, setSelectedPersonas] = useState<string[]>(["health"]);
  const [selectedHealthFlags, setSelectedHealthFlags] = useState<string[]>([]);
  const [tempUnit, setTempUnit] = useState<"c" | "f">("c");
  const [windUnit, setWindUnit] = useState<"kmh" | "mph">("kmh");
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [personaLimitError, setPersonaLimitError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Load existing preferences & units from localStorage / API
  useEffect(() => {
    // Load units
    const storedTemp = localStorage.getItem("mausam_temp_unit") as "c" | "f" | null;
    const storedWind = localStorage.getItem("mausam_wind_unit") as "kmh" | "mph" | null;
    if (storedTemp) setTempUnit(storedTemp);
    if (storedWind) setWindUnit(storedWind);

    if (!deviceId) return;
    async function load() {
      try {
        const data = await fetchPreferences(deviceId);
        if (data.personas && data.personas.length > 0) {
          const filtered = data.personas.filter((p) => p !== "default_general");
          if (filtered.length > 0) {
            setSelectedPersonas(filtered.slice(0, 3));
          }
        }
        if (data.health_flags) {
          setSelectedHealthFlags(data.health_flags);
        }
      } catch (err) {
        console.error("Could not fetch preferences", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [deviceId]);

  const togglePersona = (id: string) => {
    if (selectedPersonas.includes(id)) {
      if (selectedPersonas.length === 1) return; // Keep at least one
      setSelectedPersonas(selectedPersonas.filter((p) => p !== id));
      setPersonaLimitError(false);
    } else {
      if (selectedPersonas.length >= 3) {
        setPersonaLimitError(true);
        setTimeout(() => setPersonaLimitError(false), 4000);
        return;
      }
      setSelectedPersonas([...selectedPersonas, id]);
      setPersonaLimitError(false);
    }
  };

  const handleTempUnitChange = (unit: "c" | "f") => {
    setTempUnit(unit);
    localStorage.setItem("mausam_temp_unit", unit);
    window.dispatchEvent(new Event("mausam_units_changed"));
  };

  const handleWindUnitChange = (unit: "kmh" | "mph") => {
    setWindUnit(unit);
    localStorage.setItem("mausam_wind_unit", unit);
    window.dispatchEvent(new Event("mausam_units_changed"));
  };

  const toggleHealthFlag = (flag: string) => {
    if (selectedHealthFlags.includes(flag)) {
      setSelectedHealthFlags(selectedHealthFlags.filter((f) => f !== flag));
    } else {
      setSelectedHealthFlags([...selectedHealthFlags, flag]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    // Persist units
    localStorage.setItem("mausam_temp_unit", tempUnit);
    localStorage.setItem("mausam_wind_unit", windUnit);
    window.dispatchEvent(new Event("mausam_units_changed"));

    try {
      await updatePreferences({
        device_id: deviceId,
        personas: selectedPersonas.slice(0, 3),
        health_flags: selectedHealthFlags,
        saved_locations: [],
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save preferences", err);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSelectedPersonas(["health"]);
    setSelectedHealthFlags([]);
    setTempUnit("c");
    setWindUnit("kmh");
    localStorage.setItem("mausam_temp_unit", "c");
    localStorage.setItem("mausam_wind_unit", "kmh");
    window.dispatchEvent(new Event("mausam_units_changed"));

    await updatePreferences({
      device_id: deviceId,
      personas: ["health"],
      health_flags: [],
      saved_locations: [],
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const personasList = [
    {
      id: "health",
      title: "Health-Conscious",
      description: "AQI dial, UV index, pollen forecast, and humidity respiratory alerts.",
      icon: HeartPulse,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    {
      id: "fitness",
      title: "Fitness Enthusiast",
      description: "Best workout window, heat alert, rain and storm predictions.",
      icon: Activity,
      color: "text-amber-600 bg-amber-50 border-amber-200",
    },
    {
      id: "beach",
      title: "Beachgoer / Surfer",
      description: "Tide chart, wave height, sea temp, and swell direction.",
      icon: Sun,
      color: "text-cyan-600 bg-cyan-50 border-cyan-200",
    },
    {
      id: "traveler",
      title: "Traveler",
      description: "Multi-city cards, flight weather risk, and smart packing tips.",
      icon: MapPin,
      color: "text-blue-600 bg-blue-50 border-blue-200",
    },
    {
      id: "family",
      title: "Parent / Family",
      description: "School commute rain alert, fog & storm warning, and outdoor safety.",
      icon: Users,
      color: "text-sky-600 bg-sky-50 border-sky-200",
    },
    {
      id: "agriculture",
      title: "Farmer / Gardener",
      description: "Soil moisture, frost alert, rainfall prediction, and spray window.",
      icon: Flower2,
      color: "text-lime-700 bg-lime-50 border-lime-200",
    },
    {
      id: "commuter",
      title: "Commuter",
      description: "Visibility index, fog/storm traffic delay integration, and road alerts.",
      icon: Wind,
      color: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      id: "event",
      title: "Event Planner",
      description: "10-day forecast, rain probability, best timings, and wind risk.",
      icon: Sparkles,
      color: "text-rose-600 bg-rose-50 border-rose-200",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-white flex flex-col font-sans pb-32 transition-colors duration-300">
      {/* Top Action Bar: Theme Toggle */}
      <header className="w-full px-4 sm:px-8 pt-3.5 pb-2 transition-colors">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center">
            {/* Mobile: Hamburger menu button */}
            <MobileMenuTrigger />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <LanguageSelector variant="header" />
          </div>
        </div>
      </header>

      {/* Main Settings Body */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Persona Limit Pop-up Alert Banner */}
        {personaLimitError && (
          <div className="p-4 bg-amber-500/15 border border-amber-500/40 text-amber-950 dark:text-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-lg shadow-amber-500/10 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <span className="text-xs sm:text-sm font-bold block">
                  {t("settings.maxThreeBanner")}
                </span>
                <span className="text-[11px] text-amber-800 dark:text-amber-300">
                  {t("settings.maxThreeBannerDesc")}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPersonaLimitError(false)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-200 cursor-pointer"
            >
              {t("settings.dismiss")}
            </button>
          </div>
        )}

        {/* Saved Success Notification */}
        {savedSuccess && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">
              {t("settings.saveSuccess")}
            </span>
          </div>
        )}

        {/* Section 1: User Account Profile */}
        <section className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#27272a] rounded-3xl p-6 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272a] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-100 dark:bg-[#1c1c1e] rounded-xl text-slate-700 dark:text-slate-300 border border-transparent dark:border-[#2c2c2e]">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{t("settings.accountTitle")}</h2>
                <p className="text-xs text-slate-500 dark:text-[#8e8e93]">
                  {user ? t("settings.authenticated") : t("settings.guest")}
                </p>
              </div>
            </div>

            {user ? (
              <RippleButton
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await logoutUser();
                  router.push("/auth");
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t("settings.signOut")}</span>
                <RippleButtonRipples />
              </RippleButton>
            ) : (
              <RippleButton
                variant="default"
                size="sm"
                onClick={() => router.push("/auth")}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold"
              >
                <span>{t("settings.signIn")}</span>
                <RippleButtonRipples />
              </RippleButton>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e] flex items-center justify-between">
            <span className="text-slate-500 dark:text-[#8e8e93] font-medium text-xs">{t("settings.authState")}</span>
            <div className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${user ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span>{user ? user.email : t("settings.guestDesc")}</span>
            </div>
          </div>
        </section>

        {/* Section 2: Appearance & Dark Mode */}
        <section className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#27272a] rounded-3xl p-6 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272a] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-800/60">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Appearance & Dark Mode
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#8e8e93]">
                  Toggle between daylight and OLED dark mode themes
                </p>
              </div>
            </div>

            <ThemeTogglerButton
              variant="default"
              size="default"
              direction="ltr"
              modes={["light", "dark"]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`p-4 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                !isDark
                  ? "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500 text-amber-950 dark:text-amber-200 shadow-sm"
                  : "bg-slate-50 dark:bg-[#1c1c1e] border-slate-200 dark:border-[#2c2c2e] hover:border-slate-300 dark:hover:border-[#3a3a3c]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${!isDark ? "bg-amber-500 text-white" : "bg-amber-100/80 dark:bg-amber-950/40 text-amber-600"}`}>
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-white">Light Theme</span>
                    {!isDark && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[9px] font-extrabold">Active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#8e8e93]">Clean high-visibility daylight interface</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                isDark
                  ? "bg-sky-500/10 dark:bg-sky-500/15 border-sky-500 text-sky-950 dark:text-sky-200 shadow-sm"
                  : "bg-slate-50 dark:bg-[#1c1c1e] border-slate-200 dark:border-[#2c2c2e] hover:border-slate-300 dark:hover:border-[#3a3a3c]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${isDark ? "bg-sky-500 text-white" : "bg-sky-100/80 dark:bg-sky-950/40 text-sky-400"}`}>
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-white">Dark Theme</span>
                    {isDark && (
                      <span className="px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[9px] font-extrabold">Active</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#8e8e93]">Deep contrast OLED black</p>
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* Section 2: Language & Regional Preferences */}
        <section className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#27272a] rounded-3xl p-6 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272a] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-100 dark:border-sky-800/60">
                <Languages className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t("settings.languageSection.title")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#8e8e93]">
                  {t("settings.languageSection.subtitle")}
                </p>
              </div>
            </div>
          </div>

          <LanguageSelector variant="settings" />
        </section>

        {/* Section 3: Personas Configuration */}
        <section className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#27272a] rounded-3xl p-6 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272a] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-100 dark:border-sky-800/60">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{t("settings.personasTitle")}</h2>
                <p className="text-xs text-slate-500 dark:text-[#8e8e93]">
                  {t("settings.personasSubtitle", { current: selectedPersonas.length })}
                </p>
              </div>
            </div>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-950/50 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800/50">
              {t("settings.maxThreeAllowed")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {personasList.map((p) => {
              const isSelected = selectedPersonas.includes(p.id);
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePersona(p.id)}
                  className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? "bg-sky-50/60 dark:bg-sky-950/30 border-sky-500 ring-2 ring-sky-500/30 shadow-md shadow-sky-900/5"
                      : "bg-white dark:bg-[#1c1c1e] border-slate-200 dark:border-[#2c2c2e] hover:border-slate-300 dark:hover:border-[#3a3a3c] hover:bg-slate-50 dark:hover:bg-[#252528]"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-xl border ${p.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{t("personas." + p.id + ".title") || p.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-[#8e8e93] leading-normal font-medium">
                      {t("personas." + p.id + ".subtitle") || p.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 3: Health & Sensitivity Flags */}
        <section className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#27272a] rounded-3xl p-6 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-[#27272a] pb-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800/60">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Health & Sensitivity Multipliers</h2>
              <p className="text-xs text-slate-500 dark:text-[#8e8e93]">
                Amplify urgency scores for critical weather hazards
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => toggleHealthFlag("respiratory_sensitive")}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 cursor-pointer ${
                selectedHealthFlags.includes("respiratory_sensitive")
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                  : "bg-white dark:bg-[#1c1c1e] border-slate-200 dark:border-[#2c2c2e] hover:border-slate-300 dark:hover:border-[#3a3a3c]"
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  selectedHealthFlags.includes("respiratory_sensitive")
                    ? "bg-white/20 text-white"
                    : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                }`}
              >
                <Wind className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm text-slate-900 dark:text-white">Asthma & Respiratory Sensitivity</div>
                <p
                  className={`text-xs mt-0.5 leading-relaxed font-medium ${
                    selectedHealthFlags.includes("respiratory_sensitive")
                      ? "text-emerald-100"
                      : "text-slate-500 dark:text-[#8e8e93]"
                  }`}
                >
                  Applies a 1.8× urgency multiplier on AQI cards when PM2.5 or PM10 exceeds moderate levels.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => toggleHealthFlag("pollen_interest")}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 cursor-pointer ${
                selectedHealthFlags.includes("pollen_interest")
                  ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20"
                  : "bg-white dark:bg-[#1c1c1e] border-slate-200 dark:border-[#2c2c2e] hover:border-slate-300 dark:hover:border-[#3a3a3c]"
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  selectedHealthFlags.includes("pollen_interest")
                    ? "bg-white/20 text-white"
                    : "bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300"
                }`}
              >
                <Flower2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm text-slate-900 dark:text-white">Pollen & Seasonal Allergens</div>
                <p
                  className={`text-xs mt-0.5 leading-relaxed font-medium ${
                    selectedHealthFlags.includes("pollen_interest")
                      ? "text-teal-100"
                      : "text-slate-500 dark:text-[#8e8e93]"
                  }`}
                >
                  Enables pollen risk cards and elevates springtime allergen guidance alerts.
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* Section 4: Display Units */}
        <section className="bg-white dark:bg-[#121212] border border-slate-200/80 dark:border-[#27272a] rounded-3xl p-6 shadow-[0_16px_36px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-[#27272a] pb-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-100 dark:border-purple-800/60">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Units & Display</h2>
              <p className="text-xs text-slate-500 dark:text-[#8e8e93]">Configure measurement metrics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e]">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-white">Temperature Scale</span>
                <p className="text-[11px] text-slate-500 dark:text-[#8e8e93]">Choose display temperature unit</p>
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-[#121212] p-1 rounded-xl border border-slate-200 dark:border-[#2c2c2e]">
                <button
                  type="button"
                  onClick={() => handleTempUnitChange("c")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tempUnit === "c"
                      ? "bg-sky-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-[#8e8e93] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  °C
                </button>
                <button
                  type="button"
                  onClick={() => handleTempUnitChange("f")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tempUnit === "f"
                      ? "bg-sky-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-[#8e8e93] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  °F
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#1c1c1e] rounded-2xl border border-slate-200 dark:border-[#2c2c2e]">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-white">Wind Speed Scale</span>
                <p className="text-[11px] text-slate-500 dark:text-[#8e8e93]">Choose velocity unit</p>
              </div>
              <div className="flex items-center gap-1 bg-white dark:bg-[#121212] p-1 rounded-xl border border-slate-200 dark:border-[#2c2c2e]">
                <button
                  type="button"
                  onClick={() => handleWindUnitChange("kmh")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    windUnit === "kmh"
                      ? "bg-sky-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-[#8e8e93] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  km/h
                </button>
                <button
                  type="button"
                  onClick={() => handleWindUnitChange("mph")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    windUnit === "mph"
                      ? "bg-sky-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-[#8e8e93] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  mph
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-[#27272a]">
          <RippleButton
            variant="outline"
            size="default"
            onClick={handleReset}
            className="rounded-xl flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Defaults</span>
            <RippleButtonRipples />
          </RippleButton>

          <RippleButton
            variant="default"
            size="lg"
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/25 flex items-center gap-2"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Preferences</span>
              </>
            )}
            <RippleButtonRipples color="rgba(255, 255, 255, 0.4)" />
          </RippleButton>
        </div>
      </main>
    </div>
  );
}
