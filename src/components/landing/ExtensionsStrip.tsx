"use client";

import { motion } from "framer-motion";

const INTEGRATIONS = [
  { label: "Gmail", icon: "📧" },
  { label: "Slack", icon: "💬" },
  { label: "Notion", icon: "📋" },
  { label: "GitHub", icon: "🐙" },
  { label: "MCP", icon: "🔌" },
  { label: "Browser", icon: "🌐" },
  { label: "Custom", icon: "🛠️" },
  { label: "Zapier", icon: "⚡" },
  { label: "Linear", icon: "📐" },
  { label: "Figma", icon: "🎨" },
];

const sectionInView = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function ExtensionsStrip({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const chipBg = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200";
  const chipText = isDark ? "text-zinc-300" : "text-zinc-700";

  return (
    <motion.section
      {...sectionInView}
      className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center gap-10 px-6 py-20"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className={`font-serif text-4xl md:text-5xl lg:text-6xl ${heading}`}>
          open source. infinitely extensible.
        </h2>
        <p className={`max-w-md text-base md:text-lg ${muted}`}>
          MCPs, skills, integrations, apps — connect your entire stack
        </p>
      </div>

      {/* Integration marquee — boxy chips */}
      <div className="w-full overflow-hidden">
        <div className="flex">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            className="flex shrink-0 gap-px whitespace-nowrap"
          >
            {[...INTEGRATIONS, ...INTEGRATIONS].map((item, i) => (
              <div
                key={i}
                className={`overlay-interactive inline-flex items-center gap-2 border px-4 py-2 text-sm ${chipBg} ${chipText}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

    </motion.section>
  );
}
