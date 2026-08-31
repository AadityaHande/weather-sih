"use client";

import React, { useCallback, useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { cn } from "@/lib/utils";

/**
 * "Share this forecast".
 *
 * Uses the Web Share API where available (every mobile browser, and the
 * Capacitor Android WebView), which hands off to the OS sheet — WhatsApp,
 * Telegram, SMS, the things people actually forward weather on. Falls back to
 * clipboard on desktop Chrome/Firefox, which do not implement navigator.share.
 */

export interface ForecastShareData {
  locationName: string;
  temperature: number | null;
  unitSymbol: string;
  condition: string | null;
  high?: number | null;
  low?: number | null;
  rainProbability?: number | null;
  aqi?: number | null;
  uvIndex?: number | null;
  /** Highest-priority active severe warning, if any. Leads the message. */
  warning?: { type: string; severity: string; text: string } | null;
}

/**
 * Builds the shared message.
 *
 * Plain text rather than a rendered image card: it survives every transport,
 * needs no canvas/`html2canvas` dependency, and stays readable when a recipient
 * only sees a notification preview. A severe warning is put first because that
 * is the case where forwarding actually matters.
 */
export function buildShareText(data: ForecastShareData): string {
  const lines: string[] = [];

  if (data.warning) {
    lines.push(`⚠️ ${data.warning.severity.toUpperCase()} ${data.warning.type} warning — ${data.locationName}`);
    if (data.warning.text) lines.push(data.warning.text);
    lines.push("");
  } else {
    lines.push(`Weather in ${data.locationName}`);
  }

  const now: string[] = [];
  if (data.temperature !== null && data.temperature !== undefined) {
    now.push(`${Math.round(data.temperature)}${data.unitSymbol}`);
  }
  if (data.condition) now.push(data.condition);
  if (now.length) lines.push(now.join(" · "));

  const detail: string[] = [];
  if (data.high !== null && data.high !== undefined && data.low !== null && data.low !== undefined) {
    detail.push(`H ${Math.round(data.high)}° / L ${Math.round(data.low)}°`);
  }
  if (data.rainProbability !== null && data.rainProbability !== undefined) {
    detail.push(`Rain ${Math.round(data.rainProbability)}%`);
  }
  if (data.aqi !== null && data.aqi !== undefined) detail.push(`AQI ${Math.round(data.aqi)}`);
  if (data.uvIndex !== null && data.uvIndex !== undefined) detail.push(`UV ${data.uvIndex.toFixed(1)}`);
  if (detail.length) lines.push(detail.join(" · "));

  return lines.join("\n");
}

type ShareState = "idle" | "copied" | "failed";

export function ShareButton({
  data,
  className,
  variant = "icon",
}: {
  data: ForecastShareData;
  className?: string;
  variant?: "icon" | "full";
}) {
  const { t } = useI18n();
  const [state, setState] = useState<ShareState>("idle");

  const handleShare = useCallback(async () => {
    const text = buildShareText(data);
    // Deep-link back to the shared location so the recipient lands on it,
    // not on their own coordinates.
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/home?loc=${encodeURIComponent(data.locationName)}`
        : undefined;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Mausam", text, url });
        return;
      } catch (err) {
        // AbortError just means the user dismissed the OS sheet — not a failure,
        // and showing "copied" after they cancelled would be wrong.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else (share not permitted in this context) falls through to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2200);
  }, [data]);

  const label =
    state === "copied"
      ? t("share.copied")
      : state === "failed"
        ? t("share.failed")
        : t("share.action");

  const Icon = state === "copied" ? Check : state === "failed" ? Copy : Share2;

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleShare}
        className={cn(
          "ios-pressable inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold cursor-pointer",
          "bg-ios-fill dark:bg-ios-fill-dark text-ios-blue dark:text-ios-blue-dark",
          className
        )}
      >
        <Icon className="w-4 h-4" strokeWidth={2.25} />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      title={label}
      aria-label={label}
      className={cn(
        "ios-pressable h-9 w-9 inline-flex items-center justify-center rounded-full cursor-pointer",
        state === "copied"
          ? "bg-ios-green/15 text-ios-green"
          : "bg-ios-fill dark:bg-ios-fill-dark text-ios-blue dark:text-ios-blue-dark",
        className
      )}
    >
      <Icon className="w-4 h-4" strokeWidth={2.25} />
    </button>
  );
}
