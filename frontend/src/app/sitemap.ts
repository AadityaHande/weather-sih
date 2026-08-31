import type { MetadataRoute } from "next";
import { INDEXABLE_ROUTES, SITE_URL } from "@/lib/siteConfig";

/**
 * sitemap.xml (Next.js App Router generates this at /sitemap.xml).
 *
 * Only the public, content-bearing routes from `INDEXABLE_ROUTES`. The landing
 * page gets top priority; `/home` is the real entry point for returning users,
 * so it ranks just below.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return INDEXABLE_ROUTES.map((route) => ({
    url: `${SITE_URL}${route === "/" ? "" : route}`,
    lastModified,
    // Weather content changes constantly; the shell around it does not.
    changeFrequency: route === "/" ? "monthly" : "daily",
    priority: route === "/" ? 1 : route === "/home" ? 0.9 : 0.7,
  }));
}
