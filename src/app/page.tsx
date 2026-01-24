"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { VoiceDemo } from "@/components/VoiceDemo";
import { OverlayDemo } from "@/components/OverlayDemo";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const logoScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.6]);
  const logoOpacity = useTransform(scrollYProgress, [0.1, 0.2], [1, 0]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  return (
    <div ref={containerRef} className="min-h-[600vh] bg-[#fafafa] text-[#0a0a0a]">
      {/* Liquid Glass Background */}
      <div className="liquid-glass" />

      {/* Fixed Hero Section */}
      <motion.section 
        style={{ opacity: heroOpacity }}
        className="fixed inset-0 flex flex-col items-center justify-center z-10"
      >
        {/* Logo */}
        <motion.div
          style={{ scale: logoScale, opacity: logoOpacity }}
          className="mb-8"
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
          href="https://github.com/DevelopedByDev/dawn-landing/releases/download/v1.0.0/dawn-1.0.0.dmg"
          className="inline-flex items-center gap-3 px-6 py-3 bg-[#0a0a0a] text-white rounded-full text-sm font-medium hover:bg-[#27272a] transition-all duration-300"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          download for mac
        </a>
      </motion.section>

      {/* Spacer for scroll */}
      <div className="h-screen" />

      {/* Philosophy Section */}
      <section className="relative z-20 min-h-screen flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ duration: 1 }}
          className="max-w-3xl text-center"
        >
          <p className="font-serif text-4xl md:text-5xl lg:text-6xl leading-tight text-[#0a0a0a]">
            move execution to where{" "}<br />
            <span className="text-[#71717a]">intent</span>{" "}
            first appears
          </p>
        </motion.div>
      </section>

      {/* Voice Section - Vertical Layout */}
      <section className="relative z-20 min-h-screen flex items-center justify-center px-6 py-20">
        <div className="max-w-xl mx-auto w-full flex flex-col items-center gap-12">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">voice</h3>
            <p className="text-lg md:text-xl text-[#71717a]">speak anywhere</p>
          </motion.div>

          {/* Interactive Demo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="w-full"
          >
            <VoiceDemo />
          </motion.div>
        </div>
      </section>

      {/* Notes Section */}
      <section className="relative z-20 min-h-screen flex items-center justify-center px-6 py-20">
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">notes</h3>
            <p className="text-lg md:text-xl text-[#71717a]">capture instantly</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="w-full"
          >
            <OverlayDemo
              type="notes"
              title="notes"
              shortcutDisplay="/"
              screenImage="/assets/window-screens/note-screen.png"
              overlayImage="/assets/overlays/note-overlay.png"
            />
          </motion.div>
        </div>
      </section>

      {/* Chat Section */}
      <section className="relative z-20 min-h-screen flex items-center justify-center px-6 py-20">
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">chat</h3>
            <p className="text-lg md:text-xl text-[#71717a]">think together</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="w-full"
          >
            <OverlayDemo
              type="chat"
              title="chat"
              shortcutDisplay="."
              screenImage="/assets/window-screens/chat-screen.png"
              overlayImage="/assets/overlays/chat-overlay.png"
            />
          </motion.div>
        </div>
      </section>

      {/* Browser Section */}
      <section className="relative z-20 min-h-screen flex items-center justify-center px-6 py-20">
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl mb-4">browse</h3>
            <p className="text-lg md:text-xl text-[#71717a]">search in place</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="w-full"
          >
            <OverlayDemo
              type="browser"
              title="browser"
              shortcutDisplay="\"
              screenImage="/assets/window-screens/browser-screen.png"
              overlayImage="/assets/overlays/browser-overlay.png"
            />
          </motion.div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="relative z-20 min-h-screen flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ duration: 1 }}
          className="max-w-3xl text-center"
        >
          <p className="font-serif text-3xl md:text-4xl lg:text-5xl leading-relaxed text-[#0a0a0a]">
            welcome to <br /><span className="text-[#71717a]">overlay-first computing</span>
          </p>
        </motion.div>
      </section>

      {/* Download Section */}
      <section className="relative z-20 min-h-screen flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-8">
            begin
          </h2>
          <a
            href="https://github.com/DevelopedByDev/dawn-landing/releases/download/v1.0.0/dawn-1.0.0.dmg"
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
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-20 py-12 px-6 border-t border-[#e4e4e7]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
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
              href="mailto:hello@getdawn.io"
              className="text-sm text-[#71717a] hover:text-[#0a0a0a] transition-colors"
            >
              contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
