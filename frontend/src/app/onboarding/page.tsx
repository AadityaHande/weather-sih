"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchPreferences, updatePreferences } from "@/lib/api";
import {
  HeartPulse,
  Activity,
  Users,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Flower2,
  Wind,
  Sun,
  MapPin,
} from "lucide-react";

export default function OnboardingPage() {
  const { deviceId, user, isGuest } = useAuth();
  const router = useRouter();

  const [selectedPersonas, setSelectedPersonas] = useState<string[]>(["health"]);
  const [selectedHealthFlags, setSelectedHealthFlags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!deviceId) return;
    async function load() {
      try {
        const data = await fetchPreferences(deviceId);
        if (data.personas && data.personas.length > 0) {
          const filtered = data.personas.filter((p) => p !== "default_general");
          if (filtered.length > 0) {
            setSelectedPersonas(filtered);
          }
        }
        if (data.health_flags) {
          setSelectedHealthFlags(data.health_flags);
        }
      } catch (err) {
        console.error("Could not fetch initial preferences", err);
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
    } else {
      setSelectedPersonas([...selectedPersonas, id]);
    }
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
    try {
      await updatePreferences({
        device_id: deviceId,
        personas: selectedPersonas,
        health_flags: selectedHealthFlags,
        saved_locations: [],
      });
      localStorage.setItem("mausam_onboarding_completed", "true");
      router.push("/home");
    } catch (err) {
      console.error("Failed to save preferences", err);
      localStorage.setItem("mausam_onboarding_completed", "true");
      router.push("/home");
    } finally {
      setSaving(false);
    }
  };

  const personasList = [
    {
      id: "health",
      title: "Health-Conscious",
      description: "AQI dial, UV index, pollen forecast, and humidity alerts.",
      icon: HeartPulse,
      gradient: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-600",
    },
    {
      id: "fitness",
      title: "Fitness Enthusiast",
      description: "Best workout window, heat alert, rain and storm predictions.",
      icon: Activity,
      gradient: "from-amber-50 to-orange-50 border-amber-200 text-amber-600",
    },
    {
      id: "beach",
      title: "Beachgoer / Surfer",
      description: "Tide chart, wave height, sea temp, and swell direction.",
      icon: Sun,
      gradient: "from-cyan-50 to-sky-50 border-cyan-200 text-cyan-600",
    },
    {
      id: "traveler",
      title: "Traveler",
      description: "Multi-city cards, flight weather risk, and packing tips.",
      icon: MapPin,
      gradient: "from-blue-50 to-indigo-50 border-blue-200 text-blue-600",
    },
    {
      id: "family",
      title: "Parent / Family",
      description: "School commute rain alert, fog & storm warning, and outdoor safety.",
      icon: Users,
      gradient: "from-sky-50 to-blue-50 border-sky-200 text-sky-600",
    },
    {
      id: "agriculture",
      title: "Farmer / Gardener",
      description: "Soil moisture, frost alert, rainfall prediction, and spraying window.",
      icon: Flower2,
      gradient: "from-lime-50 to-emerald-50 border-lime-200 text-lime-700",
    },
    {
      id: "commuter",
      title: "Commuter",
      description: "Visibility index, fog/storm traffic delay integration, and road alerts.",
      icon: Wind,
      gradient: "from-purple-50 to-indigo-50 border-purple-200 text-purple-600",
    },
    {
      id: "event",
      title: "Event Planner",
      description: "10-day forecast, rain probability, best timings, and wind risk.",
      icon: Sparkles,
      gradient: "from-rose-50 to-pink-50 border-rose-200 text-rose-600",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 px-4 py-10 flex flex-col justify-center items-center relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl bg-white border border-sky-100 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 shadow-2xl shadow-sky-900/10 relative z-10">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Mausam Logo"
              className="w-7 h-7 object-contain rounded-lg shadow-xs"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
              Personalization Engine Setup
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono font-medium">
            {user ? user.email : "Guest Mode"}
          </span>
        </div>

        {/* Title & Headline */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Tailor Your Weather View
          </h1>
          <p className="text-slate-600 text-sm mt-2 leading-relaxed font-medium">
            The Mausam contextual ranking engine tailors card priority and alerts based on your primary focus. Select one or more personas.
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading profile preferences...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Persona Cards */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                Select Persona(s)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {personasList.map((p) => {
                  const isSelected = selectedPersonas.includes(p.id);
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePersona(p.id)}
                      className={`relative p-5 rounded-2xl border text-left transition-all flex flex-col justify-between group cursor-pointer ${isSelected
                          ? `bg-sky-50/60 border-sky-500 ring-2 ring-sky-500/30 shadow-md shadow-sky-900/5`
                          : `bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50`
                        }`}
                    >
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-sky-600 absolute top-4 right-4" />
                      )}
                      <div>
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center border mb-4 bg-white ${p.gradient}`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm mb-1">
                          {p.title}
                        </h3>
                        <p className="text-xs text-slate-500 leading-normal font-medium">
                          {p.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Health Sensitivity Flags (Shown if Health persona is selected) */}
            {selectedPersonas.includes("health") && (
              <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-emerald-800">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-sm">Health & Respiratory Flags</h4>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Enable specific health sensitivity flags to amplify urgency scoring (e.g. 1.8x threshold multipliers for AQI alerts).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => toggleHealthFlag("respiratory_sensitive")}
                    className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-3 transition-all ${selectedHealthFlags.includes("respiratory_sensitive")
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${selectedHealthFlags.includes("respiratory_sensitive") ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
                      }`}>
                      <span>🫁</span>
                    </div>
                    <div className="text-left">
                      <div>Asthma / Respiratory</div>
                      <div className={`text-[10px] font-normal ${selectedHealthFlags.includes("respiratory_sensitive") ? "text-emerald-100" : "text-slate-500"
                        }`}>
                        Elevates AQI card priority
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleHealthFlag("pollen_interest")}
                    className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-3 transition-all ${selectedHealthFlags.includes("pollen_interest")
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${selectedHealthFlags.includes("pollen_interest") ? "bg-white/20 text-white" : "bg-teal-100 text-teal-700"
                      }`}>
                      <span>🌸</span>
                    </div>
                    <div className="text-left">
                      <div>Pollen & Allergen</div>
                      <div className={`text-[10px] font-normal ${selectedHealthFlags.includes("pollen_interest") ? "text-teal-100" : "text-slate-500"
                        }`}>
                        Enables pollen tracking
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Action Submit */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                You can change this anytime from the Homepage header.
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="py-3.5 px-8 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {saving ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Launch Homepage</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
