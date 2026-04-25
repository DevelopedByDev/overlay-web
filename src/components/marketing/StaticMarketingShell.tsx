"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLandingTheme } from "@/contexts/LandingThemeContext";
import { getMarketingAppHref, MARKETING_GITHUB_URL } from "@/lib/marketing";

export function useStaticMarketingTheme() {
  const { landingTheme, toggleLandingTheme, isLandingDark } = useLandingTheme();
  const shellClass = isLandingDark ? "bg-[#0a0a0a] text-zinc-100" : "bg-[#faf8f4] text-zinc-950";
  const panelClass = isLandingDark ? "border-white/10 bg-white/[0.03]" : "border-black/10 bg-white";
  const mutedClass = isLandingDark ? "text-zinc-400" : "text-zinc-600";
  const subtleClass = isLandingDark ? "text-zinc-500" : "text-zinc-500";
  const dividerClass = isLandingDark ? "border-white/10" : "border-black/5";
  const secondaryButtonClass = isLandingDark
    ? "border-white/10 hover:bg-white/[0.04]"
    : "border-black/10 hover:bg-black/[0.03]";
  const primaryButtonClass = isLandingDark
    ? "bg-zinc-100 text-zinc-950 hover:bg-white"
    : "bg-zinc-950 text-white hover:bg-zinc-800";

  return {
    landingTheme,
    toggleLandingTheme,
    isDark: isLandingDark,
    shellClass,
    panelClass,
    mutedClass,
    subtleClass,
    dividerClass,
    secondaryButtonClass,
    primaryButtonClass,
  };
}

export function StaticMarketingNav() {
  const { isAuthenticated } = useAuth();
  const theme = useStaticMarketingTheme();
  const webAppHref = getMarketingAppHref(isAuthenticated);

  return (
    <header className={`border-b px-6 py-5 md:px-8 ${theme.dividerClass}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/home" className="flex items-center gap-3">
          <Image src="/assets/overlay-logo.png" alt="Overlay" width={28} height={28} />
          <span className="text-lg tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
            overlay
          </span>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <Link href="/pricing" className={`hidden rounded-full border px-4 py-2 md:inline-flex ${theme.secondaryButtonClass}`}>
            Pricing
          </Link>
          <Link href="/manifesto" className={`hidden rounded-full border px-4 py-2 md:inline-flex ${theme.secondaryButtonClass}`}>
            Manifesto
          </Link>
          <a
            href={MARKETING_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`hidden rounded-full border px-4 py-2 md:inline-flex ${theme.secondaryButtonClass}`}
          >
            GitHub
          </a>
          <button type="button" onClick={theme.toggleLandingTheme} className={`rounded-full border px-4 py-2 ${theme.secondaryButtonClass}`}>
            {theme.landingTheme === "dark" ? "Light" : "Dark"}
          </button>
          <Link href={webAppHref} className={`inline-flex rounded-full px-4 py-2 text-sm ${theme.primaryButtonClass}`}>
            Open app
          </Link>
        </div>
      </div>
    </header>
  );
}

export function StaticMarketingShell({ children }: { children: ReactNode }) {
  const theme = useStaticMarketingTheme();

  return (
    <div className={`min-h-screen ${theme.shellClass}`}>
      <StaticMarketingNav />
      {children}
    </div>
  );
}
