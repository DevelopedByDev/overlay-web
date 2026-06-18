"use client";

import {
  Bot,
  Brain,
  Check,
  Code2,
  FileText,
  MessageSquare,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { AuthBoundary, useAuth } from "@/contexts/AuthContext";
import { LandingThemeProvider } from "@/contexts/LandingThemeContext";
import { MarketingButton } from "@/features/marketing/components/MarketingButton";
import { MarketingFooter } from "@/features/marketing/components/MarketingFooter";
import { StaticMarketingShell } from "@/features/marketing/components/StaticMarketingShell";
import {
  EditorialIntro,
  MarketingBand,
  MarketingCtaRow,
  PricingControlPreview,
  ProductWorkspaceDemo,
  ScreenshotFrame,
} from "@/features/marketing/components/MarketingShowcase";
import {
  marketingEyebrow,
  marketingHeroGrid,
  marketingHeadingLg,
  marketingIconChip,
  marketingSerifStyle,
} from "@/features/marketing/lib/marketingLayout";
import { MARKETING_GITHUB_URL, MARKETING_SALES_URL, getMarketingAppHref } from "@/shared/marketing/marketing";

const WORKFLOWS = [
  {
    icon: Search,
    title: "Research",
    body: "Search the web, inspect sources, compare models, and keep the source trail attached to the final brief.",
  },
  {
    icon: Sparkles,
    title: "Create",
    body: "Draft text, generate assets, and preserve the creative brief across writing, image, and video work.",
  },
  {
    icon: Workflow,
    title: "Automate",
    body: "Turn recurring browser tasks, research loops, and operational follow-ups into saved workflows.",
  },
  {
    icon: ShieldCheck,
    title: "Govern",
    body: "Move AI work from personal accounts into a private, auditable workspace your team controls.",
  },
];

const PRIMITIVES = [
  { icon: MessageSquare, label: "Chat", detail: "GPT, Claude, Gemini, Grok, and more." },
  { icon: FileText, label: "Files", detail: "Reference docs, code, images, and video." },
  { icon: Brain, label: "Memory", detail: "Useful context compounds across work." },
  { icon: Bot, label: "Tools", detail: "Browser tasks, sandboxes, search, generation." },
  { icon: Plug, label: "Connectors", detail: "Use approved apps and custom MCPs." },
  { icon: Code2, label: "Open source", detail: "Inspect, extend, self-host, and adapt." },
];

const HERO_BULLETS = ["Self-hostable", "Model choice", "Usage-based AI"];

function HomeLandingContent() {
  const { isAuthenticated } = useAuth();
  const webAppHref = getMarketingAppHref(isAuthenticated);

  return (
    <StaticMarketingShell>
      <main className="flex-1">
        {/* Hero */}
        <section className="px-5 py-16 md:px-8 md:py-24">
          <div className={marketingHeroGrid()}>
            <div>
              <EditorialIntro
                title={
                  <>
                    Your AI workspace.
                    <br />
                    On your terms.
                  </>
                }
                body="One workspace for models, files, memory, tools, and automations. Private by default. Open source. Yours to extend."
              />
              <MarketingCtaRow>
                <MarketingButton href={webAppHref} variant="primary" arrow="right">
                  Open app
                </MarketingButton>
                <MarketingButton href={MARKETING_SALES_URL} external variant="secondary" arrow="up-right">
                  Contact sales
                </MarketingButton>
              </MarketingCtaRow>
              <div className="mt-8 grid gap-3 text-xs text-[var(--muted)] sm:grid-cols-3">
                {HERO_BULLETS.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)]">
                      <Check className="h-2.5 w-2.5" strokeWidth={2.2} />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <ProductWorkspaceDemo />
          </div>
        </section>

        {/* Product primitives */}
        <MarketingBand id="product">
          <div className="grid gap-10 lg:grid-cols-[0.45fr_1fr] lg:items-start">
            <div>
              <p className={marketingEyebrow()}>Product</p>
              <h2 className={`mt-4 ${marketingHeadingLg()}`} style={marketingSerifStyle()}>
                The primitives of AI-native work, in one surface.
              </h2>
              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
                Overlay is not another isolated chat box. It is the control surface between people, models, files,
                tools, connectors, and recurring work.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-2 xl:grid-cols-3">
              {PRIMITIVES.map((item) => (
                <article key={item.label} className="bg-[var(--surface-elevated)] p-5">
                  <item.icon className="h-5 w-5" strokeWidth={1.7} />
                  <h3 className="mt-5 text-sm font-medium">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </MarketingBand>

        {/* Workflows */}
        <MarketingBand>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <ProductWorkspaceDemo tone="dark" compact title="Work keeps moving." />
            <div>
              <p className={marketingEyebrow()}>Workflows</p>
              <h2 className={`mt-4 ${marketingHeadingLg()}`} style={marketingSerifStyle()}>
                From prompt to outcome without resetting context.
              </h2>
              <div className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {WORKFLOWS.map((workflow) => (
                  <article key={workflow.title} className="grid gap-4 py-5 sm:grid-cols-[44px_1fr]">
                    <span className={marketingIconChip()}>
                      <workflow.icon className="h-5 w-5" strokeWidth={1.7} />
                    </span>
                    <div>
                      <h3 className="text-base font-medium">{workflow.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{workflow.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </MarketingBand>

        {/* Screenshots */}
        <MarketingBand>
          <div className="grid gap-5 lg:grid-cols-2">
            <ScreenshotFrame
              src="/assets/images/overlay-model-routing.png"
              alt="Overlay model picker with selected models"
              label="Model routing"
            />
            <ScreenshotFrame
              src="/assets/images/overlay-connectors.png"
              alt="Overlay connect your tools modal"
              label="Connectors"
            />
          </div>
        </MarketingBand>

        {/* Pricing */}
        <MarketingBand>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className={marketingEyebrow()}>Pricing</p>
              <h2 className={`mt-4 ${marketingHeadingLg()}`} style={marketingSerifStyle()}>
                Pay for the platform and the AI you actually use.
              </h2>
              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
                Start free, upgrade when premium models and agents matter, and move enterprise usage into a private
                deployment when governance becomes the priority.
              </p>
              <MarketingCtaRow>
                <MarketingButton href="/pricing" variant="primary" arrow="right">
                  View pricing
                </MarketingButton>
                <MarketingButton href={MARKETING_GITHUB_URL} external variant="secondary" arrow="up-right">
                  View source
                </MarketingButton>
              </MarketingCtaRow>
            </div>
            <PricingControlPreview amount="$24" />
          </div>
        </MarketingBand>

        {/* Closing CTA */}
        <MarketingBand>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className={marketingHeadingLg()} style={marketingSerifStyle()}>
              Start with the free tier.
              <br />
              Upgrade when the work demands it.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-[var(--muted)] md:text-lg">
              No per-seat subscriptions. No vendor lock-in. Pay for platform access and the AI you actually use.
            </p>
            <MarketingCtaRow className="justify-center">
              <MarketingButton href={webAppHref} variant="primary" arrow="right">
                Open app
              </MarketingButton>
              <MarketingButton href="/pricing" variant="secondary" arrow="right">
                View pricing
              </MarketingButton>
            </MarketingCtaRow>
          </div>
        </MarketingBand>
      </main>
      <MarketingFooter />
    </StaticMarketingShell>
  );
}

export default function HomeLandingPage() {
  return (
    <AuthBoundary>
      <LandingThemeProvider>
        <HomeLandingContent />
      </LandingThemeProvider>
    </AuthBoundary>
  );
}
