import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { IMAGE_MODELS, VIDEO_MODELS } from '@/lib/models'

/**
 * Non-Composio native tools for the web app.
 * Analogous to unified-tools.ts in the desktop app.
 * These tools call internal API routes so they work within
 * the serverless Next.js environment.
 */

export interface WebToolsOptions {
  userId: string
  accessToken?: string
  chatId?: string
  agentId?: string
  baseUrl?: string
}

async function callInternalApi(
  path: string,
  body: Record<string, unknown>,
  accessToken?: string,
  baseUrl?: string,
): Promise<Response> {
  const url = baseUrl ? `${baseUrl}${path}` : path
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

export function createWebTools(options: WebToolsOptions): ToolSet {
  const { chatId, agentId, baseUrl } = options

  const tools: ToolSet = {}

  tools.generate_image = tool({
    description:
      'Generate an image from a text prompt using AI image generation models. ' +
      'Returns a data URL of the generated image. ' +
      'Tries models in priority order: Gemini Flash Image → GPT Image 1.5 → FLUX 2 Max → Grok Image Pro → Grok Image → FLUX Schnell. ' +
      'Use this whenever the user asks to create, draw, or generate an image or picture.',
    inputSchema: z.object({
      prompt: z.string().describe('Detailed description of the image to generate'),
      modelId: z
        .enum(IMAGE_MODELS.map((m) => m.id) as [string, ...string[]])
        .optional()
        .describe('Specific image model to use (optional — uses priority fallback by default)'),
      aspectRatio: z
        .enum(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'])
        .optional()
        .describe('Aspect ratio of the generated image (default: 1:1)'),
    }),
    execute: async ({ prompt, modelId, aspectRatio }) => {
      try {
        const res = await callInternalApi(
          '/api/app/generate-image',
          { prompt, modelId, aspectRatio, chatId, agentId },
          options.accessToken,
          baseUrl,
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Unknown error' }))
          return {
            success: false,
            error: (err as { message?: string }).message ?? 'Image generation failed',
          }
        }
        const data = await res.json() as { outputId?: string; url?: string; modelUsed?: string }
        return {
          success: true,
          outputId: data.outputId,
          url: data.url,
          modelUsed: data.modelUsed,
          message: `Image generated successfully with ${data.modelUsed}. OutputId: ${data.outputId}`,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Image generation failed',
        }
      }
    },
  })

  tools.generate_video = tool({
    description:
      'Generate a video from a text prompt using AI video generation models. ' +
      'Video generation is asynchronous and can take 1–5 minutes. ' +
      'Returns immediately with a job ID; the video will appear in the Outputs tab when complete. ' +
      'Tries models in priority order: Veo 3.1 → Veo 3.1 Fast → Seedance v1.5 Pro → Grok Video → Wan v2.6. ' +
      'Use this when the user asks to create, animate, or generate a video or clip.',
    inputSchema: z.object({
      prompt: z.string().describe('Detailed description of the video to generate'),
      modelId: z
        .enum(VIDEO_MODELS.map((m) => m.id) as [string, ...string[]])
        .optional()
        .describe('Specific video model to use (optional — uses priority fallback by default)'),
      aspectRatio: z
        .enum(['16:9', '9:16', '1:1', '4:3'])
        .optional()
        .describe('Aspect ratio of the generated video (default: 16:9)'),
      duration: z
        .number()
        .min(3)
        .max(60)
        .optional()
        .describe('Duration of the video in seconds (default: 8)'),
    }),
    execute: async ({ prompt, modelId, aspectRatio, duration }) => {
      try {
        const res = await callInternalApi(
          '/api/app/generate-video',
          { prompt, modelId, aspectRatio, duration, chatId, agentId },
          options.accessToken,
          baseUrl,
        )

        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Unknown error' }))
          return {
            success: false,
            status: 'failed',
            error: (err as { message?: string }).message ?? 'Video generation failed',
          }
        }

        // SSE stream — read first event for the started signal, then drain for completion
        const reader = res.body?.getReader()
        if (!reader) {
          return { success: false, status: 'failed', error: 'No response stream' }
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let outputId: string | null = null
        let finalResult: Record<string, unknown> | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6)) as Record<string, unknown>
              if (event.type === 'started') {
                outputId = event.outputId as string
              } else if (event.type === 'completed') {
                finalResult = event
              } else if (event.type === 'failed') {
                return {
                  success: false,
                  status: 'failed',
                  outputId: outputId ?? (event.outputId as string),
                  error: event.error,
                }
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }

        if (finalResult) {
          return {
            success: true,
            status: 'completed',
            outputId: finalResult.outputId,
            url: finalResult.url,
            modelUsed: finalResult.modelUsed,
            message: `Video generated successfully with ${finalResult.modelUsed}. OutputId: ${finalResult.outputId}`,
          }
        }

        return {
          success: true,
          status: 'pending',
          outputId,
          message: `Video generation started (outputId: ${outputId}). It will appear in the Outputs tab when complete.`,
        }
      } catch (err) {
        return {
          success: false,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Video generation failed',
        }
      }
    },
  })

  return tools
}
