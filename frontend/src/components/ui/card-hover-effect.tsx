"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, type LucideIcon } from "lucide-react";

export interface HoverEffectItem {
  id?: string;
  title: string;
  description: string;
  link?: string;
  icon?: LucideIcon;
  color?: string;
  widgets?: string[];
}

export const HoverEffect = ({
  items,
  className,
}: {
  items: HoverEffectItem[];
  className?: string;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 py-6 gap-3",
        className
      )}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isHovered = hoveredIndex === idx;

        return (
          <div
            key={item.id || item.title}
            className="relative group block p-1.5 h-full w-full cursor-pointer"
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Ambient Animated Hover Backdrop */}
            <span
              className={cn(
                "absolute inset-0 h-full w-full rounded-3xl transition-all duration-300 pointer-events-none",
                isHovered
                  ? "opacity-100 scale-100 shadow-xl"
                  : "opacity-0 scale-95"
              )}
              style={{
                background: item.color
                  ? `radial-gradient(ellipse at center, ${item.color}25, ${item.color}08)`
                  : "radial-gradient(ellipse at center, rgba(2,132,199,0.18), rgba(2,132,199,0.05))",
                boxShadow: item.color
                  ? `0 15px 30px -10px ${item.color}30`
                  : "0 15px 30px -10px rgba(2,132,199,0.2)",
              }}
            />

            {/* Inner Card */}
            <div
              className={cn(
                "relative z-10 rounded-2xl h-full w-full p-6 overflow-hidden bg-white border transition-all duration-300 flex flex-col justify-between",
                isHovered
                  ? "border-slate-300 shadow-md transform -translate-y-1"
                  : "border-slate-200/90 shadow-2xs"
              )}
            >
              <div>
                {Icon && (
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 shadow-2xs"
                    style={{
                      backgroundColor: item.color ? `${item.color}15` : "#0284c715",
                      color: item.color || "#0284c7",
                      boxShadow: `inset 0 0 0 1px ${item.color || "#0284c7"}30`,
                    }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                )}

                <h3 className="font-extrabold text-base text-slate-900 tracking-tight mb-1.5 group-hover:text-sky-700 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {item.widgets && item.widgets.length > 0 && (
                <div className="border-t border-slate-100 pt-3 mt-2">
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-2">
                    Key Widgets
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                    {item.widgets.map((widget, widx) => (
                      <li key={widx} className="flex items-center gap-2">
                        <CheckCircle2
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: item.color || "#0284c7" }}
                        />
                        <span>{widget}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HoverEffect;
