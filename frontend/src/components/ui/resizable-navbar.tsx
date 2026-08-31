"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X, ArrowRight } from "lucide-react";

export interface NavItem {
  name: string;
  link: string;
}

export function Navbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300 px-4 sm:px-8 py-3",
        isScrolled
          ? "pt-3 pb-3"
          : "pt-4 pb-3",
        className
      )}
    >
      <div
        className={cn(
          "max-w-6xl mx-auto transition-all duration-300 rounded-3xl border",
          isScrolled
            ? "bg-white/85 backdrop-blur-xl border-slate-200/90 shadow-lg shadow-slate-900/5 px-4 sm:px-6 py-2.5"
            : "bg-white/95 backdrop-blur-md border-sky-100/80 shadow-xs px-4 sm:px-6 py-3"
        )}
      >
        {children}
      </div>
    </header>
  );
}

export function NavBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hidden md:flex items-center justify-between gap-6 w-full",
        className
      )}
    >
      {children}
    </div>
  );
}

export function NavbarLogo({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn("flex items-center gap-3 cursor-pointer select-none", className)}
    >
      <img
        src="/logo.png"
        alt="Mausam Logo"
        className="w-9 h-9 object-contain rounded-2xl shadow-2xs"
      />
      <span className="font-black text-lg text-slate-900 tracking-tight">
        Mausam
      </span>
    </Link>
  );
}

export function NavItems({
  items,
  className,
  onItemClick,
}: {
  items: NavItem[];
  className?: string;
  onItemClick?: () => void;
}) {
  return (
    <nav className={cn("flex items-center gap-8", className)}>
      {items.map((item, idx) => (
        <a
          key={`nav-item-${idx}`}
          href={item.link}
          onClick={onItemClick}
          className="text-xs font-bold text-slate-600 hover:text-sky-600 transition-colors cursor-pointer"
        >
          {item.name}
        </a>
      ))}
    </nav>
  );
}

export function NavbarButton({
  children,
  variant = "primary",
  className,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  onClick?: () => void;
}) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push("/auth");
    }
  };

  if (variant === "secondary") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "px-4 py-2 text-slate-700 hover:text-sky-600 text-xs font-bold transition-colors cursor-pointer rounded-xl hover:bg-slate-100/80",
          className
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-500/25 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer",
        className
      )}
    >
      <span>{children}</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}

export function MobileNav({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("md:hidden w-full", className)}>{children}</div>;
}

export function MobileNavHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between w-full", className)}>
      {children}
    </div>
  );
}

export function MobileNavToggle({
  isOpen,
  onClick,
  className,
}: {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer",
        className
      )}
      aria-label="Toggle Menu"
    >
      {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
    </button>
  );
}

export function MobileNavMenu({
  isOpen,
  onClose,
  children,
  className,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "pt-5 pb-3 flex flex-col gap-4 border-t border-slate-100 mt-3 animate-in fade-in slide-in-from-top-2 duration-200",
        className
      )}
    >
      {children}
    </div>
  );
}
