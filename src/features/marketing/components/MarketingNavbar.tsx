"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu, MoonStar, SunMedium, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLandingThemeOptional } from "@/contexts/LandingThemeContext";
import {
  AUDIENCE_PAGES,
  MARKETING_GITHUB_URL,
  MARKETING_SALES_URL,
  getMarketingAppHref,
} from "@/shared/marketing/marketing";

const PRIMARY_LINKS: Array<{ href: string; label: string; match: (pathname: string) => boolean }> = [
  { href: "/home#product", label: "Product", match: (p) => p === "/home" },
  { href: "/pricing", label: "Pricing", match: (p) => p === "/pricing" },
  { href: "/manifesto", label: "Manifesto", match: (p) => p === "/manifesto" },
];

const mutedLink = "text-[var(--muted)] hover:text-[var(--foreground)]";

function activeLinkClass(active: boolean) {
  return active ? "text-[var(--foreground)]" : mutedLink;
}

function SolutionsMenu({
  currentPath,
  mobile = false,
  onNavigate,
}: {
  currentPath: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = AUDIENCE_PAGES.some((page) => page.href === currentPath);

  if (mobile) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[var(--foreground)]"
        >
          <span>Use cases</span>
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
                    className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                      currentPath === page.href
                        ? "bg-[var(--surface-subtle)] text-[var(--foreground)]"
                        : mutedLink
                    }`}
                  >
                    <span className="block">{page.navLabel}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted-light)]">{page.summary}</span>
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
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-sm transition-colors ${activeLinkClass(isActive)}`}
      >
        <span>Use cases</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-1/2 top-full mt-3 w-[320px] -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_24px_60px_var(--overlay-scrim)] backdrop-blur-xl"
          >
            <div className="grid gap-1 p-2">
              {AUDIENCE_PAGES.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className={`rounded-xl px-4 py-3 transition-colors ${
                    currentPath === page.href ? "bg-[var(--surface-subtle)]" : "hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <span className="block text-sm text-[var(--foreground)]">{page.navLabel}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--muted-light)]">{page.summary}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Single navbar shared across all outside-the-app surfaces. Styled to match the
 * app's own header chrome: flat top bar, `--sidebar-surface` background, a
 * `--border` hairline, and the serif brand mark.
 */
export function MarketingNavbar() {
  const pathname = usePathname() ?? "";
  const { isAuthenticated } = useAuth();
  const landing = useLandingThemeOptional();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const appHref = getMarketingAppHref(isAuthenticated);
  const accountIsActive = pathname === "/account";

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--sidebar-surface)_92%,transparent)] backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <nav className="flex h-14 items-center justify-between gap-4">
          <Link
            href="/home"
            className="flex min-w-0 items-center gap-2.5"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Image src="/assets/overlay-logo.png" alt="Overlay" width={24} height={24} className="shrink-0" />
            <span className="truncate text-lg tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
              overlay
            </span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <Link href={PRIMARY_LINKS[0].href} className={`text-sm transition-colors ${activeLinkClass(PRIMARY_LINKS[0].match(pathname))}`}>
              {PRIMARY_LINKS[0].label}
            </Link>
            <SolutionsMenu key={`desktop-${pathname}`} currentPath={pathname} />
            {PRIMARY_LINKS.slice(1).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`text-sm transition-colors ${activeLinkClass(item.match(pathname))}`}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={MARKETING_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm transition-colors ${mutedLink}`}
            >
              GitHub
            </a>
            {isAuthenticated ? (
              <Link href="/account" className={`text-sm transition-colors ${activeLinkClass(accountIsActive)}`}>
                Account
              </Link>
            ) : null}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {landing ? (
              <button
                type="button"
                onClick={landing.toggleLandingTheme}
                aria-label="Toggle theme"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              >
                {landing.landingTheme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
              </button>
            ) : null}
            <a
              href={MARKETING_SALES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full px-4 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              Contact sales
            </a>
            <Link
              href={appHref}
              className="inline-flex items-center rounded-full bg-[var(--button-primary-bg)] px-4 py-2 text-sm text-[var(--button-primary-text)] transition-opacity hover:opacity-90"
            >
              Open app
            </Link>
          </div>

          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] md:hidden"
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
            className="overflow-hidden border-t border-[var(--border)] bg-[var(--sidebar-surface)] px-4 py-3 md:hidden"
          >
            <div className="grid gap-2">
              <Link
                href="/home#product"
                onClick={() => setMobileMenuOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm transition-colors ${
                  pathname === "/home" ? "bg-[var(--surface-subtle)] text-[var(--foreground)]" : mutedLink
                }`}
              >
                Product
              </Link>
              <SolutionsMenu
                key={`mobile-${pathname}`}
                currentPath={pathname}
                mobile
                onNavigate={() => setMobileMenuOpen(false)}
              />
              {PRIMARY_LINKS.slice(1).map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-xl px-4 py-3 text-sm transition-colors ${
                    item.match(pathname) ? "bg-[var(--surface-subtle)] text-[var(--foreground)]" : mutedLink
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <a
                href={MARKETING_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm transition-colors ${mutedLink}`}
              >
                GitHub
              </a>
              {isAuthenticated ? (
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-xl px-4 py-3 text-sm transition-colors ${
                    accountIsActive ? "bg-[var(--surface-subtle)] text-[var(--foreground)]" : mutedLink
                  }`}
                >
                  Account
                </Link>
              ) : null}

              <div className="mt-1 flex items-center gap-2">
                {landing ? (
                  <button
                    type="button"
                    onClick={landing.toggleLandingTheme}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    {landing.landingTheme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                    <span>{landing.landingTheme === "dark" ? "Light" : "Dark"}</span>
                  </button>
                ) : null}
                <Link
                  href={appHref}
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-[var(--button-primary-bg)] px-4 py-2.5 text-sm text-[var(--button-primary-text)] transition-opacity hover:opacity-90"
                >
                  Open app
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
