"use client";

import { Menu, Monitor, Moon, Star, Sun, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLandingThemeOptional } from "@/contexts/LandingThemeContext";

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function PageNavbar() {
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stars, setStars] = useState<number | null>(null);
  const landing = useLandingThemeOptional();
  const isDark = landing?.isLandingDark ?? false;

  // GitHub stars
  useEffect(() => {
    fetch("https://api.github.com/repos/DevelopedByDev/overlay-web")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.stargazers_count === "number") setStars(d.stargazers_count);
      })
      .catch(() => {});
  }, []);

  const navBg = isDark ? "bg-[#0a0a0a]" : "bg-[#fafafa]";
  const borderColor = isDark ? "border-zinc-800" : "border-zinc-200";
  const linkClass = isDark
    ? "text-sm text-zinc-400 transition-colors hover:text-zinc-100"
    : "text-sm text-zinc-500 transition-colors hover:text-zinc-900";
  const logoClass = isDark
    ? "font-serif text-lg text-zinc-100"
    : "font-serif text-lg text-zinc-900";
  const iconClass = isDark ? "h-4 w-4 text-zinc-400" : "h-4 w-4 text-zinc-500";

  const appHref = isAuthenticated
    ? "/app/chat"
    : "/auth/sign-in?redirect=%2Fapp%2Fchat";

  const navLinks = [
    { href: appHref, label: "app" },
    { href: "/manifesto", label: "manifesto" },
    { href: "/pricing", label: "pricing" },
    {
      href: isAuthenticated ? "/account" : "/auth/sign-in",
      label: isAuthenticated ? "account" : "sign in",
    },
  ];

  const ThemeIcon = isDark ? Moon : Sun;

  return (
    <nav
      className={`sticky top-0 z-50 border-b ${borderColor} ${navBg} font-serif`}
    >
      {/* Desktop */}
      <div className="relative mx-auto hidden max-w-6xl items-center justify-between px-8 py-4 md:flex">
        {/* Left: Logo */}
        <Link href="/home" className="flex items-center gap-2.5">
          <Image src="/assets/overlay-logo.png" alt="Overlay" width={22} height={22} />
          <span className={logoClass}>overlay</span>
        </Link>

        {/* Center: Nav links (absolutely centered) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
          {navLinks.map(({ href, label }) => (
            <Link key={label} href={href} className={linkClass}>
              {label}
            </Link>
          ))}
        </div>

        {/* Right: GitHub stars + theme toggle */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/DevelopedByDev/overlay-web"
            target="_blank"
            rel="noopener noreferrer"
            className={`overlay-interactive inline-flex items-center gap-1.5 border px-3 py-1.5 ${borderColor} ${linkClass}`}
          >
            <Star className={iconClass} />
            {stars !== null && (
              <span className="text-xs">{formatStars(stars)}</span>
            )}
          </a>
          {landing && (
            <button
              type="button"
              onClick={landing.toggleLandingTheme}
              aria-label="Toggle theme"
              className={`overlay-interactive inline-flex items-center justify-center border p-2 ${borderColor}`}
            >
              <ThemeIcon className={iconClass} />
            </button>
          )}
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <Link href="/home" className="flex items-center gap-2">
          <Image src="/assets/overlay-logo.png" alt="Overlay" width={20} height={20} />
          <span className={logoClass}>overlay</span>
        </Link>
        <div className="flex items-center gap-2">
          {landing && (
            <button
              type="button"
              onClick={landing.toggleLandingTheme}
              aria-label="Toggle theme"
              className={`overlay-interactive inline-flex items-center justify-center border p-2 ${borderColor}`}
            >
              <ThemeIcon className={iconClass} />
            </button>
          )}
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className={`overlay-interactive inline-flex h-9 w-9 items-center justify-center border ${borderColor} ${isDark ? "text-zinc-300" : "text-zinc-600"}`}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className={`border-t ${borderColor} ${navBg} md:hidden`}>
          <div className="flex flex-col px-4 py-2">
            {navLinks.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`border-b py-3 text-base ${borderColor} ${isDark ? "text-zinc-300 hover:text-zinc-100" : "text-zinc-600 hover:text-zinc-900"} transition-colors`}
              >
                {label}
              </Link>
            ))}
            <a
              href="https://github.com/DevelopedByDev/overlay-web"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-2 py-3 text-base ${isDark ? "text-zinc-300 hover:text-zinc-100" : "text-zinc-600 hover:text-zinc-900"} transition-colors`}
            >
              <Star className="h-4 w-4" />
              {stars !== null ? `${formatStars(stars)} stars` : "github"}
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
