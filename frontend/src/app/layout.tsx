import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import AppSidebar from "@/components/AppSidebar";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/siteConfig";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Required for OG/Twitter image URLs to resolve to absolute paths — crawlers
  // reject relative ones.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // Pages that set their own title get " — Mausam" appended.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  keywords: [
    "weather",
    "India weather",
    "air quality",
    "AQI",
    "UV index",
    "rain forecast",
    "severe weather warnings",
    "IMD",
    "personalized weather",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_IN",
    // Image comes from app/opengraph-image.tsx — Next injects it here.
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  // Stops iOS Safari from turning temperatures and AQI numbers into tel: links.
  formatDetection: { telephone: false, address: false, date: false },
};

export const viewport: Viewport = {
  themeColor: "#0284c7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The active theme is decided here, server-side, from a cookie that
  // ThemeContext keeps in sync on the client. First paint is therefore already
  // the correct theme — no theme-init script is needed in <head>, which also
  // avoids the React 19 "Encountered a script tag" console error entirely.
  let initialThemeClass = "";
  try {
    const cookieStore = await cookies();
    if (cookieStore.get("theme")?.value === "dark") initialThemeClass = " dark";
  } catch {
    // cookies() is unavailable outside a request scope; never block first paint.
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${initialThemeClass}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="shortcut icon" href="/icon.png" type="image/png" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body
        className="min-h-full bg-slate-50 dark:bg-black text-slate-900 dark:text-white flex flex-col font-sans selection:bg-sky-200 selection:text-sky-900"
        suppressHydrationWarning
      >
        <Providers>
          <ServiceWorkerRegistrar />
          <AppSidebar>{children}</AppSidebar>
        </Providers>
      </body>
    </html>
  );
}
