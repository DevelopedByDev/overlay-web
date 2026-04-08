"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Globe } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AllInOnePlace } from "@/components/AllInOnePlace";
import { Navbar } from "@/components/Navbar";

const LANDING_THEME_KEY = "overlay.landing.theme";

export default function HomeLandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [landingTheme, setLandingTheme] = useState<"light" | "dark">("light");

  const { scrollYProgress } = useScroll();

  useEffect(() => {
    try {
      const t = window.localStorage.getItem(LANDING_THEME_KEY);
      if (t === "dark" || t === "light") {
        // Hydration: default light on server; sync stored preference after mount.
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
        window.localStorage.setItem(LANDING_THEME_KEY, next);
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

        if (!response.ok || !contentType.includes("application/json")) {
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setIsAuthenticated(Boolean(data?.authenticated));
        }
      } catch {
        /* ignore */
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const navLogoOpacity = useTransform(scrollYProgress, [0, 0.08], [0, 1]);
  const navLogoX = useTransform(scrollYProgress, [0, 0.08], [-12, 0]);

  const webAppHref = isAuthenticated ? "/app/chat" : "/auth/sign-in?redirect=%2Fapp%2Fchat";

  const isDark = landingTheme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const ctaClass = isDark
    ? "inline-flex min-w-[184px] items-center justify-center gap-3 rounded-full border border-zinc-600 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-100 transition-all duration-300 hover:bg-zinc-800"
    : "inline-flex min-w-[184px] items-center justify-center gap-3 rounded-full border border-[#d4d4d8] bg-white px-6 py-3 text-sm font-medium text-[#0a0a0a] transition-all duration-300 hover:bg-[#f4f4f5]";
  const ctaDarkClass = isDark
    ? "group inline-flex items-center gap-3 rounded-full bg-zinc-100 px-8 py-4 text-sm font-medium text-zinc-900 transition-all duration-300 hover:bg-white"
    : "group inline-flex items-center gap-3 rounded-full bg-[#0a0a0a] px-8 py-4 text-sm font-medium text-white transition-all duration-300 hover:bg-[#27272a]";

  const sectionInView = {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.35 },
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  };

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

      {/* Hero */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pb-24 pt-32">
        <motion.div {...sectionInView} className="flex flex-col items-center text-center">
          <div className="-mb-5">
            <Image
              src="/assets/overlay-logo.png"
              alt="Overlay"
              width={180}
              height={180}
              className="drop-shadow-2xl"
              priority
            />
          </div>
          <h1 className="mb-3 font-serif text-6xl tracking-tight md:text-8xl">overlay</h1>
          <p className={`mb-8 text-lg font-light tracking-wide md:text-xl ${muted}`}>
            your personal, unified ai interaction layer
          </p>
          <Link href={webAppHref} className={ctaClass}>
            <Globe className="h-4 w-4" />
            open app
          </Link>
        </motion.div>
      </section>

      {/* Combo headline */}
      <motion.section
        {...sectionInView}
        className="relative z-10 flex min-h-[85vh] flex-col items-center justify-center px-6 py-20"
      >
        <div className="flex max-w-4xl flex-col items-center gap-4 text-center">
          <p className={`font-serif text-4xl leading-tight md:text-5xl lg:text-6xl ${heading}`}>
            everything you need from AI
          </p>
          <p className={`min-h-[1.35em] pb-[0.12em] font-serif text-3xl leading-[1.15] whitespace-normal md:text-4xl lg:text-5xl ${heading}`}>
            <span className="inline-block">notes</span>
            <span className={`mx-1 inline-block ${muted}`}>+</span>
            <span className="inline-block">chats</span>
            <span className={`mx-1 inline-block ${muted}`}>+</span>
            <span className="inline-block">browser</span>
            <span className={`mx-1 inline-block ${muted}`}>+</span>
            <span className="inline-block">agents</span>
          </p>
        </div>
      </motion.section>

      {/* All in one */}
      <section className="relative z-10 flex min-h-[90vh] items-center justify-center px-6 py-20">
        <AllInOnePlace theme={landingTheme} />
      </section>

      <motion.section
        {...sectionInView}
        className="relative z-10 flex min-h-[75vh] flex-col items-center justify-center px-6 py-20 text-center"
      >
        <div className="mx-auto w-full max-w-3xl">
          <h3 className="mb-4 font-serif text-5xl md:text-6xl lg:text-7xl">notes</h3>
          <p className={`text-lg md:text-xl ${muted}`}>
            capture ideas instantly without leaving your current task
          </p>
        </div>
      </motion.section>

      <motion.section
        {...sectionInView}
        className="relative z-10 flex min-h-[75vh] flex-col items-center justify-center px-6 py-20 text-center"
      >
        <div className="mx-auto w-full max-w-4xl">
          <h3 className="mb-4 font-serif text-5xl md:text-6xl lg:text-7xl">chats</h3>
          <p className={`text-lg md:text-xl ${muted}`}>
            get ai help anywhere, no app switching needed
          </p>
        </div>
      </motion.section>

      <motion.section
        {...sectionInView}
        className="relative z-10 flex min-h-[75vh] flex-col items-center justify-center px-6 py-20 text-center"
      >
        <div className="mx-auto w-full max-w-4xl">
          <h3 className="mb-4 font-serif text-5xl md:text-6xl lg:text-7xl">browser</h3>
          <p className={`text-lg md:text-xl ${muted}`}>
            quick search without disrupting your workflow
          </p>
        </div>
      </motion.section>

      <motion.section
        {...sectionInView}
        className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center"
      >
        <div className="mx-auto max-w-3xl">
          <h3 className="mb-4 font-serif text-5xl md:text-6xl lg:text-7xl">agents</h3>
          <p className={`text-lg md:text-xl ${muted}`}>let ai work for you</p>
        </div>
      </motion.section>

      <motion.section
        {...sectionInView}
        className="relative z-10 flex min-h-[75vh] flex-col items-center justify-center px-6 py-20 text-center"
      >
        <p className={`max-w-3xl font-serif text-4xl leading-tight md:text-5xl lg:text-6xl ${heading}`}>
          reduce <span className={muted}>the friction in</span> your work
        </p>
      </motion.section>

      <motion.section
        {...sectionInView}
        className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center px-6 py-20 text-center"
      >
        <div className={`max-w-3xl font-serif text-4xl leading-[1.08] md:text-5xl lg:text-6xl ${heading}`}>
          <p>welcome to</p>
          <p className="mt-2">overlay first computing</p>
        </div>
        <p className={`mt-5 text-lg font-light tracking-wide md:text-xl ${muted}`}>
          personal computing reimagined
        </p>
      </motion.section>

      <motion.section
        {...sectionInView}
        className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pb-32 pt-20"
      >
        <h2 className={`mb-8 font-serif text-4xl md:text-5xl lg:text-6xl ${heading}`}>begin</h2>
        <Link href={webAppHref} className={ctaDarkClass}>
          <Globe className="h-5 w-5" />
          open app
        </Link>
        <p className={`mt-4 text-sm ${isDark ? "text-zinc-500" : "text-[#a1a1aa]"}`}>
          desktop download coming soon
        </p>

        <footer className="mt-24 w-full max-w-4xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-3">
              <Image
                src="/assets/overlay-logo.png"
                alt="Overlay"
                width={24}
                height={24}
                className="opacity-60"
              />
              <p className={`text-sm ${muted}`}>© 2026 overlay</p>
            </div>
            <p className={`text-sm ${muted}`}>
              made with care by{" "}
              <a
                href="https://divyan.sh"
                target="_blank"
                rel="noopener noreferrer"
                className={`underline transition-colors ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
              >
                divyan.sh
              </a>
            </p>
            <div className="flex gap-8">
              <a
                href="/terms"
                className={`text-sm transition-colors ${muted} ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
              >
                terms
              </a>
              <a
                href="/privacy"
                className={`text-sm transition-colors ${muted} ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
              >
                privacy
              </a>
              <a
                href="mailto:divyansh@layernorm.co"
                className={`text-sm transition-colors ${muted} ${isDark ? "hover:text-zinc-200" : "hover:text-[#0a0a0a]"}`}
              >
                contact
              </a>
            </div>
          </div>
        </footer>
      </motion.section>
    </div>
  );
}
