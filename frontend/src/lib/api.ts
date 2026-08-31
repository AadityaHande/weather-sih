/**
 * Backend API client.
 *
 * IMPORTANT — why these functions throw:
 *
 * This module previously caught every error and returned hard-coded "demo"
 * weather (AQI 166, 28.7°C, "Demo Mode"). That meant a user with no network,
 * a cold backend, or a 500 saw confident, invented weather instead of an
 * error — and it made error states structurally unreachable in the UI, since
 * the promises never rejected.
 *
 * These functions now reject with `ApiError`. Callers are responsible for
 * rendering a real error/offline state. The last successful `/homepage`
 * payload is persisted via `cacheHomepage()` so the offline path can show
 * genuinely-last-known data with an honest "as of <time>" label rather than
 * a fabrication.
 */

const REQUEST_TIMEOUT_MS = 10_000;

const getBaseUrl = () => {
  if (typeof window !== "undefined" && (window as unknown as Record<string, string>)._env_API_BASE_URL) {
    return (window as unknown as Record<string, string>)._env_API_BASE_URL;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
};

export type ApiErrorKind = "network" | "timeout" | "http" | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }

  /** True when retrying later is plausibly useful (offline, timeout, 5xx, 429). */
  get isRetryable(): boolean {
    if (this.kind === "network" || this.kind === "timeout") return true;
    if (this.status === undefined) return false;
    return this.status === 429 || this.status >= 500;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  // AbortSignal.timeout would be terser but is not available in every
  // Capacitor/Android WebView the app ships into, so use an explicit controller.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("timeout", `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw new ApiError("network", "Could not reach the Mausam service");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // The backend's global handler returns {"detail": "..."} — surface it when present.
    let detail = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body; keep the generic message */
    }
    throw new ApiError("http", detail, res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("parse", "Received a malformed response from the service");
  }
}

export interface CardResponse {
  card_id: string;
  title: string;
  priority: "P0" | "P1" | "P2" | "P3";
  is_alert: boolean;
  value_summary: string;
  source: "live" | "simulated" | "cached" | "unavailable" | "stale";
  freshness_badge: string | null;
  explanation_ref: string;
}

export interface WarningOverride {
  severity: string;
  type: string;
  text: string;
}

export interface HomepageResponse {
  context_snapshot_id: string;
  generated_at: string;
  system_notice: string | null;
  cards: CardResponse[];
  warnings_override: WarningOverride[];
}

export interface SignalRef {
  signal: string;
  value: string | number;
  source: string;
}

export interface ScoreComponents {
  persona_weight?: number;
  urgency_multiplier?: number;
  confidence_factor?: number;
  [key: string]: number | undefined;
}

export interface ExplanationResponse {
  explanation_ref: string;
  text: string;
  signal_refs: SignalRef[];
  score_components?: ScoreComponents;
}

export interface SavedLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface UserPreferences {
  device_id: string;
  personas: string[];
  health_flags: string[];
  saved_locations?: SavedLocation[];
}

export async function fetchHomepage(
  deviceId: string,
  lat: number = 28.6139,
  lon: number = 77.209
): Promise<HomepageResponse> {
  const url = `${getBaseUrl()}/homepage?device_id=${encodeURIComponent(deviceId)}&lat=${lat}&lon=${lon}`;
  const data = await fetchJson<HomepageResponse>(url);
  cacheHomepage(deviceId, data);
  return data;
}

export async function fetchExplanation(explanationRef: string): Promise<ExplanationResponse> {
  const url = `${getBaseUrl()}/explain?explanation_ref=${encodeURIComponent(explanationRef)}`;
  return fetchJson<ExplanationResponse>(url);
}

export async function fetchPreferences(deviceId: string): Promise<UserPreferences> {
  const url = `${getBaseUrl()}/preferences?device_id=${encodeURIComponent(deviceId)}`;
  return fetchJson<UserPreferences>(url);
}

export async function updatePreferences(prefs: UserPreferences): Promise<{ status: string }> {
  return fetchJson<{ status: string }>(`${getBaseUrl()}/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
}

// ---------------------------------------------------------------------------
// Last-known-good homepage cache.
//
// Backs the offline banner: when a fetch fails we can still render the most
// recent *real* payload, labelled with when it was actually retrieved. This is
// deliberately separate from the service-worker HTTP cache — this copy is
// readable synchronously during render, which the banner needs.
// ---------------------------------------------------------------------------

const HOMEPAGE_CACHE_PREFIX = "mausam_last_homepage_";

export interface CachedHomepage {
  cachedAt: string;
  payload: HomepageResponse;
}

export function cacheHomepage(deviceId: string, payload: HomepageResponse): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CachedHomepage = { cachedAt: new Date().toISOString(), payload };
    localStorage.setItem(HOMEPAGE_CACHE_PREFIX + deviceId, JSON.stringify(entry));
  } catch {
    /* quota or private-mode restrictions — the cache is a nicety, not required */
  }
}

export function readCachedHomepage(deviceId: string): CachedHomepage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HOMEPAGE_CACHE_PREFIX + deviceId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedHomepage;
    if (!parsed?.payload?.cards) return null;
    return parsed;
  } catch {
    return null;
  }
}
