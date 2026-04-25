"use client";

import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { StaticMarketingShell, useStaticMarketingTheme } from "@/components/marketing/StaticMarketingShell";
import { LandingThemeProvider } from "@/contexts/LandingThemeContext";

const BELIEFS = [
  {
    title: "AI needs an interface layer",
    body: "The best models change constantly. People should not rebuild their workflow every time the leaderboard moves.",
  },
  {
    title: "Context should compound",
    body: "Notes, files, projects, tools, and memory should live together so each session starts with the work already in place.",
  },
  {
    title: "Open wins",
    body: "The most important software platforms become standards when people can inspect them, extend them, and build on them.",
  },
  {
    title: "The aggregator should be user-aligned",
    body: "Overlay is not trying to trap you in one model, one provider, or one workflow. It is a surface for choosing the best tool for the job.",
  },
];

function ManifestoContent() {
  const theme = useStaticMarketingTheme();

  return (
    <StaticMarketingShell>
      <main className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-4xl">
          <p className={`text-sm uppercase tracking-[0.2em] ${theme.subtleClass}`}>Manifesto</p>
          <h1 className="mt-4 max-w-[12ch] text-5xl leading-[0.95] tracking-tight md:text-7xl" style={{ fontFamily: "var(--font-serif)" }}>
            The open AI workspace.
          </h1>
          <p className={`mt-8 max-w-2xl text-lg leading-8 ${theme.mutedClass}`}>
            Overlay exists because AI is too important to live inside closed, isolated products. The interface closest to the human should be open, extensible, and built around real work.
          </p>

          <div className={`mt-14 grid gap-4 md:grid-cols-2`}>
            {BELIEFS.map((belief) => (
              <article key={belief.title} className={`rounded-[24px] border p-6 ${theme.panelClass}`}>
                <h2 className="text-2xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                  {belief.title}
                </h2>
                <p className={`mt-4 text-sm leading-7 ${theme.mutedClass}`}>{belief.body}</p>
              </article>
            ))}
          </div>

          <section className={`mt-16 border-t pt-10 ${theme.dividerClass}`}>
            <h2 className="text-3xl tracking-tight md:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
              One surface for everything AI.
            </h2>
            <p className={`mt-5 max-w-2xl text-base leading-7 ${theme.mutedClass}`}>
              Text, images, video, agents, automations, apps, files, memory, and integrations should meet in one place. Use it, build on it, contribute, and tell us what is broken.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/pricing" className={`inline-flex rounded-full border px-5 py-3 text-sm ${theme.secondaryButtonClass}`}>
                See pricing
              </Link>
              <a
                href="https://github.com/DevelopedByDev/overlay-web"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex rounded-full border px-5 py-3 text-sm ${theme.secondaryButtonClass}`}
              >
                View source
              </a>
            </div>
          </section>
        </div>
      </main>
      <MarketingFooter />
    </StaticMarketingShell>
  );
}

export default function ManifestoPage() {
  return (
    <LandingThemeProvider>
      <ManifestoContent />
    </LandingThemeProvider>
  );
}

