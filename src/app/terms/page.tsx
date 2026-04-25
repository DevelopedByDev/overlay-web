"use client";

import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { StaticMarketingShell, useStaticMarketingTheme } from "@/components/marketing/StaticMarketingShell";
import { LandingThemeProvider } from "@/contexts/LandingThemeContext";

const TERMS = [
  {
    title: "Use Overlay responsibly",
    body: "Do not use Overlay to break the law, abuse other people, violate rights, distribute malware, spam, or try to disrupt the service.",
  },
  {
    title: "You own your work",
    body: "You keep ownership of the prompts, files, notes, chats, and outputs you create. You are responsible for what you upload, generate, share, or rely on.",
  },
  {
    title: "AI can be wrong",
    body: "Model outputs can be inaccurate, incomplete, biased, or unsafe for important decisions. Review outputs before using them, especially for legal, medical, financial, or other high-stakes work.",
  },
  {
    title: "Paid plans and billing",
    body: "Paid plans renew until canceled. You can manage billing from your account. Usage-based features may draw from your monthly budget or top-up balance.",
  },
  {
    title: "Third-party services",
    body: "Overlay connects to model providers, authentication, payments, hosting, and other services. Their terms may also apply when you use those parts of the product.",
  },
  {
    title: "Availability",
    body: "We work to keep Overlay reliable, but the service is provided as is and may change, pause, or fail. We are not liable for indirect damages or losses from using the service.",
  },
  {
    title: "Account access",
    body: "Keep your account secure. We may suspend access if we believe an account is unsafe, abusive, fraudulent, or violating these terms.",
  },
  {
    title: "Changes",
    body: "We may update these terms as the product changes. Continuing to use Overlay after an update means you accept the new terms.",
  },
];

function TermsContent() {
  const theme = useStaticMarketingTheme();

  return (
    <StaticMarketingShell>
      <main className="px-6 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className={`text-sm uppercase tracking-[0.2em] ${theme.subtleClass}`}>Legal</p>
          <h1 className="mt-4 text-4xl tracking-tight md:text-6xl" style={{ fontFamily: "var(--font-serif)" }}>
            Terms of service.
          </h1>
          <p className={`mt-5 text-base leading-7 ${theme.mutedClass}`}>Last updated: April 24, 2026</p>
          <p className={`mt-8 text-lg leading-8 ${theme.mutedClass}`}>
            These terms are the rules for using Overlay. The short version: use the product legally, keep your account secure, and review AI outputs before relying on them.
          </p>

          <div className={`mt-12 border-t ${theme.dividerClass}`}>
            {TERMS.map((section) => (
              <section key={section.title} className={`border-b py-8 ${theme.dividerClass}`}>
                <h2 className="text-2xl tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>
                  {section.title}
                </h2>
                <p className={`mt-3 text-base leading-7 ${theme.mutedClass}`}>{section.body}</p>
              </section>
            ))}
          </div>

          <p className={`mt-10 text-sm leading-6 ${theme.mutedClass}`}>
            Questions about these terms? Email{" "}
            <a href="mailto:divyansh@layernorm.co" className="underline underline-offset-4">
              divyansh@layernorm.co
            </a>
            . See also the{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </main>
      <MarketingFooter />
    </StaticMarketingShell>
  );
}

export default function TermsOfService() {
  return (
    <LandingThemeProvider>
      <TermsContent />
    </LandingThemeProvider>
  );
}

