"use client";

import Image from "next/image";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { useAuth } from "@/contexts/AuthContext";
import { LandingThemeProvider, useLandingTheme } from "@/contexts/LandingThemeContext";
import { MARKETING_GITHUB_URL, getMarketingAppHref } from "@/lib/marketing";

const VALUE_POINTS = [
  {
    title: "Best models",
    body:
      "Use GPT, Claude, Gemini, Grok, DeepSeek, and more in one workspace. Pick the best model for the job instead of committing to one vendor.",
  },
  {
    title: "Shared context",
    body:
      "Files, notes, projects, and connectors stay connected. Your context persists, so each session starts with more of your work already in place.",
  },
  {
    title: "Agents and automations",
    body:
      "Run agents, save repeatable workflows, and automate the boring parts. Overlay is built for work that should keep moving without manual follow-up.",
  },
  {
    title: "Price and trust",
    body:
      "Starts at $8 per month. You get model choice, memory, connectors, and automations in an open-source product you can inspect.",
  },
];

function HomeLandingContent() {
  const { landingTheme, toggleLandingTheme } = useLandingTheme();
  const { isAuthenticated } = useAuth();
  const webAppHref = getMarketingAppHref(isAuthenticated);
  const isDark = landingTheme === "dark";

  const shellClass = isDark
    ? "bg-[#0a0a0a] text-zinc-100"
    : "bg-[#faf8f4] text-zinc-950";
  const panelClass = isDark
    ? "border-white/10 bg-white/[0.03]"
    : "border-black/10 bg-white";
  const mutedClass = isDark ? "text-zinc-400" : "text-zinc-600";
  const subtleClass = isDark ? "text-zinc-500" : "text-zinc-500";
  const dividerClass = isDark ? "border-white/10" : "border-black/5";
  const secondaryButtonClass = isDark
    ? "border-white/10 hover:bg-white/[0.04]"
    : "border-black/10 hover:bg-black/[0.03]";

  return (
    <div className={`min-h-screen ${shellClass}`}>
      <header className={`border-b px-6 py-5 md:px-8 ${dividerClass}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/home" className="flex items-center gap-3">
            <Image src="/assets/overlay-logo.png" alt="Overlay" width={28} height={28} />
            <span className="text-lg tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
              overlay
            </span>
          </Link>

          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/pricing"
              className={`hidden rounded-full border px-4 py-2 md:inline-flex ${secondaryButtonClass}`}
            >
              Pricing
            </Link>
            <a
              href={MARKETING_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`hidden rounded-full border px-4 py-2 md:inline-flex ${secondaryButtonClass}`}
            >
              GitHub
            </a>
            <button
              type="button"
              onClick={toggleLandingTheme}
              className={`rounded-full border px-4 py-2 ${secondaryButtonClass}`}
            >
              {isDark ? "Light" : "Dark"}
            </button>
            <Link
              href={webAppHref}
              className={
                isDark
                  ? "inline-flex rounded-full bg-zinc-100 px-4 py-2 text-sm text-zinc-950"
                  : "inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm text-white"
              }
            >
              Open app
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="px-6 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:items-end">
            <div className="max-w-3xl">
              <p className={`text-sm uppercase tracking-[0.2em] ${subtleClass}`}>Open-source AI workspace</p>
              <h1
                className="mt-6 max-w-[12ch] text-5xl leading-[0.95] tracking-tight md:text-7xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                The AI workspace that does the work.
              </h1>
              <p className={`mt-6 max-w-2xl text-lg leading-8 ${mutedClass}`}>
                Overlay brings chat, notes, projects, knowledge, and automations into one surface, with every major model and the context that compounds across your work.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={webAppHref}
                  className={
                    isDark
                      ? "inline-flex rounded-full bg-zinc-100 px-5 py-3 text-sm text-zinc-950"
                      : "inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm text-white"
                  }
                >
                  Start with Overlay
                </Link>
                <Link
                  href="/pricing"
                  className={`inline-flex rounded-full border px-5 py-3 text-sm ${secondaryButtonClass}`}
                >
                  See pricing
                </Link>
              </div>
            </div>

            <div className={`rounded-[24px] border p-6 ${panelClass}`}>
              <p className="text-sm font-medium">Why people switch</p>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-3xl tracking-tight">$8</p>
                  <p className={`mt-1 text-sm ${mutedClass}`}>Starting price, below the usual $20 AI subscriptions.</p>
                </div>
                <div>
                  <p className="text-3xl tracking-tight">All models</p>
                  <p className={`mt-1 text-sm ${mutedClass}`}>Model-agnostic by default, so your workflow is not locked to one lab.</p>
                </div>
                <div>
                  <p className="text-3xl tracking-tight">Open source</p>
                  <p className={`mt-1 text-sm ${mutedClass}`}>High trust, inspectable product, with context and automation built in.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`border-t px-6 py-16 md:px-8 ${dividerClass}`}>
          <div className="mx-auto max-w-6xl">
            <div className="max-w-xl">
              <p className={`text-sm uppercase tracking-[0.2em] ${subtleClass}`}>Core value</p>
              <h2 className="mt-4 text-3xl tracking-tight md:text-4xl">One workspace. Less switching.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {VALUE_POINTS.map((point) => (
                <article key={point.title} className={`rounded-[24px] border p-6 ${panelClass}`}>
                  <h3 className="text-xl tracking-tight">{point.title}</h3>
                  <p className={`mt-3 text-sm leading-7 ${mutedClass}`}>{point.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`border-t px-6 py-16 md:px-8 md:py-20 ${dividerClass}`}>
          <div className="mx-auto max-w-4xl text-center">
            <p className={`text-sm uppercase tracking-[0.2em] ${subtleClass}`}>Simple offer</p>
            <h2 className="mt-4 text-3xl tracking-tight md:text-5xl">Better models, better context, lower cost.</h2>
            <p className={`mx-auto mt-5 max-w-2xl text-base leading-7 ${mutedClass}`}>
              Overlay gives you one place to work, one place to store context, and one place to automate what should not need manual effort.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={webAppHref}
                className={
                  isDark
                    ? "inline-flex rounded-full bg-zinc-100 px-5 py-3 text-sm text-zinc-950"
                    : "inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm text-white"
                }
              >
                Open app
              </Link>
              <a
                href={MARKETING_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex rounded-full border px-5 py-3 text-sm ${secondaryButtonClass}`}
              >
                View source
              </a>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

export default function HomeLandingPage() {
  return (
    <LandingThemeProvider>
      <HomeLandingContent />
    </LandingThemeProvider>
  );
}
