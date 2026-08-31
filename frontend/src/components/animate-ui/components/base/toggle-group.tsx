"use client";

import React, { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

export interface ToggleGroupProps {
  value?: string | string[];
  onValueChange?: (value: string) => void;
  multiple?: boolean;
  variant?: "default" | "outline" | "pills" | "filled";
  size?: "sm" | "default" | "lg";
  className?: string;
  children?: React.ReactNode;
}

interface ToggleGroupContextType {
  value?: string | string[];
  onValueChange?: (value: string) => void;
  multiple?: boolean;
  variant?: ToggleGroupProps["variant"];
  size?: ToggleGroupProps["size"];
}

const ToggleGroupContext = createContext<ToggleGroupContextType>({
  variant: "default",
  size: "default",
});

export function ToggleGroup({
  value,
  onValueChange,
  multiple = false,
  variant = "default",
  size = "default",
  className,
  children,
}: ToggleGroupProps) {
  return (
    <ToggleGroupContext.Provider
      value={{ value, onValueChange, multiple, variant, size }}
    >
      <div
        role="group"
        className={cn(
          "inline-flex items-center gap-2 p-1 rounded-2xl transition-all",
          variant === "filled" && "bg-slate-100/90 border border-slate-200/80 shadow-inner",
          className
        )}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

export interface ToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  activeClassName?: string;
  activeColor?: string;
}

export function Toggle({
  value,
  className,
  activeClassName,
  activeColor,
  children,
  onClick,
  disabled,
  ...props
}: ToggleProps) {
  const context = useContext(ToggleGroupContext);

  const isSelected = Array.isArray(context.value)
    ? context.value.includes(value)
    : context.value === value;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (context.onValueChange) {
      context.onValueChange(value);
    }
    if (onClick) {
      onClick(e);
    }
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5 rounded-xl",
    default: "px-4 py-2 text-xs font-bold gap-2 rounded-2xl min-h-[40px]",
    lg: "px-5 py-2.5 text-sm font-bold gap-2.5 rounded-2xl min-h-[46px]",
  }[context.size || "default"];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "relative inline-flex items-center justify-center font-bold transition-all duration-300 select-none cursor-pointer border",
        sizeClasses,
        isSelected
          ? cn(
              "shadow-md scale-102 text-white border-transparent",
              activeColor || "bg-emerald-600 border-emerald-600",
              activeClassName
            )
          : "bg-white dark:bg-[#1c1c1e] text-slate-700 dark:text-white border-slate-200/90 dark:border-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#252528] hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-[#3a3a3c] shadow-xs",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default ToggleGroup;
