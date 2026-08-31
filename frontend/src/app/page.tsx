"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import SpotlightCards from "@/components/SpotlightCards";
import { HoverEffect } from "@/components/ui/card-hover-effect";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import {
  CloudSun,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Sliders,
  FileCheck2,
  HeartPulse,
  Activity,
  Waves,
  Plane,
  Users,
  Sprout,
  Car,
  Calendar,
  CheckCircle2,
  Layers,
  Globe,
  Smartphone,
  ChevronRight,
  Wind,
  Sun,
  Droplets,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    {
      name: "Features",
      link: "#features",
    },
    {
      name: "Supported Personas",
      link: "#personas",
    },
    {
      name: "Weather Map",
      link: "/map",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />

      {/* Resizable Navbar */}
      <Navbar>
        {/* Desktop Navigation */}
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />
          <div className="flex items-center gap-3">
            <NavbarButton variant="secondary" onClick={() => router.push("/auth")}>
              Sign In
            </NavbarButton>
            <NavbarButton variant="primary" onClick={() => router.push("/auth")}>
              Get Started
            </NavbarButton>
          </div>
        </NavBody>

        {/* Mobile Navigation */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo onClick={() => setIsMobileMenuOpen(false)} />
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-sm font-bold text-slate-700 hover:text-sky-600 py-1 transition-colors"
              >
                {item.name}
              </a>
            ))}
            <div className="flex w-full flex-col gap-2 pt-2 border-t border-slate-100">
              <NavbarButton
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  router.push("/auth");
                }}
                variant="secondary"
                className="w-full text-center justify-center"
              >
                Sign In
              </NavbarButton>
              <NavbarButton
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  router.push("/auth");
                }}
                variant="primary"
                className="w-full justify-center"
              >
                Get Started
              </NavbarButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-8 pt-16 pb-24 max-w-6xl mx-auto text-center z-10">
        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] max-w-4xl mx-auto mb-6">
          User Persona-Based Adaptive Homepage with an{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-blue-700">
            Interpretation and Personalization Layer
          </span>
        </h1>

        <p className="text-base sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
          Generic weather apps show everyone the same generic cards. Mausam dynamically ranks AQI, UV, rain, and heat alerts based on your unique persona and health flags.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => router.push("/auth")}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-sky-500/30 transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Get Started Now</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Key Features Section with Kokonut UI Spotlight Cards */}
      <section id="features">
        <SpotlightCards />
      </section>

      {/* Supported Personas Section with Aceternity Card Hover Effect */}
      <section id="personas" className="py-20 px-4 sm:px-8 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-6">
          <p className="font-extrabold text-xs text-sky-600 uppercase tracking-[0.2em] mb-2">
            TAILORED WEATHER INTELLIGENCE
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Supported Personas
          </h2>
          <p className="text-slate-600 text-sm font-medium">
            Deeply supported personas with dedicated rule sets, signal weighting, and specialized widgets.
          </p>
        </div>

        <HoverEffect
          items={[
            {
              id: "health",
              title: "Health-conscious",
              description: "Prioritizes clean air quality, allergen guidance, and humidity alerts.",
              icon: HeartPulse,
              color: "#059669",
              widgets: ["AQI dial", "UV index", "Pollen forecast", "Humidity alert"],
            },
            {
              id: "fitness",
              title: "Fitness Enthusiast",
              description: "Optimizes workout windows around solar hours, UV index, and heat alerts.",
              icon: Activity,
              color: "#d97706",
              widgets: ["Best workout window", "Heat alert", "Rain & storm predictions"],
            },
            {
              id: "beachgoer",
              title: "Beachgoer / Surfer",
              description: "Monitors coastal swell, marine wind, wave heights, and tide cycles.",
              icon: Waves,
              color: "#0891b2",
              widgets: ["Tide chart", "Wave height", "Sea temp", "Swell direction"],
            },
            {
              id: "traveler",
              title: "Traveler",
              description: "Keeps tabs on multi-city itineraries, packing tips, and flight hazards.",
              icon: Plane,
              color: "#7c3aed",
              widgets: ["Multi-city cards", "Flight weather risk", "Packing tips"],
            },
            {
              id: "parent",
              title: "Parent / Family",
              description: "Focuses on school commute rain forecasts and severe storm warnings.",
              icon: Users,
              color: "#0284c7",
              widgets: ["School commute rain alert", "Fog & storm warning"],
            },
            {
              id: "farmer",
              title: "Farmer / Gardener",
              description: "Agricultural metrics for soil moisture, frost hazards, and rainfall.",
              icon: Sprout,
              color: "#65a30d",
              widgets: ["Soil moisture", "Frost alert", "Rainfall prediction"],
            },
            {
              id: "commuter",
              title: "Commuter",
              description: "Road transit visibility, fog tracking, and weather-driven traffic integration.",
              icon: Car,
              color: "#4f46e5",
              widgets: ["Visibility index", "Fog/storm traffic integration"],
            },
            {
              id: "event",
              title: "Event Planner",
              description: "Extended 10-day outlooks, precipitation likelihood, and optimal event windows.",
              icon: Calendar,
              color: "#e11d48",
              widgets: ["10-day forecast", "Rain probability", "Best timings"],
            },
          ]}
        />
      </section>

      {/* CTA Footer Section */}
      <section className="py-16 px-4 sm:px-8 bg-gradient-to-r from-sky-600 to-blue-700 text-white text-center mt-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Ready to Experience Personalized Weather?
          </h2>
          <p className="text-sky-100 text-sm font-medium max-w-xl mx-auto">
            Set up your persona in seconds and see how the engine dynamically ranks environmental context cards.
          </p>
          <div>
            <button
              type="button"
              onClick={() => router.push("/auth")}
              className="px-8 py-4 bg-white text-sky-800 hover:bg-sky-50 font-black text-sm rounded-2xl shadow-xl transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Copyright Footer */}
      <footer className="py-6 bg-slate-900 text-slate-400 text-center text-xs font-medium border-t border-slate-800">
        <p>Mausam · Next-Generation Weather Intelligence</p>
      </footer>
    </div>
  );
}
