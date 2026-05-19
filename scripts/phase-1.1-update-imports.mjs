#!/usr/bin/env node
/**
 * Phase 1.1: rewrite @/components/* imports after directory restructure.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const REPLACEMENTS = [
  // layout
  ["@/components/Navbar", "@/components/layout/Navbar"],
  ["@/components/PageNavbar", "@/components/layout/PageNavbar"],
  ["@/components/app/AppSidebar", "@/components/layout/AppSidebar"],
  ["@/components/app/AppSidebarInlinePanels", "@/components/layout/AppSidebarInlinePanels"],
  ["@/components/app/GlobalSearchDialog", "@/components/layout/GlobalSearchDialog"],
  ["@/components/app/sidebar/useAppSidebarActions", "@/components/layout/sidebar/useAppSidebarActions"],

  // providers
  ["@/components/ConvexProviderWithWorkOS", "@/components/providers/ConvexProviderWithWorkOS"],
  ["@/components/ObservabilityClient", "@/components/providers/ObservabilityClient"],
  ["@/components/app/AppSettingsProvider", "@/components/providers/AppSettingsProvider"],
  ["@/components/app/OnboardingProvider", "@/components/providers/OnboardingProvider"],
  ["@/components/app/GuestGateProvider", "@/components/providers/GuestGateProvider"],
  ["@/components/app/BackgroundPollManager", "@/components/providers/BackgroundPollManager"],

  // landing
  ["@/components/OverlayDemo", "@/features/landing/components/OverlayDemo"],
  ["@/components/VoiceDemo", "@/features/landing/components/VoiceDemo"],
  ["@/components/AllInOnePlace", "@/features/landing/components/AllInOnePlace"],
  ["@/components/landing/", "@/features/landing/components/"],

  // marketing
  ["@/components/marketing/", "@/features/marketing/components/"],

  // auth / account / billing
  ["@/components/auth/", "@/features/auth/components/"],
  ["@/components/billing/", "@/features/billing/components/"],
  ["@/components/account/", "@/features/account/components/"],

  // share / notebook
  ["@/components/share/", "@/features/share/components/"],
  ["@/components/notebook/", "@/features/notebook/components/"],

  // feature app screens (longest paths first)
  ["@/components/app/chat-interface/", "@/features/chat/components/chat-interface/"],
  ["@/components/app/chat/", "@/features/chat/components/chat/"],
  ["@/components/app/ChatInterface", "@/features/chat/components/ChatInterface"],
  ["@/components/app/MarkdownMessage", "@/features/chat/components/MarkdownMessage"],
  ["@/components/app/WebSourcesSidebar", "@/features/chat/components/WebSourcesSidebar"],
  ["@/components/app/WebSourceTooltip", "@/features/chat/components/WebSourceTooltip"],
  ["@/components/app/ChatInlinePanel", "@/features/chat/components/ChatInlinePanel"],
  ["@/components/app/GenerationModeToggle", "@/features/chat/components/GenerationModeToggle"],
  ["@/components/app/DelayedTooltip", "@/features/chat/components/DelayedTooltip"],
  ["@/components/app/NotebookEditor", "@/features/notebook/components/NotebookEditor"],
  ["@/components/app/SlashMenu", "@/features/notebook/components/SlashMenu"],
  ["@/components/app/KnowledgeView", "@/features/knowledge/components/KnowledgeView"],
  ["@/components/app/KnowledgeFileTree", "@/features/knowledge/components/KnowledgeFileTree"],
  ["@/components/app/MemoriesView", "@/features/knowledge/components/MemoriesView"],
  ["@/components/app/ProjectsView", "@/features/projects/components/ProjectsView"],
  ["@/components/app/ProjectsSidebar", "@/features/projects/components/ProjectsSidebar"],
  ["@/components/app/ProjectFileTree", "@/features/projects/components/ProjectFileTree"],
  ["@/components/app/IntegrationsView", "@/features/integrations/components/IntegrationsView"],
  ["@/components/app/IntegrationsDialog", "@/features/integrations/components/IntegrationsDialog"],
  ["@/components/app/McpServersView", "@/features/integrations/components/McpServersView"],
  ["@/components/app/AutomationsInlinePanel", "@/features/automations/components/AutomationsInlinePanel"],
  ["@/components/app/SkillsView", "@/features/automations/components/SkillsView"],
  ["@/components/app/FileViewer", "@/features/files/components/FileViewer"],
  ["@/components/app/FileShareMenu", "@/features/files/components/FileShareMenu"],
  ["@/components/app/ExportMenu", "@/features/files/components/ExportMenu"],
  ["@/components/app/hooks/useExport", "@/features/files/hooks/useExport"],
  ["@/components/app/ToolsView", "@/features/tools/components/ToolsView"],
  ["@/components/app/ToolsSidebar", "@/features/tools/components/ToolsSidebar"],
  ["@/components/app/ShareDialog", "@/features/share/components/ShareDialog"],
  ["@/components/app/SignInFullScreenModal", "@/features/auth/components/SignInFullScreenModal"],
  ["@/components/app/SignInCornerPopover", "@/features/auth/components/SignInCornerPopover"],
  ["@/components/app/OnboardingTour", "@/features/account/components/OnboardingTour"],
  ["@/components/app/ConfirmDialog", "@/components/ui/ConfirmDialog"],
  ["@/components/app/", "@/features/chat/components/"], // fallback for any stragglers
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "_generated") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(tsx?|mts|md)$/.test(ent.name)) files.push(p);
  }
  return files;
}

function applyReplacements(content) {
  let out = content;
  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

/** Fix relative imports that pointed at moved sibling modules under components/app */
const RELATIVE_PROVIDER_FIXES = [
  ["from './AppSettingsProvider'", "from '@/components/providers/AppSettingsProvider'"],
  ["from \"./AppSettingsProvider\"", "from \"@/components/providers/AppSettingsProvider\""],
  ["from './GuestGateProvider'", "from '@/components/providers/GuestGateProvider'"],
  ["from \"./GuestGateProvider\"", "from \"@/components/providers/GuestGateProvider\""],
  ["from './OnboardingProvider'", "from '@/components/providers/OnboardingProvider'"],
  ["from '../GuestGateProvider'", "from '@/components/providers/GuestGateProvider'"],
  ["from '../OnboardingProvider'", "from '@/components/providers/OnboardingProvider'"],
  ["from './IntegrationsDialog'", "from '@/features/integrations/components/IntegrationsDialog'"],
  ["from './ConfirmDialog'", "from '@/components/ui/ConfirmDialog'"],
  ["from './ShareDialog'", "from '@/features/share/components/ShareDialog'"],
  ["from './FileViewer'", "from '@/features/files/components/FileViewer'"],
  ["from './FileShareMenu'", "from '@/features/files/components/FileShareMenu'"],
  ["from './ProjectFileTree'", "from '@/features/projects/components/ProjectFileTree'"],
  ["from './ProjectsSidebar'", "from '@/features/projects/components/ProjectsSidebar'"],
  ["from './AppSidebarInlinePanels'", "from '@/components/layout/AppSidebarInlinePanels'"],
  ["from './ChatInlinePanel'", "from '@/features/chat/components/ChatInlinePanel'"],
  ["from './AutomationsInlinePanel'", "from '@/features/automations/components/AutomationsInlinePanel'"],
  ["from './ToolsSidebar'", "from '@/features/tools/components/ToolsSidebar'"],
  ["from './hooks/useExport'", "from '@/features/files/hooks/useExport'"],
  ["from './OnboardingTour'", "from '@/features/account/components/OnboardingTour'"],
  ["from './SignInFullScreenModal'", "from '@/features/auth/components/SignInFullScreenModal'"],
  ["from './SignInCornerPopover'", "from '@/features/auth/components/SignInCornerPopover'"],
];

