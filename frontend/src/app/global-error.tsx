"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown from the root layout itself (rare, but distinct
 * from `error.tsx`, which cannot catch layout-level failures since it
 * renders *inside* the layout). Next.js requires this file to render its
 * own <html>/<body> since the root layout has failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center space-y-4">
          <h2 className="text-lg font-bold text-slate-900">
            Mausam hit a snag
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            The app failed to load. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="w-full px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
