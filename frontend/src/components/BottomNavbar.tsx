"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Map, Home, Settings, CloudSun } from "lucide-react";

export default function BottomNavbar() {
  const pathname = usePathname();

  // Hide bottom navbar on landing page (/) or auth page (/auth)
  if (pathname === "/" || pathname === "/auth") {
    return null;
  }

  const navItems = [
    {
      name: "Weather",
      href: "/weather",
      icon: CloudSun,
    },
    {
      name: "Home",
      href: "/home",
      icon: Home,
    },
    {
      name: "Map",
      href: "/map",
      icon: Map,
    },
    {
      name: "Setting",
      href: "/settings",
      icon: Settings,
    },
  ];

  const isActiveLink = (href: string) => {
    if (href === "/settings") {
      return pathname === "/settings" || pathname === "/onboarding";
    }
    return pathname === href;
  };

  return (
    <aside
      aria-label="Bottom Navigation Bar"
      className="fixed bottom-3 sm:bottom-4 left-0 right-0 z-50 px-2 sm:px-4 pointer-events-none flex justify-center md:hidden"
    >
      <div className="w-full max-w-[390px] sm:max-w-md pointer-events-auto">
        <nav
          aria-label="Primary Navigation"
          className="bg-white/95 dark:bg-[#121212]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-[#27272a] rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/80 p-1 sm:p-1.5 grid grid-cols-4 gap-0.5 sm:gap-1 items-center transition-all"
        >
          {navItems.map((item) => {
            const isActive = isActiveLink(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-3 text-[11px] sm:text-xs transition-all duration-200 cursor-pointer select-none rounded-xl text-center",
                  isActive
                    ? "bg-slate-900 dark:bg-sky-500 text-white font-bold shadow-sm"
                    : "text-slate-600 dark:text-[#8e8e93] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-[#1c1c1e] font-semibold"
                )}
              >
                <Icon className={clsx("w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0", isActive ? "text-white" : "text-slate-600 dark:text-[#8e8e93]")} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
