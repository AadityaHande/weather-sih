import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

/**
 * robots.txt (Next.js App Router generates this at /robots.txt).
 *
 * Authenticated and device-scoped screens are excluded: they render nothing
 * useful to a crawler and `/settings` / `/auth` appearing in search results is
 * just noise. The API routes are excluded for the same reason.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth", "/settings", "/onboarding"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
