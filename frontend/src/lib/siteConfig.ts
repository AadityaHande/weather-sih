/**
 * Canonical site identity, shared by metadata, robots.txt, sitemap.xml and the
 * OpenGraph image.
 *
 * Kept in one module so a deploy to a new domain is a single env var rather than
 * a hunt through hard-coded URLs.
 */

/**
 * Absolute public origin, no trailing slash.
 *
 * Falls back to the Vercel-provided URL, then localhost. Note `VERCEL_URL` has
 * no protocol, hence the prefix.
 */
export const SITE_URL: string = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.NEXT_PUBLIC_VERCEL_URL) return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  return "http://localhost:3000";
})();

export const SITE_NAME = "Mausam";

export const SITE_TITLE = "Mausam — Personalized Weather Intelligence";

export const SITE_DESCRIPTION =
  "A weather homepage that ranks what matters to you. Personalized air quality, UV, rain and severe-warning alerts for India, with a transparent explanation for every card.";

/** Routes worth listing in the sitemap — public, indexable, and stable. */
export const INDEXABLE_ROUTES = ["/", "/home", "/weather", "/map", "/chatbot"] as const;