function fixConvexRelative(content, filePath) {
  // features/chat/components/chat-interface/types.ts needs 5 levels to root
  if (filePath.includes("features/chat/components/chat-interface")) {
    return content.replace(
      /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/convex\//g,
      "from '../../../../../convex/",
    );
  }
  // features/chat/components/ChatInterface.tsx used ../../../convex
  if (filePath.includes("features/chat/components/ChatInterface")) {
    return content
      .replace(/from ['"]\.\.\/\.\.\/\.\.\/convex\//g, "from '../../../../convex/")
      .replace(/from ['"]\.\.\/\.\.\/\.\.\/convex['"]/g, "from '../../../../convex'");
  }
  return content;
}

let changed = 0;
for (const file of walk(path.join(ROOT, "src"))) {
  let content = fs.readFileSync(file, "utf8");
  let next = applyReplacements(content);
  for (const [from, to] of RELATIVE_PROVIDER_FIXES) {
    next = next.split(from).join(to);
  }
  next = fixConvexRelative(next, file);
  if (next !== content) {
    fs.writeFileSync(file, next);
    changed++;
  }
}

// packages overlay-chat-react comment reference
const chatSettings = path.join(ROOT, "packages/overlay-chat-react/src/context/chat-settings.ts");
if (fs.existsSync(chatSettings)) {
  let c = fs.readFileSync(chatSettings, "utf8");
  const n = c.replace(
    "overlay-landing/src/components/app/AppSettingsProvider.tsx",
    "overlay-landing/src/components/providers/AppSettingsProvider.tsx",
  );
  if (n !== c) {
    fs.writeFileSync(chatSettings, n);
    changed++;
  }
}

console.log(`Updated ${changed} files`);
