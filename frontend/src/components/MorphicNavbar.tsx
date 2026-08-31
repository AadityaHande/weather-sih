"use client";

import React, { useState } from "react";
import clsx from "clsx";
import Link from "next/link";

export interface NavItem {
  name: string;
}

export interface MorphicNavbarProps {
  items?: Record<string, NavItem>;
  defaultPath?: string;
  className?: string;
  onSelect?: (path: string) => void;
}

const DEFAULT_NAV_ITEMS: Record<string, NavItem> = {
  "/": { name: "Home" },
  "#features": { name: "Features" },
  "#personas": { name: "Personas" },
  "/map": { name: "Weather Map" },
};

export function MorphicNavbar({
  items = DEFAULT_NAV_ITEMS,
  defaultPath = "/",
  className,
  onSelect,
}: MorphicNavbarProps) {
  const [activePath, setActivePath] = useState(defaultPath);

  const isActiveLink = (path: string) => {
    return activePath === path;
  };

  const handleItemClick = (path: string) => {
    setActivePath(path);
    if (onSelect) {
      onSelect(path);
    }
  };

  return (
    <nav className={clsx("px-2 py-1", className)}>
      <div className="flex items-center justify-center">
        <div className="bg-slate-100/90 border border-slate-200/80 p-1 flex items-center justify-between overflow-hidden rounded-2xl shadow-xs backdrop-blur-md">
          {Object.entries(items).map(([path, { name }], index, array) => {
            const isActive = isActiveLink(path);
            const isFirst = index === 0;
            const isLast = index === array.length - 1;
            const prevPath = index > 0 ? array[index - 1][0] : null;
            const nextPath = index < array.length - 1 ? array[index + 1][0] : null;

            return (
              <Link
                key={path}
                href={path}
                onClick={() => handleItemClick(path)}
                className={clsx(
                  "flex items-center justify-center py-1.5 px-4 text-xs transition-all duration-300 cursor-pointer whitespace-nowrap",
                  isActive
                    ? "bg-slate-900 text-white font-bold rounded-xl shadow-md scale-102 mx-1"
                    : clsx(
                        "text-slate-600 hover:text-slate-900 font-semibold",
                        (isActiveLink(prevPath || "") || isFirst) && "rounded-l-xl",
                        (isActiveLink(nextPath || "") || isLast) && "rounded-r-xl"
                      )
                )}
              >
                {name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default MorphicNavbar;
