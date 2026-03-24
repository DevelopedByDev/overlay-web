This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Unified chat tools (Ask / Act)

- **Registry:** Overlay-native tools live in `src/lib/tools/build.ts` (knowledge, notes, hosted computer, media in Act). Composio and AI Gateway `perplexity_search` are merged in `src/app/api/app/conversations/ask/route.ts` and `act/route.ts`.
- **Audit / cost classes:** Successful and failed calls for Perplexity, image/video generation, and Composio tools are appended to the Convex `toolInvocations` table via `usage:recordToolInvocation` (see `src/lib/tools/record-tool-invocation.ts`). Cheap internal reads (e.g. `search_knowledge`, notes listings) are not logged there by default.
- **Rollback:** Set `UNIFIED_TOOLS_ASK=false` to serve Ask with overlay tools only (no Composio, no Perplexity merge) if you need an emergency narrow surface.
- **References:** [Vercel AI Gateway web search / Perplexity](https://vercel.com/docs/ai-gateway/capabilities/web-search), [OpenRouter + Vercel AI SDK](https://openrouter.ai/docs/guides/community/vercel-ai-sdk), [OpenRouter SDK tools (future generator/HITL)](https://openrouter.ai/docs/sdks/typescript/call-model/tools).
