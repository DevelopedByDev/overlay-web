"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

// Dimensions matching OverlayWindow
const IDLE_WIDTH = 48;
const IDLE_HEIGHT = 10;
const EXPANDED_WIDTH = 200;
const EXPANDED_HEIGHT = 48;
const WAVEFORM_BAR_COUNT = 13;
const WAVEFORM_BAR_WIDTH = 2.5;
const WAVEFORM_BAR_MAX_HEIGHT = 15;
const WAVEFORM_GAP = 1.5;

type OverlayType = "note" | "transcription" | "chat" | "browser";

// Icon components
const NotebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6h4"/>
    <path d="M2 10h4"/>
    <path d="M2 14h4"/>
    <path d="M2 18h4"/>
    <rect width="16" height="20" x="4" y="2" rx="2"/>
    <path d="M16 2v20"/>
  </svg>
);

const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>
);

const MessageIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
  </svg>
);

const GlobeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </svg>
);

const SquareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
    <rect width="14" height="14" x="5" y="5" rx="2"/>
  </svg>
);

const PauseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect width="4" height="16" x="6" y="4"/>
    <rect width="4" height="16" x="14" y="4"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="6 3 20 12 6 21 6 3"/>
  </svg>
);

interface AllInOnePlaceProps {
  scrollProgress?: number; // 0-1 progress within this section for sequential overlay reveal
  isActive?: boolean;
}

