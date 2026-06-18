"use client";

import { LandingThemeProvider } from "@/contexts/LandingThemeContext";
import { MarketingButton } from "@/features/marketing/components/MarketingButton";
import { MarketingFooter } from "@/features/marketing/components/MarketingFooter";
import { StaticMarketingShell } from "@/features/marketing/components/StaticMarketingShell";
import {
  AudienceWorkflowDemo,
  CheckList,
  EditorialIntro,
  MarketingBand,
  MarketingCtaRow,
} from "@/features/marketing/components/MarketingShowcase";
import {
  marketingEyebrow,
  marketingHeadingLg,
  marketingHeroGrid,
  marketingSerifStyle,
} from "@/features/marketing/lib/marketingLayout";
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
        {/* Hero */}
        <section className="px-5 py-16 md:px-8 md:py-24">
          <div className={marketingHeroGrid()}>
            <div>
              <EditorialIntro label={eyebrow} title={title} body={description} />
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">{support}</p>
              <MarketingCtaRow>
                <MarketingButton
                  href={primaryCta.href}
                  external={primaryCta.external}
                  variant="primary"
                  arrow={primaryCta.external ? "up-right" : "right"}
                >
                  {primaryCta.label}
                </MarketingButton>
                <MarketingButton
                  href={secondaryCta.href}
                  external={secondaryCta.external}
                  variant="secondary"
                  arrow={secondaryCta.external ? "up-right" : "right"}
                >
                  {secondaryCta.label}
                </MarketingButton>
              </MarketingCtaRow>
            </div>
            <div>
              <AudienceWorkflowDemo audience={audience} />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {demoColumns.map((column) => (
                  <div
                    key={column.label}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-light)]">{column.label}</p>
                    <p className="mt-2 text-xl tracking-tight">{column.value}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{column.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Key workflows */}
        <MarketingBand>
          <div className="grid gap-10 lg:grid-cols-[0.45fr_1fr]">
            <div>
              <p className={marketingEyebrow()}>Key workflows</p>
              <h2 className={`mt-4 ${marketingHeadingLg()}`} style={marketingSerifStyle()}>
                Built for work that compounds.
              </h2>
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

        {/* Proof */}
        <MarketingBand>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <AudienceWorkflowDemo audience={audience} tone="dark" />
            <div>
              <p className={marketingEyebrow()}>Proof</p>
              <h2 className={`mt-4 ${marketingHeadingLg()}`} style={marketingSerifStyle()}>
                One private layer, many roles.
              </h2>
              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{demoBody}</p>
              <div className="mt-8">
                <CheckList items={proofItems} />
              </div>
              <MarketingCtaRow>
                <MarketingButton
                  href={primaryCta.href}
                  external={primaryCta.external}
                  variant="primary"
                  arrow={primaryCta.external ? "up-right" : "right"}
                >
                  {primaryCta.label}
                </MarketingButton>
                <MarketingButton
                  href={secondaryCta.href}
                  external={secondaryCta.external}
                  variant="secondary"
                  arrow={secondaryCta.external ? "up-right" : "right"}
                >
                  {secondaryCta.label}
                </MarketingButton>
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
