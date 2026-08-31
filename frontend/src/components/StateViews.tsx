"use client";

import React from "react";
import {
  AlertTriangle,
  CloudOff,
  MapPinOff,
  RefreshCw,
  Settings as SettingsIcon,
  Inbox,
  WifiOff,
} from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Actionable empty / error / permission states.
 *
 * The app had crash-recovery error boundaries (`app/error.tsx`) but no states
 * for the *expected* failures: the backend being unreachable, a location with
 * no data, or the user declining the location prompt. Those previously either
 * showed fabricated fallback weather or failed silently — location denial in
 * particular used to drop the user in Pune with no explanation.
 *
 * Every state here gives the user something to do, not just something to read.
 */

function StateShell({
  icon: Icon,
  tone,
  title,
  body,
  children,
  className,
}: {
  icon: React.ElementType;
  tone: "error" | "warning" | "neutral";
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    error: "bg-ios-red/10 text-ios-red",
    warning: "bg-ios-orange/12 text-ios-orange",
    neutral: "bg-ios-fill dark:bg-ios-fill-dark text-ios-label-2 dark:text-ios-label-2-dark",
  } as const;

  return (
    <div className={cn("flex flex-col items-center text-center px-5 py-10 gap-3.5", className)}>
      <div className={cn("w-14 h-14 rounded-ios-card flex items-center justify-center", tones[tone])}>
        <Icon className="w-7 h-7" strokeWidth={1.75} />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="ios-headline text-ios-label dark:text-ios-label-dark">{title}</h3>
        <p className="ios-footnote leading-relaxed">{body}</p>
      </div>
      {children && <div className="flex flex-wrap items-center justify-center gap-2 pt-1.5">{children}</div>}
    </div>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  icon?: React.ElementType;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "ios-pressable inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-semibold cursor-pointer",
        variant === "primary"
          ? "bg-ios-blue dark:bg-ios-blue-dark text-white"
          : "bg-ios-fill dark:bg-ios-fill-dark text-ios-blue dark:text-ios-blue-dark"
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />}
      {children}
    </button>
  );
}

/**
 * Failure state for a data fetch. Distinguishes offline from a server fault,
 * because the useful next action differs: wait/reconnect vs retry.
 */
export function DataErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();

  const apiError = error instanceof ApiError ? error : null;
  const isOffline = apiError?.kind === "network" || apiError?.kind === "timeout";

  return (
    <StateShell
      className={className}
      icon={isOffline ? WifiOff : AlertTriangle}
      tone={isOffline ? "warning" : "error"}
      title={isOffline ? t("states.offlineTitle") : t("states.errorTitle")}
      body={isOffline ? t("states.offlineBody") : apiError?.message || t("states.errorBody")}
    >
      {onRetry && (
        <ActionButton onClick={onRetry} icon={RefreshCw}>
          {t("common.retry")}
        </ActionButton>
      )}
    </StateShell>
  );
}

/**
 * The request succeeded but there is nothing to show for this location —
 * distinct from an error, and it needs a different action (change location,
 * not retry).
 */
export function NoDataState({
  onChangeLocation,
  onRetry,
  className,
}: {
  onChangeLocation?: () => void;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <StateShell
      className={className}
      icon={CloudOff}
      tone="neutral"
      title={t("states.noDataTitle")}
      body={t("states.noDataBody")}
    >
      {onChangeLocation && (
        <ActionButton onClick={onChangeLocation} icon={MapPinOff}>
          {t("states.changeLocation")}
        </ActionButton>
      )}
      {onRetry && (
        <ActionButton onClick={onRetry} icon={RefreshCw} variant="secondary">
          {t("common.retry")}
        </ActionButton>
      )}
    </StateShell>
  );
}

/** Generic "nothing here yet" for list sections (e.g. no saved locations). */
export function EmptyListState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <StateShell className={className} icon={Inbox} tone="neutral" title={title} body={body}>
      {action}
    </StateShell>
  );
}

/**
 * Location permission denied or unavailable.
 *
 * Browsers do not let a page re-prompt after a hard denial, so "Try again"
 * alone would be a dead end. This explains that the app fell back to a default
 * city, and offers the two paths that actually work: pick a location manually,
 * or fix it in browser settings.
 */
export function LocationDeniedState({
  fallbackName,
  onPickLocation,
  onRetry,
  permanentlyDenied,
  className,
}: {
  fallbackName?: string;
  onPickLocation?: () => void;
  onRetry?: () => void;
  permanentlyDenied?: boolean;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <StateShell
      className={className}
      icon={MapPinOff}
      tone="warning"
      title={t("states.locationDeniedTitle")}
      body={
        fallbackName
          ? t("states.locationDeniedBodyWithFallback", { location: fallbackName })
          : t("states.locationDeniedBody")
      }
    >
      {onPickLocation && (
        <ActionButton onClick={onPickLocation} icon={SettingsIcon}>
          {t("states.chooseManually")}
        </ActionButton>
      )}
      {onRetry && !permanentlyDenied && (
        <ActionButton onClick={onRetry} icon={RefreshCw} variant="secondary">
          {t("states.tryLocationAgain")}
        </ActionButton>
      )}
    </StateShell>
  );
}

/**
 * Compact inline version of the above, for pages where the content is still
 * usable (we have fallback coordinates) and a full-page takeover would be
 * disproportionate. Sits above the content as a dismissible notice.
 */
export function LocationFallbackNotice({
  fallbackName,
  onRetry,
  onDismiss,
}: {
  fallbackName: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-ios-card bg-ios-orange/10 border-[0.5px] border-ios-orange/25">
      <MapPinOff className="w-4 h-4 text-ios-orange shrink-0 mt-0.5" strokeWidth={2} />
      <div className="flex-1 min-w-0">
        <p className="ios-headline text-ios-label dark:text-ios-label-dark">
          {t("states.locationDeniedTitle")}
        </p>
        <p className="ios-footnote mt-0.5 leading-relaxed">
          {t("states.locationDeniedBodyWithFallback", { location: fallbackName })}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ios-pressable px-3 py-1.5 rounded-full bg-ios-orange text-white text-[11px] font-semibold cursor-pointer"
          >
            {t("states.tryLocationAgain")}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("common.close")}
            className="ios-pressable px-2.5 py-1.5 rounded-full text-ios-orange text-[11px] font-semibold cursor-pointer"
          >
            {t("settings.dismiss")}
          </button>
        )}
      </div>
    </div>
  );
}
