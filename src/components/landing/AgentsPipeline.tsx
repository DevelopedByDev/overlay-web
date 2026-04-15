"use client";

import { motion, useInView } from "framer-motion";
import { Brain, Check, Clock, Layers, Store, Wrench, Zap } from "lucide-react";
import { useRef } from "react";

const STEPS = [
  { label: "trigger", Icon: Zap },
  { label: "agent thinks", Icon: Brain },
  { label: "actions", Icon: Wrench },
  { label: "result", Icon: Check },
];

const CARDS = [
  {
    Icon: Layers,
    title: "multi-step runs",
    desc: "chain tasks across tools in a single instruction",
  },
  {
    Icon: Clock,
    title: "scheduled automations",
    desc: "set it and forget it — agents work on your timeline",
  },
  {
    Icon: Store,
    title: "agent marketplace",
    desc: "install community-built agents for any workflow",
  },
];

const sectionInView = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function AgentsPipeline({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-[#71717a]";
  const heading = isDark ? "text-zinc-100" : "text-[#0a0a0a]";
  const cardBg = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200";
  const subText = isDark ? "text-zinc-300" : "text-zinc-700";
  const fgColor = isDark ? "border-zinc-300 text-zinc-300" : "border-zinc-800 text-zinc-800";
  const connectorColor = isDark ? "border-zinc-700" : "border-zinc-300";

  const pipelineRef = useRef<HTMLDivElement>(null);
  const inView = useInView(pipelineRef, { once: true, amount: 0.4 });

  return (
    <motion.section
      {...sectionInView}
      className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center gap-12 px-6 py-20"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className={`font-serif text-4xl md:text-5xl lg:text-6xl ${heading}`}>
          agents that work while you don&apos;t
        </h2>
        <p className={`max-w-md text-base md:text-lg ${muted}`}>
          multi-step tasks, scheduled automations, a marketplace of capabilities
        </p>
      </div>

      {/* Pipeline */}
      <div
        ref={pipelineRef}
        className="flex w-full max-w-3xl items-center justify-between gap-0"
      >
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex flex-1 items-center">
            {/* Node — monochrome square */}
            <motion.div
              initial={{ opacity: 0.2, scale: 0.85 }}
              animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0.2, scale: 0.85 }}
              transition={{ duration: 0.4, delay: i * 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-2"
            >
              <div className={`flex h-12 w-12 items-center justify-center border-2 ${fgColor}`}>
                <step.Icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-medium ${muted}`}>{step.label}</span>
            </motion.div>

            {/* Connector — plain line */}
            {i < STEPS.length - 1 && (
              <div className={`mx-2 flex-1 border-t-2 ${connectorColor}`} />
            )}
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="grid w-full max-w-3xl grid-cols-1 gap-px border border-[var(--border)] sm:grid-cols-3">
        {CARDS.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={`flex flex-col gap-2 p-4 ${cardBg}`}
          >
            <card.Icon className={`h-4 w-4 ${subText}`} />
            <span className={`text-sm font-medium ${subText}`}>{card.title}</span>
            <span className={`text-xs ${muted}`}>{card.desc}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
