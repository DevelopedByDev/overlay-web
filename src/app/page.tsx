"use client";

import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Globe } from "lucide-react";
import { VoiceDemo } from "@/components/VoiceDemo";
import { OverlayDemo } from "@/components/OverlayDemo";
import { AllInOnePlace } from "@/components/AllInOnePlace";
import { Navbar } from "@/components/Navbar";

export default function Home() {
  const latestDownloadUrl = "/api/latest-release/download";
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
        // Leave the web CTA pointing at sign-in when session lookup fails.
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // Track section progress for scroll-triggered animations
  const [allInOnePlaceProgress, setAllInOnePlaceProgress] = useState(0);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [notesProgress, setNotesProgress] = useState(0);
  const [chatsProgress, setChatsProgress] = useState(0);
  const [browserProgress, setBrowserProgress] = useState(0);

  // Track which sections are active
  const [allInOnePlaceActive, setAllInOnePlaceActive] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [notesActive, setNotesActive] = useState(false);
  const [chatsActive, setChatsActive] = useState(false);
  const [browserActive, setBrowserActive] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    // New section ranges for revised flow (12 sections)
    
    // AllInOnePlace section: 0.20 - 0.32 (extended for more pause)
    setAllInOnePlaceActive(latest >= 0.20 && latest < 0.32);
    setAllInOnePlaceProgress(latest >= 0.20 && latest < 0.32 ? (latest - 0.20) / 0.12 : 0);
    
    // Voice section: 0.32 - 0.40
    setVoiceActive(latest >= 0.32 && latest < 0.40);
    setVoiceProgress(latest >= 0.32 && latest < 0.40 ? (latest - 0.32) / 0.08 : 0);
    
    // Notes section: 0.40 - 0.48
    setNotesActive(latest >= 0.40 && latest < 0.48);
    setNotesProgress(latest >= 0.40 && latest < 0.48 ? (latest - 0.40) / 0.08 : 0);
    
    // Chats section: 0.48 - 0.56
    setChatsActive(latest >= 0.48 && latest < 0.56);
    setChatsProgress(latest >= 0.48 && latest < 0.56 ? (latest - 0.48) / 0.08 : 0);
    
    // Browser section: 0.56 - 0.64
    setBrowserActive(latest >= 0.56 && latest < 0.64);
    setBrowserProgress(latest >= 0.56 && latest < 0.64 ? (latest - 0.56) / 0.08 : 0);
  });

  // Total sections: hero, valueProp, combo, allInOnePlace, voice, notes, chats, browser, agents, friction, welcome, begin = 12 sections
  
  // Hero section (0 - 0.06) - starts visible, fades out
  const logoScale = useTransform(scrollYProgress, [0, 0.03], [1, 0.6]);
  const logoOpacity = useTransform(scrollYProgress, [0.03, 0.06], [1, 0]);
  const heroOpacity = useTransform(scrollYProgress, [0.03, 0.06], [1, 0]);
  const heroPointer = useTransform(scrollYProgress, (v) => v < 0.06 ? "auto" : "none");
  
  // Combo section (0.06 - 0.20) - headline first, then notes/chats/browser/agents reveal in sequence
  const comboOpacity = useTransform(scrollYProgress, [0.06, 0.07, 0.19, 0.20], [0, 1, 1, 0]);
  const comboPointer = useTransform(scrollYProgress, (v) => v >= 0.06 && v < 0.20 ? "auto" : "none");
  // Both lines shrink and fade together before the voice pill enters
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
  // Pill appears with "powered by your voice"
  const comboPillOpacity = useTransform(scrollYProgress, [0.165, 0.18, 0.19, 0.20], [0, 1, 1, 0]);
  const comboPillScale = useTransform(scrollYProgress, [0.165, 0.18], [0.5, 1]);
  // "powered by" above, "your voice" below the pill
  const poweredByOpacity = useTransform(scrollYProgress, [0.172, 0.184], [0, 1]);
  
  // All In One Place section (0.20 - 0.32) - extended for more pause
  const allInOnePlaceOpacity = useTransform(scrollYProgress, [0.20, 0.22, 0.30, 0.32], [0, 1, 1, 0]);
  const allInOnePlacePointer = useTransform(scrollYProgress, (v) => v >= 0.20 && v < 0.32 ? "auto" : "none");
  
  // Voice section (0.32 - 0.40)
  const voiceOpacity = useTransform(scrollYProgress, [0.32, 0.34, 0.38, 0.40], [0, 1, 1, 0]);
  const voicePointer = useTransform(scrollYProgress, (v) => v >= 0.32 && v < 0.40 ? "auto" : "none");
  
  // Notes section (0.40 - 0.48)
  const notesOpacity = useTransform(scrollYProgress, [0.40, 0.42, 0.46, 0.48], [0, 1, 1, 0]);
  const notesPointer = useTransform(scrollYProgress, (v) => v >= 0.40 && v < 0.48 ? "auto" : "none");
  
  // Chats section (0.48 - 0.56)
  const chatsOpacity = useTransform(scrollYProgress, [0.48, 0.50, 0.54, 0.56], [0, 1, 1, 0]);
  const chatsPointer = useTransform(scrollYProgress, (v) => v >= 0.48 && v < 0.56 ? "auto" : "none");
  
  // Browser section (0.56 - 0.64)
  const browserOpacity = useTransform(scrollYProgress, [0.56, 0.58, 0.62, 0.64], [0, 1, 1, 0]);
  const browserPointer = useTransform(scrollYProgress, (v) => v >= 0.56 && v < 0.64 ? "auto" : "none");
  
  // Agents section (0.64 - 0.72)
  const agentsOpacity = useTransform(scrollYProgress, [0.64, 0.66, 0.70, 0.72], [0, 1, 1, 0]);
  const agentsPointer = useTransform(scrollYProgress, (v) => v >= 0.64 && v < 0.72 ? "auto" : "none");
  
  // Friction section (0.72 - 0.82) - "reduce the friction in your work" → "reduce your work"
  const frictionOpacity = useTransform(scrollYProgress, [0.72, 0.74, 0.80, 0.82], [0, 1, 1, 0]);
  const frictionPointer = useTransform(scrollYProgress, (v) => v >= 0.72 && v < 0.82 ? "auto" : "none");
  // "the friction in" dissolves and width collapses smoothly
  const frictionMiddleOpacity = useTransform(scrollYProgress, [0.76, 0.78], [1, 0]);
  const frictionMiddleMaxWidth = useTransform(scrollYProgress, [0.76, 0.79], ["300px", "0px"]);
  const frictionMiddleMarginLeft = useTransform(scrollYProgress, [0.76, 0.79], ["0.18em", "0em"]);
  const frictionMiddleMarginRight = useTransform(scrollYProgress, [0.76, 0.79], ["0.18em", "0.18em"]);
  
  // Welcome section (0.82 - 0.92) - merged with subtitle
  const welcomeOpacity = useTransform(scrollYProgress, [0.82, 0.84, 0.912, 0.93], [0, 1, 1, 0]);
  const welcomePointer = useTransform(scrollYProgress, (v) => v >= 0.82 && v < 0.93 ? "auto" : "none");
  const welcomeOverlayOpacity = useTransform(scrollYProgress, [0.846, 0.872], [0, 1]);
  const welcomeSubtitleOpacity = useTransform(scrollYProgress, [0.872, 0.898], [0, 1]);
  
  // Begin/Download section (0.92 - 1.0) - stays visible at end
  const downloadOpacity = useTransform(scrollYProgress, [0.93, 0.965, 1.0], [0, 1, 1]);
  const downloadPointer = useTransform(scrollYProgress, (v) => v >= 0.93 ? "auto" : "none");
  const webAppHref = isAuthenticated
    ? "/app/chat"
    : "/auth/sign-in?redirect=%2Fapp%2Fchat";

  return (
    <div ref={containerRef} className="bg-[#fafafa] text-[#0a0a0a]">
      {/* Liquid Glass Background */}
      <div className="liquid-glass" />

      {/* Sticky Navbar - appears after scrolling past hero */}
      <Navbar scrollYProgress={scrollYProgress} />

      {/* Fixed Hero Section */}
      <motion.section 
        style={{ opacity: heroOpacity, pointerEvents: heroPointer }}
        className="fixed inset-0 flex flex-col items-center justify-center z-10"
      >
        {/* Logo */}
        <motion.div
          style={{ scale: logoScale, opacity: logoOpacity }}
          className="-mb-5"
        >
          <Image
            src="/assets/overlay-logo.png"
            alt="Overlay"
            width={180}
            height={180}
            className="drop-shadow-2xl"
            priority
          />
        </motion.div>

        {/* Title */}
        <h1 className="font-serif text-6xl md:text-8xl tracking-tight mb-3">
          overlay
        </h1>

        {/* Tagline */}
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

          <a
            href={latestDownloadUrl}
            className="inline-flex min-w-[184px] items-center justify-center gap-3 px-6 py-3 bg-[#0a0a0a] text-white rounded-full text-sm font-medium hover:bg-[#27272a] transition-all duration-300"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            download for mac
          </a>
        </div>

      </motion.section>

      {/* Spacer for scroll */}
      <div className="h-screen" />

      {/* Combo Section - "everything you need from ai" + "notes + chats + browser + agents" shrink together → "powered by your voice" */}
      <motion.section 
        style={{ opacity: comboOpacity, pointerEvents: comboPointer }}
        className="fixed inset-0 flex flex-col items-center justify-center px-6 z-10"
      >
        <div className="relative flex flex-col items-center justify-center">
          {/* Headline stays first, then the product surfaces reveal one by one */}
          <motion.div 
            style={{ scale: comboTextScale, opacity: comboTextOpacity }}
            className="flex flex-col items-center gap-4"
          >
            <p className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0a0a] text-center leading-tight">
              everything you need from AI
            </p>
            <div className="min-h-[1.35em] pb-[0.12em] font-serif text-3xl leading-[1.15] md:text-4xl lg:text-5xl text-[#0a0a0a] text-center whitespace-nowrap">
              <motion.span
                style={{ opacity: comboNotesOpacity, y: comboNotesY, clipPath: comboNotesClip }}
                className="inline-block"
              >
                notes <span className="text-[#71717a]">+</span>
              </motion.span>
              <motion.span
                style={{ opacity: comboChatsOpacity, y: comboChatsY, clipPath: comboChatsClip }}
                className="inline-block ml-[0.28em]"
              >
                chats <span className="text-[#71717a]">+</span>
              </motion.span>
              <motion.span
                style={{ opacity: comboBrowserOpacity, y: comboBrowserY, clipPath: comboBrowserClip }}
                className="inline-block ml-[0.28em]"
              >
                browser <span className="text-[#71717a]">+</span>
              </motion.span>
              <motion.span
                style={{ opacity: comboAgentsOpacity, y: comboAgentsY, clipPath: comboAgentsClip }}
                className="inline-block ml-[0.28em]"
              >
                agents
              </motion.span>
            </div>
          </motion.div>
          
          {/* Pill with "powered by your voice" - same font size as "everything you need from ai" */}
          <motion.div
            style={{ opacity: comboPillOpacity, scale: comboPillScale }}
            className="absolute flex flex-col items-center gap-4"
          >
            <motion.p 
              style={{ opacity: poweredByOpacity }}
              className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0a0a] text-center leading-tight"
            >
              powered by
            </motion.p>
            <div
              style={{
                width: 48,
                height: 10,
                borderRadius: 12,
                background: "rgba(19, 19, 19, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
              }}
            />
            <motion.p 
              style={{ opacity: poweredByOpacity }}
              className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0a0a] text-center leading-tight"
            >
              your voice
            </motion.p>
          </motion.div>
        </div>
      </motion.section>

      {/* All In One Place Section - moved earlier */}
      <motion.section 
        style={{ opacity: allInOnePlaceOpacity, pointerEvents: allInOnePlacePointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <AllInOnePlace scrollProgress={allInOnePlaceProgress} isActive={allInOnePlaceActive} />
      </motion.section>

      {/* Voice Section */}
      <motion.section 
        style={{ opacity: voiceOpacity, pointerEvents: voicePointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <div className="max-w-xl mx-auto w-full flex flex-col items-center gap-12">
          <div className="text-center">
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">voice</h3>
            <p className="text-lg md:text-xl text-[#71717a]">speak your mind</p>
          </div>
          <div className="w-full">
            <VoiceDemo scrollProgress={voiceProgress} isActive={voiceActive} />
          </div>
        </div>
      </motion.section>

      {/* Notes Section */}
      <motion.section 
        style={{ opacity: notesOpacity, pointerEvents: notesPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <div className="max-w-3xl mx-auto w-full flex flex-col items-center gap-8">
          <div className="relative text-center">
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">notes</h3>
            <p className="text-lg md:text-xl text-[#71717a]">capture that thought</p>
            {notesProgress > 0.5 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 ml-8 text-sm text-[#0a0a0a]/70 font-medium whitespace-nowrap text-left"
              >
                capture ideas instantly without leaving your current task
              </motion.p>
            )}
          </div>
          <div className="w-full hidden md:block">
            <OverlayDemo
              type="notes"
              title="notes"
              shortcutDisplay="/"
              screenImage="/assets/window-screens/note-screen.png"
              overlayImage="/assets/overlays/note-overlay.png"
              isActive={notesActive}
              sectionProgress={notesProgress}
              hideAnnotation={true}
            />
          </div>
        </div>
      </motion.section>

      {/* Chats Section - renamed from "chat" */}
      <motion.section 
        style={{ opacity: chatsOpacity, pointerEvents: chatsPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center gap-12">
          <div className="relative text-center">
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">chats</h3>
            <p className="text-lg md:text-xl text-[#71717a]">ask that question</p>
            {chatsProgress > 0.5 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="hidden md:block absolute right-full top-1/2 -translate-y-1/2 mr-8 text-sm text-[#0a0a0a]/70 font-medium whitespace-nowrap text-right"
              >
                get ai help anywhere, no app switching needed
              </motion.p>
            )}
          </div>
          <div className="w-full hidden md:block">
            <OverlayDemo
              type="chat"
              title="chats"
              shortcutDisplay="."
              screenImage="/assets/window-screens/chat-screen.png"
              overlayImage="/assets/overlays/chat-overlay.png"
              isActive={chatsActive}
              sectionProgress={chatsProgress}
              hideAnnotation={true}
            />
          </div>
        </div>
      </motion.section>

      {/* Browser Section */}
      <motion.section 
        style={{ opacity: browserOpacity, pointerEvents: browserPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center gap-12">
          <div className="relative text-center">
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">browser</h3>
            <p className="text-lg md:text-xl text-[#71717a]">make that search</p>
            {browserProgress > 0.5 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="hidden md:block absolute left-full top-1/2 -translate-y-1/2 ml-8 text-sm text-[#0a0a0a]/70 font-medium whitespace-nowrap text-left"
              >
                quick search without disrupting your workflow
              </motion.p>
            )}
          </div>
          <div className="w-full hidden md:block">
            <OverlayDemo
              type="browser"
              title="browser"
              shortcutDisplay="\\"
              screenImage="/assets/window-screens/browser-screen.png"
              overlayImage="/assets/overlays/browser-overlay.png"
              isActive={browserActive}
              sectionProgress={browserProgress}
              hideAnnotation={true}
            />
          </div>
        </div>
      </motion.section>

      {/* Agents Section */}
      <motion.section 
        style={{ opacity: agentsOpacity, pointerEvents: agentsPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 z-10"
      >
        <div className="max-w-3xl text-center">
          <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">agents</h3>
          <p className="text-lg md:text-xl text-[#71717a]">let ai work for you</p>
        </div>
      </motion.section>

      {/* Friction Section - "reduce the friction in your work" → "reduce your work" */}
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

      {/* Welcome Section - merged with subtitle */}
      <motion.section 
        style={{ opacity: welcomeOpacity, pointerEvents: welcomePointer }}
        className="fixed inset-0 flex items-center justify-center px-6 z-10"
      >
        <div className="max-w-3xl text-center">
          <div className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.08] text-[#0a0a0a]">
            <p>welcome to</p>
            <div className="mt-2 min-h-[1.12em] pb-[0.08em]">
              <motion.p
                style={{ opacity: welcomeOverlayOpacity }}
              >
                overlay first computing
              </motion.p>
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

      {/* Download Section with Footer */}
      <motion.section 
        id="download"
        style={{ opacity: downloadOpacity, pointerEvents: downloadPointer }}
        className="fixed inset-0 flex flex-col items-center justify-center px-6 z-10"
      >
        <div className="text-center">
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-8">
            begin
          </h2>
          <a
            href={latestDownloadUrl}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-[#0a0a0a] text-white rounded-full text-sm font-medium hover:bg-[#27272a] transition-all duration-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            download for mac
          </a>
          <p className="text-sm text-[#a1a1aa] mt-4">
            windows, ios, and android coming soon
          </p>
        </div>
        
        {/* Footer */}
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
              <p className="text-sm text-[#71717a]">
                © 2026 overlay
              </p>
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
              <a
                href="/terms"
                className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors"
              >
                terms
              </a>
              <a
                href="/privacy"
                className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors"
              >
                privacy
              </a>
              <a
                href="mailto:work.dslalwani@gmail.com"
                className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors"
              >
                contact
              </a>
            </div>
          </div>
        </footer>
      </motion.section>

      {/* Spacer for scroll - 12 sections * 100vh = 1200vh */}
      <div className="h-[1200vh]" />
    </div>
  );
}
