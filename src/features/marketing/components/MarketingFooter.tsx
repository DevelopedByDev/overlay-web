"use client";

import { MoonStar, SunMedium } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLandingThemeOptional } from "@/contexts/LandingThemeContext";
import { MARKETING_GITHUB_URL } from "@/shared/marketing/marketing";

export function MarketingFooter() {
  const landing = useLandingThemeOptional();
  const linkClass = "text-[var(--muted)] hover:text-[var(--foreground)]";

  return (
    <footer className="relative z-10 border-t border-[var(--border)] px-6 py-8 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/assets/overlay-logo.png" alt="Overlay" width={22} height={22} />
          <div>
            <p className="text-sm text-[var(--foreground)]">overlay</p>
            <p className="text-xs text-[var(--muted-light)]">the AI workspace that does the work.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <Link href="/pricing" className={`transition-colors ${linkClass}`}>
            Pricing
          </Link>
          <a href={MARKETING_GITHUB_URL} target="_blank" rel="noopener noreferrer" className={`transition-colors ${linkClass}`}>
            GitHub
          </a>
          <Link href="/terms" className={`transition-colors ${linkClass}`}>
            Terms
          </Link>
          <Link href="/privacy" className={`transition-colors ${linkClass}`}>
            Privacy
          </Link>
          {landing ? (
            <button
              type="button"
              onClick={landing.toggleLandingTheme}
              className={`inline-flex items-center gap-2 transition-colors ${linkClass}`}
            >
              {landing.landingTheme === "light" ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
              <span>{landing.landingTheme === "light" ? "Dark theme" : "Light theme"}</span>
            </button>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
