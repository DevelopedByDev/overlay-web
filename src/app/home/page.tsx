"use client";

import Link from "next/link";
import {
  Bot,
  Brain,
  Cpu,
  FolderOpen,
  GitBranch,
  Layers,
  Lock,
  MessageSquare,
  Plug,
  Repeat,
  Scale,
  Shield,
  Sparkles,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { MarketingFooter } from "@/features/marketing/components/MarketingFooter";
import { StaticMarketingShell, useStaticMarketingTheme } from "@/features/marketing/components/StaticMarketingShell";
import { useAuth } from "@/contexts/AuthContext";
import { LandingThemeProvider } from "@/contexts/LandingThemeContext";
import { MARKETING_GITHUB_URL, getMarketingAppHref } from "@/shared/marketing/marketing";

const PLATFORM_PRIMITIVES = [
  {
    icon: MessageSquare,
    title: "Chat",
    description: "One interface for GPT, Claude, Gemini, Grok, and more. Pick the right model for every task.",
  },
  {
    icon: Wrench,
    title: "Tools",
    description: "Web search, deep research, image and video generation, browser automation, and code sandboxes.",
  },
  {
    icon: FolderOpen,
    title: "Files",
    description: "Upload, reference, and reason over documents, code, images, and videos in context.",
  },
  {
    icon: Brain,
    title: "Memory",
    description: "Preserve useful context across conversations and workflows. Your knowledge compounds.",
  },
  {
    icon: Repeat,
    title: "Automations",
    description: "Save repeatable workflows for you and your team. Let the machine handle the routine.",
  },
  {
    icon: Plug,
    title: "Connectors",
    description: "Pre-built integrations to the tools you already use. No context switching required.",
  },
  {
    icon: Cpu,
    title: "MCPs",
    description: "Build custom tools and connectors for workflows specific to your domain.",
  },
  {
    icon: GitBranch,
    title: "Open Source",
    description: "Auditable, extensible, and adaptable to your needs. Own your infrastructure.",
  },
];

const USE_CASES = [
  {
    href: "/use-cases/business",
    label: "For Business",
    description: "Research, analysis, strategy, and operations at the speed of thought.",
    icon: Scale,
  },
  {
    href: "/use-cases/content",
    label: "For Content",
    description: "Writing, images, video, and publishing workflows that scale.",
    icon: Sparkles,
  },
  {
    href: "/use-cases/developers",
    label: "For Developers",
    description: "Code, debug, review, and ship with agents that understand your codebase.",
    icon: Zap,
  },
  {
    href: "/use-cases/education",
    label: "For Education",
    description: "Curriculum, assessment, tutoring, and governance for schools and universities.",
    icon: Layers,
  },
];

const ADVANTAGES = [
  {
    icon: Lock,
    title: "No vendor lock-in",
    description: "Choose models, providers, deployment style, and integrations. Your data, your rules.",
  },
  {
    icon: Wrench,
    title: "Fully customizable",
    description: "Shape the workspace around your team, not generic SaaS defaults. Add or remove features as you need.",
  },
  {
    icon: Cpu,
    title: "Fully extensible",
    description: "New tools, MCPs, connectors, and dashboards can be built as your needs evolve.",
  },
  {
    icon: Shield,
    title: "On-prem or private",
    description: "Maximum privacy and full control of data flow. Deploy on your own infrastructure.",
  },
  {
    icon: Bot,
    title: "Better governance",
    description: "Move AI use from unmanaged consumer accounts into a team-controlled, auditable system.",
  },
  {
    icon: Wallet,
    title: "Cost savings",
    description: "Pay for the platform, not per-seat model subscriptions. Only pay for the AI usage you actually consume.",
  },
];

function HomeLandingContent() {
  const { isAuthenticated } = useAuth();
  const theme = useStaticMarketingTheme();
  const webAppHref = getMarketingAppHref(isAuthenticated);

  return (
    <StaticMarketingShell>
      <main className="flex-1">
        {/* Hero */}
        <section className="px-6 py-24 md:px-8 md:py-32">
          <div className="mx-auto max-w-5xl text-center">
            <p className={`text-sm font-medium uppercase tracking-[0.15em] ${theme.subtleClass}`}>
              The AI-native workspace
            </p>
            <h1
              className="mt-6 text-4xl leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              One place to think,
              <br />
              create, and ship.
            </h1>
            <p className={`mx-auto mt-6 max-w-2xl text-lg leading-8 md:text-xl ${theme.mutedClass}`}>
              Overlay brings chat, files, memory, and automations into one surface. Use every major AI model with the
              context that compounds across your work.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                href={webAppHref}
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium ${theme.primaryButtonClass}`}
              >
                Start with Overlay
              </Link>
              <Link
                href="/pricing"
                className={`inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-medium ${theme.secondaryButtonClass}`}
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Platform Primitives */}
        <section className={`border-t px-6 py-20 md:px-8 md:py-24 ${theme.dividerClass}`}>
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className={`text-sm font-medium uppercase tracking-[0.15em] ${theme.subtleClass}`}>Platform</p>
              <h2
                className="mt-4 text-3xl tracking-tight md:text-4xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Primitives for AI-native work
              </h2>
              <p className={`mt-4 text-base leading-7 ${theme.mutedClass}`}>
                Everything you need to build, iterate, and ship — in one open-source workspace.
              </p>
            </div>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLATFORM_PRIMITIVES.map((item) => (
                <div
                  key={item.title}
                  className={`group rounded-2xl border p-6 transition-colors hover:bg-[var(--surface-muted)] ${theme.panelClass}`}
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--foreground)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{item.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${theme.mutedClass}`}>{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className={`border-t px-6 py-20 md:px-8 md:py-24 ${theme.dividerClass}`}>
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className={`text-sm font-medium uppercase tracking-[0.15em] ${theme.subtleClass}`}>Use cases</p>
              <h2
                className="mt-4 text-3xl tracking-tight md:text-4xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Built for how you work
              </h2>
              <p className={`mt-4 text-base leading-7 ${theme.mutedClass}`}>
                Overlay adapts to your domain, not the other way around.
              </p>
            </div>
            <div className="mt-14 grid gap-4 md:grid-cols-2">
              {USE_CASES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-start gap-5 rounded-2xl border p-6 transition-colors hover:bg-[var(--surface-muted)] ${theme.panelClass}`}
                >
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--foreground)] transition-colors group-hover:bg-[var(--surface-subtle)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">{item.label}</h3>
                    <p className={`mt-1 text-sm leading-relaxed ${theme.mutedClass}`}>{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* The Overlay Advantage */}
        <section className={`border-t px-6 py-20 md:px-8 md:py-24 ${theme.dividerClass}`}>
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className={`text-sm font-medium uppercase tracking-[0.15em] ${theme.subtleClass}`}>Why Overlay</p>
              <h2
                className="mt-4 text-3xl tracking-tight md:text-4xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                The Overlay advantage
              </h2>
              <p className={`mt-4 text-base leading-7 ${theme.mutedClass}`}>
                Shift from fragmented subscriptions to a single, open-source platform you control.
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {ADVANTAGES.map((item) => (
                <div key={item.title} className="flex flex-col">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--foreground)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{item.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${theme.mutedClass}`}>{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing CTA */}
        <section className={`border-t px-6 py-20 md:px-8 md:py-24 ${theme.dividerClass}`}>
          <div className="mx-auto max-w-4xl text-center">
            <p className={`text-sm font-medium uppercase tracking-[0.15em] ${theme.subtleClass}`}>Pricing</p>
            <h2
              className="mt-4 text-3xl tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Better models, better context, lower cost.
            </h2>
            <p className={`mx-auto mt-5 max-w-2xl text-base leading-7 ${theme.mutedClass}`}>
              Starts at $8 per month. You get model choice, memory, connectors, and automations in an open-source
              product you can inspect, extend, and deploy on-prem.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                href="/pricing"
                className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium ${theme.primaryButtonClass}`}
              >
                View plans
              </Link>
              <a
                href={MARKETING_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-medium ${theme.secondaryButtonClass}`}
              >
                View source
              </a>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </StaticMarketingShell>
  );
}

export default function HomeLandingPage() {
  return (
    <LandingThemeProvider>
      <HomeLandingContent />
    </LandingThemeProvider>
  );
}
