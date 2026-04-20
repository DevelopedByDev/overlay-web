"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu, MoonStar, SunMedium, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLandingThemeOptional } from "@/contexts/LandingThemeContext";
import { AUDIENCE_PAGES, getMarketingAppHref, MARKETING_GITHUB_URL, MARKETING_SALES_URL } from "@/lib/marketing";

const DESKTOP_NAV = [
  { href: "/home#product", label: "Product", match: (pathname: string) => pathname === "/home" },
  { href: "/for-business", label: "Enterprise", match: (pathname: string) => pathname === "/for-business" },
  { href: "/pricing", label: "Pricing", match: (pathname: string) => pathname === "/pricing" },
  { href: "/manifesto", label: "Manifesto", match: (pathname: string) => pathname === "/manifesto" },
];

function SolutionsMenu({
  isDark,
  currentPath,
  mobile = false,
  onNavigate,
}: {
  isDark: boolean;
  currentPath: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);

  const isActive = AUDIENCE_PAGES.some((page) => page.href === currentPath);
  const linkClass = isDark
    ? "text-zinc-400 hover:text-zinc-100"
    : "text-zinc-500 hover:text-zinc-950";

  if (mobile) {
    return (
      <div
        className={`rounded-[22px] border p-2 ${
          isDark ? "border-white/10 bg-white/[0.03]" : "border-black/8 bg-black/[0.02]"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition-colors ${
            isDark ? "text-zinc-100" : "text-zinc-900"
          }`}
        >
          <span>Solutions</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="grid gap-1 px-1 pb-1 pt-2">
                {AUDIENCE_PAGES.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    onClick={onNavigate}
                    className={`rounded-2xl px-3 py-2 text-sm transition-colors ${
                      currentPath === page.href
                        ? isDark
                          ? "bg-white/8 text-zinc-100"
                          : "bg-black/[0.045] text-zinc-950"
                        : `${linkClass}`
                    }`}
                  >
                    <span className="block">{page.label}</span>
                    <span className={`mt-0.5 block text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                      {page.summary}
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
          isActive
            ? isDark
              ? "text-zinc-100"
              : "text-zinc-950"
            : linkClass
        }`}
      >
        <span>Solutions</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`absolute left-1/2 top-full mt-3 w-[320px] -translate-x-1/2 overflow-hidden rounded-[28px] border backdrop-blur-xl ${
              isDark
                ? "border-white/10 bg-[#0d0d10]/96 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
                : "border-black/8 bg-white/96 shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
            }`}
          >
            <div className="grid gap-1 p-2">
              {AUDIENCE_PAGES.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className={`rounded-[22px] px-4 py-3 transition-colors ${
                    currentPath === page.href
                      ? isDark
                        ? "bg-white/8"
                        : "bg-black/[0.04]"
                      : isDark
                        ? "hover:bg-white/6"
                        : "hover:bg-black/[0.025]"
                  }`}
                >
                  <span className={`block text-sm ${isDark ? "text-zinc-100" : "text-zinc-950"}`}>
                    {page.label}
                  </span>
                  <span className={`mt-1 block text-xs leading-relaxed ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                    {page.summary}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function PageNavbar() {
  const pathname = usePathname() ?? "";
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const landing = useLandingThemeOptional();
  const isDark = landing?.isLandingDark ?? false;
  const appHref = getMarketingAppHref(isAuthenticated);

  const shellClass = isDark
    ? "border-white/10 bg-[#111113]/96 text-zinc-100"
    : "border-black/8 bg-[#fbfbfa]/96 text-zinc-950";
  const mutedLinkClass = isDark ? "text-zinc-400 hover:text-zinc-100" : "text-zinc-500 hover:text-zinc-950";
  const mobilePanelClass = isDark
    ? "border-white/10 bg-[#111113]/98"
    : "border-black/8 bg-[#fbfbfa]/98";

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 py-4 md:px-8 md:py-5">
      <div className="mx-auto max-w-7xl">
        <div
          className={`pointer-events-auto rounded-[22px] border transition-colors ${shellClass}`}
        >
          <nav className="flex items-center justify-between gap-4 px-4 py-3 md:px-5">
            <Link href="/home" className="flex min-w-0 items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
              <Image src="/assets/overlay-logo.png" alt="Overlay" width={26} height={26} className="shrink-0" />
              <span className="truncate text-lg tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                overlay
              </span>
            </Link>

            <div className="hidden items-center gap-6 md:flex">
              {DESKTOP_NAV.slice(0, 1).map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`text-sm transition-colors ${
                      active
                        ? isDark
                          ? "text-zinc-100"
                          : "text-zinc-950"
                        : mutedLinkClass
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <SolutionsMenu key={`desktop-${pathname}`} isDark={isDark} currentPath={pathname} />
              {DESKTOP_NAV.slice(1).map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`text-sm transition-colors ${
                      active
                        ? isDark
                          ? "text-zinc-100"
                          : "text-zinc-950"
                        : mutedLinkClass
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <a
                href={MARKETING_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm transition-colors ${mutedLinkClass}`}
              >
                GitHub
              </a>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <a
                href={MARKETING_SALES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center rounded-full px-4 py-2 text-sm transition-colors ${
                  isDark
                    ? "text-zinc-300 hover:bg-white/7 hover:text-zinc-100"
                    : "text-zinc-700 hover:bg-black/[0.045] hover:text-zinc-950"
                }`}
              >
                Contact sales
              </a>
              <Link
                href={appHref}
                className={`inline-flex items-center rounded-full px-4 py-2 text-sm transition-colors ${
                  isDark
                    ? "bg-zinc-100 text-zinc-950 hover:bg-white"
                    : "bg-zinc-950 text-white hover:bg-zinc-800"
                }`}
              >
                Open app
              </Link>
            </div>

            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              onClick={() => setMobileMenuOpen((value) => !value)}
              className={`pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border md:hidden ${
                isDark
                  ? "border-white/10 bg-white/5 text-zinc-100"
                  : "border-black/8 bg-white text-zinc-950"
              }`}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </nav>
        </div>

        <AnimatePresence initial={false}>
          {mobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={`pointer-events-auto mt-3 overflow-hidden rounded-[24px] border p-3 md:hidden ${mobilePanelClass}`}
            >
              <div className="grid gap-2">
                <Link
                  href="/home#product"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-[22px] px-4 py-3 text-sm transition-colors ${
                    pathname === "/home"
                      ? isDark
                        ? "bg-white/8 text-zinc-100"
                        : "bg-black/[0.045] text-zinc-950"
                      : mutedLinkClass
                  }`}
                >
                  Product
                </Link>
                <SolutionsMenu
                  key={`mobile-${pathname}`}
                  isDark={isDark}
                  currentPath={pathname}
                  mobile
                  onNavigate={() => setMobileMenuOpen(false)}
                />
                <Link
                  href="/for-business"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-[22px] px-4 py-3 text-sm transition-colors ${
                    pathname === "/for-business"
                      ? isDark
                        ? "bg-white/8 text-zinc-100"
                        : "bg-black/[0.045] text-zinc-950"
                      : mutedLinkClass
                  }`}
                >
                  Enterprise
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-[22px] px-4 py-3 text-sm transition-colors ${mutedLinkClass}`}
                >
                  Pricing
                </Link>
                <Link
                  href="/manifesto"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-[22px] px-4 py-3 text-sm transition-colors ${mutedLinkClass}`}
                >
                  Manifesto
                </Link>
                <a
                  href={MARKETING_GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-[22px] px-4 py-3 text-sm transition-colors ${mutedLinkClass}`}
                >
                  GitHub
                </a>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <a
                    href={MARKETING_SALES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-3 text-sm transition-colors ${
                      isDark
                        ? "border border-white/10 bg-white/5 text-zinc-100"
                        : "border border-black/8 bg-white text-zinc-950"
                    }`}
                  >
                    Contact sales
                  </a>
                  <Link
                    href={appHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-3 text-sm transition-colors ${
                      isDark
                        ? "bg-zinc-100 text-zinc-950"
                        : "bg-zinc-950 text-white"
                    }`}
                  >
                    Open app
                  </Link>
                </div>
                {landing ? (
                  <button
                    type="button"
                    onClick={() => {
                      landing.toggleLandingTheme();
                      setMobileMenuOpen(false);
                    }}
                    className={`mt-2 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm ${
                      isDark ? "text-zinc-300" : "text-zinc-700"
                    }`}
                  >
                    {landing.landingTheme === "light" ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
                    <span>{landing.landingTheme === "light" ? "Dark theme" : "Light theme"}</span>
                  </button>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
