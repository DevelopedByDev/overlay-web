import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { IMAGE_MODELS, VIDEO_MODELS } from '@/lib/models'
import {
  executeCreateNote,
  executeDeleteNote,
  executeGetNote,
  executeListNotes,
  executeUpdateNote,
} from './notes-executes'
import { executeBrowserRunTask } from './browser-executes'
import {
  executeDeleteMemory,
  executeGenerateImage,
  executeGenerateVideo,
  executeListSkills,
  executeRunDaytonaSandbox,
  executeSaveMemory,
  executeSearchKnowledge,
  executeUpdateMemory,
} from './overlay-executes'
import { assertOverlayToolAllowedForMode } from './policy'
import type { OverlayToolsOptions, ToolMode } from './types'

/**
 * Overlay-defined tools only (no Composio, no Gateway perplexity).
 * Ask: knowledge + memory writes + notes read. Act: full mutations + media.
 */
export function buildOverlayToolSet(mode: ToolMode, options: OverlayToolsOptions): ToolSet {
  const tools: ToolSet = {}

  tools.list_skills = tool({
    description:
      'List all active skills configured by the user. Skills are custom instructions the user has set up for specific task types. ' +
      'IMPORTANT: Call this before taking action on any task to discover whether a relevant skill applies — especially when the request touches a domain the user may have customized (writing style, workflows, personas, integrations, etc.). ' +
      'Use the optional query parameter to filter skills by keyword.',
    inputSchema: z.object({
      query: z.string().optional().describe('Optional keyword to filter skills by name, description, or instructions'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'list_skills')
      return executeListSkills(options, input)
    },
  })

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

  tools.list_notes = tool({
    description:
      'List the user\'s notes in Overlay. When the chat is tied to a project, pass projectId from context to scope results.',
    inputSchema: z.object({
      projectId: z.string().optional().describe('Only notes in this project (omit for general notes tab)'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'list_notes')
      return executeListNotes(options, input)
    },
  })

  tools.get_note = tool({
    description: 'Load a single note by id (full title, body, tags).',
    inputSchema: z.object({
      noteId: z.string().describe('Convex notes document id'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'get_note')
      return executeGetNote(options, input)
    },
  })

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

  tools.browser_run_task = tool({
    description:
      'Browse the web using a remote AI-controlled browser. Use this when you need fresh live data, need to inspect a website directly, or must interact with a real web page.',
    inputSchema: z.object({
      task: z.string().describe('What to do in the browser — natural language'),
      model: z.enum(['bu-mini', 'bu-max']).optional(),
      sessionId: z.string().optional().describe('Reuse an existing browser session'),
      keepAlive: z.boolean().optional().describe('Keep session alive after task for follow-ups'),
      proxyCountryCode: z.string().optional().describe('2-letter country code for residential proxy'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'browser_run_task')
      return executeBrowserRunTask(options, input)
    },
  })

  if (mode === 'act') {
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

    tools.run_daytona_sandbox = tool({
      description:
        'Run a CLI or script task inside the user’s persistent paid Daytona workspace. ' +
        'Use this for programmatic workflows like app building, code generation, file transforms, slideshow generation, or media pipelines that should run through command-line tooling rather than browser automation. ' +
        'Selected Overlay files are uploaded into the workspace, declared output files are imported back into the Outputs tab, and the workspace persists across runs.',
      inputSchema: z.object({
        task: z.string().describe('Short summary of what the sandbox should do'),
        runtime: z.enum(['node', 'python']).describe('Sandbox runtime: node for JavaScript tooling, python for Python tooling'),
        command: z.string().describe('Shell command to execute inside the sandbox workspace'),
        code: z.string().optional().describe('Optional inline source code to write into the sandbox before execution'),
        inputFileIds: z
          .array(z.string())
          .optional()
          .describe('Optional existing Overlay file ids to upload into the sandbox input directory'),
        expectedOutputs: z
          .array(z.string())
          .min(1)
          .describe('File paths relative to the sandbox workspace that should be imported back into Outputs after execution'),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'run_daytona_sandbox')
        return executeRunDaytonaSandbox(options, input)
      },
    })

    tools.create_note = tool({
      description: 'Create a new note (title, markdown/plain content, optional tags and project).',
      inputSchema: z.object({
        title: z.string().optional(),
        content: z.string(),
        tags: z.array(z.string()).optional(),
        projectId: z.string().optional(),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'create_note')
        return executeCreateNote(options, input)
      },
    })

    tools.update_note = tool({
      description: 'Update an existing note by id (any subset of title, content, tags).',
      inputSchema: z.object({
        noteId: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'update_note')
        return executeUpdateNote(options, input)
      },
    })

    tools.delete_note = tool({
      description: 'Delete a note by id.',
      inputSchema: z.object({
        noteId: z.string(),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'delete_note')
        return executeDeleteNote(options, input)
      },
    })
  }

  return tools
}
