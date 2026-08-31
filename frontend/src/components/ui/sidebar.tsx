"use client";
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconX } from "@tabler/icons-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  const toggleSidebar = () => {
    setOpen((prev) => !prev);
  };

  return (
    <SidebarContext.Provider
      value={{ open, setOpen, toggleSidebar, animate: animate }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <>
      <DesktopSidebar className={className}>{children}</DesktopSidebar>
      <MobileSidebar className={className}>{children}</MobileSidebar>
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.aside
      aria-label="Application Sidebar"
      className={cn(
        "h-screen sticky top-0 px-2.5 py-4 hidden md:flex md:flex-col justify-between bg-white dark:bg-[#121212] border-r border-slate-200/90 dark:border-[#27272a] shrink-0 z-30 overflow-hidden transition-colors duration-300",
        className
      )}
      animate={{
        width: animate ? (open ? "240px" : "64px") : "240px",
      }}
      transition={{
        duration: 0.22,
        ease: [0.32, 0.72, 0, 1],
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
    </motion.aside>
  );
};

export const MobileSidebar = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  const { open, setOpen } = useSidebar();
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden"
            onClick={() => setOpen(false)}
          />
          {/* Half-screen Drawer (max 280px / 72vw) */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{
              duration: 0.28,
              ease: [0.32, 0.72, 0, 1],
            }}
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-[72vw] max-w-[280px] h-screen bg-white dark:bg-[#121212] border-r border-slate-200 dark:border-[#27272a] p-4 shadow-2xl flex flex-col justify-between md:hidden overflow-y-auto",
              className
            )}
          >
            <div
              className="absolute right-3.5 top-3.5 z-50 p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-[#8e8e93] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c1c1e] cursor-pointer transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Close Sidebar"
            >
              <IconX className="w-5 h-5" />
            </div>
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export const SidebarLink = ({
  link,
  className,
}: {
  link: Links;
  className?: string;
}) => {
  const { open, animate } = useSidebar();
  return (
    <a
      href={link.href}
      className={cn(
        "flex items-center gap-3 py-2 px-2 rounded-xl group/sidebar cursor-pointer overflow-hidden transition-all duration-150",
        className
      )}
    >
      <div className="flex items-center justify-center w-6 h-6 shrink-0">
        {link.icon}
      </div>

      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
          width: animate ? (open ? "auto" : 0) : "auto",
        }}
        transition={{
          duration: 0.15,
        }}
        className="text-neutral-700 dark:text-neutral-200 text-sm font-medium whitespace-nowrap truncate overflow-hidden"
      >
        {link.label}
      </motion.span>
    </a>
  );
};
