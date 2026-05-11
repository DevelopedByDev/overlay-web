---
title: "Vercel AI Gateway"
description: "Configure Vercel AI Gateway as the AI provider for Overlay."
---

# Vercel AI Gateway

Vercel AI Gateway is the default AI provider for Overlay SaaS deployments. It provides unified routing, rate limiting, and cost tracking across multiple model providers.

## Prerequisites

- [Vercel account](https://vercel.com)
- AI Gateway enabled in your Vercel project

## Setup

1. Go to your [Vercel Dashboard > AI Gateway](https://vercel.com/dashboard)
2. Create a new Gateway
3. Copy the **API Key**

## Environment Variables

```bash
AI_GATEWAY_API_KEY=vgw_...
```

## Supported Models

Overlay automatically routes these models through the gateway:

| Model | Provider |
|-------|----------|
| GPT-5.4 | OpenAI |
| Claude Opus 4.7 | Anthropic |
| Gemini 3.1 Pro | Google |
| Grok 4.20 | xAI |
| DeepSeek V4 Pro | DeepSeek |

## Fallback

If a provider is unavailable, the gateway automatically retries with the next available provider in the same tier.

## Self-Hosted Alternative

For self-hosted deployments, route to a local [Ollama](/ai/ollama) or [vLLM](/ai/vllm) instance instead:

```bash
AI_GATEWAY_URL=http://localhost:3000/v1
```
