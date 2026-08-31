"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

/**
 * Next.js App Router error boundary.
 *
 * This automatically wraps every route segment under `app/` (Next.js
 * convention: any `error.tsx` file becomes a React error boundary for its
 * segment). Previously the app had no error boundary at all, so any
 * unexpected render-time exception (a bad API response shape, a null
 * dereference, etc.) would white-screen the entire app with no recovery
 * path for the user.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side/console visibility for debugging; does not expose
    // internals to the user.
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272a] rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/40 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Something went wrong
          </h2>
          <p className="text-sm text-slate-500 dark:text-[#8e8e93] leading-relaxed">
            This screen hit an unexpected error. Your other data is safe — try again, or head back home.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/home"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1c1c1e] hover:bg-slate-200 dark:hover:bg-[#27272a] text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors"
          >
            <Home className="w-4 h-4" />
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
