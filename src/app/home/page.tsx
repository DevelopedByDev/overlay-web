"use client";

import { AudienceShowcase } from "@/components/landing/AudienceShowcase";
import { AgentsPipeline } from "@/components/landing/AgentsPipeline";
import { ClosingCTA } from "@/components/landing/ClosingCTA";
import { ContextHub } from "@/components/landing/ContextHub";
import { CreationBento } from "@/components/landing/CreationBento";
import { ExtensionsStrip } from "@/components/landing/ExtensionsStrip";
import { HeroSection } from "@/components/landing/HeroSection";
import { ModelsShowcase } from "@/components/landing/ModelsShowcase";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PageNavbar } from "@/components/PageNavbar";
import { useLandingTheme, LandingThemeProvider } from "@/contexts/LandingThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { getMarketingAppHref } from "@/lib/marketing";

function HomeLandingContent() {
  const { landingTheme } = useLandingTheme();
  const { isAuthenticated } = useAuth();
  const webAppHref = getMarketingAppHref(isAuthenticated);

  return (
    <div className="gradient-bg">
      <PageNavbar />
      <main className="relative z-10 flex flex-col">
        <HeroSection theme={landingTheme} webAppHref={webAppHref} />
        <ExtensionsStrip theme={landingTheme} />
        <ContextHub theme={landingTheme} />
        <ModelsShowcase theme={landingTheme} />
        <AgentsPipeline theme={landingTheme} />
        <CreationBento theme={landingTheme} />
        <AudienceShowcase theme={landingTheme} />
        <ClosingCTA theme={landingTheme} webAppHref={webAppHref} />
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
