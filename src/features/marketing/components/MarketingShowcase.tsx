import Image from "next/image";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Brain,
  BriefcaseBusiness,
  Check,
  Code2,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AudiencePageKey } from "@/shared/marketing/marketing";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MarketingBand({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("border-t border-[var(--border)] px-5 py-16 md:px-8 md:py-24", className)}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function EditorialIntro({
  label,
  title,
  body,
  align = "left",
  className,
}: {
  label?: string;
  title: ReactNode;
  body?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cx(align === "center" ? "mx-auto text-center" : "", "max-w-3xl", className)}>
      {label ? (
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted-light)]">{label}</p>
      ) : null}
      <h1 className="mt-4 text-balance text-5xl leading-[0.95] tracking-tight md:text-7xl">{title}</h1>
      {body ? <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-[var(--muted)] md:text-lg">{body}</p> : null}
    </div>
  );
}

export function MarketingCtaRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mt-8 flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

export function PrimaryMarketingLink({
  children,
  href,
  external,
}: {
  children: ReactNode;
  href: string;
  external?: boolean;
}) {
  const className =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--button-primary-bg)] px-5 text-sm font-medium text-[var(--button-primary-text)] transition-opacity hover:opacity-90";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
      </a>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function SecondaryMarketingLink({
  children,
  href,
  external,
}: {
  children: ReactNode;
  href: string;
  external?: boolean;
}) {
  const className =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] px-5 text-sm font-medium text-[var(--button-secondary-text)] transition-colors hover:bg-[var(--surface-muted)]";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
      </a>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

const demoPalette = {
  light: {
    root: "border-[var(--border)] bg-white text-[#0a0a0a] shadow-[0_18px_60px_rgba(0,0,0,0.08)]",
    sidebar: "border-[#e4e4e7] bg-[#f5f5f5]",
    top: "border-[#e4e4e7] bg-white",
    panel: "border-[#e4e4e7] bg-white",
    panelSubtle: "border-[#e4e4e7] bg-[#fafafa]",
    active: "bg-[#ededed] text-[#0a0a0a]",
    muted: "text-[#71717a]",
    faint: "text-[#a1a1aa]",
    control: "border-[#e4e4e7] bg-[#f5f5f5]",
    sendButton: "bg-[#0a0a0a] text-white",
  },
  dark: {
    root: "border-[#27272a] bg-[#09090b] text-[#f5f5f5] shadow-[0_18px_60px_rgba(0,0,0,0.35)]",
    sidebar: "border-[#27272a] bg-[#111113]",
    top: "border-[#27272a] bg-[#09090b]",
    panel: "border-[#27272a] bg-[#111113]",
    panelSubtle: "border-[#27272a] bg-[#151518]",
    active: "bg-[#1c1c20] text-[#f5f5f5]",
    muted: "text-[#a1a1aa]",
    faint: "text-[#71717a]",
    control: "border-[#27272a] bg-[#151518]",
    sendButton: "bg-[#f5f5f5] text-[#0a0a0a]",
  },
};

const navItems = [
  { label: "Chat", icon: MessageSquare },
  { label: "Files", icon: FileText },
  { label: "Memory", icon: Brain },
  { label: "Automations", icon: Workflow },
  { label: "Connectors", icon: Plug },
];

