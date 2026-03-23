import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { IMAGE_MODELS, VIDEO_MODELS } from '@/lib/models'
import {
  executeDeleteMemory,
  executeGenerateImage,
  executeGenerateVideo,
  executeSaveMemory,
  executeSearchKnowledge,
  executeUpdateMemory,
} from './overlay-executes'
import { assertOverlayToolAllowedForMode } from './policy'
import type { OverlayToolsOptions, ToolMode } from './types'

/**
 * Overlay-defined tools only (no Composio, no Gateway perplexity).
 * Ask mode: search_knowledge only. Act: full set.
 */
export function buildOverlayToolSet(mode: ToolMode, options: OverlayToolsOptions): ToolSet {
  const tools: ToolSet = {}

  tools.search_knowledge = tool({
    description:
      'Search the user\'s saved knowledge: notebook files and memories. Uses hybrid semantic + keyword retrieval. ' +
      'Call this when you need facts from their knowledge base, prior notes, or stored context that is not in the chat transcript.',
    inputSchema: z.object({
      query: z.string().describe('Search query: keywords or a short natural-language question'),
      sourceKind: z
        .enum(['file', 'memory'])
        .optional()
        .describe('Limit to files only or memories only (omit to search both)'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'search_knowledge')
      return executeSearchKnowledge(options, input)
    },
  })

  if (mode === 'act') {
    tools.save_memory = tool({
      description:
        'Save a durable memory about the user (preferences, facts, standing instructions). ' +
        'You MUST call this when they state personal preferences or long-lived facts (e.g. "I like pasta", "I am vegetarian", "always cite sources"). ' +
        'Use one short factual sentence per call. Skip for pure small talk or one-off requests.',
      inputSchema: z.object({
        content: z.string().describe('The memory text to store'),
        source: z
          .enum(['chat', 'note', 'manual'])
          .optional()
          .describe('How the memory was captured (default: chat when learning from conversation)'),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'save_memory')
        return executeSaveMemory(options, input)
      },
    })

    tools.update_memory = tool({
      description: 'Replace the text of an existing memory by id (use after listing or saving a memory).',
      inputSchema: z.object({
        memoryId: z.string().describe('Convex document id of the memory'),
        content: z.string().describe('New full text for the memory'),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'update_memory')
        return executeUpdateMemory(options, input)
      },
    })

    tools.delete_memory = tool({
      description: 'Delete a memory by id.',
      inputSchema: z.object({
        memoryId: z.string().describe('Convex document id of the memory to remove'),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'delete_memory')
        return executeDeleteMemory(options, input)
      },
    })

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
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'generate_image')
        return executeGenerateImage(options, input)
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
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'generate_video')
        return executeGenerateVideo(options, input)
      },
    })
  }

  return tools
}
