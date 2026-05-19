"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface OverlayDemoProps {
  type: "notes" | "chat" | "browser";
  title: string;
  shortcutDisplay: string;
  screenImage: string;
  overlayImage: string;
  isActive?: boolean;
  sectionProgress?: number; // 0-1 progress within this section
  hideAnnotation?: boolean; // Hide annotation (when shown in page.tsx instead)
}

const overlayAnnotations: Record<string, string> = {
  notes: "capture ideas instantly without leaving your current task",
  chat: "get ai help anywhere, no app switching needed",
  browser: "quick search without disrupting your workflow",
};

export function OverlayDemo({
  type,
  title,
  shortcutDisplay,
  screenImage,
  overlayImage,
  isActive = false,
  sectionProgress = 0,
  hideAnnotation = false,
}: OverlayDemoProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [showAnnotation, setShowAnnotation] = useState(false);
  const [hasManuallyToggled, setHasManuallyToggled] = useState(false);
  const [screenImageError, setScreenImageError] = useState(false);
  const [overlayImageError, setOverlayImageError] = useState(false);
  const prevProgressRef = useRef(sectionProgress);
  const hasOpenedRef = useRef(false);

  // Auto-open overlay when scrolled enough within section, hide when scrolling back up
  useEffect(() => {
    const isScrollingDown = sectionProgress > prevProgressRef.current;
    const isScrollingUp = sectionProgress < prevProgressRef.current;
    prevProgressRef.current = sectionProgress;

    if (!isActive) {
      // Reset when leaving section - use timeout to avoid sync setState
      if (!hasManuallyToggled && showOverlay) {
        const timer = setTimeout(() => setShowOverlay(false), 0);
        hasOpenedRef.current = false;
        return () => clearTimeout(timer);
      }
      hasOpenedRef.current = false;
      return;
    }

    if (hasManuallyToggled) return;

    // Open overlay after 40% progress within the section (gives time to see the screen first)
    if (isScrollingDown && sectionProgress > 0.4 && !hasOpenedRef.current) {
      const timer = setTimeout(() => setShowOverlay(true), 0);
      hasOpenedRef.current = true;
      return () => clearTimeout(timer);
    }
    
    // Hide overlay when scrolling back up past 30%
    if (isScrollingUp && sectionProgress < 0.3 && hasOpenedRef.current) {
      const timer = setTimeout(() => {
        setShowOverlay(false);
        setShowAnnotation(false);
      }, 0);
      hasOpenedRef.current = false;
      return () => clearTimeout(timer);
    }
    
    // Show annotation after overlay is shown and more scrolling (70% progress)
    if (isScrollingDown && sectionProgress > 0.7 && hasOpenedRef.current && !showAnnotation) {
      const timer = setTimeout(() => setShowAnnotation(true), 0);
      return () => clearTimeout(timer);
    }
    
    // Hide annotation when scrolling back up past 60%
    if (isScrollingUp && sectionProgress < 0.6 && showAnnotation) {
      const timer = setTimeout(() => setShowAnnotation(false), 0);
      return () => clearTimeout(timer);
    }
  }, [isActive, sectionProgress, hasManuallyToggled, showOverlay, showAnnotation]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check for the specific shortcut (cmd + key)
      const isCorrectShortcut =
        (type === "notes" && e.metaKey && e.code === "Slash") ||
        (type === "chat" && e.metaKey && e.code === "Period") ||
        (type === "browser" && e.metaKey && e.code === "Backslash");

      if (isCorrectShortcut) {
        e.preventDefault();
        setShowOverlay((prev) => !prev);
      }
    },
    [type]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Get overlay positioning based on type
  const getOverlayClasses = () => {
    switch (type) {
      case "notes":
        return "absolute bottom-8 -right-16 w-[55%]";
      case "chat":
        return "absolute -bottom-4 -left-16 w-[50%]";
      case "browser":
        return "absolute bottom-8 -right-24 w-[75%]";
      default:
        return "absolute bottom-8 right-4 w-[50%]";
    }
  };

  const toggleOverlay = () => {
    setHasManuallyToggled(true);
    setShowOverlay((prev) => !prev);
  };

  // Get annotation positioning based on type (sides of overlay)
  const getAnnotationClasses = () => {
    switch (type) {
      case "notes":
        // Right side of the notes overlay
        return "absolute top-1/3 -right-4 translate-x-full";
      case "chat":
        // Left side of the chat overlay  
        return "absolute top-1/3 -left-4 -translate-x-full";
      case "browser":
        // Above the browser overlay (at top of overlay, not below screen title)
        return "absolute top-0 right-[30%] -translate-y-full -mt-3";
      default:
        return "absolute top-1/3 -right-4 translate-x-full";
    }
  };

  if (screenImageError) return null;

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Screen Container */}
      <div className="relative rounded-2xl overflow-visible bg-white">
        {/* Base Screen */}
        <div className="rounded-2xl overflow-hidden">
          <Image
            src={screenImage}
            alt={`${title} base screen`}
            width={1400}
            height={900}
            className="w-full h-auto object-cover"
            onError={() => setScreenImageError(true)}
          />
        </div>

        {/* Overlay */}
        <AnimatePresence>
          {showOverlay && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{
                duration: 0.25,
                ease: [0.4, 0, 0.2, 1],
              }}
              className={`${getOverlayClasses()} rounded-xl overflow-hidden`}
            >
              {!overlayImageError && (
                <Image
                  src={overlayImage}
                  alt={`${title} overlay`}
                  width={800}
                  height={600}
                  className="w-full h-auto object-cover"
                  onError={() => setOverlayImageError(true)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Annotation - appears after more scrolling (unless hidden) */}
        <AnimatePresence>
          {showAnnotation && !hideAnnotation && (
            <motion.div
              initial={{ opacity: 0, y: type === "browser" ? -10 : 0, x: type === "notes" ? 10 : type === "chat" ? -10 : 0 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, y: type === "browser" ? -10 : 0, x: type === "notes" ? 10 : type === "chat" ? -10 : 0 }}
              transition={{ duration: 0.3 }}
              className={getAnnotationClasses()}
            >
              <p className={`text-sm text-[#0a0a0a] font-medium leading-relaxed max-w-[200px] ${type === "browser" ? "text-center" : type === "notes" ? "text-left" : "text-right"}`}>
                {overlayAnnotations[type]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instruction Text */}
      <div className="mt-6 text-center">
        <p className="text-sm text-[#71717a]">
          press{" "}
          <kbd className="px-1.5 py-0.5 bg-[#e4e4e7] rounded text-[11px] font-mono mx-0.5">
            ⌘
          </kbd>
          <kbd className="px-1.5 py-0.5 bg-[#e4e4e7] rounded text-[11px] font-mono mx-0.5">
            {shortcutDisplay}
          </kbd>{" "}
          to{" "}
          <button
            onClick={toggleOverlay}
            className="underline hover:text-[#0a0a0a] transition-colors"
          >
            {showOverlay ? "hide" : "show"} {title} overlay
          </button>
        </p>
      </div>
    </div>
  );
}
