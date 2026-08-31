"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type {
  Circle,
  Layer,
  LeafletMouseEvent,
  Map as LeafletMap,
  Marker,
  TileLayer,
} from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { fetchHomepage } from "@/lib/api";
import { GooeyInput } from "@/components/ui/gooey-input";
import { MobileMenuTrigger } from "@/components/AppSidebar";
import { Crosshair } from "lucide-react";

import { useTheme } from "@/context/ThemeContext";
import { useI18n } from "@/context/I18nContext";
import { cn } from "@/lib/utils";
import { getLeaflet } from "@/lib/leaflet";
import {
  MAP_STYLES,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  QUICK_CITIES,
  type MapStyleKey,
  type WeatherLayer,
  type MapLiveWeather,
} from "@/lib/mapData";
import { OfflineBanner } from "@/components/OfflineBanner";
import { MapLayerSwitcher } from "@/components/map/MapLayerSwitcher";
import { MapStyleSwitcher } from "@/components/map/MapStyleSwitcher";
import { MapZoomControls } from "@/components/map/MapZoomControls";
import { MapRadarTimeline } from "@/components/map/MapRadarTimeline";
import { MapLegend } from "@/components/map/MapLegend";
import { MapWeatherCard } from "@/components/map/MapWeatherCard";
import { MapHint } from "@/components/map/MapHint";

const STYLE_STORAGE_KEY = "mausam_map_style";
const DEFAULT_STYLE: MapStyleKey = "streets";
const INITIAL_ZOOM = 11;