export function ProductWorkspaceDemo({
  tone = "light",
  compact = false,
  title = "Hi there!",
}: {
  tone?: "light" | "dark";
  compact?: boolean;
  title?: string;
}) {
  const p = demoPalette[tone];
  return (
    <div className={cx("overflow-hidden rounded-lg border", p.root)}>
      <div className={cx("grid min-h-[420px]", compact ? "md:grid-cols-[150px_minmax(0,1fr)]" : "md:grid-cols-[190px_minmax(0,1fr)_220px]")}>
        <aside className={cx("hidden border-r p-3 md:block", p.sidebar)}>
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-current opacity-70" />
            <span className="font-medium">overlay</span>
          </div>
          <div className="mt-5 space-y-1">
            {navItems.map((item, index) => (
              <div
                key={item.label}
                className={cx("flex items-center gap-2 rounded-md px-2.5 py-2 text-xs", index === 0 ? p.active : p.muted)}
              >
                <item.icon className="h-3.5 w-3.5" strokeWidth={1.7} />
                {item.label}
              </div>
            ))}
          </div>
          <div className={cx("mt-6 rounded-md border p-2", p.control)}>
            <div className="text-[11px] text-current opacity-70">Recent work</div>
            {["Q1 planning", "Customer analysis", "Worksheet draft"].map((item) => (
              <div key={item} className={cx("mt-2 truncate text-[11px]", p.faint)}>
                {item}
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div className={cx("flex h-12 items-center justify-between border-b px-4", p.top)}>
            <div className="text-xs font-medium">New conversation</div>
            <div className="flex items-center gap-2">
              <span className={cx("rounded-md border px-2.5 py-1 text-[11px]", p.control)}>GPT-5.4</span>
              <span className={cx("hidden rounded-md border px-2.5 py-1 text-[11px] sm:inline-flex", p.control)}>Tools</span>
            </div>
          </div>
          <div className="flex min-h-[360px] flex-col items-center justify-center px-4 py-8">
            <p className="text-3xl tracking-tight md:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
              {title}
            </p>
            <div className={cx("mt-8 w-full max-w-xl rounded-lg border p-4", p.panel)}>
              <p className={cx("text-sm", p.faint)}>Ask anything, use @ to reference files, memory, tools...</p>
              <div className="mt-7 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className={p.muted}>+</span>
                  <span className={p.muted}>@</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cx("hidden text-xs sm:inline", p.muted)}>Chat</span>
                  <span className={cx("flex h-9 w-9 items-center justify-center rounded-md", p.sendButton)}>
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid w-full max-w-xl gap-2 sm:grid-cols-2">
              {["Summarize this folder", "Create a report", "What changed?", "Build an automation"].map((prompt) => (
                <div key={prompt} className={cx("rounded-md border px-3 py-2 text-xs", p.panelSubtle, p.muted)}>
                  {prompt}
                </div>
              ))}
            </div>
          </div>
        </div>

        {!compact ? (
          <aside className={cx("hidden border-l p-3 md:block", p.sidebar)}>
            <RailBlock title="Files" items={["Q1 plan.docx", "Financials.xlsx", "Roadmap.pdf"]} palette={p} />
            <RailBlock title="Memory" items={["Project brief", "Customer prefs", "Launch plan"]} palette={p} className="mt-5" />
            <div className="mt-5 flex flex-wrap gap-1.5">
              {["Drive", "Notion", "Slack"].map((item) => (
                <span key={item} className={cx("rounded-md border px-2 py-1 text-[10px]", p.control, p.muted)}>
                  {item}
                </span>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function RailBlock({
  title,
  items,
  palette,
  className,
}: {
  title: string;
  items: string[];
  palette: (typeof demoPalette)["light"];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">{title}</p>
        <span className={cx("text-[10px]", palette.faint)}>View all</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {items.map((item) => (
          <div key={item} className={cx("flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px]", palette.panel)}>
            <span className="truncate">{item}</span>
            <span className={palette.faint}>&gt;</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const audienceData = {
  business: {
    icon: BriefcaseBusiness,
    title: "Market analysis",
    context: "Sources, browser tasks, and team memory stay attached to the brief.",
    steps: ["Search source set", "Compare model answers", "Draft recommendation", "Schedule follow-up"],
    side: ["Research", "Operations", "Governance"],
  },
  content: {
    icon: Sparkles,
    title: "Campaign draft",
    context: "Ideas, scripts, images, and video prompts live in one project.",
    steps: ["Capture voice note", "Summarize references", "Draft script", "Generate assets"],
    side: ["Ideation", "Drafting", "Generation"],
  },
  developers: {
    icon: Code2,
    title: "Debug workflow",
    context: "Switch models, run browser checks, and execute code without leaving the thread.",
    steps: ["Read repo notes", "Run sandbox", "Inspect browser", "Open pull request"],
    side: ["Models", "Browser", "MCP tools"],
  },
  education: {
    icon: GraduationCap,
    title: "School AI layer",
    context: "Teachers, students, parents, and admins use a governed private workspace.",
    steps: ["Create worksheet", "Generate practice plan", "Approve parent summary", "Review adoption"],
    side: ["Teachers", "Students", "Parents", "Admins"],
  },
} satisfies Record<AudiencePageKey, {
  icon: LucideIcon;
  title: string;
  context: string;
  steps: string[];
  side: string[];
}>;

export function AudienceWorkflowDemo({ audience, tone = "light" }: { audience: AudiencePageKey; tone?: "light" | "dark" }) {
  const p = demoPalette[tone];
  const data = audienceData[audience];
  const Icon = data.icon;

  return (
    <div className={cx("overflow-hidden rounded-lg border", p.root)}>
      <div className={cx("flex h-12 items-center justify-between border-b px-4", p.top)}>
        <div className="flex items-center gap-2 text-xs">
          <span className={cx("flex h-6 w-6 items-center justify-center rounded-md border", p.control)}>
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
          </span>
          <span>{data.title}</span>
        </div>
        <span className={cx("rounded-md border px-2.5 py-1 text-[11px]", p.control)}>Private workspace</span>
      </div>
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="p-4">
          <div className={cx("rounded-lg border p-4", p.panel)}>
            <p className="text-sm font-medium">{data.title}</p>
            <p className={cx("mt-2 text-xs leading-5", p.muted)}>{data.context}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.steps.map((step, index) => (
                <div key={step} className={cx("rounded-md border p-3", p.panelSubtle)}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 text-[10px] text-emerald-500">
                      {index + 1}
                    </span>
                    <p className="text-xs font-medium">{step}</p>
                  </div>
                  <div className={cx("mt-3 h-1.5 overflow-hidden rounded-full", tone === "dark" ? "bg-[#27272a]" : "bg-[#e4e4e7]")}>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${46 + index * 13}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Model routing", "Use the right model per step"],
              ["Files + memory", "Keep context attached"],
              ["Audit trail", "Govern work without drag"],
            ].map(([label, text]) => (
              <div key={label} className={cx("rounded-md border p-3", p.panelSubtle)}>
                <p className="text-xs font-medium">{label}</p>
                <p className={cx("mt-1 text-[11px] leading-4", p.muted)}>{text}</p>
              </div>
            ))}
          </div>
        </div>
        <aside className={cx("border-t p-4 md:border-l md:border-t-0", p.sidebar)}>
          <p className="text-xs font-medium">Workspace views</p>
          <div className="mt-3 space-y-2">
            {data.side.map((item, index) => (
              <div key={item} className={cx("rounded-md border p-3 text-xs", index === 1 ? "border-blue-500/65" : p.panel)}>
                <p className="font-medium">{item}</p>
                <p className={cx("mt-1 text-[11px] leading-4", p.muted)}>
                  {index === 1 ? "Selected view" : "Configured"}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function PricingControlPreview({ amount = "$24" }: { amount?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]">
      <div className="grid border-b border-[var(--border)] text-xs md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        {["Capability", "Free", "Paid", "Enterprise"].map((heading) => (
          <div key={heading} className="border-b border-[var(--border)] px-4 py-3 font-medium last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
            {heading}
          </div>
        ))}
      </div>
      {[
        ["AI chat + tools", "Auto", "Premium", "Curated"],
        ["File storage", "10 MB", "Budget based", "Custom"],
        ["Automations", "Basic", "Included", "Governed"],
        ["On-prem/private", "-", "-", "Available"],
      ].map((row) => (
        <div key={row[0]} className="grid border-b border-[var(--border)] text-sm last:border-b-0 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          {row.map((cell, index) => (
            <div key={`${row[0]}-${index}`} className={cx("px-4 py-3 md:border-r md:last:border-r-0", index === 0 ? "text-[var(--foreground)]" : "text-[var(--muted)]")}>
              {cell}
            </div>
          ))}
        </div>
      ))}
      <div className="grid gap-4 border-t border-[var(--border)] bg-[var(--surface-muted)] p-4 md:grid-cols-[1fr_1fr]">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">Monthly budget</span>
            <span className="font-medium">{amount}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-subtle)]">
            <div className="h-full w-2/3 rounded-full bg-[var(--foreground)]" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-[var(--muted)]">
          {["Models", "Storage", "Runs"].map((item) => (
            <div key={item} className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-2">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrincipleGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] md:grid-cols-4">
      {[
        { icon: Lock, title: "Private by default", body: "Control data flow, model access, and workspace policy." },
        { icon: Code2, title: "Open source", body: "Inspect, self-host, extend, and adapt the interface." },
        { icon: Bot, title: "Model choice", body: "Route work by quality, speed, cost, and governance." },
        { icon: Zap, title: "Context compounds", body: "Files, notes, memory, and tools stay attached to work." },
      ].map((item) => (
        <article key={item.title} className="bg-[var(--surface-elevated)] p-5">
          <item.icon className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.7} />
          <h3 className="mt-5 text-sm font-medium">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
        </article>
      ))}
    </div>
  );
}

export function ScreenshotFrame({
  src,
  alt,
  label,
  className,
}: {
  src: string;
  alt: string;
  label?: string;
  className?: string;
}) {
  return (
    <figure className={cx("overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]", className)}>
      {label ? (
        <figcaption className="border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">{label}</figcaption>
      ) : null}
      <Image src={src} alt={alt} width={1440} height={920} className="h-auto w-full" />
    </figure>
  );
}

export function TrustStrip() {
  return (
    <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
      {[
        { icon: ShieldCheck, label: "Private", text: "On-prem or private deployment paths." },
        { icon: Code2, label: "Open", text: "Auditable and extensible codebase." },
        { icon: Search, label: "Grounded", text: "Files, web, and tools in one run." },
        { icon: ImageIcon, label: "Multimodal", text: "Text, image, video, browser, and code." },
      ].map((item) => (
        <div key={item.label} className="flex items-start gap-3 bg-[var(--surface-elevated)] p-4">
          <item.icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)]">
            <Check className="h-3 w-3" strokeWidth={1.9} />
          </span>
          <p className="text-sm leading-6 text-[var(--muted)]">{item}</p>
        </div>
      ))}
    </div>
  );
}
