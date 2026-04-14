"use client";

import { useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { AgentsPipeline } from "@/components/landing/AgentsPipeline";
import { ClosingCTA } from "@/components/landing/ClosingCTA";
import { ContextHub } from "@/components/landing/ContextHub";
import { CreationBento } from "@/components/landing/CreationBento";
import { ExtensionsStrip } from "@/components/landing/ExtensionsStrip";
import { HeroSection } from "@/components/landing/HeroSection";
import { ModelsShowcase } from "@/components/landing/ModelsShowcase";
import { LANDING_THEME_STORAGE_KEY } from "@/lib/landingThemeConstants";

export default function HomeLandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [landingTheme, setLandingTheme] = useState<"light" | "dark">("light");

  const { scrollYProgress } = useScroll();

  useEffect(() => {
    try {
      const t = window.localStorage.getItem(LANDING_THEME_STORAGE_KEY);
      if (t === "dark" || t === "light") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- external persisted theme
        setLandingTheme(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLandingTheme = useCallback(() => {
    setLandingTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(LANDING_THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

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

  const navLogoOpacity = useTransform(scrollYProgress, [0, 0.08], [0, 1]);
  const navLogoX = useTransform(scrollYProgress, [0, 0.08], [-12, 0]);

  const webAppHref = isAuthenticated ? "/app/chat" : "/auth/sign-in?redirect=%2Fapp%2Fchat";
  const isDark = landingTheme === "dark";

  const dividerClass = isDark ? "border-zinc-800" : "border-zinc-100";

  return (
    <div
      data-landing-theme={landingTheme}
      className={
        isDark
          ? "relative min-h-screen bg-[#0a0a0a] text-zinc-100"
          : "relative min-h-screen bg-[#fafafa] text-[#0a0a0a]"
      }
    >
      <div className="liquid-glass" />

      <Navbar
        scrollYProgress={scrollYProgress}
        landingTheme={landingTheme}
        onLandingThemeToggle={toggleLandingTheme}
        navLogoOpacity={navLogoOpacity}
        navLogoX={navLogoX}
      />

      <HeroSection theme={landingTheme} webAppHref={webAppHref} />

      <div className={`mx-auto max-w-4xl border-t ${dividerClass}`} />
      <ModelsShowcase theme={landingTheme} />

      <div className={`mx-auto max-w-4xl border-t ${dividerClass}`} />
      <CreationBento theme={landingTheme} />

      <div className={`mx-auto max-w-4xl border-t ${dividerClass}`} />
      <AgentsPipeline theme={landingTheme} />

      <div className={`mx-auto max-w-4xl border-t ${dividerClass}`} />
      <ContextHub theme={landingTheme} />

      <div className={`mx-auto max-w-4xl border-t ${dividerClass}`} />
      <ExtensionsStrip theme={landingTheme} />

      <div className={`mx-auto max-w-4xl border-t ${dividerClass}`} />
      <ClosingCTA theme={landingTheme} webAppHref={webAppHref} />
    </div>
  );
}
