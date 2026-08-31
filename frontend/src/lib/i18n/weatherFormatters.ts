/**
 * weatherFormatters.ts
 * Centralized, type-safe translators for dynamic weather API values:
 * - Weather conditions (WMO codes and textual statuses)
 * - Compass wind directions with degree interpolation
 * - Humidity statuses (Humid, Comfortable, Dry)
 * - UV index levels (Low, Moderate, High, Very High)
 * - Time relative day tags (Today, Tomorrow, Tonight)
 */

export function getCompassKey(deg: number): string {
  const val = Math.floor(deg / 22.5 + 0.5);
  const arr = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
  ];
  return arr[val % 16];
}

/**
 * Translates wind direction with degrees interpolation: e.g. "W Direction (270°)"
 */
export function formatLocalizedWindDirection(
  deg: number,
  t: (key: string, params?: Record<string, any>) => string
): string {
  const compass = getCompassKey(deg);
  const dirName = t(`weather.directions.${compass}`) || compass;
  return t("weather.windDirectionFormat", { dir: dirName, deg });
}

/**
 * Translates simple wind direction: e.g. "WSW Direction"
 */
export function formatLocalizedWindDirectionSimple(
  compass: string,
  t: (key: string, params?: Record<string, any>) => string
): string {
  const cleanCode = compass.replace(/[^A-Z]/g, "") || "W";
  const dirName = t(`weather.directions.${cleanCode}`) || cleanCode;
  return t("weather.windDirectionSimple", { dir: dirName });
}

/**
 * Translates WMO weather code and day/night state into localized string
 */
export function formatLocalizedWmoCondition(
  code: number,
  isDay: boolean,
  t: (key: string) => string,
  precipitationMm?: number
): string {
  if (code === 0) return isDay ? t("weather.conditions.clearDay") : t("weather.conditions.clearNight");
  if (code <= 2) return isDay ? t("weather.conditions.partlyCloudyDay") : t("weather.conditions.partlyCloudyNight");
  if (code === 3) return t("weather.conditions.overcast");
  if (code <= 48) return t("weather.conditions.fog");

  // If precipitation is explicitly 0 or negative, report overcast rather than active drizzle or rain
  if (precipitationMm !== undefined && precipitationMm <= 0 && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))) {
    return t("weather.conditions.overcast");
  }

  if (code <= 57) return t("weather.conditions.drizzle");
  if (code <= 67) return t("weather.conditions.rain");
  if (code <= 77) return t("weather.conditions.snow");
  if (code <= 82) return t("weather.conditions.showers");
  return t("weather.conditions.thunderstorm");
}

/**
 * Translates textual condition strings from API / mock:
 * e.g. "Overcast", "Partly Cloudy", "Clear Sky"
 */
export function translateConditionString(
  rawStatus: string,
  t: (key: string) => string
): string {
  if (!rawStatus) return t("weather.conditions.partlyCloudyDay");
  const normalized = rawStatus.toLowerCase().trim();

  if (normalized.includes("overcast")) return t("weather.conditions.overcast");
  if (normalized.includes("clear") && normalized.includes("night")) return t("weather.conditions.clearNight");
  if (normalized.includes("clear") || normalized.includes("sunny")) return t("weather.conditions.clearDay");
  if (normalized.includes("partly") && normalized.includes("night")) return t("weather.conditions.partlyCloudyNight");
  if (normalized.includes("partly")) return t("weather.conditions.partlyCloudyDay");
  if (normalized.includes("fog") || normalized.includes("mist")) return t("weather.conditions.fog");
  if (normalized.includes("drizzle")) return t("weather.conditions.drizzle");
  if (normalized.includes("shower")) return t("weather.conditions.showers");
  if (normalized.includes("rain")) return t("weather.conditions.rain");
  if (normalized.includes("thunder") || normalized.includes("storm")) return t("weather.conditions.thunderstorm");
  if (normalized.includes("snow")) return t("weather.conditions.snow");

  return rawStatus;
}

/**
 * Translates humidity status: "Humid", "Comfortable", "Dry"
 */
export function translateHumidityStatus(
  status: string,
  t: (key: string) => string
): string {
  const norm = (status || "").toLowerCase().trim();
  if (norm.includes("humid")) return t("weather.humidityStatuses.humid");
  if (norm.includes("dry")) return t("weather.humidityStatuses.dry");
  return t("weather.humidityStatuses.comfortable");
}

/**
 * Translates UV index level string: "Low", "Moderate", "High", "Very High"
 */
export function translateUvLevel(
  level: string,
  t: (key: string) => string
): string {
  const norm = (level || "").toLowerCase().trim();
  if (norm.includes("very high")) return t("weather.uvLevels.veryHigh");
  if (norm.includes("high")) return t("weather.uvLevels.high");
  if (norm.includes("moderate")) return t("weather.uvLevels.moderate");
  if (norm.includes("extreme")) return t("weather.uvLevels.extreme");
  return t("weather.uvLevels.low");
}

/**
 * Translates relative day prefixes like "Today, 9:30–11:30 AM" or "Tomorrow, 6:00–7:30 AM"
 */
export function localizeRelativeTimeWindow(
  rawWindowStr: string,
  t: (key: string) => string
): string {
  if (!rawWindowStr) return "";
  let result = rawWindowStr;

  result = result.replace(/^Today,?\s*/i, `${t("common.today")}, `);
  result = result.replace(/^Tomorrow,?\s*/i, `${t("common.tomorrow")}, `);
  result = result.replace(/^Tonight,?\s*/i, `${t("common.tonight")}, `);

  return result;
}

/**
 * Translates deterministic schedule fallback reasons
 */
export function translateScheduleReason(
  rawReason: string,
  t: (key: string) => string
): string {
  if (!rawReason) return "";
  const norm = rawReason.toLowerCase();

  if (norm.includes("cool air") || norm.includes("breeze")) return t("insights.reasons.coolAirBreeze");
  if (norm.includes("sunset cooling")) return t("insights.reasons.postSunsetCooling");
  if (norm.includes("lowest daily")) return t("insights.reasons.lowestTemp");
  if (norm.includes("zero solar")) return t("insights.reasons.zeroSolarUv");
  if (norm.includes("dispersed pm2.5") || norm.includes("clean air")) return t("insights.reasons.cleanAirDispersed");
  if (norm.includes("fresh circulating")) return t("insights.reasons.freshAir");
  if (norm.includes("clear roads")) return t("insights.reasons.clearRoads");
  if (norm.includes("offshore breeze")) return t("insights.reasons.offshoreBreeze");
  if (norm.includes("deep soil")) return t("insights.reasons.deepSoilRoot");
  if (norm.includes("park playtime") || norm.includes("park")) return t("insights.reasons.mildParkPlaytime");
  if (norm.includes("midday heat")) return t("insights.reasons.middayHeatUv");
  if (norm.includes("morning smog") || norm.includes("smog")) return t("insights.reasons.morningSmog");
  if (norm.includes("rush hour")) return t("insights.reasons.rushHourTraffic");
  if (norm.includes("choppy winds")) return t("insights.reasons.choppyWindsUv");
  if (norm.includes("evaporation heat")) return t("insights.reasons.highEvaporationHeat");
  if (norm.includes("peak heat") || norm.includes("direct uv")) return t("insights.reasons.peakHeatDirectUv");

  return rawReason;
}

