"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, ThemeMode } from "@/context/ThemeContext";

export interface ThemeTogglerButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "accent"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg";
  modes?: ThemeMode[];
  direction?: "btt" | "ttb" | "ltr" | "rtl";
  onImmediateChange?: (theme: ThemeMode) => void;
}

export function ThemeTogglerButton({
  variant = "default",
  size = "default",
  modes = ["light", "dark"],
  direction = "ltr",
  onImmediateChange,
  className,
  ...props
}: ThemeTogglerButtonProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const currentIdx = modes.indexOf(theme);
    const nextIdx = (currentIdx + 1) % modes.length;
    const nextTheme = modes[nextIdx];

    setTheme(nextTheme);
    if (onImmediateChange) {
      onImmediateChange(nextTheme);
    }
    if (props.onClick) {
      props.onClick(e);
    }
  };

  const sizeClasses = {
    sm: "h-8 w-8 text-xs rounded-xl",
    default: "h-10 w-10 text-sm rounded-2xl",
    lg: "h-12 w-12 text-base rounded-2xl",
  }[size];

  const variantClasses = {
    default: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 shadow-2xs",
    accent: "bg-sky-500 text-white hover:bg-sky-600 shadow-md",
    destructive: "bg-rose-500 text-white hover:bg-rose-600 shadow-md",
    outline: "border border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
    secondary: "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300",
    link: "bg-transparent text-sky-600 underline-offset-4 hover:underline",
  }[variant];

  // Directional slide transform classes
  const getTransitionClass = () => {
    switch (direction) {
      case "btt":
        return "translate-y-0 animate-in slide-in-from-bottom-2 fade-in";
      case "ttb":
        return "translate-y-0 animate-in slide-in-from-top-2 fade-in";
      case "rtl":
        return "translate-x-0 animate-in slide-in-from-right-2 fade-in";
      case "ltr":
      default:
        return "translate-x-0 animate-in slide-in-from-left-2 fade-in";
    }
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          "relative inline-flex items-center justify-center transition-all cursor-pointer",
          sizeClasses,
          variantClasses,
          className
        )}
        {...props}
      >
        <Sun className="w-4 h-4 text-amber-500" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`Current theme: ${theme}. Click to change theme.`}
      title={`Theme: ${theme}`}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden transition-all duration-300 active:scale-95 cursor-pointer",
        sizeClasses,
        variantClasses,
        className
      )}
      {...props}
    >
      <div key={theme} className={cn("transition-all duration-300 flex items-center justify-center", getTransitionClass())}>
        {theme === "light" && (
          <Sun className="w-4 h-4 text-amber-500 transition-transform duration-300 rotate-0 hover:rotate-45" />
        )}
        {theme === "dark" && (
          <Moon className="w-4 h-4 text-sky-400 transition-transform duration-300 -rotate-12 hover:rotate-0" />
        )}
        {theme === "system" && (
          <Laptop className="w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform duration-300" />
        )}
      </div>
    </button>
  );
}

export default ThemeTogglerButton;
