import type { Metadata } from "next";
import type { AudiencePageKey } from "@/shared/marketing/marketing";
import { MARKETING_GITHUB_URL, MARKETING_SALES_URL } from "@/shared/marketing/marketing";

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
        "One AI-native workspace for research, operations, and execution. Secure context, flexible model routing, automations, and integrations for teams that ship.",
    },
    eyebrow: "Business",
    title: "Overlay for business",
    description:
      "Give your team one AI interaction layer for research, operations, browser work, and automations — without scattering context across five separate subscriptions.",
    support:
      "Overlay keeps conversations, files, notes, outputs, and integrations in one surface so work moves from question to execution with less operational drag and no vendor lock-in.",
    features: [
      {
        meta: "Research & Analysis",
        title: "Deep research at the speed of thought.",
        body: "Query across web search, internal documents, and live browser sessions. Synthesize findings into briefs, reports, and recommendations without losing the source trail.",
      },
      {
        meta: "Operations",
        title: "Automate the routine, focus on the critical.",
        body: "Schedule research, browser tasks, data extraction, and follow-up work so outputs land back in the project without manual orchestration.",
      },
      {
        meta: "Governance",
        title: "Control what enters your workflow.",
        body: "Bring institutional knowledge into the same workspace where teams ask questions and run work. Audit trails, access controls, and on-prem deployment keep data inside your perimeter.",
      },
    ],
    demoTitle: "A team workspace for operations, research, and execution.",
    demoBody:
      "Overlay acts as the control surface between your operators, the best available models, live browser work, and the internal context that makes every run accurate.",
    demoColumns: [
      { label: "Workspace", value: "Shared", detail: "Notes, outputs, and projects remain aligned across the team." },
      { label: "Models", value: "Flexible", detail: "Route tasks to the best reasoning, speed, or vision model." },
      { label: "Automations", value: "Persistent", detail: "Keep recurring work running beyond a single session." },
    ],
    proofItems: [
      "Model-agnostic workflow design eliminates lock-in to any single AI lab.",
      "Useful for customer support, market research, internal operations, and browser-heavy execution.",
      "Open-source codebase for teams that need to inspect, extend, or self-host.",
      "Cost transparency: pay for platform access and actual AI usage, not per-seat subscriptions.",
    ],
    primaryCta: { label: "Contact sales", href: MARKETING_SALES_URL, external: true },
    secondaryCta: { label: "Open app", href: "/auth/sign-in?redirect=%2Fapp%2Fchat" },
  },
  education: {
    metadata: {
      title: "Overlay for education",
      description:
        "An AI-native platform for teachers, students, parents, and administrators. Curriculum, assessment, tutoring, and governance in one school-controlled workspace.",
    },
    eyebrow: "Education",
    title: "Overlay for education",
    description:
      "Give your school an AI-native layer that improves outcomes without losing control of data, standards, or policy.",
    support:
      "Overlay helps teachers reclaim time from admin work, gives students personalized support beyond the classroom ratio, and gives parents and administrators visibility without surveillance.",
    features: [
      {
        meta: "For Teachers",
        title: "Reclaim time from administrative work.",
        body: "Create curriculum-grounded tests, exams, worksheets, and marking schemes. Automate first-pass checking against rubrics. Query a centralized repository of class materials, notes, and policies.",
      },
      {
        meta: "For Students",
        title: "Personalized support at any scale.",
        body: "Practice problems, step-by-step explanations, and interactive visualizations tuned to the curriculum. Upload notes and materials into one test-prep source of truth. Get revision plans and targeted practice for weak topics.",
      },
      {
        meta: "For Parents & Admins",
        title: "Governance and visibility without surveillance.",
        body: "Parents query approved progress summaries and upcoming work. Administrators track adoption, teacher efficiency, and student engagement. IT controls data flow, models, and custom connectors.",
      },
    ],
    demoTitle: "A private AI layer for your entire school.",
    demoBody:
      "Overlay shifts AI use from unmanaged consumer accounts into a school-controlled, on-prem system. Every conversation, file, and workflow stays inside your infrastructure.",
    demoColumns: [
      { label: "Deployment", value: "On-prem", detail: "Private infrastructure with full school control over data flow." },
      { label: "Models", value: "Flexible", detail: "Choose the best model for each task without vendor lock-in." },
      { label: "Cost", value: "Transparent", detail: "Pay for actual AI usage at API cost, not per-seat subscriptions." },
    ],
    proofItems: [
      "Keep student AI activity inside a school-controlled, auditable system.",
      "Create images, videos, and interactive mini-apps to explain difficult concepts visually.",
      "Generate detailed exercises and individualized feedback for standardized testing prep.",
      "Build custom teacher dashboards, student dashboards, and parent portals on top of Overlay.",
    ],
    primaryCta: { label: "Contact sales", href: MARKETING_SALES_URL, external: true },
    secondaryCta: { label: "Open app", href: "/auth/sign-in?redirect=%2Fapp%2Fchat" },
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
      "Move from research to script to visual output in one workspace. Voice notes, drafts, browser tasks, and generation loops stay in context from first idea to final asset.",
    support:
      "Overlay is built for content systems, not single prompts: capture ideas quickly, synthesize source material, generate images and video, and keep every revision attached to the same project.",
    features: [
      {
        meta: "Ideation",
        title: "Capture momentum before it disappears.",
        body: "Voice notes and scratchpad workflows make it easy to catch hooks, outlines, and angles while the idea is still fresh. No more losing sparks in separate note apps.",
      },
      {
        meta: "Research & Writing",
        title: "Research and writing share one surface.",
        body: "Keep source material, references, and the working draft in the same project. Browser research, file uploads, and chat all feed into the same creative context.",
      },
      {
        meta: "Multimodal Generation",
        title: "Generate assets without losing the brief.",
        body: "Image, video, and document outputs remain tied to the same conversation and creative context. The brief survives all the way to the final asset.",
      },
    ],
    demoTitle: "A creative workflow that doesn't reset at every stage.",
    demoBody:
      "Overlay treats research, writing, generation, and revision as parts of one system. Your source material, draft history, and generated assets all live in the same project.",
    demoColumns: [
      { label: "Capture", value: "Fast", detail: "Voice notes and quick prompts turn stray ideas into working material." },
      { label: "Draft", value: "Structured", detail: "Summaries, outlines, and scripts stay linked to source context." },
      { label: "Generate", value: "Multimodal", detail: "Images, video, and docs live alongside the project history." },
    ],
    proofItems: [
      "Built for marketing teams, editors, solo creators, and creative operations.",
      "Continuity between research, writing, and generation means fewer lost revision trails.",
      "One surface for ideation, drafting, and multimodal asset creation.",
      "Open-source and extensible: build custom connectors for your creative stack.",
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
      "Overlay gives developers a place to route across models, run browser tasks, execute code in sandboxes, connect extensions and integrations, and keep project context close to the code and output.",
    features: [
      {
        meta: "Model Routing",
        title: "Reasoning, speed, vision, and search in one loop.",
        body: "Choose the strongest model for each step of the workflow without changing products or rebuilding prompts from scratch. GPT for reasoning, Claude for writing, Gemini for multimodal — all in one thread.",
      },
      {
        meta: "Tools & Browser",
        title: "Use live tools, not just text completion.",
        body: "Browser automation, web search, code execution, and API calls can be part of the same interaction. Build agents that actually do work, not just generate text.",
      },
      {
        meta: "Code & Sandboxes",
        title: "Execute, iterate, and ship faster.",
        body: "Run code in secure sandboxes, iterate on scripts, and keep outputs tied to the same project context. Perfect for prototyping, data work, and agent development.",
      },
    ],
    demoTitle: "An AI control surface that feels closer to a dev tool than a chat app.",
    demoBody:
      "Overlay helps technical teams keep context, tool usage, browsing, and model choice together so the product supports real workflows instead of isolated prompt experiments.",
    demoColumns: [
      { label: "Models", value: "Routable", detail: "Switch inside the same thread based on reasoning depth or speed." },
      { label: "Browser", value: "Live", detail: "Run real browser workflows as part of the same task." },
      { label: "Code", value: "Executable", detail: "Sandboxes and tool use for real engineering workflows." },
    ],
    proofItems: [
      "Open-source codebase you can inspect, extend, and self-host.",
      "Supports tool use, browsing, code execution, and context in one product loop.",
      "Built for repeatability and traceability in technical workflows.",
      "MCP support lets you build custom tools and connectors for your stack.",
    ],
    primaryCta: { label: "Open app", href: "/auth/sign-in?redirect=%2Fapp%2Fchat" },
    secondaryCta: { label: "GitHub", href: MARKETING_GITHUB_URL, external: true },
  },
};
