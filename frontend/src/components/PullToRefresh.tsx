"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ArrowDown } from "lucide-react";
import { useI18n } from "@/context/I18nContext";
import { cn } from "@/lib/utils";

/**
 * Pull-to-refresh.
 *
 * Refreshing previously required finding the "Refresh Location" button inside
 * the collapsed desktop sidebar — effectively undiscoverable on a phone, which
 * is the app's primary form factor (it also ships as a Capacitor Android app).
 *
 * Implemented with raw touch events rather than a library so it adds no
 * dependency and can bail out cleanly in the cases that matter: mid-scroll,
 * multi-touch, and horizontally-scrolling children.
 */

const PULL_THRESHOLD_PX = 70;
/** Pull beyond the threshold moves the indicator at a fraction of finger speed. */
const OVERPULL_RESISTANCE = 0.35;
const MAX_PULL_PX = 120;

export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  className,
}: {
  /** Should resolve when the refresh completes; the spinner runs until then. */
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mutable gesture state lives in refs: touch handlers are attached once and
  // must not be torn down and re-created on every pixel of movement.
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  // Mirrors pullDistance so the touch handlers below can read the current value
  // without the subscribing effect depending on (and re-attaching for) every
  // pixel of movement.
  const pullDistanceRef = useRef(0);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const runRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    /**
     * A pull is only valid from the very top of the scroll container. The app
     * scrolls the document, not this element, so consult the window.
     */
    const atTop = () => window.scrollY <= 0;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || e.touches.length !== 1 || !atTop()) {
        isPullingRef.current = false;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshingRef.current) return;

      // A second finger means the user is pinch-zooming, not pulling.
      if (e.touches.length !== 1) {
        isPullingRef.current = false;
        setPullDistance(0);
        return;
      }

      const delta = e.touches[0].clientY - startYRef.current;

      // Upward movement, or the page having scrolled away from the top mid-gesture,
      // means this is a normal scroll — hand it back to the browser.
      if (delta <= 0 || !atTop()) {
        isPullingRef.current = false;
        setPullDistance(0);
        return;
      }

      // Let horizontally-scrolling children (persona pills, city chips, the
      // hourly strip) keep their own gestures.
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-pull-refresh]")) {
        isPullingRef.current = false;
        setPullDistance(0);
        return;
      }

      const resisted =
        delta <= PULL_THRESHOLD_PX
          ? delta
          : PULL_THRESHOLD_PX + (delta - PULL_THRESHOLD_PX) * OVERPULL_RESISTANCE;
      const clamped = Math.min(resisted, MAX_PULL_PX);

      // Suppress the browser's own overscroll/bounce so the indicator is the
      // only thing that moves. Requires a non-passive listener (below).
      if (e.cancelable) e.preventDefault();
      setPullDistance(clamped);
    };

    const onTouchEnd = () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      if (pullDistanceRef.current >= PULL_THRESHOLD_PX && !isRefreshingRef.current) {
        void runRefresh();
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, runRefresh]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD_PX, 1);
  const armed = progress >= 1;
  const indicatorVisible = pullDistance > 2 || isRefreshing;
  /**
   * While the finger is down the indicator must track it 1:1, so transitions are
   * off; on release (`pullDistance` drops to 0, or `isRefreshing` pins it at the
   * threshold) they come back and animate the spring-back. Derived from state
   * rather than read off `isPullingRef` — refs must not be read during render.
   */
  const pullTransition = pullDistance > 0 && !isRefreshing;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Pull indicator — overlays content, never displaces it, so nothing reflows. */}
      <div
        aria-hidden={!indicatorVisible}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center overflow-hidden"
        style={{
          height: indicatorVisible ? Math.max(pullDistance, isRefreshing ? PULL_THRESHOLD_PX : 0) : 0,
          transition: pullTransition ? "none" : "height 320ms var(--ease-ios)",
        }}
      >
        <div
          className="flex flex-col items-center justify-center gap-1 pt-3"
          style={{ opacity: isRefreshing ? 1 : progress }}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              armed || isRefreshing
                ? "bg-ios-blue dark:bg-ios-blue-dark text-white shadow-[0_4px_14px_-2px_rgba(0,122,255,0.5)]"
                : "ios-material text-ios-label-2 dark:text-ios-label-2-dark shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            )}
          >
            {isRefreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowDown
                className="w-4 h-4 transition-transform duration-200 ease-ios"
                style={{ transform: `rotate(${progress * 180}deg)` }}
              />
            )}
          </div>
          {/*
            suppressHydrationWarning: the indicator is invisible at load
            (height 0 / opacity 0) and its label is derived purely from runtime
            state (touch gesture + post-mount locale). Hydration can also be
            tripped by browser extensions mutating the DOM pre-hydration, which
            React can't reconcile — so never let a warning here burn the tree.
          */}
          <span
            className="ios-footnote font-semibold whitespace-nowrap"
            suppressHydrationWarning
          >
            {isRefreshing
              ? t("refresh.refreshing")
              : armed
                ? t("refresh.releaseToRefresh")
                : t("refresh.pullToRefresh")}
          </span>
        </div>
      </div>

      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.5}px)` : undefined,
          transition: pullTransition ? "none" : "transform 320ms var(--ease-ios)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