export function AllInOnePlace({ scrollProgress = 0, isActive = false }: AllInOnePlaceProps) {
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayType>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [showAllOverlays, setShowAllOverlays] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(
    Array(WAVEFORM_BAR_COUNT).fill(0)
  );
  const animationRef = useRef<number | null>(null);
  const prevProgressRef = useRef(scrollProgress);

  // Scroll-triggered sequential overlay reveal (clockwise: transcription -> notes -> chat -> browser)
  // On scroll up, hide in anticlockwise order (browser -> chat -> notes -> transcription)
  useEffect(() => {
    if (!isActive || hasUserInteracted) return;

    const isScrollingDown = scrollProgress > prevProgressRef.current;
    const isScrollingUp = scrollProgress < prevProgressRef.current;
    prevProgressRef.current = scrollProgress;

    // Sequential reveal on scroll down
    // Transcription at 15%, Notes at 30%, Chat at 45%, Browser at 60%
    if (isScrollingDown) {
      if (scrollProgress > 0.15 && !showTranscription) {
        setTimeout(() => setShowTranscription(true), 0);
      }
      if (scrollProgress > 0.30 && !activeOverlays.has("note")) {
        setTimeout(() => setActiveOverlays(prev => new Set(prev).add("note")), 0);
      }
      if (scrollProgress > 0.45 && !activeOverlays.has("chat")) {
        setTimeout(() => setActiveOverlays(prev => new Set(prev).add("chat")), 0);
      }
      if (scrollProgress > 0.60 && !activeOverlays.has("browser")) {
        setTimeout(() => setActiveOverlays(prev => new Set(prev).add("browser")), 0);
      }
    }
    
    // Sequential hide on scroll up (anticlockwise: browser -> chat -> notes -> transcription)
    if (isScrollingUp) {
      if (scrollProgress < 0.55 && activeOverlays.has("browser")) {
        setTimeout(() => setActiveOverlays(prev => {
          const next = new Set(prev);
          next.delete("browser");
          return next;
        }), 0);
      }
      if (scrollProgress < 0.40 && activeOverlays.has("chat")) {
        setTimeout(() => setActiveOverlays(prev => {
          const next = new Set(prev);
          next.delete("chat");
          return next;
        }), 0);
      }
      if (scrollProgress < 0.25 && activeOverlays.has("note")) {
        setTimeout(() => setActiveOverlays(prev => {
          const next = new Set(prev);
          next.delete("note");
          return next;
        }), 0);
      }
      if (scrollProgress < 0.10 && showTranscription) {
        setTimeout(() => setShowTranscription(false), 0);
      }
    }
  }, [scrollProgress, isActive, hasUserInteracted, showTranscription, activeOverlays]);

  // Simulate audio levels during recording
  useEffect(() => {
    if (isRecording && !isPaused) {
      let lastUpdate = 0;
      const updateLevels = (timestamp: number) => {
        if (timestamp - lastUpdate > 80) {
          const newLevels = Array(WAVEFORM_BAR_COUNT)
            .fill(0)
            .map(() => 0.2 + Math.random() * 0.8);
          setAudioLevels(newLevels);
          lastUpdate = timestamp;
        }
        animationRef.current = requestAnimationFrame(updateLevels);
      };

      const timeout = setTimeout(() => {
        animationRef.current = requestAnimationFrame(updateLevels);
      }, 50);

      return () => {
        clearTimeout(timeout);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isRecording, isPaused]);

  const toggleOverlay = (type: OverlayType) => {
    setHasUserInteracted(true);
    if (type === "transcription") {
      if (isRecording) {
        return;
      }
      setIsRecording(true);
      setIsPaused(false);
      setShowTranscription(false);
      setActiveOverlays((prev) => new Set(prev).add(type));
    } else {
      setActiveOverlays((prev) => {
        const next = new Set(prev);
        if (next.has(type)) {
          next.delete(type);
        } else {
          next.add(type);
        }
        return next;
      });
    }
  };

  const handlePause = () => {
    if (!isPaused) {
      setAudioLevels(Array(WAVEFORM_BAR_COUNT).fill(0.1));
    }
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setIsRecording(false);
    setIsPaused(false);
    setShowTranscription(true);
  };

  const resetTranscription = () => {
    setShowTranscription(false);
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      next.delete("transcription");
      return next;
    });
  };

  const toggleAllOverlays = () => {
    setHasUserInteracted(true);
    if (showAllOverlays) {
      setActiveOverlays(new Set());
      setShowAllOverlays(false);
      setIsRecording(false);
      setShowTranscription(false);
    } else {
      setActiveOverlays(new Set(["note", "chat", "browser"]));
      setShowTranscription(true);
      setShowAllOverlays(true);
    }
  };

  // Count active overlays for determining if pill should show buttons
  const activeOverlayCount = activeOverlays.size + (showTranscription ? 1 : 0);
  const hasScrollTriggeredOverlays = !hasUserInteracted && isActive && activeOverlayCount > 0;
  
  // Get dimensions based on state - expand to show buttons when overlays appear
  const getDimensions = () => {
    if (isRecording) {
      return { width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT };
    }
    if (isHovered || hasScrollTriggeredOverlays) {
      return { width: EXPANDED_WIDTH, height: EXPANDED_HEIGHT };
    }
    return { width: IDLE_WIDTH, height: IDLE_HEIGHT };
  };

  const { width, height } = getDimensions();
  const isExpanded = isHovered || isRecording || hasScrollTriggeredOverlays;
  // Show buttons when expanded (either by hover or scroll-triggered overlays)
  const shouldShowButtons = showButtons || hasScrollTriggeredOverlays;

  return (
    <>
      {/* Note Overlay - Left edge of screen */}
      <AnimatePresence>
        {activeOverlays.has("note") && (
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-10"
            style={{ marginLeft: "-180px" }}
          >
            <Image
              src="/assets/overlays/note-overlay.png"
              alt="Note Overlay"
              width={600}
              height={480}
              className="rounded-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Overlay - Top edge of screen - z-60 to be above navbar */}
      <AnimatePresence>
        {activeOverlays.has("chat") && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-1/2 -translate-x-1/2 top-0 z-60"
            style={{ marginTop: "-260px" }}
          >
            <Image
              src="/assets/overlays/chat-overlay.png"
              alt="Chat Overlay"
              width={550}
              height={400}
              className="rounded-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Browser Overlay - Right edge of screen */}
      <AnimatePresence>
        {activeOverlays.has("browser") && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-10"
            style={{ marginRight: "-200px" }}
          >
            <Image
              src="/assets/overlays/browser-overlay.png"
              alt="Browser Overlay"
              width={680}
              height={540}
              className="rounded-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcription Overlay - Fixed at bottom, cropped */}
      <AnimatePresence>
        {showTranscription && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-1/2 -translate-x-1/2 bottom-0 z-10 cursor-pointer"
            style={{ marginBottom: "-120px" }}
            onClick={resetTranscription}
          >
            <Image
              src="/assets/overlays/transcription-overlay.png"
              alt="Transcription Result"
              width={600}
              height={380}
              className="rounded-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex flex-col items-center justify-center gap-4">
        {/* "all in" text */}
        <p className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0a0a]">
          all in
        </p>

        {/* Bean Control Panel */}
        <div
          className="relative z-30"
          style={{ width: EXPANDED_WIDTH + 32, height: EXPANDED_HEIGHT + 32 }}
          onMouseEnter={() => {
            if (!isRecording) {
              setIsHovered(true);
              setShowButtons(true);
            }
          }}
          onMouseLeave={() => {
            if (!isRecording) {
              setIsHovered(false);
              setShowButtons(false);
            }
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            {/* Control bar */}
            <div
              style={{
                width,
                height,
                borderRadius: isExpanded ? 28 : 12,
                background: isExpanded ? "rgba(19, 19, 19, 0.95)" : "rgba(19, 19, 19, 0.8)",
                border: isExpanded ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(255, 255, 255, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: isRecording ? 10 : isExpanded ? 10 : WAVEFORM_GAP,
                padding: isExpanded ? "0 10px" : 0,
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {isRecording ? (
                <>
                  {/* Stop button */}
                  <button
                    onClick={handleStop}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{
                      background: "#dc2626",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <SquareIcon />
                  </button>

                  {/* Waveform */}
                  <div style={{ display: "flex", alignItems: "center", gap: WAVEFORM_GAP }}>
                    {audioLevels.map((level, i) => (
                      <div
                        key={i}
                        style={{
                          width: WAVEFORM_BAR_WIDTH,
                          height: Math.max(2, level * WAVEFORM_BAR_MAX_HEIGHT),
                          background: "#fff",
                          borderRadius: 1,
                          transition: "height 0.05s ease",
                        }}
                      />
                    ))}
                  </div>

                  {/* Pause/Play button */}
                  <button
                    onClick={handlePause}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <span className="text-white/70">
                      {isPaused ? <PlayIcon /> : <PauseIcon />}
                    </span>
                  </button>
                </>
              ) : isExpanded && shouldShowButtons ? (
                <>
                  <button
                    onClick={() => toggleOverlay("transcription")}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{
                      background: showTranscription ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                      border: showTranscription ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid rgba(255, 255, 255, 0.12)",
                      animation: hasScrollTriggeredOverlays ? "none" : "buttonFadeIn 0.12s ease-out forwards",
                      animationDelay: hasScrollTriggeredOverlays ? "0ms" : "180ms",
                      opacity: hasScrollTriggeredOverlays ? 1 : 0,
                    }}
                  >
                    <span style={{ color: showTranscription ? "#fff" : "rgba(255,255,255,0.7)" }}>
                      <MicIcon />
                    </span>
                  </button>
                  <button
                    onClick={() => toggleOverlay("note")}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{
                      background: activeOverlays.has("note") ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                      border: activeOverlays.has("note") ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid rgba(255, 255, 255, 0.12)",
                      animation: hasScrollTriggeredOverlays ? "none" : "buttonFadeIn 0.12s ease-out forwards",
                      animationDelay: hasScrollTriggeredOverlays ? "0ms" : "200ms",
                      opacity: hasScrollTriggeredOverlays ? 1 : 0,
                    }}
                  >
                    <span style={{ color: activeOverlays.has("note") ? "#fff" : "rgba(255,255,255,0.7)" }}>
                      <NotebookIcon />
                    </span>
                  </button>
                  <button
                    onClick={() => toggleOverlay("chat")}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{
                      background: activeOverlays.has("chat") ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                      border: activeOverlays.has("chat") ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid rgba(255, 255, 255, 0.12)",
                      animation: hasScrollTriggeredOverlays ? "none" : "buttonFadeIn 0.12s ease-out forwards",
                      animationDelay: hasScrollTriggeredOverlays ? "0ms" : "220ms",
                      opacity: hasScrollTriggeredOverlays ? 1 : 0,
                    }}
                  >
                    <span style={{ color: activeOverlays.has("chat") ? "#fff" : "rgba(255,255,255,0.7)" }}>
                      <MessageIcon />
                    </span>
                  </button>
                  <button
                    onClick={() => toggleOverlay("browser")}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                    style={{
                      background: activeOverlays.has("browser") ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                      border: activeOverlays.has("browser") ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid rgba(255, 255, 255, 0.12)",
                      animation: hasScrollTriggeredOverlays ? "none" : "buttonFadeIn 0.12s ease-out forwards",
                      animationDelay: hasScrollTriggeredOverlays ? "0ms" : "240ms",
                      opacity: hasScrollTriggeredOverlays ? 1 : 0,
                    }}
                  >
                    <span style={{ color: activeOverlays.has("browser") ? "#fff" : "rgba(255,255,255,0.7)" }}>
                      <GlobeIcon />
                    </span>
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* "one place" text */}
        <p className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0a0a]">
          one place
        </p>

        {/* Subtitle */}
        <p className="text-sm text-[#71717a] mt-2">
          hover over and press any of the buttons to{" "}
          <button
            onClick={toggleAllOverlays}
            className="underline hover:text-[#0a0a0a] transition-colors"
          >
            {showAllOverlays ? "hide overlays" : "open overlays"}
          </button>
        </p>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes buttonFadeIn {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
