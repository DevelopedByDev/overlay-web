import type { Metadata } from "next";
import type { AudiencePageKey } from "@/lib/marketing";
import { MARKETING_GITHUB_URL, MARKETING_SALES_URL } from "@/lib/marketing";

type AudiencePageContent = {
  metadata: Metadata;
  eyebrow: string;
  title: string;
  description: string;
  support: string;
  features: Array<{ title: string; body: string; meta: string }>;
  demoTitle: string;
  demoBody: string;
  demoColumns: Array<{ label: string; value: string; detail: string }>;
  proofItems: string[];
  primaryCta: { label: string; href: string; external?: boolean };
  secondaryCta: { label: string; href: string; external?: boolean };
};

export const AUDIENCE_PAGE_CONTENT: Record<AudiencePageKey, AudiencePageContent> = {
  business: {
    metadata: {
      title: "Overlay for business",
      description:
        "Secure context, flexible model routing, automations, and integrations for teams that need one serious AI workspace.",
    },
    eyebrow: "Enterprise",
    title: "Overlay for business",
    description:
      "Give teams one AI interaction layer for research, operations, browser work, and automations without scattering context across five separate tools.",
    support:
      "Overlay keeps conversations, files, notes, outputs, and integrations in one surface so work can move from question to execution with less operational drag.",
    features: [
      {
        meta: "Security and control",
        title: "Context stays usable, not buried.",
        body: "Bring notes, files, and institutional knowledge into the same workspace where teams actually ask questions and run work.",
      },
      {
        meta: "Model flexibility",
        title: "Use the best model for the job.",
        body: "Route different tasks to different frontier models without retraining the team on a new interface every month.",
      },
      {
        meta: "Automation",
        title: "Turn repeated workflows into runs.",
        body: "Schedule research, browser tasks, and follow-up work so outputs land back in the project without manual orchestration.",
      },
    ],
    demoTitle: "A team workspace for operations, research, and execution.",
    demoBody:
      "Overlay can act as the control surface between human operators, the best available models, live browser work, and the internal context that makes those runs accurate.",
    demoColumns: [
      { label: "Workspace", value: "Shared", detail: "Notes, outputs, and projects remain aligned across the team." },
      { label: "Models", value: "Flexible", detail: "Use the right reasoning, speed, or vision model per task." },
      { label: "Automations", value: "Persistent", detail: "Keep recurring work running beyond a single session." },
    ],
    proofItems: [
      "Model-agnostic workflow design instead of lock-in to one lab.",
      "Useful for customer support, research, internal operations, and browser-heavy execution.",
      "Open-source posture for teams that care how the layer works.",
    ],
    primaryCta: { label: "Contact sales", href: MARKETING_SALES_URL, external: true },
    secondaryCta: { label: "Open app", href: "/auth/sign-in?redirect=%2Fapp%2Fchat" },
  },
  education: {
    metadata: {
      title: "Overlay for education",
      description:
        "Research, guided study, grounded notes, and organized context in one AI workspace for students, teachers, and learning teams.",
    },
    eyebrow: "Education",
    title: "Overlay for education",
    description:
      "Research, study, and synthesize in one place, with grounded notes, source-aware chat, and a workspace that actually keeps the context together.",
    support:
      "Overlay helps students, educators, and academic teams move from material collection to explanation, revision, and output without losing the thread.",
    features: [
      {
        meta: "Research",
        title: "Keep source material close to the answer.",
        body: "Use files, notes, and browser research as working context so explanations and summaries stay grounded in what you’re actually reading.",
      },
      {
        meta: "Study",
        title: "Turn capture into understanding.",
        body: "Voice notes, notebook-style drafting, and chat live inside the same workspace for faster iteration and recall.",
      },
      {
        meta: "Organization",
        title: "Projects keep the semester from fragmenting.",
        body: "Separate classes, topics, or research tracks into projects while still keeping one consistent product surface.",
      },
    ],
    demoTitle: "Research and study without tab chaos.",
    demoBody:
      "Overlay combines notes, source material, summaries, and follow-up questions so a learning workflow feels like one system instead of a pile of disconnected apps.",
    demoColumns: [
      { label: "Notes", value: "Grounded", detail: "Voice captures and text notes stay tied to the same project context." },
      { label: "Sources", value: "Visible", detail: "Browser and file context remain close to the working answer." },
      { label: "Outputs", value: "Organized", detail: "Summaries, briefs, and drafts accumulate where they belong." },
    ],
    proofItems: [
      "Useful for coursework, self-study, research prep, and academic operations.",
      "The same workspace supports capture, synthesis, and revision.",
      "A better fit than bouncing between chat tabs and separate note tools.",
    ],
    primaryCta: { label: "Open app", href: "/auth/sign-in?redirect=%2Fapp%2Fchat" },
    secondaryCta: { label: "Contact sales", href: MARKETING_SALES_URL, external: true },
  },
  content: {
    metadata: {
      title: "Overlay for content",
      description:
        "Research, drafting, voice capture, and multimodal generation in one AI workspace for content teams and independent creators.",
    },
    eyebrow: "Content",
    title: "Overlay for content",
    description:
      "Move from research to script to visual output in one workspace, with voice notes, drafts, browser tasks, and generation loops that stay in context.",
    support:
      "Overlay is built for content systems, not single prompts: capture ideas quickly, synthesize source material, generate assets, and keep every revision attached to the same project.",
    features: [
      {
        meta: "Ideation",
        title: "Capture momentum before it disappears.",
        body: "Voice notes and scratchpad workflows make it easy to catch hooks, outlines, and angles while the idea is still fresh.",
      },
      {
        meta: "Research and drafting",
        title: "Research and writing share one surface.",
        body: "Keep source material, references, and the working draft in the same project so fewer ideas die in the handoff.",
      },
      {
        meta: "Multimodal generation",
        title: "Generate assets without losing the brief.",
        body: "Image, video, and document outputs remain tied to the same conversation and creative context.",
      },
    ],
    demoTitle: "A creative workflow that doesn’t reset at every stage.",
    demoBody:
      "Overlay lets content teams treat research, writing, generation, and revision as parts of one system so the brief survives all the way to the output.",
    demoColumns: [
      { label: "Capture", value: "Fast", detail: "Voice notes and quick prompts turn stray ideas into working material." },
      { label: "Draft", value: "Structured", detail: "Summaries, outlines, and scripts stay linked to source context." },
      { label: "Generate", value: "Multimodal", detail: "Images, video, and docs live alongside the project history." },
    ],
    proofItems: [
      "Useful for marketing teams, editors, solo creators, and creative ops.",
      "Better continuity between research, writing, and generation.",
      "Fewer disconnected tools and fewer lost revision trails.",
    ],
    primaryCta: { label: "Open app", href: "/auth/sign-in?redirect=%2Fapp%2Fchat" },
    secondaryCta: { label: "Contact sales", href: MARKETING_SALES_URL, external: true },
  },
  developers: {
    metadata: {
      title: "Overlay for developers",
      description:
        "Model routing, browser tasks, extensions, integrations, and open-source control for developers building with AI every day.",
    },
    eyebrow: "Developers",
    title: "Overlay for developers",
    description:
      "Use the best model, the right tool, and your own context in one open-source AI workspace built for technical workflows.",
    support:
      "Overlay gives developers a place to route across models, run browser tasks, connect extensions and integrations, and keep project context close to the code and output.",
    features: [
      {
        meta: "Model routing",
        title: "Reasoning, speed, vision, and search in one loop.",
        body: "Choose the strongest model for each step of the workflow without changing products or rebuilding prompts from scratch.",
      },
      {
        meta: "Tools and browser",
        title: "Use live tools, not just text completion.",
        body: "Browser tasks, search, outputs, and workflow steps can be part of the same interaction instead of separate utilities.",
      },
      {
        meta: "Open source",
        title: "Inspect and extend the layer itself.",
        body: "Overlay is designed for teams that care about extensibility, connector breadth, and the long-term leverage of an open interface layer.",
      },
    ],
    demoTitle: "An AI control surface that feels closer to a dev tool than a toy chat app.",
    demoBody:
      "Overlay helps technical teams keep context, tool usage, browsing, and model choice together so the product can support real workflows instead of isolated prompt experiments.",
    demoColumns: [
      { label: "Models", value: "Routable", detail: "Switch inside the same thread based on reasoning depth or speed." },
      { label: "Browser", value: "Live", detail: "Run real browser workflows as part of the same task." },
      { label: "Extensions", value: "Open", detail: "Integrations, MCPs, and open-source control stay within reach." },
    ],
    proofItems: [
      "Built for developers who want control, not just a polished chat window.",
      "Supports tool use, browsing, context, and outputs in one product loop.",
      "Pairs well with technical workflows that need repeatability and traceability.",
    ],
    primaryCta: { label: "Open app", href: "/auth/sign-in?redirect=%2Fapp%2Fchat" },
    secondaryCta: { label: "GitHub", href: MARKETING_GITHUB_URL, external: true },
  },
};