/** RainViewer frame tile URL. */
function radarTileUrl(frame: { path: string }): string {
  return `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}

/** One RainViewer radar frame (past precipitation). */
interface RadarFrame {
  path: string;
  time: number;
}

export default function WeatherMapPage() {
  const { deviceId } = useAuth();
  const { isDark } = useTheme();
  const { t } = useI18n();
  // Refs keep the current `t` (locale-sensitive) available to handlers that are
  // attached once on mount, so effect-bound strings re-translate on locale change.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const baseTileLayerRef = useRef<TileLayer | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const accuracyCircleRef = useRef<Circle | null>(null);
  const weatherLayerRef = useRef<TileLayer | null>(null);
  const radarLayerRef = useRef<TileLayer | null>(null);
  const locateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({
    lat: 18.5204,
    lon: 73.8567,
  }); // Default Pune center until auto-locate resolves
  const coordsRef = useRef(coords);
  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locName, setLocName] = useState<string>(t("map.locatingArea"));
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>(DEFAULT_STYLE);
  const [zoomLevel, setZoomLevel] = useState<number>(INITIAL_ZOOM);
  const [weatherLayer, setWeatherLayer] = useState<WeatherLayer>("radar");
  const [isRadarPlaying, setIsRadarPlaying] = useState<boolean>(false);
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const currentFrameIndexRef = useRef(0);
  useEffect(() => {
    currentFrameIndexRef.current = currentFrameIndex;
  }, [currentFrameIndex]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [liveWeather, setLiveWeather] = useState<MapLiveWeather | null>(null);
  const [fetchingPointWeather, setFetchingPointWeather] = useState<boolean>(false);

  // Fetch backend personalized homepage weather for active location (warms the
  // engine cache for this point while the map shows its own live details).
  useQuery({
    queryKey: ["map_weather", deviceId, coords.lat, coords.lon],
    queryFn: () => fetchHomepage(deviceId || "map_user", coords.lat, coords.lon),
    enabled: !!coords,
  });

  // Restore the user's last basemap choice (deferred a tick so the setState
  // isn't run synchronously from within the effect body).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const stored = localStorage.getItem(STYLE_STORAGE_KEY);
        if (stored && (MAP_STYLES as Record<string, unknown>)[stored]) {
          setMapStyle(stored as MapStyleKey);
        }
      } catch {
        // Ignore storage access errors (private mode etc.)
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Persist the basemap choice.
  useEffect(() => {
    try {
      localStorage.setItem(STYLE_STORAGE_KEY, mapStyle);
    } catch {
      // Ignore storage access errors
    }
  }, [mapStyle]);

  // Auto-pair the two theme basemaps (streets <-> dark) by deriving the
  // *effective* style at render time instead of mutating state inside an
  // effect. The user's explicit choice (satellite/voyager/light) is preserved.
  const effectiveMapStyle: MapStyleKey =
    isDark && mapStyle === "streets"
      ? "dark"
      : !isDark && mapStyle === "dark"
        ? "streets"
        : mapStyle;

  // Reverse Geocode helper to get exact locality / suburb (e.g. Gokulnagar, Pune)
  const reverseGeocode = useCallback(async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data?.address;
        if (addr) {
          const neighborhood =
            addr.suburb ||
            addr.neighbourhood ||
            addr.quarter ||
            addr.residential ||
            addr.village ||
            addr.city_district ||
            addr.road ||
            addr.hamlet;
          const city = addr.city || addr.town || addr.state_district || "Pune";
          if (neighborhood && city && !neighborhood.toLowerCase().includes(city.toLowerCase())) {
            return `${neighborhood}, ${city}`;
          }
          return neighborhood || city || data.display_name.split(",")[0];
        }
      }
    } catch (e) {
      console.warn("Reverse geocoding error:", e);
    }
    return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  }, []);

  // Live weather fetch: Combines Open-Meteo Current + Air Quality + Hourly
  const fetchLiveWeatherDetails = useCallback(async (lat: number, lon: number) => {
    setFetchingPointWeather(true);
    try {
      // 1. Forecast data
      const forecastPromise = fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,precipitation_probability,weather_code&forecast_days=1`
      ).then((r) => (r.ok ? r.json() : null));

      // 2. Air quality & UV data
      const aqiPromise = fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,uv_index`
      ).then((r) => (r.ok ? r.json() : null));

      const [forecastData, aqiData] = await Promise.all([forecastPromise, aqiPromise]);

      if (forecastData?.current) {
        const curr = forecastData.current;
        const hourlyTimes: string[] = forecastData.hourly?.time || [];
        const currentIso: string = curr.time || "";
        // Align the hourly window to the current hour rather than always
        // starting from the first entry (midnight).
        let currentHourIdx = 0;
        if (currentIso && hourlyTimes.length > 0) {
          const found = hourlyTimes.findIndex((tm) => tm.startsWith(currentIso.slice(0, 13)));
          if (found !== -1) currentHourIdx = found;
        }
        const hourlyList = hourlyTimes
          .slice(currentHourIdx, currentHourIdx + 12)
          .map((tm: string, offset: number) => {
            const i = currentHourIdx + offset;
            return {
              time: new Date(tm).toLocaleTimeString([], { hour: "numeric" }),
              temp: forecastData.hourly.temperature_2m[i],
              rainProb: forecastData.hourly.precipitation_probability[i],
            };
          });

        setLiveWeather({
          temp: curr.temperature_2m,
          feelsLike: curr.apparent_temperature,
          humidity: curr.relative_humidity_2m,
          wind: curr.wind_speed_10m,
          precip: curr.precipitation,
          weatherCode: curr.weather_code,
          pressure: curr.surface_pressure ? Math.round(curr.surface_pressure) : 1012,
          aqi: aqiData?.current?.us_aqi ?? 45,
          pm25: aqiData?.current?.pm2_5,
          uv: aqiData?.current?.uv_index ?? 5.5,
          hourly: hourlyList,
        });
      }
    } catch (e) {
      console.warn("Could not fetch live weather details", e);
    } finally {
      setFetchingPointWeather(false);
    }
  }, []);

  const moveMapTo = useCallback(
    (lat: number, lon: number, zoom: number, name: string, gps = false) => {
      setCoords({ lat, lon });
      setLocName(name || tRef.current("map.inspectingLocation"));
      setIsGpsActive(gps);
      const map = mapInstanceRef.current;
      if (map) {
        map.flyTo([lat, lon], zoom, { duration: 1.5 });
        markerRef.current?.setLatLng([lat, lon]);
      }
      // Hide the accuracy halo when the pin is moved manually (not GPS).
      if (!gps) accuracyCircleRef.current?.setRadius(0);
      void fetchLiveWeatherDetails(lat, lon);
    },
    [fetchLiveWeatherDetails]
  );

  // GPS User Location with High Accuracy
  const locateUser = useCallback(
    (isInitial: boolean = false) => {
      setIsLocating(true);
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const newLat = pos.coords.latitude;
            const newLon = pos.coords.longitude;
            setCoords({ lat: newLat, lon: newLon });
            setAccuracy(pos.coords.accuracy);
            setIsGpsActive(true);
            setIsLocating(false);

            const map = mapInstanceRef.current;
            if (map) {
              map.flyTo([newLat, newLon], 13, { duration: 1.5 });
              markerRef.current?.setLatLng([newLat, newLon]);
              accuracyCircleRef.current
                ?.setLatLng([newLat, newLon])
                .setRadius(pos.coords.accuracy);
            }

            const name = await reverseGeocode(newLat, newLon);
            setLocName(name);
            void fetchLiveWeatherDetails(newLat, newLon);
          },
          async () => {
            console.warn("Location error");
            setIsLocating(false);
            if (isInitial) {
              // Fallback initial location
              const fallback = coordsRef.current;
              const name = await reverseGeocode(fallback.lat, fallback.lon);
              setLocName(name || tRef.current("map.locatingArea"));
              void fetchLiveWeatherDetails(fallback.lat, fallback.lon);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } else {
        setIsLocating(false);
      }
    },
    [reverseGeocode, fetchLiveWeatherDetails]
  );

  // Auto-locate on first load (deferred a tick so locateUser's synchronous
  // setState isn't run from within the effect body).
  useEffect(() => {
    const id = setTimeout(() => locateUser(true), 0);
    return () => clearTimeout(id);
  }, [locateUser]);

  const flyToCity = useCallback(
    (city: { name: string; lat: number; lon: number }) => {
      moveMapTo(city.lat, city.lon, 11, city.name);
    },
    [moveMapTo]
  );

  const handleSearch = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return;
      const match = QUICK_CITIES.find((c) => c.name.toLowerCase() === q.toLowerCase());
      if (match) {
        flyToCity(match);
        setSearchQuery("");
        return;
      }
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.length > 0) {
            const first = data[0];
            moveMapTo(parseFloat(first.lat), parseFloat(first.lon), 12, first.display_name.split(",")[0]);
            setSearchQuery("");
          }
        })
        .catch((err) => console.warn("Geocoding failed", err));
    },
    [flyToCity, moveMapTo]
  );

  // Fetch RainViewer radar timestamps
  useEffect(() => {
    async function loadRadarFrames() {
      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (res.ok) {
          const data = await res.json();
          if (data?.radar?.past) {
            setRadarFrames(data.radar.past);
            setCurrentFrameIndex(data.radar.past.length - 1);
          }
        }
      } catch (err) {
        console.warn("Could not load RainViewer radar frames", err);
      }
    }
    void loadRadarFrames();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      try {
        const L = await getLeaflet();
        if (!isMounted || !mapContainerRef.current) return;

        // Reset existing instance or container references
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
        // Leaflet tags its container with a non-enumerable `_leaflet_id`; reset
        // it so a fresh instance can re-attach on strict-mode double-mount.
        const container = mapContainerRef.current as HTMLElement & {
          _leaflet_id?: number | null;
        };
        if (container._leaflet_id) {
          container._leaflet_id = null;
        }

        const initial = coordsRef.current;

        // Initialize map
        const map = L.map(mapContainerRef.current, {
          center: [initial.lat, initial.lon],
          zoom: INITIAL_ZOOM,
          maxZoom: MAP_MAX_ZOOM,
          minZoom: MAP_MIN_ZOOM,
          zoomControl: false,
        });
        mapInstanceRef.current = map;

        // Base tile layer
        const styleConfig = MAP_STYLES[effectiveMapStyle];
        const baseLayer = L.tileLayer(styleConfig.url, {
          attribution: styleConfig.attribution,
          maxZoom: styleConfig.maxZoom,
          subdomains: styleConfig.subdomains || ["a", "b", "c"],
          crossOrigin: true,
        });
        baseLayer.addTo(map);
        baseTileLayerRef.current = baseLayer;

        // Metric scale (bottom-right; sits under the layer panels when open).
        L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);

        // Custom GPS Pin Marker
        const customIcon = L.divIcon({
          className: "custom-gps-pin",
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-10 h-10 bg-sky-500/30 rounded-full animate-ping"></div>
              <div class="absolute w-7 h-7 bg-sky-400/50 rounded-full animate-pulse"></div>
              <div class="relative w-5 h-5 bg-gradient-to-tr from-sky-600 to-blue-700 border-2 border-white rounded-full shadow-xl flex items-center justify-center text-[9px] text-white font-bold">
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([initial.lat, initial.lon], { icon: customIcon }).addTo(map);
        markerRef.current = marker;

        // GPS accuracy halo — hidden until the first fix.
        const accuracyCircle = L.circle([initial.lat, initial.lon], {
          radius: 0,
          color: "#0a84ff",
          fillColor: "#0a84ff",
          fillOpacity: 0.12,
          weight: 1,
          interactive: false,
        }).addTo(map);
        accuracyCircleRef.current = accuracyCircle;

        // Keep the zoom chip in sync with the map.
        map.on("zoomend", () => setZoomLevel(map.getZoom()));

        // Click on map to drop pin & fetch exact locality weather (debounced so
        // pan/zoom gestures that end on the map don't fire repeated lookups).
        map.on("click", (e: LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          setCoords({ lat, lon: lng });
          setIsGpsActive(false);
          accuracyCircle.setRadius(0);
          setLocName(tRef.current("map.inspectingLocation"));
          if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
          locateTimerRef.current = setTimeout(() => {
            void (async () => {
              const name = await reverseGeocode(lat, lng);
              if (mapInstanceRef.current) setLocName(name);
              void fetchLiveWeatherDetails(lat, lng);
            })();
          }, 350);
        });

        // Size invalidation: the map starts inside a flexbox whose height is
        // only known post-layout, so observe the container and re-fit.
        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
        });
        resizeObserver.observe(mapContainerRef.current);
      } catch (err) {
        console.error("Leaflet map initialization error:", err);
      }
    }

    void initMap();

    const handleResize = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
      if (locateTimerRef.current) clearTimeout(locateTimerRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Base Map Style
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    void (async () => {
      const L = await getLeaflet();
      if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);

      const styleConfig = MAP_STYLES[effectiveMapStyle];
      const baseLayer = L.tileLayer(styleConfig.url, {
        attribution: styleConfig.attribution,
        maxZoom: styleConfig.maxZoom,
        subdomains: styleConfig.subdomains || ["a", "b", "c"],
        crossOrigin: true,
      });
      baseLayer.addTo(map);
      baseTileLayerRef.current = baseLayer;

      // Clamp to the style's real ceiling so tiles never degrade to the
      // provider's placeholder ("zoom level not supported") tiles.
      if (map.getZoom() > styleConfig.maxZoom) {
        map.setZoom(styleConfig.maxZoom);
      }
    })();
  }, [effectiveMapStyle]);

  // Update Weather Layer Overlay (created once; radar frames swap via setUrl)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    void (async () => {
      const L = await getLeaflet();

      // Completely clear any previous weather or radar layers from the map
      map.eachLayer((layer: Layer) => {
        if (
          layer !== baseTileLayerRef.current &&
          layer !== markerRef.current &&
          layer !== accuracyCircleRef.current
        ) {
          map.removeLayer(layer);
        }
      });
      weatherLayerRef.current = null;
      radarLayerRef.current = null;

      // Stop radar animation if switched away from radar
      if (weatherLayer !== "radar" && isRadarPlaying) {
        setIsRadarPlaying(false);
      }

      if (weatherLayer === "radar") {
        const frame =
          radarFrames[currentFrameIndexRef.current] || radarFrames[radarFrames.length - 1];
        if (frame?.path) {
          const radarLayer = L.tileLayer(radarTileUrl(frame), {
            opacity: 0.8,
            zIndex: 10,
            maxZoom: 19,
            maxNativeZoom: 12,
            tileSize: 256,
            crossOrigin: true,
          });
          radarLayer.addTo(map);
          radarLayerRef.current = radarLayer;
        }
      } else if (
        weatherLayer === "temp" ||
        weatherLayer === "wind" ||
        weatherLayer === "clouds" ||
        weatherLayer === "pressure"
      ) {
        const overlayLayer = L.tileLayer(`/api/weather-tile/${weatherLayer}/{z}/{x}/{y}.png`, {
          opacity: weatherLayer === "clouds" ? 0.75 : 0.65,
          zIndex: 10,
          maxZoom: 19,
          maxNativeZoom: 10,
          tileSize: 256,
          crossOrigin: true,
          attribution:
            '&copy; <a href="https://openweathermap.org" target="_blank" rel="noreferrer">OpenWeatherMap</a>',
        });
        overlayLayer.on("tileerror", () => {
          // Silently absorbed, no broken icons displayed on map
        });
        overlayLayer.addTo(map);
        weatherLayerRef.current = overlayLayer;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherLayer, radarFrames]);

  // Radar Animation Loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRadarPlaying && radarFrames.length > 0) {
      interval = setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % radarFrames.length);
      }, 700);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRadarPlaying, radarFrames]);

  // Swap the radar frame in place instead of rebuilding the layer each tick.
  useEffect(() => {
    const layer = radarLayerRef.current;
    if (!layer || weatherLayer !== "radar") return;
    const frame = radarFrames[currentFrameIndex] || radarFrames[radarFrames.length - 1];
    if (frame?.path) {
      layer.setUrl(radarTileUrl(frame));
    }
  }, [currentFrameIndex, weatherLayer, radarFrames]);

  const zoomIn = () => mapInstanceRef.current?.zoomIn();
  const zoomOut = () => mapInstanceRef.current?.zoomOut();
  const recenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const c = coordsRef.current;
    map.flyTo([c.lat, c.lon], Math.max(map.getZoom(), 13), { duration: 1.2 });
  };
  const refreshPointWeather = () =>
    void fetchLiveWeatherDetails(coordsRef.current.lat, coordsRef.current.lon);

  const panelActive = weatherLayer !== "none";
  const activeCityName = QUICK_CITIES.find((c) => locName.includes(c.name))?.name ?? "";

  return (
    <div className="min-h-screen bg-ios-grouped dark:bg-black text-ios-label dark:text-ios-label-dark flex flex-col relative pb-24 transition-colors duration-300">
      {/* Top Map Action Bar */}
      <header className="ios-nav sticky top-0 z-40 px-4 sm:px-8 pb-2.5 ios-safe-top">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center">
            <MobileMenuTrigger />
          </div>

          {/* Gooey Search Form — visible on all breakpoints (mobile is the
              primary form factor, so hiding it there was a real gap). */}
          <div className="flex-1 flex justify-center relative min-w-[150px]">
            <GooeyInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSubmitQuery={handleSearch}
              placeholder={t("map.searchPlaceholder")}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => locateUser(false)}
              disabled={isLocating}
              className={`ios-pressable px-3.5 py-2 rounded-full text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                isGpsActive
                  ? "bg-ios-green/15 text-ios-green"
                  : "bg-ios-blue dark:bg-ios-blue-dark text-white"
              }`}
              title={t("map.locate")}
            >
              <Crosshair
                className={`w-4 h-4 ${isLocating ? "animate-spin" : ""}`}
                strokeWidth={2.25}
              />
              <span className="inline">
                {isLocating
                  ? t("map.pinpointing")
                  : isGpsActive
                    ? t("map.gpsActive")
                    : t("map.locate")}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Offline / stale-data banner (self-hiding when back online). */}
      <div className="px-4 sm:px-8 pt-2">
        <OfflineBanner onRetry={refreshPointWeather} />
      </div>

      {/* Main Map Container Area */}
      <div className="flex-1 relative w-full h-[calc(100dvh-125px)] min-h-[550px] bg-ios-grouped dark:bg-[#09090b]">
        {/* Leaflet Map DOM Root */}
        <div ref={mapContainerRef} className="w-full h-full z-0" role="region" aria-label={t("nav.map")} />

        {/* Quick cities + weather layer switcher */}
        <MapLayerSwitcher
          layer={weatherLayer}
          onSelectLayer={setWeatherLayer}
          cities={QUICK_CITIES}
          activeCity={activeCityName}
          onSelectCity={flyToCity}
        />

        {/* Basemap style switcher */}
        <MapStyleSwitcher active={effectiveMapStyle} onSelect={setMapStyle} />

        {/* Zoom in/out + level chip + recenter */}
        <MapZoomControls
          zoom={zoomLevel}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onRecenter={recenter}
          showRecenter={isGpsActive}
          accuracy={accuracy}
        />

        {/* Weather layer panel: radar timeline, or the overlay legend */}
        {weatherLayer === "radar" && radarFrames.length > 0 ? (
          <div className="absolute bottom-2 left-2 right-2 z-20 sm:left-auto sm:right-2 sm:w-96">
            <MapRadarTimeline
              playing={isRadarPlaying}
              onTogglePlay={() => setIsRadarPlaying((p) => !p)}
              frames={radarFrames}
              currentIndex={currentFrameIndex}
              onScrub={setCurrentFrameIndex}
            />
          </div>
        ) : weatherLayer === "radar" ? (
          // Radar selected but frames not yet loaded — no legend to show yet.
          null
        ) : weatherLayer !== "none" ? (
          <div className="absolute bottom-2 left-2 right-2 z-20 sm:left-auto sm:right-2 sm:w-80">
            <MapLegend layer={weatherLayer} />
          </div>
        ) : null}

        {/* Bottom-left weather summary, or the tap hint */}
        {liveWeather || fetchingPointWeather ? (
          <div
            className={cn(
              "absolute left-2 z-20 w-[calc(100%-1rem)] sm:w-80",
              panelActive ? "bottom-48 sm:bottom-2" : "bottom-2"
            )}
          >
            <MapWeatherCard
              weather={liveWeather}
              locName={locName}
              loading={fetchingPointWeather}
              onRefresh={refreshPointWeather}
            />
          </div>
        ) : weatherLayer === "none" ? (
          <MapHint />
        ) : null}
      </div>
    </div>
  );
}
