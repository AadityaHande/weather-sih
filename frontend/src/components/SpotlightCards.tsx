"use client";

import React, { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Sliders, ShieldAlert, FileCheck2, Sparkles, Smartphone, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Data Types ──────────────────────────────────────────────────────────────────

export interface SpotlightItem {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  codeSnippet?: string;
}

export const ENGINE_FEATURES: SpotlightItem[] = [
  {
    icon: Sliders,
    title: "Contextual Ranking Engine",
    description:
      "Calculates card priorities using pure function mathematical scoring: Score = persona × urgency × confidence.",
    color: "#0284c7",
    codeSnippet: "Score = persona × urgency × confidence",
  },
  {
    icon: ShieldAlert,
    title: "P0 Severe Warning Override",
    description:
      "Life-safety warnings (thunderstorms, heavy rainfall) bypass user preferences and render permanently at the top.",
    color: "#ef4444",
  },
  {
    icon: FileCheck2,
    title: "Deterministic Audit Trail",
    description:
      "Every card can be tapped to reveal the exact environmental signal values and scoring weights that placed it there.",
    color: "#a855f7",
  },
  {
    icon: Sparkles,
    title: "Data Source Disclosure",
    description:
      "Explicit badging for live, simulated, cached, or unavailable data ensuring 100% transparency for judges and users.",
    color: "#10b981",
  },
  {
    icon: Smartphone,
    title: "PWA & Capacitor Mobile",
    description:
      "Progressive Web App support with native Android/iOS Capacitor configuration for mobile deployments.",
    color: "#38bdf8",
  },
  {
    icon: Globe,
    title: "Firebase Auth & Profiles",
    description:
      "Secure Email/Password and Google authentication with seamless device-ID guest mode support.",
    color: "#f59e0b",
  },
];

// ─── Card Component ─────────────────────────────────────────────────────────────

interface CardProps {
  item: SpotlightItem;
  dimmed: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

function Card({ item, dimmed, onHoverStart, onHoverEnd }: CardProps) {
  const Icon = item.icon;
  const cardRef = useRef<HTMLDivElement>(null);

  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({
      x: (0.5 - y) * 14,
      y: (x - 0.5) * 14,
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHoverStart();
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
    onHoverEnd();
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      style={{
        transform: isHovered
          ? `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`
          : dimmed
          ? "scale(0.96)"
          : "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)",
        opacity: dimmed ? 0.45 : 1,
        filter: dimmed ? "blur(2px)" : "none",
        transition: isHovered
          ? "transform 0.12s ease-out, opacity 0.3s ease, filter 0.3s ease"
          : "transform 0.4s ease-out, opacity 0.3s ease, filter 0.3s ease",
      }}
      className={cn(
        "group relative flex flex-col justify-between gap-5 overflow-hidden rounded-3xl border p-7 cursor-pointer",
        "border-slate-200/90 bg-white shadow-sm hover:shadow-xl hover:shadow-slate-900/5",
        "transition-[border-color,box-shadow] duration-300",
        "hover:border-slate-300"
      )}
    >
      {/* Static accent tint */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background: `radial-gradient(ellipse at 20% 20%, ${item.color}14, transparent 65%)`,
        }}
      />

      {/* Hover glow layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl transition-opacity duration-500"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(ellipse at 20% 20%, ${item.color}28, transparent 70%)`,
        }}
      />

      {/* Shimmer sweep */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[55%] -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[280%]"
      />

      {/* Top section: Icon & Title */}
      <div className="relative z-10 space-y-4">
        {/* Icon badge */}
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
          style={{
            background: `${item.color}18`,
            boxShadow: `inset 0 0 0 1px ${item.color}35`,
          }}
        >
          <Icon className="w-6 h-6" style={{ color: item.color }} strokeWidth={2.2} />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h3 className="font-bold text-base text-slate-900 tracking-tight">
            {item.title}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {item.description}
          </p>
        </div>
      </div>

      {/* Accent bottom line */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-[3px] w-0 rounded-full transition-all duration-500 group-hover:w-full"
        style={{
          background: `linear-gradient(to right, ${item.color}, transparent)`,
        }}
      />
    </div>
  );
}

// ─── Main SpotlightCards Grid Component ──────────────────────────────────────────

export interface SpotlightCardsProps {
  items?: SpotlightItem[];
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  className?: string;
}

export default function SpotlightCards({
  items = ENGINE_FEATURES,
  eyebrow = "ENGINE CAPABILITIES",
  heading = "Engine Capabilities & Features",
  subheading = "Designed with high standards for safety, transparency, and explainable AI scoring.",
  className,
}: SpotlightCardsProps) {
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl px-4 sm:px-8 py-16",
        "bg-white border-y border-sky-100",
        className
      )}
    >
      {/* Dot grid subtle background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(2,132,199,0.12) 1.2px, transparent 1.2px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="font-extrabold text-xs text-sky-600 uppercase tracking-[0.2em] mb-2">
            {eyebrow}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
            {heading}
          </h2>
          <p className="text-slate-600 text-sm font-medium">
            {subheading}
          </p>
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <Card
              dimmed={hoveredTitle !== null && hoveredTitle !== item.title}
              item={item}
              key={item.title}
              onHoverEnd={() => setHoveredTitle(null)}
              onHoverStart={() => setHoveredTitle(item.title)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
