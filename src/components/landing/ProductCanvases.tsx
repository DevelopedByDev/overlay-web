"use client";

import { motion } from "framer-motion";

function surfaceClasses(isDark: boolean) {
  return isDark
    ? {
        border: "border-white/10",
        base: "bg-[#111113]",
        soft: "bg-white/[0.03]",
        softer: "bg-white/[0.02]",
        text: "text-zinc-100",
        muted: "text-zinc-400",
      }
    : {
        border: "border-black/8",
        base: "bg-[#fbfbfa]",
        soft: "bg-black/[0.025]",
        softer: "bg-black/[0.018]",
        text: "text-zinc-950",
        muted: "text-zinc-600",
      };
}

export function WorkspaceCanvas({ isDark }: { isDark: boolean }) {
  const ui = surfaceClasses(isDark);

  return (
    <div className={`overflow-hidden rounded-[24px] border ${ui.border} ${ui.base}`}>
      <div className={`grid min-h-[560px] lg:grid-cols-[220px_minmax(0,1fr)]`}>
        <aside className={`border-r ${ui.border} ${ui.softer}`}>
          <div className={`flex h-14 items-center gap-3 border-b px-4 ${ui.border}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${isDark ? "bg-zinc-700" : "bg-zinc-300"}`} />
            <span className={`text-lg tracking-tight ${ui.text}`} style={{ fontFamily: "var(--font-serif)" }}>
              overlay
            </span>
          </div>
          <div className="px-3 py-4">
            <div className={`mb-3 rounded-[14px] px-4 py-3 text-sm ${ui.text} ${ui.soft}`}>Chat</div>
            <div className="space-y-1">
              {["Notes", "Knowledge", "Extensions", "Projects", "Automations", "Settings"].map((item) => (
                <div key={item} className={`rounded-[14px] px-4 py-3 text-sm ${ui.muted}`}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className={`border-t px-3 py-3 ${ui.border}`}>
            <div className={`rounded-[14px] border px-4 py-3 text-sm ${ui.border} ${ui.base} ${ui.muted}`}>New chat</div>
            <div className="mt-3 space-y-2">
              {["Draft a clearer GTM plan", "Compare three coding tools", "Summarize the research article"].map((item) => (
                <div key={item} className={`truncate rounded-[12px] px-3 py-2 text-xs ${ui.muted}`}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div>
          <div className={`flex h-14 items-center justify-between border-b px-5 ${ui.border}`}>
            <span className={`text-sm ${ui.text}`}>New conversation</span>
            <div className="flex items-center gap-2">
              {["Auto", "Text", "Image", "Video"].map((item, index) => (
                <span
                  key={item}
                  className={`rounded-full px-3 py-1.5 text-xs ${
                    index === 1
                      ? isDark
                        ? "border border-white/12 bg-white/5 text-zinc-100"
                        : "border border-black/8 bg-white text-zinc-950"
                      : `${ui.muted} ${ui.softer}`
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="flex min-h-[506px] flex-col items-center justify-center px-6 py-10">
            <h3 className={`text-5xl tracking-tight ${ui.text}`} style={{ fontFamily: "var(--font-serif)" }}>
              the all-in-one AI workspace.
            </h3>
            <div className={`mt-8 w-full max-w-[640px] rounded-[22px] border p-5 ${ui.border} ${ui.base}`}>
              <p className={`text-sm ${ui.muted}`}>Ask anything...</p>
              <div className="mt-12 flex items-end justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${ui.soft} ${ui.text}`}>+</span>
                  <span className={`rounded-full border px-3 py-1.5 text-xs ${ui.border} ${ui.text}`}>Act</span>
                  <span className={`rounded-full px-3 py-1.5 text-xs ${ui.muted} ${ui.softer}`}>Ask</span>
                </div>
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-[12px] ${isDark ? "bg-zinc-600 text-white" : "bg-zinc-400 text-white"}`}>
                  ↗
                </span>
              </div>
            </div>
            <div className="mt-6 grid w-full max-w-[640px] gap-3 md:grid-cols-2">
              {[
                "Draft a clear plan for organizing your project timeline",
                "Compare the features of three different coding tools",
                "Summarize key points from this research article",
                "Organize the main ideas of this chapter into a checklist",
              ].map((item) => (
                <div key={item} className={`rounded-[16px] border px-4 py-4 text-sm leading-6 ${ui.border} ${ui.soft} ${ui.muted}`}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContextCanvas({ isDark }: { isDark: boolean }) {
  const ui = surfaceClasses(isDark);

  return (
    <div className={`overflow-hidden rounded-[30px] border ${ui.border} ${ui.base}`}>
      <div className={`border-b px-5 py-4 ${ui.border}`}>
        <p className={`text-xs uppercase tracking-[0.22em] ${ui.muted}`}>Context system</p>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[0.78fr_1.22fr]">
        <div className={`rounded-[24px] border p-4 ${ui.border} ${ui.soft}`}>
          <p className={`text-sm ${ui.text}`}>Project memory</p>
          <div className="mt-5 space-y-3">
            {[
              "voice note from founder call",
              "pricing objections and replies",
              "enterprise requirements checklist",
              "draft response stored in outputs",
            ].map((item) => (
              <div key={item} className={`rounded-[18px] px-3 py-3 text-sm leading-6 ${ui.softer} ${ui.text}`}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-[24px] border p-4 ${ui.border} ${ui.soft}`}>
          <div className="grid gap-4 md:grid-cols-[1fr_0.92fr]">
            <div className="space-y-4">
              <div className={`rounded-[20px] border p-4 ${ui.border} ${ui.base}`}>
                <p className={`text-xs uppercase tracking-[0.2em] ${ui.muted}`}>Knowledge</p>
                <div className="mt-4 grid gap-3">
                  {["files", "memories", "outputs", "sources"].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${isDark ? "bg-zinc-100" : "bg-zinc-950"}`} />
                      <span className={`text-sm capitalize ${ui.text}`}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`rounded-[20px] border p-4 ${ui.border} ${ui.base}`}>
                <p className={`text-xs uppercase tracking-[0.2em] ${ui.muted}`}>Organized by project</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Enterprise", "Research", "Content", "Product"].map((item) => (
                    <span key={item} className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${ui.muted} ${ui.softer}`}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className={`rounded-[20px] border p-4 ${ui.border} ${ui.base}`}>
              <p className={`text-xs uppercase tracking-[0.2em] ${ui.muted}`}>Linked integrations</p>
              <div className="mt-6 grid gap-3">
                {["Gmail", "GitHub", "Calendar", "MCP server", "Browser tasks"].map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className={`flex items-center justify-between rounded-[18px] px-3 py-3 ${ui.softer}`}
                  >
                    <span className={`text-sm ${ui.text}`}>{item}</span>
                    <span className={`text-[10px] uppercase tracking-[0.18em] ${ui.muted}`}>connected</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModelCanvas({ isDark, accent }: { isDark: boolean; accent: string }) {
  const ui = surfaceClasses(isDark);
  const modelBadges = [
    { label: "Claude", color: accent },
    { label: "GPT", color: "#10a37f" },
    { label: "Gemini", color: "#2563eb" },
    { label: "Grok", color: "#db2777" },
  ];

  return (
    <div className={`overflow-hidden rounded-[30px] border ${ui.border} ${ui.base}`}>
      <div className={`flex items-center justify-between border-b px-5 py-4 ${ui.border}`}>
        <p className={`text-xs uppercase tracking-[0.22em] ${ui.muted}`}>Model routing</p>
        <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white`} style={{ backgroundColor: accent }}>
          Active model
        </span>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className={`rounded-[24px] border p-4 ${ui.border} ${ui.soft}`}>
          <div className="space-y-2">
            {["Reasoning", "Speed", "Vision", "Search", "Code"].map((item, index) => (
              <div
                key={item}
                className={`flex items-center justify-between rounded-[18px] px-3 py-3 ${
                  index === 0 ? "" : ui.softer
                }`}
                style={index === 0 ? { backgroundColor: `${accent}18`, border: `1px solid ${accent}40` } : undefined}
              >
                <span className={`text-sm ${ui.text}`}>{item}</span>
                <span className={`text-[10px] uppercase tracking-[0.18em] ${ui.muted}`}>
                  {index === 0 ? "best match" : "available"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={`rounded-[24px] border p-4 ${ui.border} ${ui.soft}`}>
          <div className="space-y-3">
            <div className={`max-w-[80%] rounded-[20px] px-4 py-3 text-sm leading-6 ${ui.softer} ${ui.text}`}>
              Compare the strongest ways to automate an enterprise onboarding workflow.
            </div>
            <div className={`rounded-[22px] border p-4 ${ui.border} ${ui.base}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${ui.text}`}>Recommended path</span>
                <span className={`text-[10px] uppercase tracking-[0.18em] ${ui.muted}`}>thread preserved</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  "Use a reasoning-heavy model for workflow planning.",
                  "Switch to a faster model for draft generation and edits.",
                  "Keep the same tool context, sources, and history across both steps.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className={`mt-2 h-1.5 w-1.5 rounded-full`} style={{ backgroundColor: accent }} />
                    <span className={`text-sm leading-6 ${ui.text}`}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {modelBadges.map((item) => (
                <span
                  key={item.label}
                  className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white"
                  style={{ backgroundColor: item.color }}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
