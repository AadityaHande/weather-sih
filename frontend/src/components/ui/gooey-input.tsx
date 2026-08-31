"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GooeyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onSubmit"> {
  onSubmitQuery?: (query: string) => void;
  className?: string;
  defaultExpanded?: boolean;
}

export function GooeyInput({
  placeholder = "Search...",
  value: controlledValue,
  onChange,
  onSubmitQuery,
  className,
  defaultExpanded = false,
  ...props
}: GooeyInputProps) {
  const [internalValue, setInternalValue] = useState("");
  const [isFocused, setIsFocused] = useState(defaultExpanded);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const isExpanded = isFocused || isHovered || (value !== undefined && String(value).length > 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e);
    } else {
      setInternalValue(e.target.value);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange) {
      const syntheticEvent = {
        target: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    } else {
      setInternalValue("");
    }
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmitQuery) {
      onSubmitQuery(String(value));
    }
  };

  const handleIconClick = () => {
    if (!isExpanded) {
      setIsFocused(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (value && String(value).trim().length > 0) {
      if (onSubmitQuery) {
        onSubmitQuery(String(value));
      }
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className={cn("relative inline-flex items-center select-none", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* SVG Liquid Gooey Filter */}
      <svg
        className="pointer-events-none absolute h-0 w-0"
        aria-hidden="true"
      >
        <defs>
          <filter id="aceternity-gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Gooey Layer Container with Filter applied */}
      <div
        className="relative flex items-center"
        style={{ filter: "url(#aceternity-gooey)" }}
      >
        {/* Separated Left Circle (Search Icon Button) */}
        <button
          type="button"
          onClick={handleIconClick}
          className={cn(
            "relative z-20 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-pointer active:scale-95",
            "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-300/80 shadow-md shadow-slate-900/5",
            "dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 dark:border-white/90 dark:shadow-black/50",
            isExpanded ? "mr-3 scale-100 ring-2 ring-slate-400/30 dark:ring-white/40" : "mr-0"
          )}
          title="Search"
        >
          <Search className="h-4 w-4 stroke-[2.5] text-slate-700 dark:text-slate-900 transition-transform duration-300" />
        </button>

        {/* Right Elongating Input Capsule */}
        <div
          onClick={() => {
            setIsFocused(true);
            inputRef.current?.focus();
          }}
          className={cn(
            "relative z-10 flex h-10 items-center overflow-hidden rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] cursor-text",
            "bg-slate-100 text-slate-900 border border-slate-300/80 shadow-md shadow-slate-900/5",
            "dark:bg-white dark:text-slate-900 dark:border-white/90 dark:shadow-black/50",
            isExpanded
              ? "w-64 sm:w-80 px-4 opacity-100 scale-100 ring-2 ring-slate-400/30 dark:ring-white/40"
              : "-ml-10 w-32 pl-10 pr-4 opacity-100"
          )}
        >
          <form onSubmit={handleSubmit} className="flex h-full w-full items-center">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isExpanded ? placeholder : "Search"}
              className="h-full w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-900 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none"
              {...props}
            />

            {/* Clear Button */}
            {value && String(value).length > 0 && isExpanded && (
              <button
                type="button"
                onClick={handleClear}
                className="ml-1 p-0.5 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default GooeyInput;
