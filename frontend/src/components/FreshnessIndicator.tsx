"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Database, FlaskConical, CloudOff, Clock, AlertTriangle } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { formatTimeAgo, isStaleTimestamp } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import type { CardResponse } from "@/lib/api";

/**
 * Data-freshness indicator.
 *
 * Replaces the hard-coded green "LIVE" pill that used to sit on the Home feed
 * regardless of what the backend actually returned. `/homepage` reports a real
 * per-card `source` ("live" | "cached" | "stale" | "simulated" | "unavailable")
 * plus a `generated_at` timestamp; none of it was rendered anywhere outside the
 * explanation drawer, so the UI asserted "live" over simulated fixture data.
 *
 * This component tells the truth instead, and it is the single place that maps
 * a source value to its label and colour.
 */

export type DataSource = CardResponse["source"];

/** Severity ranking — a feed is only as fresh as its least-fresh signal. */
const SOURCE_RANK: Record<DataSource, number> = {
  live: 0,
  cached: 1,
  stale: 2,
  simulated: 3,
  unavailable: 4,
};

/**
 * Reduces the per-card sources of a homepage payload into one headline source.
 * Picks the worst, so a feed with nine live cards and one stale one is not
 * advertised as fully live.
 */
export function deriveFeedSource(cards: CardResponse[] | undefined): DataSource | null {
  if (!cards || cards.length === 0) return null;
  return cards.reduce<DataSource>((worst, card) => {
    const candidate: DataSource = card.source ?? "simulated";
    return (SOURCE_RANK[candidate] ?? 3) > (SOURCE_RANK[worst] ?? 0) ? candidate : worst;
  }, "live");
}

const SOURCE_STYLES: Record<
  DataSource,
  { icon: React.ElementType; className: string; i18nKey: string; fallback: string }
> = {
  live: {
    icon: CheckCircle2,
    className: "bg-ios-green/12 text-ios-green",
    i18nKey: "freshness.live",
    fallback: "Live",
  },
  cached: {
    icon: Database,
    className: "bg-ios-blue/12 text-ios-blue dark:text-ios-blue-dark",
    i18nKey: "freshness.cached",
    fallback: "Cached",
  },
  stale: {
    icon: Clock,
    className: "bg-ios-orange/12 text-ios-orange",
    i18nKey: "freshness.stale",
    fallback: "Stale",
  },
  simulated: {
    icon: FlaskConical,
    className: "bg-ios-purple/12 text-ios-purple",
    i18nKey: "freshness.simulated",
    fallback: "Simulated",
  },
  unavailable: {
    icon: CloudOff,
    className:
      "bg-ios-fill dark:bg-ios-fill-dark text-ios-label-2 dark:text-ios-label-2-dark",
    i18nKey: "freshness.unavailable",
    fallback: "Unavailable",
  },
};

/**
 * Re-renders on an interval so "2 minutes ago" keeps counting up without
 * refetching. 30s is fine-grained enough that the label is never more than
 * half a minute wrong, and cheap enough to be invisible.
 */
function useTicker(intervalMs = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

export function FreshnessIndicator({
  source,
  generatedAt,
  className,
  showTimestamp = true,
}: {
  source: DataSource | null | undefined;
  generatedAt?: string | null;
  className?: string;
  showTimestamp?: boolean;
}) {
  const { t, locale } = useI18n();
  useTicker();

  if (!source) return null;

  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES.simulated;
  const Icon = style.icon;
  const label = t(style.i18nKey) || style.fallback;
  const ago = showTimestamp ? formatTimeAgo(generatedAt, locale) : null;

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 text-[11px] font-semibold rounded-full",
          style.className
        )}
      >
        <Icon className="w-3 h-3" strokeWidth={2.5} />
        {label}
      </span>
      {ago && (
        <span
          className="ios-footnote font-medium"
          title={generatedAt ?? undefined}
        >
          {t("freshness.updated")} {ago}
        </span>
      )}
    </div>
  );
}

/**
 * Full-width banner shown when the visible data is materially out of date —
 * either the backend flagged it (`stale`/`unavailable`) or the timestamp itself
 * has aged past `staleAfterMinutes`. Silent when the data is fresh.
 */
export function StaleDataBanner({
  source,
  generatedAt,
  onRefresh,
  staleAfterMinutes = 60,
}: {
  source: DataSource | null | undefined;
  generatedAt?: string | null;
  onRefresh?: () => void;
  staleAfterMinutes?: number;
}) {
  const { t, locale } = useI18n();
  useTicker();

  const flaggedByBackend = source === "stale" || source === "unavailable";
  const agedOut = isStaleTimestamp(generatedAt, staleAfterMinutes);
  if (!flaggedByBackend && !agedOut) return null;

  const ago = formatTimeAgo(generatedAt, locale);

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-ios-card bg-ios-orange/10 border-[0.5px] border-ios-orange/25">
      <AlertTriangle className="w-4 h-4 text-ios-orange shrink-0 mt-0.5" strokeWidth={2} />
      <div className="flex-1 min-w-0">
        <p className="ios-headline text-ios-label dark:text-ios-label-dark">
          {t("freshness.staleTitle")}
        </p>
        <p className="ios-footnote mt-0.5 leading-relaxed">
          {ago
            ? t("freshness.staleBodyWithTime", { time: ago })
            : t("freshness.staleBody")}
        </p>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="ios-pressable shrink-0 px-3 py-1.5 rounded-full bg-ios-orange text-white text-[11px] font-semibold cursor-pointer"
        >
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
