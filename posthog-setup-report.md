<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. PostHog was already partially instrumented — this run extended the coverage with 11 new events across 7 files, added server-side user identification for returning logins, and wired up a PostHog dashboard with 5 insights.

**What was already in place:**
- Client-side PostHog init in `instrumentation-client.ts` using `NEXT_PUBLIC_POSTHOG_TOKEN` / `NEXT_PUBLIC_POSTHOG_HOST`
- Server-side PostHog client in `src/lib/posthog-server.ts`
- User `identify()` in `ObservabilityClient.tsx` (client-side, on session hydration)
- Events: `user_signed_out`, `user_signed_up`, `auth_callback_success`, `voice_recording_started`, `voice_transcription_completed`, `voice_demo_interacted`, `automation_created`, `automation_deleted`, `automation_run_triggered`, `integration_disconnected`, `integration_connect_initiated`, `knowledge_file_created`, `chat_message_sent`, `$pageview`

**New events added in this session:**

| Event | Description | File |
|---|---|---|
| `auth_callback_error` | Fired when the auth callback receives an error or missing code | `src/app/auth/callback/page.tsx` |
| `user_signed_in` | Server-side event for returning user sign-ins (complements `user_signed_up`) | `src/app/api/auth/sync-profile/route.ts` |
| `integration_connect_completed` | Fired when a Composio OAuth callback succeeds | `src/app/auth/composio/callback/page.tsx` |
| `integration_connect_failed` | Fired when a Composio OAuth callback fails | `src/app/auth/composio/callback/page.tsx` |
| `automation_updated` | Fired when an existing automation is saved with edits | `src/components/app/AutomationsView.tsx` |
| `automation_status_toggled` | Fired when an automation's status changes (active ↔ paused) | `src/components/app/AutomationsView.tsx` |
| `knowledge_file_deleted` | Fired when a file or folder is deleted from the knowledge base | `src/components/app/KnowledgeView.tsx` |
| `knowledge_folder_created` | Fired when a new folder is created in the knowledge base | `src/components/app/KnowledgeView.tsx` |
| `voice_transcription_error` | Fired when a voice transcription request fails | `src/components/app/VoiceRecorder.tsx` |
| `voice_saved_as_note` | Fired when a voice transcript is saved as a note | `src/components/app/VoiceRecorder.tsx` |
| `chat_new_chat_created` | Fired when a new chat session is created | `src/components/app/ChatInterface.tsx` |

**Other changes:**
- `src/app/api/auth/sync-profile/route.ts`: `posthog.identify()` is now called for both new and returning users (was previously only called for new users).
- `.env.local`: Confirmed `NEXT_PUBLIC_POSTHOG_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` are set to the correct values.

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/384169/dashboard/1477005
- **Auth Funnel** (auth callback → signup / signin): https://us.posthog.com/project/384169/insights/8pmv5EHO
- **Integration Connection Funnel** (initiated → completed): https://us.posthog.com/project/384169/insights/j7mtdM9o
- **Chat & Automation Activity** (trend): https://us.posthog.com/project/384169/insights/mWPaSf7Z
- **Voice Feature Usage** (trend): https://us.posthog.com/project/384169/insights/24jQgbrn
- **Knowledge Base Activity** (trend): https://us.posthog.com/project/384169/insights/C31tStuw

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
