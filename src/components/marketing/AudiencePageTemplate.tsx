"use client";

import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";
import { LandingThemeProvider } from "@/contexts/LandingThemeContext";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { StaticMarketingShell, useStaticMarketingTheme } from "@/components/marketing/StaticMarketingShell";

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

function MarketingLink({ cta, primary }: { cta: AudienceCta; primary?: boolean }) {
  const theme = useStaticMarketingTheme();
  const className = primary
    ? `inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm ${theme.primaryButtonClass}`
    : `inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm ${theme.secondaryButtonClass}`;

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
  const theme = useStaticMarketingTheme();

  return (
    <StaticMarketingShell>
      <main>
        <section className="px-6 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.05fr)_380px] lg:items-end">
            <div className="max-w-3xl">
              <p className={`text-sm uppercase tracking-[0.2em] ${theme.subtleClass}`}>{eyebrow}</p>
              <h1 className="mt-6 max-w-[12ch] text-5xl leading-[0.95] tracking-tight md:text-7xl" style={{ fontFamily: "var(--font-serif)" }}>
                {title}
              </h1>
              <p className={`mt-6 max-w-2xl text-lg leading-8 ${theme.mutedClass}`}>{description}</p>
              <p className={`mt-4 max-w-2xl text-base leading-7 ${theme.mutedClass}`}>{support}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <MarketingLink cta={primaryCta} primary />
                <MarketingLink cta={secondaryCta} />
              </div>
            </div>

            <aside className={`rounded-[24px] border p-6 ${theme.panelClass}`}>
              <p className="text-sm font-medium">{demoTitle}</p>
              <p className={`mt-3 text-sm leading-7 ${theme.mutedClass}`}>{demoBody}</p>
              <div className="mt-6 space-y-4">
                {demoColumns.map((column) => (
                  <div key={column.label}>
                    <p className={`text-xs uppercase tracking-[0.18em] ${theme.subtleClass}`}>{column.label}</p>
                    <p className="mt-1 text-2xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                      {column.value}
                    </p>
                    <p className={`mt-1 text-sm leading-6 ${theme.mutedClass}`}>{column.detail}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className={`border-t px-6 py-16 md:px-8 ${theme.dividerClass}`}>
          <div className="mx-auto max-w-6xl">
            <div className="max-w-xl">
              <p className={`text-sm uppercase tracking-[0.2em] ${theme.subtleClass}`}>Key workflows</p>
              <h2 className="mt-4 text-3xl tracking-tight md:text-4xl">Built for work that compounds.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className={`rounded-[24px] border p-6 ${theme.panelClass}`}>
                  <p className={`text-xs uppercase tracking-[0.18em] ${theme.subtleClass}`}>{feature.meta}</p>
                  <h3 className="mt-4 text-xl tracking-tight">{feature.title}</h3>
                  <p className={`mt-3 text-sm leading-7 ${theme.mutedClass}`}>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`border-t px-6 py-16 md:px-8 md:py-20 ${theme.dividerClass}`}>
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-4 md:grid-cols-2">
              {proofItems.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${theme.dividerClass}`}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <p className={`text-sm leading-6 ${theme.mutedClass}`}>{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              <MarketingLink cta={primaryCta} primary />
              <MarketingLink cta={secondaryCta} />
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </StaticMarketingShell>
  );
}

export function AudiencePageTemplate(props: AudiencePageTemplateProps) {
  return (
    <LandingThemeProvider>
      <AudiencePageInner {...props} />
    </LandingThemeProvider>
  );
}

