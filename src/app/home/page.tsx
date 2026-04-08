"use client";

import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { Globe } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AllInOnePlace } from "@/components/AllInOnePlace";
import { Navbar } from "@/components/Navbar";

export default function HomeLandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

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
        // Fall back to the sign-in CTA if session lookup fails.
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const [allInOnePlaceProgress, setAllInOnePlaceProgress] = useState(0);

  const [allInOnePlaceActive, setAllInOnePlaceActive] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    setAllInOnePlaceActive(latest >= 0.18 && latest < 0.30);
    setAllInOnePlaceProgress(latest >= 0.18 && latest < 0.30 ? (latest - 0.18) / 0.12 : 0);
  });

  const logoScale = useTransform(scrollYProgress, [0, 0.03], [1, 0.6]);
  const logoOpacity = useTransform(scrollYProgress, [0.03, 0.06], [1, 0]);
  const heroOpacity = useTransform(scrollYProgress, [0.03, 0.06], [1, 0]);
  const heroPointer = useTransform(scrollYProgress, (v) => (v < 0.06 ? "auto" : "none"));

  const comboOpacity = useTransform(scrollYProgress, [0.06, 0.07, 0.17, 0.18], [0, 1, 1, 0]);
  const comboPointer = useTransform(scrollYProgress, (v) => (v >= 0.06 && v < 0.18 ? "auto" : "none"));
  const comboTextScale = useTransform(scrollYProgress, [0.145, 0.17], [1, 0]);
  const comboTextOpacity = useTransform(scrollYProgress, [0.145, 0.17], [1, 0]);
  const comboNotesOpacity = useTransform(scrollYProgress, [0.078, 0.092], [0, 1]);
  const comboNotesY = useTransform(scrollYProgress, [0.078, 0.092], [12, 0]);
  const comboNotesClip = useTransform(scrollYProgress, [0.078, 0.092], ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);
  const comboChatsOpacity = useTransform(scrollYProgress, [0.092, 0.106], [0, 1]);
  const comboChatsY = useTransform(scrollYProgress, [0.092, 0.106], [12, 0]);
  const comboChatsClip = useTransform(scrollYProgress, [0.092, 0.106], ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);
  const comboBrowserOpacity = useTransform(scrollYProgress, [0.106, 0.12], [0, 1]);
  const comboBrowserY = useTransform(scrollYProgress, [0.106, 0.12], [12, 0]);
  const comboBrowserClip = useTransform(scrollYProgress, [0.106, 0.12], ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);
  const comboAgentsOpacity = useTransform(scrollYProgress, [0.12, 0.134], [0, 1]);
  const comboAgentsY = useTransform(scrollYProgress, [0.12, 0.134], [12, 0]);
  const comboAgentsClip = useTransform(scrollYProgress, [0.12, 0.134], ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);

  const allInOnePlaceOpacity = useTransform(scrollYProgress, [0.18, 0.20, 0.28, 0.30], [0, 1, 1, 0]);
  const allInOnePlacePointer = useTransform(scrollYProgress, (v) => (v >= 0.18 && v < 0.30 ? "auto" : "none"));

  const notesOpacity = useTransform(scrollYProgress, [0.30, 0.32, 0.38, 0.40], [0, 1, 1, 0]);
  const notesPointer = useTransform(scrollYProgress, (v) => (v >= 0.30 && v < 0.40 ? "auto" : "none"));

  const chatsOpacity = useTransform(scrollYProgress, [0.40, 0.42, 0.48, 0.50], [0, 1, 1, 0]);
  const chatsPointer = useTransform(scrollYProgress, (v) => (v >= 0.40 && v < 0.50 ? "auto" : "none"));

  const browserOpacity = useTransform(scrollYProgress, [0.50, 0.52, 0.58, 0.60], [0, 1, 1, 0]);
  const browserPointer = useTransform(scrollYProgress, (v) => (v >= 0.50 && v < 0.60 ? "auto" : "none"));

  const agentsOpacity = useTransform(scrollYProgress, [0.60, 0.62, 0.68, 0.70], [0, 1, 1, 0]);
  const agentsPointer = useTransform(scrollYProgress, (v) => (v >= 0.60 && v < 0.70 ? "auto" : "none"));

  const frictionOpacity = useTransform(scrollYProgress, [0.70, 0.72, 0.78, 0.80], [0, 1, 1, 0]);
  const frictionPointer = useTransform(scrollYProgress, (v) => (v >= 0.70 && v < 0.80 ? "auto" : "none"));
  const frictionMiddleOpacity = useTransform(scrollYProgress, [0.74, 0.76], [1, 0]);
  const frictionMiddleMaxWidth = useTransform(scrollYProgress, [0.74, 0.77], ["300px", "0px"]);
  const frictionMiddleMarginLeft = useTransform(scrollYProgress, [0.74, 0.77], ["0.18em", "0em"]);
  const frictionMiddleMarginRight = useTransform(scrollYProgress, [0.74, 0.77], ["0.18em", "0.18em"]);

  const welcomeOpacity = useTransform(scrollYProgress, [0.80, 0.82, 0.892, 0.91], [0, 1, 1, 0]);
  const welcomePointer = useTransform(scrollYProgress, (v) => (v >= 0.80 && v < 0.91 ? "auto" : "none"));
  const welcomeOverlayOpacity = useTransform(scrollYProgress, [0.826, 0.852], [0, 1]);
  const welcomeSubtitleOpacity = useTransform(scrollYProgress, [0.852, 0.878], [0, 1]);

  const beginOpacity = useTransform(scrollYProgress, [0.91, 0.95, 1.0], [0, 1, 1]);
  const beginPointer = useTransform(scrollYProgress, (v) => (v >= 0.91 ? "auto" : "none"));

  const webAppHref = isAuthenticated ? "/app/chat" : "/auth/sign-in?redirect=%2Fapp%2Fchat";

  return (
    <div ref={containerRef} className="bg-[#fafafa] text-[#0a0a0a]">
      <div className="liquid-glass" />
      <Navbar scrollYProgress={scrollYProgress} />

      <motion.section
        style={{ opacity: heroOpacity, pointerEvents: heroPointer }}
        className="fixed inset-0 flex flex-col items-center justify-center z-10"
      >
        <motion.div style={{ scale: logoScale, opacity: logoOpacity }} className="-mb-5">
          <Image
            src="/assets/overlay-logo.png"
            alt="Overlay"
            width={180}
            height={180}
            className="drop-shadow-2xl"
            priority
          />
        </motion.div>

        <h1 className="font-serif text-6xl md:text-8xl tracking-tight mb-3">overlay</h1>

        <p className="text-lg md:text-xl text-[#71717a] font-light tracking-wide mb-8">
          your personal, unified ai interaction layer
        </p>

        <div className="flex flex-col items-center gap-3">
          <Link
            href={webAppHref}
            className="inline-flex min-w-[184px] items-center justify-center gap-3 px-6 py-3 bg-white text-[#0a0a0a] border border-[#d4d4d8] rounded-full text-sm font-medium hover:bg-[#f4f4f5] transition-all duration-300"
          >
            <Globe className="w-4 h-4" />
            open app
          </Link>
        </div>
      </motion.section>

      <div className="h-screen" />

      <motion.section
        style={{ opacity: comboOpacity, pointerEvents: comboPointer }}
        className="fixed inset-0 flex flex-col items-center justify-center px-6 z-10"
      >
        <div className="relative flex flex-col items-center justify-center">
          <motion.div style={{ scale: comboTextScale, opacity: comboTextOpacity }} className="flex flex-col items-center gap-4">
            <p className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0a0a] text-center leading-tight">
              everything you need from AI
            </p>
            <div className="min-h-[1.35em] pb-[0.12em] font-serif text-3xl leading-[1.15] md:text-4xl lg:text-5xl text-[#0a0a0a] text-center whitespace-nowrap">
              <motion.span style={{ opacity: comboNotesOpacity, y: comboNotesY, clipPath: comboNotesClip }} className="inline-block">
                notes <span className="text-[#71717a]">+</span>
              </motion.span>
              <motion.span style={{ opacity: comboChatsOpacity, y: comboChatsY, clipPath: comboChatsClip }} className="inline-block ml-[0.28em]">
                chats <span className="text-[#71717a]">+</span>
              </motion.span>
              <motion.span
                style={{ opacity: comboBrowserOpacity, y: comboBrowserY, clipPath: comboBrowserClip }}
                className="inline-block ml-[0.28em]"
              >
                browser <span className="text-[#71717a]">+</span>
              </motion.span>
              <motion.span style={{ opacity: comboAgentsOpacity, y: comboAgentsY, clipPath: comboAgentsClip }} className="inline-block ml-[0.28em]">
                agents
              </motion.span>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        style={{ opacity: allInOnePlaceOpacity, pointerEvents: allInOnePlacePointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <AllInOnePlace scrollProgress={allInOnePlaceProgress} isActive={allInOnePlaceActive} />
      </motion.section>

      <motion.section
        style={{ opacity: notesOpacity, pointerEvents: notesPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <div className="max-w-3xl mx-auto w-full flex flex-col items-center text-center">
          <div className="text-center">
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">notes</h3>
            <p className="text-lg md:text-xl text-[#71717a]">
              capture ideas instantly without leaving your current task
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        style={{ opacity: chatsOpacity, pointerEvents: chatsPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <div className="max-w-4xl mx-auto w-full flex flex-col items-center text-center">
          <div className="text-center">
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">chats</h3>
            <p className="text-lg md:text-xl text-[#71717a]">
              get ai help anywhere, no app switching needed
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        style={{ opacity: browserOpacity, pointerEvents: browserPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <div className="max-w-4xl mx-auto w-full flex flex-col items-center text-center">
          <div className="text-center">
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">browser</h3>
            <p className="text-lg md:text-xl text-[#71717a]">
              quick search without disrupting your workflow
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        style={{ opacity: agentsOpacity, pointerEvents: agentsPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 z-10"
      >
        <div className="max-w-3xl text-center">
          <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">agents</h3>
          <p className="text-lg md:text-xl text-[#71717a]">let ai work for you</p>
        </div>
      </motion.section>

      <motion.section
        style={{ opacity: frictionOpacity, pointerEvents: frictionPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 z-10"
      >
        <div className="max-w-3xl text-center">
          <p className="font-serif text-4xl md:text-5xl lg:text-6xl leading-tight text-[#0a0a0a] inline-flex items-baseline justify-center">
            <span>reduce</span>
            <motion.span
              style={{
                opacity: frictionMiddleOpacity,
                maxWidth: frictionMiddleMaxWidth,
                marginLeft: frictionMiddleMarginLeft,
                marginRight: frictionMiddleMarginRight,
                overflow: "hidden",
                whiteSpace: "nowrap",
                display: "inline-block",
              }}
              className="text-[#71717a]"
            >
              the friction in
            </motion.span>
            <span>your</span>
            <span className="ml-[0.18em]">work</span>
          </p>
        </div>
      </motion.section>

      <motion.section
        style={{ opacity: welcomeOpacity, pointerEvents: welcomePointer }}
        className="fixed inset-0 flex items-center justify-center px-6 z-10"
      >
        <div className="max-w-3xl text-center">
          <div className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.08] text-[#0a0a0a]">
            <p>welcome to</p>
            <div className="mt-2 min-h-[1.12em] pb-[0.08em]">
              <motion.p style={{ opacity: welcomeOverlayOpacity }}>overlay first computing</motion.p>
            </div>
          </div>
          <div className="mt-5 min-h-[1.3em] pb-[0.08em]">
            <motion.p
              style={{ opacity: welcomeSubtitleOpacity }}
              className="text-lg md:text-xl text-[#71717a] font-light tracking-wide"
            >
              personal computing reimagined
            </motion.p>
          </div>
        </div>
      </motion.section>

      <motion.section
        style={{ opacity: beginOpacity, pointerEvents: beginPointer }}
        className="fixed inset-0 flex flex-col items-center justify-center px-6 z-10"
      >
        <div className="text-center">
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-8">begin</h2>
          <Link
            href={webAppHref}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-[#0a0a0a] text-white rounded-full text-sm font-medium hover:bg-[#27272a] transition-all duration-300"
          >
            <Globe className="w-5 h-5" />
            open app
          </Link>
          <p className="text-sm text-[#a1a1aa] mt-4">desktop download coming soon</p>
        </div>

        <footer className="absolute bottom-8 left-0 right-0 px-6">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/assets/overlay-logo.png"
                alt="Overlay"
                width={24}
                height={24}
                className="opacity-60"
              />
              <p className="text-sm text-[#71717a]">© 2026 overlay</p>
            </div>
            <p className="text-sm text-[#71717a]">
              made with care by{" "}
              <a
                href="https://divyan.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[#0a0a0a] transition-colors"
              >
                divyan.sh
              </a>
            </p>
            <div className="flex gap-8">
              <a href="/terms" className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors">
                terms
              </a>
              <a href="/privacy" className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors">
                privacy
              </a>
              <a
                href="mailto:divyansh@layernorm.co"
                className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors"
              >
                contact
              </a>
            </div>
          </div>
        </footer>
      </motion.section>

      <div className="h-[1000vh]" />
    </div>
  );
}
