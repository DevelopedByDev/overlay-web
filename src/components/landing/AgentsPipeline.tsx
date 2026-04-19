"use client";

import { motion } from "framer-motion";

const STEPS = [
  { label: "Ask", value: "Define the work once." },
  { label: "Plan", value: "Pick tools, models, and sources." },
  { label: "Run", value: "Agents execute browser and workflow steps." },
  { label: "Return", value: "Outputs land back in the workspace." },
];

const AUTOMATION_RAIL = [
  "schedule overnight research",
  "monitor inboxes and docs",
  "run browser tasks in sequence",
  "drop outputs into projects",
];

export function AgentsPipeline({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-zinc-400" : "text-zinc-600";
  const heading = isDark ? "text-zinc-100" : "text-zinc-950";
  const border = isDark ? "border-white/10" : "border-black/8";

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 px-6 py-20 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(440px,1.22fr)] lg:items-end">
          <div>
            <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Let agents do the work while you sleep</p>
            <h2 className={`mt-4 max-w-md text-4xl tracking-tight md:text-5xl ${heading}`} style={{ fontFamily: "var(--font-serif)" }}>
              From prompt to execution to stored output.
            </h2>
            <p className={`mt-5 max-w-lg text-base leading-7 ${muted}`}>
              Overlay can turn a single request into a multi-step run across search, browser work, integrations, and output generation, then hand you the result when it’s done.
            </p>
          </div>

          <div className={`border-t pt-6 ${border}`}>
            <div className="grid gap-4 md:grid-cols-4">
              {STEPS.map((step, index) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.42, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className={`text-xs uppercase tracking-[0.2em] ${muted}`}>{step.label}</p>
                  <p className={`mt-3 text-sm leading-6 ${muted}`}>{step.value}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className={`mt-12 overflow-hidden rounded-[34px] border ${border} ${isDark ? "bg-[#0d0d10]/84" : "bg-white/84"} backdrop-blur-xl`}>
          <div className={`grid gap-4 p-4 md:grid-cols-[0.92fr_1.08fr]`}>
            <div className={`rounded-[28px] border p-5 ${border} ${isDark ? "bg-white/[0.03]" : "bg-black/[0.02]"}`}>
              <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Automation run</p>
              <div className="mt-8 space-y-4">
                {STEPS.map((step, index) => (
                  <div key={step.label} className="flex items-start gap-4">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs ${border}`}>
                      0{index + 1}
                    </div>
                    <div>
                      <p className={`text-sm ${heading}`}>{step.label}</p>
                      <p className={`mt-1 text-sm leading-6 ${muted}`}>{step.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px]">
              <div className={`h-full border ${border} ${isDark ? "bg-[#111115]" : "bg-[#fbfbfb]"}`}>
                <div className={`border-b px-5 py-4 ${border}`}>
                  <p className={`text-xs uppercase tracking-[0.24em] ${muted}`}>Asynchronous work</p>
                </div>
                <div className="space-y-4 p-5">
                  {AUTOMATION_RAIL.map((item, index) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0.3, x: -18 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.46, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      className={`flex items-center justify-between rounded-[22px] border px-4 py-4 ${border} ${
                        isDark ? "bg-white/[0.03]" : "bg-white"
                      }`}
                    >
                      <span className={`text-sm ${heading}`}>{item}</span>
                      <span className={`text-xs uppercase tracking-[0.2em] ${muted}`}>
                        {index < 2 ? "running" : "queued"}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
