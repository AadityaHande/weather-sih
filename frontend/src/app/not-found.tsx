import Link from "next/link";
import { CloudOff, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white dark:bg-[#121212] border border-slate-200 dark:border-[#27272a] rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/40 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center">
          <CloudOff className="w-7 h-7 text-sky-600 dark:text-sky-400" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Page not found
          </h2>
          <p className="text-sm text-slate-500 dark:text-[#8e8e93] leading-relaxed">
            The page you're looking for doesn't exist or has moved.
          </p>
        </div>
        <Link
          href="/home"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors w-full"
        >
          <Home className="w-4 h-4" />
          Go home
        </Link>
      </div>
    </div>
  );
}
