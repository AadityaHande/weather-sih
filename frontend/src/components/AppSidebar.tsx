"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, SidebarBody, SidebarLink, useSidebar } from "@/components/ui/sidebar";
import {
  IconHome,
  IconSun,
  IconMap,
  IconSettings,
  IconUser,
  IconMenu2,
} from "@tabler/icons-react";
import { Bot, RefreshCw, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { cn } from "@/lib/utils";

export default function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logoutUser } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);
  const [currentLocName, setCurrentLocName] = useState<string>("Ward 1, Pune");

  useEffect(() => {
    const cached =
      localStorage.getItem("mausam_detected_location") ||
      localStorage.getItem("mausam_custom_location");
    if (cached) setCurrentLocName(cached);

    const onLocUpdated = (e: any) => {
      if (e.detail?.name) {
        setCurrentLocName(e.detail.name);
      }
    };
    window.addEventListener("mausam_location_updated", onLocUpdated);
    return () => window.removeEventListener("mausam_location_updated", onLocUpdated);
  }, []);

  const handleRefreshLocation = () => {
    setIsRefreshingLocation(true);
    window.dispatchEvent(new CustomEvent("mausam_refresh_location"));
    window.dispatchEvent(new CustomEvent("mausam_refresh_weather"));
    router.refresh();
    setTimeout(() => {
      setIsRefreshingLocation(false);
    }, 1000);
  };

  // Hide sidebar on landing page (/) or auth page (/auth)
  const isAuthOrLanding = pathname === "/" || pathname === "/auth";

  if (isAuthOrLanding) {
    return <>{children}</>;
  }

  const links = [
    {
      label: t("nav.home"),
      href: "/home",
      icon: (
        <IconHome
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/home"
              ? "text-sky-500"
              : "text-neutral-700 dark:text-neutral-300"
          )}
        />
      ),
    },
    {
      label: t("nav.weather"),
      href: "/weather",
      icon: (
        <IconSun
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/weather"
              ? "text-sky-500"
              : "text-neutral-700 dark:text-neutral-300"
          )}
        />
      ),
    },
    {
      label: t("nav.map"),
      href: "/map",
      icon: (
        <IconMap
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/map"
              ? "text-sky-500"
              : "text-neutral-700 dark:text-neutral-300"
          )}
        />
      ),
    },
    {
      label: t("nav.chatbot"),
      href: "/chatbot",
      icon: (
        <Bot
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/chatbot"
              ? "text-sky-500"
              : "text-neutral-700 dark:text-neutral-300"
          )}
        />
      ),
    },
    {
      label: t("nav.settings"),
      href: "/settings",
      icon: (
        <IconSettings
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            pathname === "/settings" || pathname === "/onboarding"
              ? "text-sky-500"
              : "text-neutral-700 dark:text-neutral-300"
          )}
        />
      ),
    },
  ];

  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={true}>
      <div className="flex flex-col md:flex-row w-full min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-white transition-colors duration-300">
        <SidebarBody className="justify-between gap-6 bg-white dark:bg-[#121212] border-r border-slate-200/90 dark:border-[#27272a]">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-6 flex flex-col gap-1.5">
              {links.map((link, idx) => (
                <SidebarLink
                  key={idx}
                  link={link}
                  className={cn(
                    "rounded-xl px-2 py-2 transition-all",
                    pathname === link.href
                      ? "bg-slate-100 dark:bg-[#1c1c1e] font-bold text-sky-600 dark:text-sky-400 shadow-xs"
                      : "hover:bg-slate-100/80 dark:hover:bg-[#1c1c1e] text-slate-600 dark:text-[#8e8e93] hover:text-slate-900 dark:hover:text-white"
                  )}
                />
              ))}

              {/* Sidebar: Refresh Location Button */}
              <button
                type="button"
                onClick={handleRefreshLocation}
                className={cn(
                  "flex items-center justify-start gap-2.5 group/sidebar py-2 px-2 rounded-xl transition-all w-full text-left cursor-pointer",
                  "hover:bg-slate-100/80 dark:hover:bg-[#1c1c1e] text-slate-700 dark:text-[#8e8e93] hover:text-sky-600 dark:hover:text-sky-400"
                )}
                title="Refresh GPS Location & Weather"
              >
                <div className="relative flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-sky-500 transition-colors" />
                  <RefreshCw
                    className={cn(
                      "h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-sky-600 dark:text-sky-400 transition-transform",
                      isRefreshingLocation && "animate-spin text-sky-600"
                    )}
                  />
                </div>
                <motion.div
                  animate={{
                    display: open ? "flex" : "none",
                    opacity: open ? 1 : 0,
                  }}
                  className="flex-col min-w-0 group-hover/sidebar:translate-x-1 transition duration-150"
                >
                  <span className="text-sm font-semibold text-slate-800 dark:text-white truncate leading-tight">
                    {isRefreshingLocation ? "Locating GPS..." : "Refresh Location"}
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 dark:text-[#8e8e93] truncate leading-tight">
                    {currentLocName}
                  </span>
                </motion.div>
              </button>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-[#1c1c1e] overflow-hidden space-y-1">
            {open && (
              <div className="px-1 py-1">
                <LanguageSelector variant="sidebar" />
              </div>
            )}
            {user ? (
              <SidebarLink
                link={{
                  label: user.email?.split("@")[0] || "Account",
                  href: "/settings",
                  icon: (
                    <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-[11px] shrink-0 shadow-xs">
                      {user.email ? user.email.charAt(0).toUpperCase() : "U"}
                    </div>
                  ),
                }}
                className={cn(
                  "rounded-xl px-2 py-2 transition-all",
                  pathname === "/settings"
                    ? "bg-slate-100 dark:bg-[#1c1c1e] font-bold text-sky-600 dark:text-sky-400"
                    : "hover:bg-slate-100/80 dark:hover:bg-[#1c1c1e] text-slate-600 dark:text-[#8e8e93] hover:text-slate-900 dark:hover:text-white"
                )}
              />
            ) : (
              <SidebarLink
                link={{
                  label: t("settings.signIn"),
                  href: "/auth",
                  icon: (
                    <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-[#27272a] flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                      <IconUser className="h-3.5 w-3.5" />
                    </div>
                  ),
                }}
                className="rounded-xl px-2 py-2 transition-all hover:bg-slate-100/80 dark:hover:bg-[#1c1c1e]"
              />
            )}
          </div>
        </SidebarBody>

        <div className="flex-1 w-full overflow-x-hidden flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}

export const Logo = () => {
  return (
    <Link
      href="/home"
      className="relative z-20 flex items-center space-x-3 px-1 py-1 text-slate-900 dark:text-white overflow-hidden"
    >
      <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
        <img
          src="/logo.png"
          alt="Mausam Logo"
          className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl shadow-xs"
        />
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-black text-xl sm:text-2xl tracking-tight whitespace-pre text-slate-900 dark:text-white leading-none"
      >
        Mausam
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="/home"
      className="relative z-20 flex items-center justify-center px-1 py-1"
    >
      <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
        <img
          src="/logo.png"
          alt="Mausam Logo"
          className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl shadow-xs"
        />
      </div>
    </Link>
  );
};

export function MobileMenuTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Toggle navigation menu"
      className={cn(
        "p-2 rounded-xl text-slate-700 hover:text-slate-900 dark:text-[#8e8e93] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c1c1e] transition-colors cursor-pointer md:hidden flex items-center justify-center",
        className
      )}
    >
      <IconMenu2 className="w-5 h-5" />
    </button>
  );
}
