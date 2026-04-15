"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AgentsPipeline } from "@/components/landing/AgentsPipeline";
import { ClosingCTA } from "@/components/landing/ClosingCTA";
import { ContextHub } from "@/components/landing/ContextHub";
import { CreationBento } from "@/components/landing/CreationBento";
import { ExtensionsStrip } from "@/components/landing/ExtensionsStrip";
import { HeroSection } from "@/components/landing/HeroSection";
import { ModelsShowcase } from "@/components/landing/ModelsShowcase";

export default function HomeLandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [landingTheme, setLandingTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/session");
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !contentType.includes("application/json")) return;
        const data = await response.json();
        if (!cancelled) setIsAuthenticated(Boolean(data?.authenticated));
      } catch {
        /* ignore */
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, []);

  const webAppHref = isAuthenticated ? "/app/chat" : "/auth/sign-in?redirect=%2Fapp%2Fchat";
  const isDark = landingTheme === "dark";

  return (
    <div
      data-landing-theme={landingTheme}
      className={
        isDark
          ? "relative min-h-screen bg-[#0a0a0a] text-zinc-100"
          : "relative min-h-screen bg-[#fafafa] text-[#0a0a0a]"
      }
    >

      <Navbar
        onThemeChange={setLandingTheme}
        initialTheme={landingTheme}
      />

      <HeroSection theme={landingTheme} webAppHref={webAppHref} />

      <div className="border-t border-[var(--border)]" />
      <ModelsShowcase theme={landingTheme} />

      <div className="border-t border-[var(--border)]" />
      <CreationBento theme={landingTheme} />

      <div className="border-t border-[var(--border)]" />
      <AgentsPipeline theme={landingTheme} />

      <div className="border-t border-[var(--border)]" />
      <ContextHub theme={landingTheme} />

      <div className="border-t border-[var(--border)]" />
      <ExtensionsStrip theme={landingTheme} />

      <div className="border-t border-[var(--border)]" />
      <ClosingCTA theme={landingTheme} webAppHref={webAppHref} />
    </div>
  );
}
