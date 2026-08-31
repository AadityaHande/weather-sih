"use client";

import React, { createContext, useContext, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface RippleContextType {
  ripples: Ripple[];
  onRippleEnd: (id: number) => void;
}

const RippleContext = createContext<RippleContextType>({
  ripples: [],
  onRippleEnd: () => {},
});

export interface RippleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "accent"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  hoverScale?: number;
  tapScale?: number;
  className?: string;
  children?: React.ReactNode;
}

const variantClasses: Record<
  NonNullable<RippleButtonProps["variant"]>,
  string
> = {
  default:
    "bg-slate-900 text-white hover:bg-slate-800 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500 shadow-sm",
  accent:
    "bg-sky-500 text-white hover:bg-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400 shadow-sm",
  destructive:
    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-sm",
  outline:
    "border border-slate-200 bg-white text-slate-800 hover:bg-slate-100 dark:border-[#2c2c2e] dark:bg-[#1c1c1e] dark:text-white dark:hover:bg-[#252528] shadow-xs",
  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-[#2c2c2e] dark:text-white dark:hover:bg-[#3a3a3c] shadow-2xs",
  ghost:
    "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#1c1c1e] dark:hover:text-white",
  link: "text-sky-600 underline-offset-4 hover:underline dark:text-sky-400",
};

const sizeClasses: Record<NonNullable<RippleButtonProps["size"]>, string> = {
  default: "h-10 px-4 py-2 text-xs font-bold rounded-xl",
  sm: "h-8 px-3 py-1.5 text-xs font-semibold rounded-lg",
  lg: "h-12 px-6 py-3 text-sm font-bold rounded-2xl",
  icon: "h-9 w-9 p-0 rounded-xl flex items-center justify-center",
};

export function RippleButton({
  variant = "default",
  size = "default",
  hoverScale = 1.02,
  tapScale = 0.96,
  className,
  children,
  onClick,
  disabled,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rippleSize = Math.max(rect.width, rect.height) * 2;

      const newRipple: Ripple = {
        id: Date.now() + Math.random(),
        x,
        y,
        size: rippleSize,
      };

      setRipples((prev) => [...prev, newRipple]);
    }

    if (onClick) {
      onClick(e);
    }
  };

  const handleRippleEnd = (id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <RippleContext.Provider value={{ ripples, onRippleEnd: handleRippleEnd }}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative isolate inline-flex items-center justify-center gap-2 overflow-hidden select-none cursor-pointer transition-all duration-200 active:scale-[0.96] hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    </RippleContext.Provider>
  );
}

export interface RippleButtonRipplesProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string;
  scale?: number;
}

export function RippleButtonRipples({
  color,
  scale = 1,
  className,
  ...props
}: RippleButtonRipplesProps) {
  const { ripples, onRippleEnd } = useContext(RippleContext);

  return (
    <span
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
      {...props}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          onAnimationEnd={() => onRippleEnd(ripple.id)}
          style={{
            top: ripple.y,
            left: ripple.x,
            width: ripple.size * scale,
            height: ripple.size * scale,
            backgroundColor: color || "var(--ripple-button-ripple-color, rgba(255, 255, 255, 0.4))",
            transform: "translate(-50%, -50%) scale(0)",
            animation: "rippleEffect 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
          }}
          className={cn("absolute rounded-full pointer-events-none", className)}
        />
      ))}
      <style jsx global>{`
        @keyframes rippleEffect {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.55;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </span>
  );
}

export default RippleButton;
