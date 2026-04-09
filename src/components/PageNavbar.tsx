"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLandingThemeOptional } from "@/contexts/LandingThemeContext";

export function PageNavbar() {
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const landing = useLandingThemeOptional();
  const isDark = landing?.isLandingDark ?? false;

  const linkClass = isDark
    ? "text-sm text-zinc-400 transition-colors hover:text-zinc-100"
    : "text-sm text-zinc-500 transition-colors hover:text-zinc-900";
  const mobileLinkClass = isDark
    ? "block rounded-2xl border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-base text-zinc-200 transition-colors hover:text-white"
    : "block rounded-2xl border border-[#e5e5e5] bg-white px-4 py-3 text-base text-[#3f3f46] transition-colors hover:text-[#0a0a0a]";
  const shellClass = isDark
    ? "flex h-full items-center justify-between rounded-full border border-zinc-700/80 bg-zinc-950/85 px-4 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur md:hidden"
    : "flex h-full items-center justify-between rounded-full border border-[#e5e5e5] bg-white/85 px-4 py-2 shadow-[0_10px_30px_rgba(10,10,10,0.05)] backdrop-blur md:hidden";
  const mobileMenuShell = isDark
    ? "mt-3 rounded-[28px] border border-zinc-700 bg-zinc-950/95 p-3 shadow-[0_24px_64px_rgba(0,0,0,0.45)] backdrop-blur md:hidden"
    : "mt-3 rounded-[28px] border border-[#e5e5e5] bg-[#fafafa]/95 p-3 shadow-[0_24px_64px_rgba(10,10,10,0.12)] backdrop-blur md:hidden";
  const menuBtnClass = isDark
    ? "inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-600 text-zinc-300"
    : "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] text-[#52525b]";
  const logoClass = isDark ? "font-serif text-lg text-zinc-100" : "font-serif text-lg";
  const logoClassLg = isDark ? "font-serif text-xl text-zinc-100" : "font-serif text-xl";

  const appHref = isAuthenticated ? "/app/chat" : "/auth/sign-in?redirect=%2Fapp%2Fchat";

  return (
    <header className="relative z-10 px-4 py-4 md:px-8 md:py-6">
      <nav className="mx-auto max-w-6xl">
        <div className={shellClass}>
          <Link href="/home" className="flex items-center gap-2">
            <Image src="/assets/overlay-logo.png" alt="Overlay" width={22} height={22} />
            <span className={logoClass}>overlay</span>
          </Link>
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileMenuOpen((value) => !value)}
            className={menuBtnClass}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className={mobileMenuShell}>
            <div className="grid gap-2">
              <Link href={appHref} className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
                app
              </Link>
              <Link href="/manifesto" className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
                manifesto
              </Link>
              <a
                href="https://github.com/DevelopedByDev/overlay-web"
                target="_blank"
                rel="noopener noreferrer"
                className={mobileLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                github
              </a>
              <Link href="/pricing" className={mobileLinkClass} onClick={() => setMobileMenuOpen(false)}>
                pricing
              </Link>
              <Link
                href={isAuthenticated ? "/account" : "/auth/sign-in"}
                className={mobileLinkClass}
                onClick={() => setMobileMenuOpen(false)}
              >
                {isAuthenticated ? "account" : "sign in"}
              </Link>
              {landing ? (
                <button
                  type="button"
                  onClick={() => {
                    landing.toggleLandingTheme();
                    setMobileMenuOpen(false);
                  }}
                  className={`${mobileLinkClass} w-full text-left`}
                >
                  {landing.landingTheme === "light" ? "dark" : "light"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="hidden items-center justify-between md:flex">
          <Link href="/home" className="flex items-center gap-2">
            <Image src="/assets/overlay-logo.png" alt="Overlay" width={28} height={28} />
            <span className={logoClassLg}>overlay</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href={appHref} className={linkClass}>
              app
            </Link>
            <Link href="/manifesto" className={linkClass}>
              manifesto
            </Link>
            <a
              href="https://github.com/DevelopedByDev/overlay-web"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              github
            </a>
            <Link href="/pricing" className={linkClass}>
              pricing
            </Link>
            {isAuthenticated ? (
              <Link href="/account" className={linkClass}>
                account
              </Link>
            ) : (
              <Link href="/auth/sign-in" className={linkClass}>
                sign in
              </Link>
            )}
            {landing ? (
              <button type="button" onClick={landing.toggleLandingTheme} className={linkClass}>
                {landing.landingTheme === "light" ? "dark" : "light"}
              </button>
            ) : null}
          </div>
        </div>
      </nav>
    </header>
  );
}
