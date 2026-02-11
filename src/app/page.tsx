"use client";

import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useState, useRef } from "react";
import Image from "next/image";
import { VoiceDemo } from "@/components/VoiceDemo";
import { OverlayDemo } from "@/components/OverlayDemo";
import { AllInOnePlace } from "@/components/AllInOnePlace";
import { useLatestRelease } from "@/hooks/useLatestRelease";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Track section progress for scroll-triggered animations
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [notesProgress, setNotesProgress] = useState(0);
  const [chatProgress, setChatProgress] = useState(0);
  const [browserProgress, setBrowserProgress] = useState(0);
  const [allInOnePlaceProgress, setAllInOnePlaceProgress] = useState(0);

  // Track which sections are active
  const [voiceActive, setVoiceActive] = useState(false);
  const [notesActive, setNotesActive] = useState(false);
  const [chatActive, setChatActive] = useState(false);
  const [browserActive, setBrowserActive] = useState(false);
  const [allInOnePlaceActive, setAllInOnePlaceActive] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    // Updated section ranges
    
    // Voice section: 0.20 - 0.30
    setVoiceActive(latest >= 0.20 && latest < 0.30);
    setVoiceProgress(latest >= 0.20 && latest < 0.30 ? (latest - 0.20) / 0.10 : 0);
    
    // Notes section: 0.30 - 0.40
    setNotesActive(latest >= 0.30 && latest < 0.40);
    setNotesProgress(latest >= 0.30 && latest < 0.40 ? (latest - 0.30) / 0.10 : 0);
    
    // Chat section: 0.40 - 0.50
    setChatActive(latest >= 0.40 && latest < 0.50);
    setChatProgress(latest >= 0.40 && latest < 0.50 ? (latest - 0.40) / 0.10 : 0);
    
    // Browser section: 0.50 - 0.60
    setBrowserActive(latest >= 0.50 && latest < 0.60);
    setBrowserProgress(latest >= 0.50 && latest < 0.60 ? (latest - 0.50) / 0.10 : 0);
    
    // AllInOnePlace section: 0.68 - 0.80
    setAllInOnePlaceActive(latest >= 0.68 && latest < 0.80);
    setAllInOnePlaceProgress(latest >= 0.68 && latest < 0.80 ? (latest - 0.68) / 0.12 : 0);
  });

  // Total sections: hero, philosophy, voice, notes, chat, browser, combo, allInOnePlace, flow, welcome, download = 11 sections
  // Each section gets ~0.08 of scroll progress
  
  // Hero section (0 - 0.08) - starts visible, fades out
  const logoScale = useTransform(scrollYProgress, [0, 0.04], [1, 0.6]);
  const logoOpacity = useTransform(scrollYProgress, [0.04, 0.08], [1, 0]);
  const heroOpacity = useTransform(scrollYProgress, [0.04, 0.08], [1, 0]);
  const heroPointer = useTransform(scrollYProgress, (v) => v < 0.08 ? "auto" : "none");
  
  // Philosophy section (0.08 - 0.20) - extended for more pause on 'overlays'
  const philosophyOpacity = useTransform(scrollYProgress, [0.08, 0.10, 0.18, 0.20], [0, 1, 1, 0]);
  const philosophyPointer = useTransform(scrollYProgress, (v) => v >= 0.08 && v < 0.20 ? "auto" : "none");
  // "using overlays" text fades in
  const usingOverlaysOpacity = useTransform(scrollYProgress, [0.10, 0.11], [0, 1]);
  // Fade out "move execution..." and "using" text, leave only "overlays"
  const philosophyMainTextOpacity = useTransform(scrollYProgress, [0.12, 0.14], [1, 0]);
  // "overlays" stays visible longer then fades
  const overlaysOnlyOpacity = useTransform(scrollYProgress, [0.16, 0.18], [1, 0]);
  
  // Voice section (0.20 - 0.30) - extended for slower scroll, delayed fade out
  const voiceOpacity = useTransform(scrollYProgress, [0.20, 0.22, 0.28, 0.30], [0, 1, 1, 0]);
  const voicePointer = useTransform(scrollYProgress, (v) => v >= 0.20 && v < 0.30 ? "auto" : "none");
  
  // Notes section (0.30 - 0.40) - more pause after annotation
  const notesOpacity = useTransform(scrollYProgress, [0.30, 0.32, 0.38, 0.40], [0, 1, 1, 0]);
  const notesPointer = useTransform(scrollYProgress, (v) => v >= 0.30 && v < 0.40 ? "auto" : "none");
  
  // Chat section (0.40 - 0.50) - more pause after annotation
  const chatOpacity = useTransform(scrollYProgress, [0.40, 0.42, 0.48, 0.50], [0, 1, 1, 0]);
  const chatPointer = useTransform(scrollYProgress, (v) => v >= 0.40 && v < 0.50 ? "auto" : "none");
  
  // Browser section (0.50 - 0.60) - more pause after annotation
  const browserOpacity = useTransform(scrollYProgress, [0.50, 0.52, 0.58, 0.60], [0, 1, 1, 0]);
  const browserPointer = useTransform(scrollYProgress, (v) => v >= 0.50 && v < 0.60 ? "auto" : "none");
  
  // Combo section (0.60 - 0.68) - "voice + notes + chat + browser" text that collapses into pill
  const comboOpacity = useTransform(scrollYProgress, [0.60, 0.62, 0.66, 0.68], [0, 1, 1, 0]);
  const comboPointer = useTransform(scrollYProgress, (v) => v >= 0.60 && v < 0.68 ? "auto" : "none");
  // Text scale/collapse animation - text shrinks and moves to center
  const comboTextScale = useTransform(scrollYProgress, [0.62, 0.65], [1, 0]);
  const comboTextOpacity = useTransform(scrollYProgress, [0.62, 0.64], [1, 0]);
  // Pill appears as text disappears, then fades out
  const comboPillOpacity = useTransform(scrollYProgress, [0.64, 0.65, 0.66, 0.68], [0, 1, 1, 0]);
  const comboPillScale = useTransform(scrollYProgress, [0.64, 0.65], [0.5, 1]);
  
  // All In One Place section (0.68 - 0.80) - extended for overlay reveals
  const allInOnePlaceOpacity = useTransform(scrollYProgress, [0.68, 0.70, 0.78, 0.80], [0, 1, 1, 0]);
  const allInOnePlacePointer = useTransform(scrollYProgress, (v) => v >= 0.68 && v < 0.80 ? "auto" : "none");
  
  // Flow section (0.80 - 0.86)
  const flowOpacity = useTransform(scrollYProgress, [0.80, 0.82, 0.84, 0.86], [0, 1, 1, 0]);
  const flowPointer = useTransform(scrollYProgress, (v) => v >= 0.80 && v < 0.86 ? "auto" : "none");
  
  // Welcome section (0.86 - 0.92)
  const welcomeOpacity = useTransform(scrollYProgress, [0.86, 0.88, 0.90, 0.92], [0, 1, 1, 0]);
  const welcomePointer = useTransform(scrollYProgress, (v) => v >= 0.86 && v < 0.92 ? "auto" : "none");
  
  // Download section (0.92 - 1.0) - stays visible at end
  const downloadOpacity = useTransform(scrollYProgress, [0.92, 0.96, 1.0], [0, 1, 1]);
  const downloadPointer = useTransform(scrollYProgress, (v) => v >= 0.92 ? "auto" : "none");

  const { downloadUrl } = useLatestRelease();

  return (
    <div ref={containerRef} className="bg-[#fafafa] text-[#0a0a0a]">
      {/* Liquid Glass Background */}
      <div className="liquid-glass" />

      {/* Fixed Hero Section */}
      <motion.section 
        style={{ opacity: heroOpacity, pointerEvents: heroPointer }}
        className="fixed inset-0 flex flex-col items-center justify-center z-10"
      >
        {/* Logo */}
        <motion.div
          style={{ scale: logoScale, opacity: logoOpacity }}
          className="mb-4"
        >
          <Image
            src="/assets/dawn-logo.png"
            alt="Dawn"
            width={180}
            height={180}
            className="drop-shadow-2xl"
            priority
          />
        </motion.div>

        {/* Title */}
        <h1 className="font-serif text-6xl md:text-8xl tracking-tight mb-4">
          dawn
        </h1>

        {/* Tagline */}
        <p className="text-lg md:text-xl text-[#71717a] font-light tracking-wide mb-8">
          personal computing, reimagined
        </p>

        {/* Download Button */}
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-3 px-6 py-3 bg-[#0a0a0a] text-white rounded-full text-sm font-medium hover:bg-[#27272a] transition-all duration-300"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          download for mac
        </a>

        {/* Demo Link */}
        <a
          href="https://x.com/dsllwn/status/2015923879668044002"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-6 text-sm text-[#71717a] hover:text-[#0a0a0a] underline transition-colors duration-300"
        >
          demo
        </a>
      </motion.section>

      {/* Spacer for scroll */}
      <div className="h-screen" />

      {/* Philosophy Section */}
      <motion.section 
        style={{ opacity: philosophyOpacity, pointerEvents: philosophyPointer }}
        className="fixed inset-0 flex flex-col items-center justify-center px-6 z-10"
      >
        <div className="max-w-3xl text-center -mt-16">
          {/* Main text fades out leaving only "overlays" */}
          <motion.p 
            style={{ opacity: philosophyMainTextOpacity }}
            className="font-serif text-4xl md:text-5xl lg:text-6xl leading-tight text-[#0a0a0a]"
          >
            move execution to where{" "}<br />
            <span className="text-[#71717a]">intent</span>{" "}
            first appears,
          </motion.p>
          <motion.p 
            style={{ opacity: usingOverlaysOpacity }}
            className="font-serif text-4xl md:text-5xl lg:text-6xl leading-tight text-[#0a0a0a]"
          >
            <motion.span style={{ opacity: philosophyMainTextOpacity }}>using </motion.span>
            <motion.span style={{ opacity: overlaysOnlyOpacity }} className="text-[#71717a]">overlays</motion.span>
          </motion.p>
        </div>
      </motion.section>

      {/* Voice Section - Vertical Layout */}
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
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center gap-12">
          <div className="relative text-center">
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">notes</h3>
            <p className="text-lg md:text-xl text-[#71717a]">capture that thought</p>
            {notesProgress > 0.5 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute left-full top-1/2 -translate-y-1/2 ml-8 text-sm text-[#0a0a0a]/70 font-medium whitespace-nowrap text-left"
              >
                capture ideas instantly without leaving your current task
              </motion.p>
            )}
          </div>
          <div className="w-full">
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

      {/* Chat Section */}
      <motion.section 
        style={{ opacity: chatOpacity, pointerEvents: chatPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center gap-12">
          <div className="relative text-center">
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">chat</h3>
            <p className="text-lg md:text-xl text-[#71717a]">ask that question</p>
            {chatProgress > 0.5 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute right-full top-1/2 -translate-y-1/2 mr-8 text-sm text-[#0a0a0a]/70 font-medium whitespace-nowrap text-right"
              >
                get ai help anywhere, no app switching needed
              </motion.p>
            )}
          </div>
          <div className="w-full">
            <OverlayDemo
              type="chat"
              title="chat"
              shortcutDisplay="."
              screenImage="/assets/window-screens/chat-screen.png"
              overlayImage="/assets/overlays/chat-overlay.png"
              isActive={chatActive}
              sectionProgress={chatProgress}
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
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">browse</h3>
            <p className="text-lg md:text-xl text-[#71717a]">make that search</p>
            {browserProgress > 0.5 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute left-full top-1/2 -translate-y-1/2 ml-8 text-sm text-[#0a0a0a]/70 font-medium whitespace-nowrap text-left"
              >
                quick search without disrupting your workflow
              </motion.p>
            )}
          </div>
          <div className="w-full">
            <OverlayDemo
              type="browser"
              title="browser"
              shortcutDisplay="\"
              screenImage="/assets/window-screens/browser-screen.png"
              overlayImage="/assets/overlays/browser-overlay.png"
              isActive={browserActive}
              sectionProgress={browserProgress}
              hideAnnotation={true}
            />
          </div>
        </div>
      </motion.section>

      {/* Combo Section - "voice + notes + chat + browser" collapsing into pill */}
      <motion.section 
        style={{ opacity: comboOpacity, pointerEvents: comboPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 z-10"
      >
        <div className="relative flex flex-col items-center justify-center" style={{ transform: "translateY(-20px)" }}>
          {/* Text that shrinks and fades */}
          <motion.p 
            style={{ scale: comboTextScale, opacity: comboTextOpacity }}
            className="font-serif text-3xl md:text-4xl lg:text-5xl text-[#0a0a0a] text-center whitespace-nowrap"
          >
            voice{" "}
            <span className="text-[#71717a]">+</span>{" "}
            notes{" "}
            <span className="text-[#71717a]">+</span>{" "}
            chat{" "}
            <span className="text-[#71717a]">+</span>{" "}
            browser
          </motion.p>
          
          {/* Pill that appears */}
          <motion.div
            style={{ opacity: comboPillOpacity, scale: comboPillScale }}
            className="absolute"
          >
            <div
              style={{
                width: 48,
                height: 10,
                borderRadius: 12,
                background: "rgba(19, 19, 19, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
              }}
            />
          </motion.div>
        </div>
      </motion.section>

      {/* All In One Place Section */}
      <motion.section 
        style={{ opacity: allInOnePlaceOpacity, pointerEvents: allInOnePlacePointer }}
        className="fixed inset-0 flex items-center justify-center px-6 py-20 z-10"
      >
        <AllInOnePlace scrollProgress={allInOnePlaceProgress} isActive={allInOnePlaceActive} />
      </motion.section>

      {/* Without Breaking Flow Section */}
      <motion.section 
        style={{ opacity: flowOpacity, pointerEvents: flowPointer }}
        className="fixed inset-0 flex items-center justify-center px-6 z-10"
      >
        <div className="max-w-3xl text-center">
          <p className="font-serif text-4xl md:text-5xl lg:text-6xl leading-tight text-[#0a0a0a]">
            without breaking flow
          </p>
        </div>
      </motion.section>

      {/* Welcome Section */}
      <motion.section 
        style={{ opacity: welcomeOpacity, pointerEvents: welcomePointer }}
        className="fixed inset-0 flex items-center justify-center px-6 z-10"
      >
        <div className="max-w-3xl text-center">
          <p className="font-serif text-4xl md:text-5xl lg:text-6xl leading-relaxed text-[#0a0a0a]">
            welcome to <br /><span className="text-[#71717a]">overlay-first computing</span>
          </p>
        </div>
      </motion.section>

      {/* Download Section with Footer */}
      <motion.section 
        style={{ opacity: downloadOpacity, pointerEvents: downloadPointer }}
        className="fixed inset-0 flex flex-col items-center justify-center px-6 z-10"
      >
        <div className="text-center">
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-8">
            begin
          </h2>
          <a
            href={downloadUrl}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-[#0a0a0a] text-white rounded-full text-sm font-medium hover:bg-[#27272a] transition-all duration-300"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            download for mac
          </a>
          <p className="text-sm text-[#a1a1aa] mt-4">
            windows coming soon
          </p>
        </div>
        
        {/* Footer */}
        <footer className="absolute bottom-8 left-0 right-0 px-6">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/assets/dawn-logo.png"
                alt="Dawn"
                width={24}
                height={24}
                className="opacity-60"
              />
              <p className="text-sm text-[#71717a]">
                © 2026 dawn
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

      {/* Spacer for scroll - 11 sections * 100vh = 1100vh */}
      <div className="h-[1100vh]" />
    </div>
  );
}
