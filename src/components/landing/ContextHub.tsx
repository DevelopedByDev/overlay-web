"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const SPOKES = [
  { label: "files", icon: "📄", angle: -45 },
  { label: "memories", icon: "🧠", angle: 45 },
  { label: "notes", icon: "📝", angle: 135 },
  { label: "integrations", icon: "🔗", angle: 225 },
];

const sectionInView = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function RadialHub({ isDark }: { isDark: boolean }) {
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const nodeBg = isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-zinc-200";
  const coreBg = isDark ? "bg-zinc-900 border-zinc-600" : "bg-white border-zinc-300";
  const spokeLine = isDark ? "stroke-zinc-700" : "stroke-zinc-300";

  return (
    <div className="relative h-64 w-64 flex-shrink-0">
      <svg className="absolute inset-0" width="256" height="256" viewBox="0 0 256 256">
        {SPOKES.map((spoke, i) => {
          const rad = (spoke.angle * Math.PI) / 180;
          const r = 88;
          const x2 = 128 + r * Math.cos(rad);
          const y2 = 128 + r * Math.sin(rad);
          return (
            <motion.line
              key={i}
              x1="128"
              y1="128"
              x2={x2}
              y2={y2}
              className={spokeLine}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
            />
          );
        })}
      </svg>

      {/* Center core — square */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 ${coreBg}`}
      >
        <Image src="/assets/overlay-logo.png" alt="Overlay" width={28} height={28} />
      </motion.div>

      {/* Spoke nodes — square */}
      {SPOKES.map((spoke, i) => {
        const rad = (spoke.angle * Math.PI) / 180;
        const r = 88;
        const cx = 128 + r * Math.cos(rad);
        const cy = 128 + r * Math.sin(rad);
        return (
          <motion.div
            key={spoke.label}
            initial={{ scale: 0.5, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 border ${nodeBg}`}
            style={{ left: cx, top: cy }}
          >
            <span className="text-base leading-none">{spoke.icon}</span>
            <span className={`text-[9px] font-medium ${muted}`}>{spoke.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

export function ContextHub({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const borderColor = isDark ? "border-zinc-800" : "border-zinc-200";

  return (
    <motion.section
      {...sectionInView}
      className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center gap-12 px-6 py-20"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className={`font-serif text-4xl md:text-5xl lg:text-6xl ${heading}`}>
          all your context, always there
        </h2>
        <p className={`max-w-md text-base md:text-lg ${muted}`}>
          files, memories, notes, integrations — the ai remembers so you don&apos;t have to
        </p>
      </div>

      <div className="flex w-full max-w-4xl flex-col items-center gap-12 md:flex-row md:justify-center">
        <RadialHub isDark={isDark} />

        {/* Note screen placeholder */}
        <div className="relative w-full max-w-sm md:w-1/2">
          <div className={`flex h-64 items-center justify-center border border-dashed ${borderColor} ${isDark ? "bg-zinc-900" : "bg-zinc-50"} p-6 text-center`}>
            <p className={`font-mono text-xs ${muted}`}>
              [CAPTURE NEEDED] Screenshot: Overlay Notes panel with a formatted markdown note, dark mode, 600×400px. Save as /assets/window-screens/note-screen.png
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, x: -20, y: 10 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute -bottom-5 -left-4 w-2/5 max-w-[200px]"
          >
            <div className={`flex h-20 items-center justify-center border border-dashed ${borderColor} ${isDark ? "bg-zinc-900" : "bg-zinc-50"} p-2 text-center`}>
              <p className={`font-mono text-[8px] leading-tight ${muted}`}>
                [CAPTURE NEEDED] Floating note overlay, transparent BG PNG. Save as /assets/overlays/note-overlay.png
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
