"use client";

import { cn } from "@/lib/utils";

/**
 * Skeleton primitive.
 *
 * The app previously either showed a bare spinner or — worse — rendered
 * hard-coded placeholder numbers (`?? 28`°C, `?? 68`% humidity) while a fetch
 * was in flight, so users briefly saw invented weather presented as real.
 * Skeletons occupy the same space as the content that replaces them, so
 * nothing shifts on load and nothing false is ever asserted.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        // Base fill is iOS's secondary system fill; `ios-shimmer` sweeps a sheen
        // across it, which reads as "loading" more clearly than an opacity pulse.
        "ios-shimmer rounded-ios-sm bg-ios-fill dark:bg-ios-fill-dark",
        className
      )}
      {...props}
    />
  );
}

/**
 * Wraps a loading region with the correct assistive-tech semantics.
 * Screen readers announce "Loading" once rather than reading the decorative
 * skeleton blocks.
 */
export function SkeletonRegion({
  label = "Loading",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Repeated single-line bars, for list-shaped content. */
export function SkeletonLines({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

/**
 * Matches the shape of a ranked priority card row on the Home feed:
 * icon tile, two stacked text lines, trailing chevron.
 */
export function SkeletonCardRow() {
  return (
    <div className="ios-card w-full flex items-center gap-3 p-3.5">
      <Skeleton className="w-10 h-10 rounded-ios shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-7" />
        </div>
        <Skeleton className="h-2.5 w-48" />
      </div>
      <Skeleton className="w-4 h-4 shrink-0" />
    </div>
  );
}

/** Metric tile skeleton, for the Weather page's diagnostics grid. */
export function SkeletonMetricTile() {
  return (
    <div className="ios-card p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-9 h-9 rounded-ios shrink-0" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-2.5 w-28" />
    </div>
  );
}
