"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface OverlayDemoProps {
  type: "notes" | "chat" | "browser";
  title: string;
  shortcutDisplay: string;
  screenImage: string;
  overlayImage: string;
}

export function OverlayDemo({
  type,
  title,
  shortcutDisplay,
  screenImage,
  overlayImage,
}: OverlayDemoProps) {
  const [showOverlay, setShowOverlay] = useState(false);

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
        return "absolute bottom-8 -left-16 w-[55%]";
      case "browser":
        return "absolute bottom-8 -right-24 w-[75%]";
      default:
        return "absolute bottom-8 right-4 w-[50%]";
    }
  };

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
              <Image
                src={overlayImage}
                alt={`${title} overlay`}
                width={800}
                height={600}
                className="w-full h-auto object-cover"
              />
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
          to {showOverlay ? "hide" : "show"} {title} overlay
        </p>
      </div>
    </div>
  );
}
