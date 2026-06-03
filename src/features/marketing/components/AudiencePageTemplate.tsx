"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { LandingThemeProvider } from "@/contexts/LandingThemeContext";
import { MarketingFooter } from "@/features/marketing/components/MarketingFooter";
import { StaticMarketingShell } from "@/features/marketing/components/StaticMarketingShell";
import {
  AudienceWorkflowDemo,
  CheckList,
  EditorialIntro,
  MarketingBand,
  MarketingCtaRow,
} from "@/features/marketing/components/MarketingShowcase";
import type { AudiencePageKey } from "@/shared/marketing/marketing";

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
  audience: AudiencePageKey;
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
  const className = primary
    ? "inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--button-primary-bg)] px-5 text-sm font-medium text-[var(--button-primary-text)] transition-opacity hover:opacity-90"
    : "inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] px-5 text-sm font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--surface-muted)]";

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
  audience,
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
  return (
    <StaticMarketingShell>
      <main>
        <section className="px-5 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
            <div>
              <EditorialIntro label={eyebrow} title={title} body={description} />
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">{support}</p>
              <MarketingCtaRow>
                <MarketingLink cta={primaryCta} primary />
                <MarketingLink cta={secondaryCta} />
              </MarketingCtaRow>
            </div>
            <div>
              <AudienceWorkflowDemo audience={audience} />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {demoColumns.map((column) => (
                  <div key={column.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-light)]">{column.label}</p>
                    <p className="mt-2 text-xl tracking-tight">{column.value}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{column.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <MarketingBand>
          <div className="grid gap-10 lg:grid-cols-[0.45fr_1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted-light)]">Key workflows</p>
              <h2 className="mt-4 text-3xl tracking-tight md:text-5xl">Built for work that compounds.</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{demoTitle}</p>
            </div>
            <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {features.map((feature) => (
                <article key={feature.title} className="grid gap-4 py-6 md:grid-cols-[180px_1fr]">
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-light)]">{feature.meta}</p>
                  <div>
                    <h3 className="text-xl tracking-tight">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{feature.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </MarketingBand>

        <MarketingBand>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <AudienceWorkflowDemo audience={audience} tone="dark" />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted-light)]">Proof</p>
              <h2 className="mt-4 text-3xl tracking-tight md:text-5xl">One private layer, many roles.</h2>
              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{demoBody}</p>
              <div className="mt-8">
                <CheckList items={proofItems} />
              </div>
              <MarketingCtaRow>
                <MarketingLink cta={primaryCta} primary />
                <MarketingLink cta={secondaryCta} />
              </MarketingCtaRow>
            </div>
          </div>
        </MarketingBand>
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
