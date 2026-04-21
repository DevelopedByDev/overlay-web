"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";
import { LandingThemeProvider, useLandingTheme } from "@/contexts/LandingThemeContext";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageNavbar } from "@/components/PageNavbar";

type AudienceFeature = {
  title: string;
  body: string;
  meta: string;
};

type AudienceDemoColumn = {
  label: string;
  value: string;
  detail: string;
};

type AudienceCta = {
  label: string;
  href: string;
  external?: boolean;
};

type AudiencePageTemplateProps = {
  eyebrow: string;
  title: string;
  description: string;
  support: string;
  features: AudienceFeature[];
  demoTitle: string;
  demoBody: string;
  demoColumns: AudienceDemoColumn[];
  proofItems: string[];
  primaryCta: AudienceCta;
  secondaryCta: AudienceCta;
};

const fadeInUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function MarketingLink({
  cta,
  primary,
  isDark,
}: {
  cta: AudienceCta;
  primary?: boolean;
  isDark: boolean;
}) {
  const className = primary
    ? isDark
      ? "inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-3 text-sm text-zinc-950 transition-colors hover:bg-white"
      : "inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm text-white transition-colors hover:bg-zinc-800"
    : isDark
      ? "inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-zinc-100 transition-colors hover:bg-white/5"
      : "inline-flex items-center gap-2 rounded-full border border-black/8 px-5 py-3 text-sm text-zinc-950 transition-colors hover:bg-black/[0.03]";

  if (cta.external) {
    return (
      <a href={cta.href} target="_blank" rel="noopener noreferrer" className={className}>
        <span>{cta.label}</span>
        <ArrowUpRight className="h-4 w-4" />
      </a>
    );
  }

  return (
    <Link href={cta.href} className={className}>
      {cta.label}
    </Link>
  );
}

function AudiencePageInner({
  eyebrow,
  title,
  description,
  support,
  features,
  demoTitle,
  demoBody,
  demoColumns,
  proofItems,
  primaryCta,
  secondaryCta,
}: AudiencePageTemplateProps) {
  const { isLandingDark } = useLandingTheme();
  const muted = isLandingDark ? "text-zinc-400" : "text-zinc-600";
  const heading = isLandingDark ? "text-zinc-100" : "text-zinc-950";
  const subtleBorder = isLandingDark ? "border-white/10" : "border-black/8";
  const subtleSurface = isLandingDark ? "bg-white/[0.03]" : "bg-black/[0.02]";
  const elevatedSurface = isLandingDark ? "bg-[#0e0e11]/88" : "bg-white/86";

  return (
    <div className="gradient-bg">
      <div className="liquid-glass" />
      <PageNavbar />
      <main className="relative z-10 flex flex-col">
        <section className="px-6 pb-20 pt-32 md:px-8 md:pb-28 md:pt-36">
          <div className="mx-auto grid min-h-[calc(100svh-7rem)] max-w-7xl items-end gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
            <motion.div {...fadeInUp} className="max-w-2xl">
              <p className={`mb-4 text-sm uppercase tracking-[0.24em] ${muted}`}>{eyebrow}</p>
              <h1 className={`max-w-[12ch] text-5xl leading-[0.96] tracking-tight md:text-7xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
                {title}
              </h1>
              <p className={`mt-6 max-w-xl text-base leading-7 md:text-lg ${muted}`}>{description}</p>
              <p className={`mt-4 max-w-lg text-sm leading-6 md:text-base ${muted}`}>{support}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <MarketingLink cta={primaryCta} primary isDark={isLandingDark} />
                <MarketingLink cta={secondaryCta} isDark={isLandingDark} />
              </div>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ ...fadeInUp.transition, delay: 0.08 }} className="w-full">
              <div className={`overflow-hidden rounded-[32px] border ${subtleBorder} ${elevatedSurface} backdrop-blur-xl`}>
                <div className={`border-b px-6 py-5 ${subtleBorder}`}>
                  <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Workflow preview</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {demoColumns.map((column) => (
                      <div key={column.label} className={`rounded-[24px] border px-4 py-4 ${subtleBorder} ${subtleSurface}`}>
                        <p className={`text-xs uppercase tracking-[0.18em] ${muted}`}>{column.label}</p>
                        <p className={`mt-4 text-2xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
                          {column.value}
                        </p>
                        <p className={`mt-2 text-sm leading-6 ${muted}`}>{column.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-8 px-6 py-6 md:grid-cols-[minmax(0,0.92fr)_minmax(200px,0.7fr)]">
                  <div>
                    <p className={`text-sm uppercase tracking-[0.22em] ${muted}`}>Product surface</p>
                    <h2 className={`mt-4 text-3xl tracking-tight ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
                      {demoTitle}
                    </h2>
                    <p className={`mt-4 max-w-lg text-sm leading-6 ${muted}`}>{demoBody}</p>
                  </div>
                  <div className={`rounded-[28px] border p-5 ${subtleBorder} ${subtleSurface}`}>
                    <div className="space-y-4">
                      {proofItems.map((item) => (
                        <div key={item} className="flex items-start gap-3">
                          <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border ${subtleBorder}`}>
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <p className={`text-sm leading-6 ${muted}`}>{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <motion.section {...fadeInUp} className="px-6 py-20 md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Key workflows</p>
              <h2 className={`mt-5 text-4xl tracking-tight md:text-5xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
                Built for the work that actually compounds.
              </h2>
            </div>
            <div className={`mt-12 grid gap-6 border-t pt-8 md:grid-cols-3 ${subtleBorder}`}>
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.42, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>{feature.meta}</p>
                  <h3 className={`mt-4 text-2xl tracking-tight ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
                    {feature.title}
                  </h3>
                  <p className={`mt-4 max-w-sm text-sm leading-6 ${muted}`}>{feature.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section {...fadeInUp} className="px-6 pb-24 pt-12 md:px-8">
          <div className={`mx-auto max-w-7xl border-t pt-10 ${subtleBorder}`}>
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Next step</p>
                <h2 className={`mt-4 text-4xl tracking-tight md:text-5xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
                  Use Overlay with your real context, not a blank prompt box.
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <MarketingLink cta={primaryCta} primary isDark={isLandingDark} />
                <MarketingLink cta={secondaryCta} isDark={isLandingDark} />
              </div>
            </div>
          </div>
        </motion.section>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function AudiencePageTemplate(props: AudiencePageTemplateProps) {
  return (
    <LandingThemeProvider>
      <AudiencePageInner {...props} />
    </LandingThemeProvider>
  );
}
