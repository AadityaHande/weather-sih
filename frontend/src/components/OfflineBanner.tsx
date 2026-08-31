"use client";

import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { formatTimeAgo } from "@/lib/relativeTime";

/**
 * "You're offline, showing last update" banner.
 *
 * Pairs with `readCachedHomepage()` in lib/api.ts: when a fetch fails we render
 * the last payload that genuinely came from the backend, and this banner states
 * plainly that it is not current. Previously an offline user was shown
 * hard-coded demo weather with a green "Live" badge on it.
 */
export function OfflineBanner({
  /** ISO timestamp of the cached payload currently on screen, if any. */
  cachedAt,
  /** Set when a request actually failed — covers "online but backend down". */
  hasFailedRequest = false,
  onRetry,
}: {
  cachedAt?: string | null;
  hasFailedRequest?: boolean;
  onRetry?: () => void;
}) {
  const { t, locale } = useI18n();
  const isOnline = useOnlineStatus();

  // Stay quiet when there is nothing wrong.
  if (isOnline && !hasFailedRequest) return null;

  const ago = formatTimeAgo(cachedAt, locale);

  return (
    <div
      role="status"
      className="flex items-start gap-3 p-3.5 rounded-ios-card bg-[#1c1c1e] dark:bg-ios-surface-dark border-[0.5px] border-white/10 text-white shadow-[var(--ios-shadow-card)]"
    >
      <div className="p-1.5 rounded-ios-sm bg-white/12 shrink-0">
        <WifiOff className="w-4 h-4 text-ios-orange" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="ios-headline">
          {isOnline ? t("offline.serviceUnreachableTitle") : t("offline.title")}
        </p>
        <p className="text-xs text-white/65 mt-0.5 leading-relaxed">
          {ago ? t("offline.showingCached", { time: ago }) : t("offline.noCache")}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ios-pressable shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/15 text-[11px] font-semibold cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" strokeWidth={2.25} />
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
