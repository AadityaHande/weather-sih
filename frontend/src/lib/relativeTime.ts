/**
 * Relative-time formatting for freshness indicators ("Updated 2 min ago").
 *
 * Uses Intl.RelativeTimeFormat so the output follows the active locale — the
 * app ships 12 Indian languages, so a hand-rolled "2 min ago" string would be
 * the only untranslated text on the screen.
 */

/** Coarse buckets, largest-first. Seconds per unit. */
const DIVISIONS: { limit: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, unit: "second" },
  { limit: 3600, unit: "minute" },
  { limit: 86400, unit: "hour" },
  { limit: 604800, unit: "day" },
];

const SECONDS_PER_UNIT: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
};

/**
 * Formats `iso` relative to now, e.g. "2 minutes ago".
 * Returns null when the timestamp is missing or unparseable, so callers can
 * omit the indicator entirely rather than render "Invalid Date".
 */
export function formatTimeAgo(iso: string | null | undefined, locale: string = "en"): string | null {
  if (!iso) return null;

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  // Clock skew between the device and the backend (which stamps generated_at in
  // IST) can make a fresh payload look like it came from the future. Clamp to 0
  // so we say "just now" instead of "in 3 minutes".
  const elapsedSec = Math.max(0, (Date.now() - then) / 1000);

  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  } catch {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }

  if (elapsedSec < 45) {
    // "now" reads better than "44 seconds ago" for a freshness badge.
    return rtf.format(0, "second");
  }

  for (const { limit, unit } of DIVISIONS) {
    if (elapsedSec < limit) {
      return rtf.format(-Math.round(elapsedSec / SECONDS_PER_UNIT[unit]), unit);
    }
  }

  return rtf.format(-Math.round(elapsedSec / SECONDS_PER_UNIT.day), "day");
}

/** True when the payload is old enough that we should warn the user about it. */
export function isStaleTimestamp(iso: string | null | undefined, thresholdMinutes = 60): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then > thresholdMinutes * 60_000;
}
