"use client";

import { useEffect, useState } from "react";

/**
 * Tracks connectivity.
 *
 * Starts optimistic (`true`) rather than reading `navigator.onLine` during the
 * initial render: this app is server-rendered, and seeding state from a
 * browser-only API produces a hydration mismatch. The `online`/`offline` events
 * plus the mount effect correct it immediately.
 *
 * Note `navigator.onLine` only proves a network interface exists, not that the
 * backend is reachable — so treat it as a hint. The authoritative signal is a
 * failed request (`ApiError` with kind "network"), which is why the offline
 * banner accepts an explicit `hasFailedRequest` too.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return isOnline;
}
