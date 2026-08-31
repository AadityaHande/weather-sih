"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { formatLocalizedLocation } from "@/lib/i18n/localizeLocation";
import { LanguageSelector } from "@/components/LanguageSelector";
import { MobileMenuTrigger } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";
import {
  Bot,
  Send,
  Sparkles,
  MapPin,
  RefreshCw,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  ShieldCheck,
  CloudRain,
  CornerDownLeft,
  User,
  Edit3,
  X,
  Check,
  Search,
  Mic,
  MicOff,
} from "lucide-react";

const SPEECH_LANG_MAP: Record<string, string> = {
  hi: "hi-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  bn: "bn-IN",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
  en: "en-US",
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  weatherSnapshot?: {
    location: string;
    temp: number;
    unit: string;
    condition: string;
    isRainingNow?: boolean;
    precipNow?: number;
    humidity: number;
    wind: number;
    windUnit: string;
    rainChance: number;
    aqi?: number;
    uv?: number;
    isDay?: boolean;
  };
  suggestions?: string[];
}

const CHAT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 Hours
const CHAT_STORAGE_KEY = "mausam_chatbot_messages_v1";

export default function ChatbotPage() {
  const { deviceId } = useAuth();
  const { t, config, locale } = useI18n();

  // Location & unit state
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locName, setLocName] = useState<string>("Pune, India");
  const [tempUnit, setTempUnit] = useState<"c" | "f">("c");
  const [windUnit, setWindUnit] = useState<"kmh" | "mph">("kmh");

  // Location correction modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationSearchInput, setLocationSearchInput] = useState("");
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState("");

  // Chat state: initialized with static welcome message to guarantee zero SSR hydration mismatch
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content:
        "Hey there! I am your Mausam weather companion. Ask me anything about whether it's raining right now, rain forecasts for later, or clothing and workout advice!",
      timestamp: 0,
      suggestions: [
        "Is it raining right now?",
        "Will it rain today?",
        "What should I wear right now?",
      ],
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError("Voice input is not supported in this browser. Please try Chrome, Edge, or Safari.");
      setTimeout(() => setSpeechError(null), 5000);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = SPEECH_LANG_MAP[locale] || "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setInputVal(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setSpeechError("Microphone access was denied. Please allow microphone permissions in your browser.");
          setTimeout(() => setSpeechError(null), 5000);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        inputRef.current?.focus();
      };

      recognition.start();
    } catch (err) {
      console.error("Failed to start voice recognition:", err);
      setIsListening(false);
    }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  // Helper to persist chats safely to localStorage with 24-hour expiration
  const persistChatList = (msgs: ChatMessage[]) => {
    if (typeof window === "undefined") return;
    try {
      const now = Date.now();
      const valid = msgs.filter((m) => {
        if (m.id === "welcome-msg") return true;
        if (!m.timestamp) return false;
        return now - m.timestamp < CHAT_RETENTION_MS;
      });
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(valid));
    } catch (e) {
      console.warn("Failed to persist chats to localStorage", e);
    }
  };

  // Append new message to state and persist immediately
  const appendAndPersistMessage = (newMsg: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, newMsg];
      persistChatList(next);
      return next;
    });
  };

  // Restore 24-hour chats on client mount after hydration
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed: ChatMessage[] = JSON.parse(stored);
        const now = Date.now();
        const valid = parsed.filter((m) => {
          if (m.id === "welcome-msg") return true;
          if (!m.timestamp) return false;
          return now - m.timestamp < CHAT_RETENTION_MS;
        });

        // Restore if there's user interaction within the 24-hour window
        const hasUserChat = valid.some((m) => m.role === "user");
        if (hasUserChat) {
          setMessages(valid);
        }
      }
    } catch (e) {
      console.warn("Could not parse saved chat history", e);
    }
  }, []);

  // Periodic check (every 5 minutes) to prune messages that cross the 24-hour threshold
  useEffect(() => {
    const pruneExpiredChats = () => {
      const now = Date.now();
      setMessages((prev) => {
        const hasUserChat = prev.some(
          (m) => m.role === "user" && now - (m.timestamp || 0) < CHAT_RETENTION_MS
        );
        if (!hasUserChat) {
          const freshWelcome: ChatMessage[] = [
            {
              id: "welcome-msg",
              role: "assistant",
              content: t("chatbot.welcomeMsg"),
              timestamp: Date.now(),
              suggestions: [
                "Is it raining right now?",
                "Will it rain today?",
                "What should I wear right now?",
              ],
            },
          ];
          persistChatList(freshWelcome);
          return freshWelcome;
        }
        const filtered = prev.filter((m) => {
          if (m.id === "welcome-msg") return true;
          if (!m.timestamp) return false;
          return now - m.timestamp < CHAT_RETENTION_MS;
        });
        persistChatList(filtered);
        return filtered;
      });
    };

    const interval = setInterval(pruneExpiredChats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [t]);

  // Sync units from localStorage
  useEffect(() => {
    const updateUnits = () => {
      const storedTemp = localStorage.getItem("mausam_temp_unit") as "c" | "f" | null;
      const storedWind = localStorage.getItem("mausam_wind_unit") as "kmh" | "mph" | null;
      if (storedTemp) setTempUnit(storedTemp);
      if (storedWind) setWindUnit(storedWind);
    };
    updateUnits();
    window.addEventListener("mausam_units_changed", updateUnits);
    window.addEventListener("storage", updateUnits);
    return () => {
      window.removeEventListener("mausam_units_changed", updateUnits);
      window.removeEventListener("storage", updateUnits);
    };
  }, []);

  // Geolocation detection with cleaned neighborhood parsing
  const detectLocation = () => {
    setLocName("Locating GPS...");
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setCoords({ lat, lon });
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1&accept-language=${locale},en`
            );
            if (res.ok) {
              const data = await res.json();
              const addr = data?.address;

              // Filter out administrative "Ward X" tags to give realistic local neighborhood
              const isWard = (s?: string) => s && /ward|zone|circle/i.test(s);
              const sub =
                (!isWard(addr?.suburb) ? addr?.suburb : null) ||
                addr?.neighbourhood ||
                addr?.quarter ||
                addr?.residential ||
                (!isWard(addr?.city_district) ? addr?.city_district : null) ||
                addr?.suburb ||
                "Gokulnagar";
              const city = addr?.city || addr?.town || "Pune";
              const formatted = `${sub}, ${city}`;
              setLocName(formatted);
              localStorage.setItem("mausam_detected_location", formatted);
              return;
            }
          } catch (e) {
            console.warn(e);
          }
          setLocName(`${lat.toFixed(2)}°, ${lon.toFixed(2)}°`);
        },
        () => {
          setCoords({ lat: 18.4635, lon: 73.8732 });
          setLocName("Pune, India");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setCoords({ lat: 18.4635, lon: 73.8732 });
      setLocName("Pune, India");
    }
  };

  useEffect(() => {
    // Check if user has saved custom location first
    const savedCustomLoc = localStorage.getItem("mausam_custom_location");
    const savedCoords = localStorage.getItem("mausam_custom_coords");
    if (savedCustomLoc && savedCoords) {
      try {
        setCoords(JSON.parse(savedCoords));
        setLocName(savedCustomLoc);
        return;
      } catch (e) {}
    }
    detectLocation();
  }, [locale]);

  useEffect(() => {
    const handleLocationRefresh = () => {
      detectLocation();
    };
    window.addEventListener("mausam_refresh_location", handleLocationRefresh);
    return () => window.removeEventListener("mausam_refresh_location", handleLocationRefresh);
  }, []);

  const displayLocName = formatLocalizedLocation(locName, locale, t("common.loading"));

  // Custom location search handler
  const handleSetCustomLocation = async (cityName: string) => {
    if (!cityName.trim()) return;
    setIsSearchingLocation(true);
    setLocationSearchError("");

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName.trim())}&count=1&language=en&format=json`
      );
      if (geoRes.ok) {
        const data = await geoRes.json();
        if (data.results && data.results.length > 0) {
          const top = data.results[0];
          const newCoords = { lat: top.latitude, lon: top.longitude };
          const resolvedName = `${top.name}${top.admin1 ? ", " + top.admin1 : ""}, ${top.country_code?.toUpperCase() || ""}`;

          setCoords(newCoords);
          setLocName(resolvedName);
          localStorage.setItem("mausam_custom_location", resolvedName);
          localStorage.setItem("mausam_custom_coords", JSON.stringify(newCoords));
          setIsLocationModalOpen(false);
          setLocationSearchInput("");

          // Post notification message in chat
          appendAndPersistMessage({
            id: `sys-${Date.now()}`,
            role: "assistant",
            content: `📍 Location updated to ${resolvedName}. All live observations and rain forecasts are now synced to this area!`,
            timestamp: Date.now(),
            suggestions: [
              `Is it raining right now in ${top.name}?`,
              `Will it rain today?`,
              `What's the forecast for ${top.name}?`,
            ],
          });
          return;
        }
      }
      setLocationSearchError("Area not found. Try entering city name (e.g. Pune, Mumbai, Delhi).");
    } catch (err) {
      setLocationSearchError("Failed to search location. Please check your connection.");
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Send message handler
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputVal).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: Date.now(),
    };

    appendAndPersistMessage(userMsg);
    setInputVal("");
    setIsLoading(true);

    try {
      const historyPayload = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyPayload,
          location: {
            lat: coords?.lat ?? 18.4635,
            lon: coords?.lon ?? 73.8732,
            name: locName,
          },
          userLanguage: config.name,
          locale: config.code,
          aiChatSupported: config.aiChatSupported,
          tempUnit,
          windUnit,
        }),
      });

      if (!res.ok) throw new Error("Failed to reach chatbot backend");
      const data = await res.json();

      // If user inquired about a specific city, update location display
      if (data.isLocationUpdated && data.resolvedLocation) {
        setLocName(data.resolvedLocation);
      }

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        weatherSnapshot: data.weatherContext,
        suggestions: data.suggestions,
        timestamp: Date.now(),
      };

      appendAndPersistMessage(assistantMsg);
    } catch (err: any) {
      console.error(err);
      appendAndPersistMessage({
        id: `ai-err-${Date.now()}`,
        role: "assistant",
        content:
          "I ran into a temporary glitch fetching the live meteorological feed. Please send your question once more!",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat
  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content:
          "Conversation reset! I'm ready to answer any questions distinguishing live rain right now from upcoming forecast probabilities.",
        suggestions: [
          "Is it raining right now?",
          "Will it rain today?",
          "What should I wear right now?",
        ],
      },
    ]);
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-white flex flex-col font-sans selection:bg-sky-500 selection:text-white transition-colors duration-300 overflow-hidden">
      {/* 1. Header (Clean Mobile-Friendly Layout) */}
      <header className="w-full px-4 sm:px-8 pt-3.5 pb-2 shrink-0 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center">
            <MobileMenuTrigger />
          </div>
        </div>
      </header>

      {/* Location Correction Inline Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#161618] border border-slate-200 dark:border-[#28282b] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#242427] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-50 dark:bg-[#1f1f22] text-sky-600 dark:text-sky-400 rounded-xl">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Confirm or Change Location</h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#8e8e93]">Ensure weather matches what is outside your window</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSetCustomLocation(locationSearchInput);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={locationSearchInput}
                    onChange={(e) => setLocationSearchInput(e.target.value)}
                    placeholder="E.g. Kothrud, Pune, Mumbai, Delhi..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#1c1c1f] border border-slate-200 dark:border-[#2f2f33] rounded-xl text-slate-900 dark:text-white outline-none focus:border-sky-500"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!locationSearchInput.trim() || isSearchingLocation}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isSearchingLocation ? "Searching..." : "Set"}
                </button>
              </form>

              {locationSearchError && (
                <p className="text-[11px] text-rose-500 font-medium">{locationSearchError}</p>
              )}

              {/* Quick Reset to GPS */}
              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-[#242427]">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("mausam_custom_location");
                    localStorage.removeItem("mausam_custom_coords");
                    detectLocation();
                    setIsLocationModalOpen(false);
                  }}
                  className="text-sky-600 dark:text-sky-400 hover:underline font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Use Auto-Detected GPS Location
                </button>
                <span className="text-[10px] text-slate-400">Current: {locName}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Direct Chat Feed with DaisyUI Chat Component */}
      <main className="flex-1 w-full overflow-y-auto px-3 sm:px-6 py-4 no-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";

          return (
            <div
              key={msg.id}
              className={cn("chat w-full", isUser ? "chat-end" : "chat-start")}
            >
              {/* Author Image (Avatar) */}
              <div className="chat-image avatar">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shadow-xs shrink-0",
                    isUser
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                      : "bg-sky-600 text-white"
                  )}
                >
                  {isUser ? <User className="w-5 h-5 shrink-0" /> : <Bot className="w-5 h-5 shrink-0" />}
                </div>
              </div>

              {/* Chat Header */}
              <div className="chat-header text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <span>{isUser ? "You" : "Mausam AI"}</span>
                {msg.timestamp ? (
                  <time className="text-[10px] opacity-50 font-mono">
                    {formatTime(msg.timestamp)}
                  </time>
                ) : null}
              </div>

              {/* Chat Bubble */}
              <div
                className={cn(
                  "chat-bubble shadow-xs",
                  isUser
                    ? "chat-bubble-primary text-white"
                    : "bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-[#27272a]"
                )}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                {/* Weather Snapshot Card inside Assistant Bubble */}
                {!isUser && msg.weatherSnapshot && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-[#202024] border border-slate-200/80 dark:border-[#2b2b30] rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-2xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                        {msg.weatherSnapshot.location.split(",")[0]}
                      </span>
                      <span className="font-extrabold text-sky-600 dark:text-sky-400">
                        {msg.weatherSnapshot.temp}°{msg.weatherSnapshot.unit}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          msg.weatherSnapshot.isRainingNow
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                            : "bg-slate-200/70 dark:bg-[#2a2a30] text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {msg.weatherSnapshot.isRainingNow
                          ? `🌧️ Raining now (${msg.weatherSnapshot.precipNow} mm)`
                          : `☁️ ${msg.weatherSnapshot.condition} (No active rain)`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-[#8e8e93]">
                      <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                        <CloudRain className="w-3 h-3 text-indigo-500" />
                        {msg.weatherSnapshot.rainChance}% rain forecast
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-sky-500" />
                        {msg.weatherSnapshot.humidity}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Wind className="w-3 h-3 text-teal-500" />
                        {msg.weatherSnapshot.wind} {msg.weatherSnapshot.windUnit}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Footer */}
              <div className="chat-footer opacity-70 text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex flex-col gap-1.5">
                <span>{isUser ? "Delivered" : "Mausam Telemetry Verified"}</span>

                {/* Follow-up Suggestion Chips in footer */}
                {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => handleSendMessage(sug)}
                        className="px-2.5 py-1 bg-white dark:bg-[#18181b] hover:bg-sky-50 dark:hover:bg-[#222226] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-[#2c2c30] rounded-full text-[11px] font-medium transition-all cursor-pointer shadow-2xs flex items-center gap-1 opacity-100"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-sky-500" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live Typing Indicator with DaisyUI Chat */}
        {isLoading && (
          <div className="chat chat-start w-full">
            <div className="chat-image avatar">
              <div className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs shrink-0 animate-pulse">
                <Bot className="w-5 h-5 shrink-0" />
              </div>
            </div>
            <div className="chat-header text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              <span>Mausam AI</span>
            </div>
            <div className="chat-bubble bg-white dark:bg-[#18181b] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-[#27272a] shadow-xs flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="text-xs text-slate-500 dark:text-[#8e8e93] font-medium">
                Analyzing live observation telemetry...
              </span>
            </div>
            <div className="chat-footer opacity-50 text-[10px] text-slate-400 mt-1">
              Thinking...
            </div>
          </div>
        )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 3. Sticky Input Chatting Bar */}
      <div className="shrink-0 sticky bottom-0 z-30 w-full bg-slate-50/95 dark:bg-[#000000]/95 backdrop-blur-md pt-2 pb-3 sm:pb-4 border-t border-slate-200/70 dark:border-[#1f1f22]">
        <div className="max-w-4xl mx-auto px-3 sm:px-6">
          {/* Live listening banner */}
          {isListening && (
            <div className="flex items-center justify-center gap-2 px-3 py-1 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-full text-xs font-semibold text-rose-600 dark:text-rose-400 animate-pulse mb-2 mx-auto w-fit shadow-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Listening... Speak your question now</span>
            </div>
          )}

          {/* Speech error toast */}
          {speechError && (
            <div className="flex items-center justify-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-full text-xs font-medium text-amber-700 dark:text-amber-300 mb-2 mx-auto w-fit shadow-xs">
              <span>{speechError}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2 bg-white dark:bg-[#141416] border border-slate-200/90 dark:border-[#27272a] focus-within:border-sky-500 dark:focus-within:border-sky-500 rounded-2xl p-2 transition-all shadow-xs"
          >
            <textarea
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={isListening ? "Listening to your voice..." : "Ask anything related to weather..."}
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#71717a] resize-none outline-none max-h-32 min-h-[38px] py-2 px-2 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            />

            {/* Voice Input Button */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              title={isListening ? "Stop listening" : "Voice input (Speak to ask)"}
              className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-xs",
                isListening
                  ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/25"
                  : "bg-slate-100 dark:bg-[#202024] hover:bg-sky-50 dark:hover:bg-[#27272c] text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200/80 dark:border-[#2f2f35]"
              )}
            >
              {isListening ? (
                <MicOff className="w-4 h-4 text-white" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputVal.trim() || isLoading}
              className="h-9 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-xs"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
          <p className="text-[10px] text-slate-400 dark:text-[#71717a] mt-1.5 text-center">
            Distinguishes live current observations from forecast probabilities. Type or speak your question.
          </p>
        </div>
      </div>
    </div>
  );
}
