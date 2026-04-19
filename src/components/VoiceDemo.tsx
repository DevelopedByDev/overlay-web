"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";

const WAVEFORM_BAR_COUNT = 7;
const WAVEFORM_BAR_WIDTH = 3;
const WAVEFORM_BAR_MAX_HEIGHT = 14;
const WAVEFORM_GAP = 2;

interface VoiceDemoProps {
  scrollProgress?: number; // 0-1 progress within the voice section
  isActive?: boolean;
}

export function VoiceDemo({ scrollProgress = 0, isActive = false }: VoiceDemoProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [audioLevels, setAudioLevels] = useState<number[]>(
    Array(WAVEFORM_BAR_COUNT).fill(0)
  );
  const [hasUserActivated, setHasUserActivated] = useState(false);
  const recordingStartTime = useRef<number>(0);
  const animationRef = useRef<number | null>(null);

  // Scroll-triggered text fill when user hasn't activated
  const scrollText = "omw be there in 5";
  const scrollFillStart = 0.10; // Start text fill early in section
  const scrollFillEnd = 0.50; // End text fill
  const scrollFillRange = scrollFillEnd - scrollFillStart;
  
  // Calculate how much text to show based on scroll progress
  const textFillProgress = !hasUserActivated && isActive && scrollProgress > scrollFillStart
    ? Math.min(1, (scrollProgress - scrollFillStart) / scrollFillRange)
    : 0;
  const scrollFilledText = textFillProgress > 0
    ? scrollText.slice(0, Math.floor(textFillProgress * scrollText.length))
    : "";
  
  // Text is complete - trigger "send" after 0.60 progress (sets sentMessage)
  const isTextComplete = scrollFilledText.length === scrollText.length;
  const shouldTriggerSend = !hasUserActivated && isActive && scrollProgress > 0.60 && isTextComplete;
  
  // Show waveform animation while scroll-filling
  const isScrollFilling = !hasUserActivated && isActive && scrollProgress > scrollFillStart && scrollProgress < scrollFillEnd;

  // Cursor blink effect
  useEffect(() => {
    if (!isRecording && !isProcessing && inputText === "") {
      const interval = setInterval(() => {
        setShowCursor((prev) => !prev);
      }, 530);
      return () => clearInterval(interval);
    }
    setShowCursor(true);
  }, [isRecording, isProcessing, inputText]);

  // Simulate audio levels during recording or scroll-filling
  useEffect(() => {
    if (isRecording || isScrollFilling) {
      let lastUpdate = 0;
      const updateLevels = (timestamp: number) => {
        // Throttle to ~8fps for slower, smoother oscillation
        if (timestamp - lastUpdate > 120) {
          const newLevels = Array(WAVEFORM_BAR_COUNT)
            .fill(0)
            .map(() => 0.3 + Math.random() * 0.7);
          setAudioLevels(newLevels);
          lastUpdate = timestamp;
        }
        animationRef.current = requestAnimationFrame(updateLevels);
      };
      
      // Small delay before starting animation
      const timeout = setTimeout(() => {
        animationRef.current = requestAnimationFrame(updateLevels);
      }, 50);
      
      return () => {
        clearTimeout(timeout);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setAudioLevels(Array(WAVEFORM_BAR_COUNT).fill(0));
    }
  }, [isRecording, isScrollFilling]);

  // Trigger send when scroll reaches threshold
  useEffect(() => {
    if (shouldTriggerSend && !sentMessage) {
      setSentMessage(scrollText);
    }
  }, [shouldTriggerSend, sentMessage, scrollText]);

  // Handle key events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check for Option/Alt + Space
      if (e.altKey && e.code === "Space" && !isRecording && !isProcessing) {
        e.preventDefault();
        posthog.capture('voice_demo_interacted', { trigger: 'keyboard' });
        setHasUserActivated(true);
        setIsRecording(true);
        recordingStartTime.current = Date.now();
      }
      // Check for Enter to send message
      if (e.code === "Enter" && inputText && !isRecording && !isProcessing) {
        e.preventDefault();
        setSentMessage(inputText);
        setInputText("");
      }
    },
    [isRecording, isProcessing, inputText]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === "Alt") && isRecording) {
        e.preventDefault();
        const recordingDuration = Date.now() - recordingStartTime.current;

        // Only process if held for at least 300ms
        if (recordingDuration >= 300) {
          setIsRecording(false);
          setIsProcessing(true);

          // Simulate processing delay then show result
          setTimeout(() => {
            setIsProcessing(false);
            // Type out the text character by character
            const text = "omw be there in 5";
            let index = 0;
            const typeInterval = setInterval(() => {
              if (index <= text.length) {
                setInputText(text.slice(0, index));
                index++;
              } else {
                clearInterval(typeInterval);
              }
            }, 30);
          }, 800);
        } else {
          // Quick release - cancel
          setIsRecording(false);
        }
      }
    },
    [isRecording]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Reset demo
  const resetDemo = () => {
    setInputText("");
    setSentMessage("");
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* iMessage UI Container - Dark Theme */}
      <div className="bg-[#1c1c1e] rounded-3xl overflow-hidden">
        {/* Messages Area */}
        <div className="p-8 pb-6 min-h-[180px] flex flex-col justify-end gap-3">
          {/* Received Message Bubble */}
          <div className="flex justify-start">
            <div className="bg-[#3a3a3c] rounded-2xl rounded-bl-md px-5 py-3 max-w-[85%]">
              <p className="text-white text-[17px]">when will you get here?</p>
            </div>
          </div>
          
          {/* Sent Message Bubble */}
          <AnimatePresence>
            {sentMessage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="flex justify-end"
              >
                <div className="bg-[#007aff] rounded-2xl rounded-br-md px-5 py-3 max-w-[85%]">
                  <p className="text-white text-[17px]">{sentMessage}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="px-8 pb-8">
          <div className="relative flex items-center gap-4">
            {/* Plus Button */}
            <button className="w-12 h-12 rounded-full border-2 border-[#3a3a3c] flex items-center justify-center shrink-0">
              <svg
                className="w-6 h-6 text-[#8e8e93]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>

            {/* Text Input */}
            <div className="flex-1 relative bg-transparent border-2 border-[#3a3a3c] rounded-full px-5 py-3.5 flex items-center min-h-[52px]">
              {!inputText && !isRecording && !isProcessing && !scrollFilledText && (
                <span className="text-[17px] text-[#8e8e93] absolute left-[28px]">iMessage</span>
              )}
              <span className="text-[17px] text-white flex items-center">
                {!isRecording && !isProcessing && inputText === "" && !scrollFilledText && (
                  <span
                    className={`inline-block w-[2px] h-[22px] bg-[#007aff] transition-opacity ${
                      showCursor ? "opacity-100" : "opacity-0"
                    }`}
                  />
                )}
                {inputText || scrollFilledText}
                {scrollFilledText && !inputText && !isTextComplete && (
                  <span className="inline-block w-[2px] h-[22px] bg-[#007aff] animate-pulse" />
                )}
              </span>
              
              {/* Waveform Overlay - show during recording, processing, OR scroll filling */}
              <AnimatePresence>
                {(isRecording || isProcessing || isScrollFilling) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ 
                      duration: 0.2, 
                      ease: [0.4, 0, 0.2, 1] 
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <div
                      className="flex items-center justify-center px-1 py-2"
                      style={{ 
                        gap: WAVEFORM_GAP,
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {isProcessing
                        ? // Processing animation - bouncing wave
                          Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, i) => (
                            <motion.div
                              key={i}
                              style={{
                                width: WAVEFORM_BAR_WIDTH,
                                background: "#fff",
                                borderRadius: 1,
                              }}
                              animate={{
                                height: [2, WAVEFORM_BAR_MAX_HEIGHT * 0.6, 2],
                              }}
                              transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                delay: i * 0.05,
                                ease: "easeInOut",
                              }}
                            />
                          ))
                        : // Recording waveform
                          audioLevels.map((level, i) => (
                            <div
                              key={i}
                              style={{
                                width: WAVEFORM_BAR_WIDTH,
                                height: Math.max(3, level * WAVEFORM_BAR_MAX_HEIGHT),
                                background: "#fff",
                                borderRadius: 2,
                                transition: "height 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                              }}
                            />
                          ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Instruction Text */}
      <div className="mt-6 text-center">
        <AnimatePresence mode="wait">
          {sentMessage ? (
            <motion.button
              key="reset"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              onClick={resetDemo}
              className="text-sm text-[#007aff] hover:underline"
            >
              try again
            </motion.button>
          ) : inputText ? (
            <motion.p
              key="send-hint"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-sm text-[#71717a]"
            >
              press{" "}
              <kbd className="px-1.5 py-0.5 bg-[#e4e4e7] rounded text-[11px] font-mono mx-0.5">
                enter
              </kbd>{" "}
              to send
            </motion.p>
          ) : (
            <motion.p
              key="instruction"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-sm text-[#71717a]"
            >
              {isRecording ? (
                <span className="text-[#0a0a0a] font-medium">recording... release to transcribe</span>
              ) : isProcessing ? (
                <span className="text-[#0a0a0a] font-medium">transcribing...</span>
              ) : (
                <>
                  hold and release{" "}
                  <kbd className="px-1.5 py-0.5 bg-[#e4e4e7] rounded text-[11px] font-mono mx-0.5">
                    ⌥
                  </kbd>
                  <kbd className="px-1.5 py-0.5 bg-[#e4e4e7] rounded text-[11px] font-mono mx-0.5">
                    space
                  </kbd>{" "}
                  to{" "}
                  <button
                    onClick={() => {
                      posthog.capture('voice_demo_interacted', { trigger: 'click' });
                      setHasUserActivated(true);
                      setIsRecording(true);
                      recordingStartTime.current = Date.now();
                      // Auto-release after 1.5s for demo
                      setTimeout(() => {
                        setIsRecording(false);
                        setIsProcessing(true);
                        setTimeout(() => {
                          setIsProcessing(false);
                          const text = "omw be there in 5";
                          let index = 0;
                          const typeInterval = setInterval(() => {
                            if (index <= text.length) {
                              setInputText(text.slice(0, index));
                              index++;
                            } else {
                              clearInterval(typeInterval);
                            }
                          }, 30);
                        }, 800);
                      }, 1500);
                    }}
                    className="underline hover:text-[#0a0a0a] transition-colors"
                  >
                    respond
                  </button>
                </>
              )}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
