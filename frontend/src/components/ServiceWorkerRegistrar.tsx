"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (`public/sw.js`).
 *
 * Mounted once from the root layout. Registration is skipped in development:
 * a service worker caching Next.js dev-server output produces confusing stale
 * modules and defeats hot reload.
 *
 * `PUSH_SUBSCRIPTION_CHANGED` messages are forwarded to a window event so the
 * notification settings UI can re-subscribe without this component importing
 * the push module (and pulling it into every page's bundle).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelled) return;

        // Pick up a newly deployed worker without requiring the user to close
        // every tab first.
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              installing.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      } catch (err) {
        // A failed registration must never break the app — it only costs offline
        // support and push, both of which degrade gracefully.
        console.warn("Service worker registration failed:", err);
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") {
        window.dispatchEvent(new CustomEvent("mausam_push_subscription_changed"));
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    void register();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
