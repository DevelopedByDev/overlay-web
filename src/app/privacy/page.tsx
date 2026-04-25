"use client";

import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { StaticMarketingShell, useStaticMarketingTheme } from "@/components/marketing/StaticMarketingShell";
import { LandingThemeProvider } from "@/contexts/LandingThemeContext";

const PRIVACY = [
  {
    title: "What we collect",
    body: "We collect account information, authentication data, billing records, product events, diagnostics, and the content you choose to store or process through Overlay.",
  },
  {
    title: "How we use it",
    body: "We use data to run the product, authenticate you, process billing, sync your workspace, improve reliability, prevent abuse, and respond to support requests.",
  },
  {
    title: "AI providers",
    body: "When you use model-powered features, relevant prompts, files, and context may be sent to model providers so they can return a result. We route only what is needed for the request.",
  },
  {
    title: "Payments",
    body: "Payments are handled by Stripe. We do not store full card numbers. We keep billing status and transaction records needed to manage your account.",
  },
  {
    title: "We do not sell your data",
    body: "We do not sell personal information. We share data only with service providers, when you connect integrations, when required by law, or to protect Overlay and its users.",
  },
  {
    title: "Security",
    body: "We use reasonable safeguards for data in transit and at rest. No system is perfect, so keep your account credentials secure and tell us if something looks wrong.",
  },
  {
    title: "Your choices",
    body: "You can manage your account, disconnect integrations, request deletion, or contact us about access and correction requests.",
  },
  {
    title: "Retention",
    body: "We keep data while your account is active and as needed for product, security, billing, support, and legal reasons. Deletion requests are handled as quickly as practical.",
  },
];

function PrivacyContent() {
  const theme = useStaticMarketingTheme();

  return (
    <StaticMarketingShell>
      <main className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className={`text-sm uppercase tracking-[0.2em] ${theme.subtleClass}`}>Privacy</p>
          <h1 className="mt-4 text-4xl tracking-tight md:text-6xl" style={{ fontFamily: "var(--font-serif)" }}>
            Privacy policy.
          </h1>
          <p className={`mt-5 text-base leading-7 ${theme.mutedClass}`}>Last updated: April 24, 2026</p>
          <p className={`mt-8 text-lg leading-8 ${theme.mutedClass}`}>
            Overlay is a workspace for real work, so privacy needs to be understandable. This page explains what we collect and why.
          </p>

          <div className={`mt-12 border-t ${theme.dividerClass}`}>
            {PRIVACY.map((section) => (
              <section key={section.title} className={`border-b py-8 ${theme.dividerClass}`}>
                <h2 className="text-2xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                  {section.title}
                </h2>
                <p className={`mt-3 text-base leading-7 ${theme.mutedClass}`}>{section.body}</p>
              </section>
            ))}
          </div>

          <p className={`mt-10 text-sm leading-6 ${theme.mutedClass}`}>
            Privacy questions or deletion requests:{" "}
            <a href="mailto:divyansh@layernorm.co" className="underline underline-offset-4">
              divyansh@layernorm.co
            </a>
            . See also the{" "}
            <Link href="/terms" className="underline underline-offset-4">
              terms of service
            </Link>
            .
          </p>
        </div>
      </main>
      <MarketingFooter />
    </StaticMarketingShell>
  );
}

export default function PrivacyPolicy() {
  return (
    <LandingThemeProvider>
      <PrivacyContent />
    </LandingThemeProvider>
  );
}

