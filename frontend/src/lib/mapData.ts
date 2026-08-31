import { Sun, SunMedium, Cloud, CloudRain, CloudSnow, CloudDrizzle, CloudFog, CloudLightning } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MapStyleKey = "streets" | "voyager" | "light" | "dark" | "satellite";

export type WeatherLayer = "radar" | "temp" | "wind" | "clouds" | "pressure" | "none";

export interface MapStyleConfig {
  name: string;
  icon: string;
  url: string;
  attribution: string;
  /** Hard ceiling the tile server actually serves. Clamping here is what stops
   *  the "zoom level not supported" placeholder tiles at deep zoom. */
  maxZoom: number;
  subdomains?: string[];
}

export const MAP_STYLES: Record<MapStyleKey, MapStyleConfig> = {
  streets: {
    name: "Detailed Map",
    icon: "🗺️",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  voyager: {
    name: "Clean Light",
    icon: "☀️",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ["a", "b", "c"],
  },
  light: {
    name: "Minimal Light",
    icon: "⚪",
    // Esri Canvas "World Light Gray Base" only serves tiles up to z=16 — beyond
    // that it returns placeholder tiles ("zoom level not supported"). maxZoom is
    // pinned to the server's real limit; the map clamps when switching to it.
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 16,
  },
  dark: {
    name: "Dark Canvas",
    icon: "🌙",
    // Same z=16 ceiling as the light Canvas layer.
    url: "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 16,
  },
  satellite: {
    name: "Satellite",
    icon: "🛰️",
    // World Imagery serves to z=23; 19 keeps street-level detail without
    // hammering the server with huge tile counts at redundant depth.
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a>, Earthstar Geographics',
    maxZoom: 19,
  },
};

/** Highest zoom any basemap in MAP_STYLES supports — the map's own cap. */
export const MAP_MAX_ZOOM = 19;
export const MAP_MIN_ZOOM = 2;

/** Live weather snapshot shown in the map's point summary card. */
export interface MapLiveWeather {
  temp?: number;
  feelsLike?: number;
  humidity?: number;
  wind?: number;
  precip?: number;
  weatherCode?: number;
  pressure?: number;
  aqi?: number;
  pm25?: number;
  uv?: number;
  hourly?: Array<{ time: string; temp: number; rainProb: number }>;
}

// Helper: Decode WMO weather code to text & icon
export function decodeWMO(code?: number): { text: string; icon: LucideIcon } {
  if (code === undefined || code === null) return { text: "Fair", icon: SunMedium };
  if (code === 0) return { text: "Clear Sky", icon: Sun };
  if (code === 1 || code === 2) return { text: "Partly Cloudy", icon: SunMedium };
  if (code === 3) return { text: "Overcast", icon: Cloud };
  if (code >= 45 && code <= 48) return { text: "Foggy", icon: CloudFog };
  if (code >= 51 && code <= 55) return { text: "Drizzle", icon: CloudDrizzle };
  if (code >= 61 && code <= 65) return { text: "Rain", icon: CloudRain };
  if (code >= 71 && code <= 77) return { text: "Snow", icon: CloudSnow };
  if (code >= 80 && code <= 82) return { text: "Rain Showers", icon: CloudRain };
  if (code >= 95) return { text: "Thunderstorm", icon: CloudLightning };
  return { text: "Partly Cloudy", icon: SunMedium };
}

// Helper: AQI qualitative descriptor & color
export function getAQIDescriptor(aqi?: number): {
  text: string;
  color: string;
} {
  if (!aqi) return { text: "Good", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (aqi <= 50) return { text: "Good", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (aqi <= 100) return { text: "Moderate", color: "bg-amber-50 text-amber-700 border-amber-200" };
  if (aqi <= 150)
    return { text: "Unhealthy for Sensitive", color: "bg-orange-50 text-orange-700 border-orange-200" };
  if (aqi <= 200) return { text: "Poor", color: "bg-rose-50 text-rose-700 border-rose-200" };
  return { text: "Very Poor", color: "bg-purple-50 text-purple-700 border-purple-200" };
}

/** Quick-jump preset cities for the map. */
export const QUICK_CITIES = [
  { name: "Pune", lat: 18.5204, lon: 73.8567 },
  { name: "Delhi", lat: 28.6139, lon: 77.209 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
  { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { name: "Jaipur", lat: 26.9124, lon: 75.7873 },
];
