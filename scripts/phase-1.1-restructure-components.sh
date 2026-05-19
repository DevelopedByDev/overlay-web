#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p \
  src/features/{chat,notebook,knowledge,projects,automations,integrations,files,share,landing,marketing,auth,billing,account,tools}/components \
  src/features/files/hooks \
  src/components/{layout,providers,ui} \
  src/components/layout/sidebar

git_mv() {
  if [[ -e "$1" ]]; then
    git mv "$1" "$2"
  fi
}

# --- layout ---
git_mv src/components/Navbar.tsx src/components/layout/Navbar.tsx
git_mv src/components/PageNavbar.tsx src/components/layout/PageNavbar.tsx
git_mv src/components/app/AppSidebar.tsx src/components/layout/AppSidebar.tsx
git_mv src/components/app/AppSidebarInlinePanels.tsx src/components/layout/AppSidebarInlinePanels.tsx
git_mv src/components/app/GlobalSearchDialog.tsx src/components/layout/GlobalSearchDialog.tsx
git_mv src/components/app/sidebar/useAppSidebarActions.ts src/components/layout/sidebar/useAppSidebarActions.ts

# --- providers ---
git_mv src/components/ConvexProviderWithWorkOS.tsx src/components/providers/ConvexProviderWithWorkOS.tsx
git_mv src/components/ObservabilityClient.tsx src/components/providers/ObservabilityClient.tsx
git_mv src/components/app/AppSettingsProvider.tsx src/components/providers/AppSettingsProvider.tsx
git_mv src/components/app/OnboardingProvider.tsx src/components/providers/OnboardingProvider.tsx
git_mv src/components/app/GuestGateProvider.tsx src/components/providers/GuestGateProvider.tsx
git_mv src/components/app/BackgroundPollManager.tsx src/components/providers/BackgroundPollManager.tsx

# --- landing (top-level + folder) ---
git_mv src/components/OverlayDemo.tsx src/features/landing/components/OverlayDemo.tsx
git_mv src/components/VoiceDemo.tsx src/features/landing/components/VoiceDemo.tsx
git_mv src/components/AllInOnePlace.tsx src/features/landing/components/AllInOnePlace.tsx
if [[ -d src/components/landing ]]; then
  for f in src/components/landing/*; do
    git_mv "$f" "src/features/landing/components/$(basename "$f")"
  done
  rmdir src/components/landing 2>/dev/null || true
fi

# --- marketing ---
if [[ -d src/components/marketing ]]; then
  for f in src/components/marketing/*; do
    git_mv "$f" "src/features/marketing/components/$(basename "$f")"
  done
  rmdir src/components/marketing 2>/dev/null || true
fi

# --- auth ---
git_mv src/components/auth/SignInForm.tsx src/features/auth/components/SignInForm.tsx
git_mv src/components/app/SignInFullScreenModal.tsx src/features/auth/components/SignInFullScreenModal.tsx
git_mv src/components/app/SignInCornerPopover.tsx src/features/auth/components/SignInCornerPopover.tsx
git_mv src/components/app/OnboardingTour.tsx src/features/account/components/OnboardingTour.tsx
rmdir src/components/auth 2>/dev/null || true

# --- billing, account ---
git_mv src/components/billing/TopUpPreferenceControl.tsx src/features/billing/components/TopUpPreferenceControl.tsx
rmdir src/components/billing 2>/dev/null || true
git_mv src/components/account/DeleteAccountSection.tsx src/features/account/components/DeleteAccountSection.tsx
rmdir src/components/account 2>/dev/null || true

# --- share ---
git_mv src/components/share/SharedFileView.tsx src/features/share/components/SharedFileView.tsx
git_mv src/components/share/SharedChatView.tsx src/features/share/components/SharedChatView.tsx
git_mv src/components/app/ShareDialog.tsx src/features/share/components/ShareDialog.tsx
rmdir src/components/share 2>/dev/null || true

# --- notebook ---
git_mv src/components/app/NotebookEditor.tsx src/features/notebook/components/NotebookEditor.tsx
git_mv src/components/notebook/InlineDiffExtension.ts src/features/notebook/components/InlineDiffExtension.ts
git_mv src/components/app/SlashMenu.tsx src/features/notebook/components/SlashMenu.tsx
rmdir src/components/notebook 2>/dev/null || true

# --- knowledge ---
git_mv src/components/app/KnowledgeView.tsx src/features/knowledge/components/KnowledgeView.tsx
git_mv src/components/app/KnowledgeFileTree.tsx src/features/knowledge/components/KnowledgeFileTree.tsx
git_mv src/components/app/MemoriesView.tsx src/features/knowledge/components/MemoriesView.tsx

# --- projects ---
git_mv src/components/app/ProjectsView.tsx src/features/projects/components/ProjectsView.tsx
git_mv src/components/app/ProjectsSidebar.tsx src/features/projects/components/ProjectsSidebar.tsx
git_mv src/components/app/ProjectFileTree.tsx src/features/projects/components/ProjectFileTree.tsx

# --- integrations ---
git_mv src/components/app/IntegrationsView.tsx src/features/integrations/components/IntegrationsView.tsx
git_mv src/components/app/IntegrationsDialog.tsx src/features/integrations/components/IntegrationsDialog.tsx
git_mv src/components/app/McpServersView.tsx src/features/integrations/components/McpServersView.tsx

# --- automations ---
git_mv src/components/app/AutomationsInlinePanel.tsx src/features/automations/components/AutomationsInlinePanel.tsx
git_mv src/components/app/SkillsView.tsx src/features/automations/components/SkillsView.tsx

# --- files ---
git_mv src/components/app/FileViewer.tsx src/features/files/components/FileViewer.tsx
git_mv src/components/app/FileShareMenu.tsx src/features/files/components/FileShareMenu.tsx
git_mv src/components/app/ExportMenu.tsx src/features/files/components/ExportMenu.tsx
git_mv src/components/app/hooks/useExport.ts src/features/files/hooks/useExport.ts

# --- tools ---
git_mv src/components/app/ToolsView.tsx src/features/tools/components/ToolsView.tsx
git_mv src/components/app/ToolsSidebar.tsx src/features/tools/components/ToolsSidebar.tsx

# --- chat (dirs + files) ---
git_mv src/components/app/chat src/features/chat/components/chat
git_mv src/components/app/chat-interface src/features/chat/components/chat-interface
git_mv src/components/app/ChatInterface.tsx src/features/chat/components/ChatInterface.tsx
git_mv src/components/app/MarkdownMessage.tsx src/features/chat/components/MarkdownMessage.tsx
git_mv src/components/app/WebSourcesSidebar.tsx src/features/chat/components/WebSourcesSidebar.tsx
git_mv src/components/app/WebSourceTooltip.tsx src/features/chat/components/WebSourceTooltip.tsx
git_mv src/components/app/ChatInlinePanel.tsx src/features/chat/components/ChatInlinePanel.tsx
git_mv src/components/app/GenerationModeToggle.tsx src/features/chat/components/GenerationModeToggle.tsx
git_mv src/components/app/DelayedTooltip.tsx src/features/chat/components/DelayedTooltip.tsx

# --- shared UI primitive ---
git_mv src/components/app/ConfirmDialog.tsx src/components/ui/ConfirmDialog.tsx

# cleanup empty dirs
rmdir src/components/app/hooks 2>/dev/null || true
rmdir src/components/app/sidebar 2>/dev/null || true
rmdir src/components/app 2>/dev/null || true

echo "Phase 1.1 file moves complete."
