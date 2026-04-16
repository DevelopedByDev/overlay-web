import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { IMAGE_MODELS, getVideoModelsBySubMode } from '@/lib/models'
import {
  executeCreateNote,
  executeDeleteNote,
  executeGetNote,
  executeListNotes,
  executeUpdateNote,
} from './notes-executes'
import { executeBrowserRunTask } from './browser-executes'
import {
  executeDraftAutomationFromChat,
  executeDraftSkillFromChat,
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
    tools.draft_automation_from_chat = tool({
      description:
        'Create a draft automation proposal from the current chat turn. ' +
        'Use this when the user is asking for a repeatable or scheduled workflow. ' +
        'This only creates a draft and never saves a live automation.',
      inputSchema: z.object({
        userText: z.string().describe('The user request to turn into an automation draft'),
        assistantText: z.string().optional().describe('Optional assistant summary of the workflow'),
        toolNames: z.array(z.string()).optional().describe('Tool names used in the workflow'),
        reason: z.string().optional().describe('Why this should become an automation'),
        mode: z.enum(['ask', 'act']).optional(),
        modelId: z.string().optional(),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'draft_automation_from_chat')
        return executeDraftAutomationFromChat(options, input)
      },
    })

    tools.draft_skill_from_chat = tool({
      description:
        'Create a reusable skill draft from the current chat turn. ' +
        'Use this when the workflow is reusable but not obviously scheduled. ' +
        'This only drafts the skill and never saves it.',
      inputSchema: z.object({
        userText: z.string().describe('The user request to turn into a saved skill draft'),
        assistantText: z.string().optional().describe('Optional assistant summary of the workflow'),
        reason: z.string().optional().describe('Why this should become a saved skill'),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'draft_skill_from_chat')
        return executeDraftSkillFromChat(options, input)
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

  // ── Image & Video generation tools (ask + act) ─────────────────────────────

  tools.generate_image = tool({
    description:
      'Generate an image from a text prompt using AI image generation models. ' +
      'Optionally accepts a reference image URL for editing or style transfer. ' +
      'Saves the result to Outputs. ' +
      'Use this whenever the user asks to create, draw, generate, or edit an image or picture.',
    inputSchema: z.object({
      prompt: z.string().describe('Detailed description of the image to generate or edit'),
      modelId: z
        .enum(IMAGE_MODELS.map((m) => m.id) as [string, ...string[]])
        .optional()
        .describe('Specific image model to use (optional — uses priority fallback by default)'),
      aspectRatio: z
        .enum(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'])
        .optional()
        .describe('Aspect ratio of the generated image (default: 1:1)'),
      referenceImageUrl: z
        .string()
        .optional()
        .describe('URL or data URL of a reference image to edit or use as style source'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'generate_image')
      return executeGenerateImage(options, input)
    },
  })

  const t2vModelIds = getVideoModelsBySubMode('text-to-video').map((m) => m.id) as [string, ...string[]]
  tools.generate_video = tool({
    description:
      'Generate a video from a text prompt (text-to-video). ' +
      'Video generation takes 1–5 minutes; saves the result to Outputs. ' +
      'Supported models: Veo 3.1, Veo 3.1 Fast, Seedance v1.5 Pro, Grok Video, Wan v2.6, Kling v2.6. ' +
      'Use this when the user asks to create or generate a video clip from a description.',
    inputSchema: z.object({
      prompt: z.string().describe('Detailed description of the video to generate'),
      modelId: z.enum(t2vModelIds).optional().describe('Specific model to use (optional)'),
      aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).optional().describe('Aspect ratio (default: 16:9)'),
      duration: z.number().min(3).max(12).optional().describe('Duration in seconds (default: 8, max 12)'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'generate_video')
      return executeGenerateVideo(options, { ...input, videoSubMode: 'text-to-video' })
    },
  })

  const i2vModelIds = getVideoModelsBySubMode('image-to-video').map((m) => m.id) as [string, ...string[]]
  tools.animate_image = tool({
    description:
      'Animate a static image into a video (image-to-video). ' +
      'The source image becomes the video — you are adding motion to that exact scene. ' +
      'Supported models: Veo 3.1, Grok Video, Seedance v1.5 Pro, Kling v2.6 I2V, Wan v2.6 I2V. ' +
      'Use this when the user wants to animate, bring to life, or add motion to an existing image.',
    inputSchema: z.object({
      prompt: z.string().describe('Description of the motion or animation to apply'),
      imageUrl: z.string().describe('URL or data URL of the source image to animate'),
      modelId: z.enum(i2vModelIds).optional().describe('Specific model to use (optional)'),
      aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3']).optional().describe('Aspect ratio (default: matches input image)'),
      duration: z.number().min(3).max(15).optional().describe('Duration in seconds (default: 5)'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'animate_image')
      return executeGenerateVideo(options, { ...input, videoSubMode: 'image-to-video' })
    },
  })

  const r2vModelIds = getVideoModelsBySubMode('reference-to-video').map((m) => m.id) as [string, ...string[]]
  tools.generate_video_with_reference = tool({
    description:
      'Generate a new video scene featuring characters from reference images (reference-to-video). ' +
      'The reference images show what characters look like; your prompt describes a completely new scene. ' +
      'Use character1, character2, etc. in the prompt to refer to each reference. ' +
      'Supported model: Wan v2.6 R2V. ' +
      'Use this when the user wants to place characters from photos into a new video scene.',
    inputSchema: z.object({
      prompt: z.string().describe('Scene description using character1, character2, etc. to reference each character'),
      referenceUrl: z.string().describe('URL of a reference image or video showing the character'),
      modelId: z.enum(r2vModelIds).optional().describe('Specific model to use (optional)'),
      duration: z.number().min(2).max(10).optional().describe('Duration in seconds (default: 5)'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'generate_video_with_reference')
      return executeGenerateVideo(options, { prompt: input.prompt, modelId: input.modelId, duration: input.duration, videoSubMode: 'reference-to-video', imageUrl: input.referenceUrl })
    },
  })

  const motionModelIds = getVideoModelsBySubMode('motion-control').map((m) => m.id) as [string, ...string[]]
  tools.apply_motion_control = tool({
    description:
      'Transfer motion from a reference video onto a character image (motion control). ' +
      'The model analyzes movements in the reference video and applies them to the character. ' +
      'Supported model: Kling v2.6 Motion Control. ' +
      'Use this when the user wants to make a character perform the same actions as someone in a video.',
    inputSchema: z.object({
      prompt: z.string().describe('Optional description of scene elements or camera movement'),
      characterImageUrl: z.string().describe('URL of the character image to apply motion to'),
      referenceVideoUrl: z.string().describe('URL of the reference video whose motion to transfer'),
      modelId: z.enum(motionModelIds).optional().describe('Specific model to use (optional)'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'apply_motion_control')
      return executeGenerateVideo(options, { prompt: input.prompt, modelId: input.modelId, videoSubMode: 'motion-control', imageUrl: input.characterImageUrl, referenceVideoUrl: input.referenceVideoUrl })
    },
  })

  const editVideoModelIds = getVideoModelsBySubMode('video-editing').map((m) => m.id) as [string, ...string[]]
  tools.edit_video = tool({
    description:
      'Edit an existing video using a text prompt (video editing). ' +
      'Describe the changes and the model modifies the video accordingly. ' +
      'Supported model: Grok Video (max 8.7s input, output up to 720p). ' +
      'Use this when the user wants to modify, restyle, or transform an existing video.',
    inputSchema: z.object({
      prompt: z.string().describe('Description of the edits to apply to the video'),
      videoUrl: z.string().describe('URL of the source video to edit'),
      modelId: z.enum(editVideoModelIds).optional().describe('Specific model to use (optional)'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'edit_video')
      return executeGenerateVideo(options, { prompt: input.prompt, modelId: input.modelId, videoSubMode: 'video-editing', imageUrl: input.videoUrl })
    },
  })

  return tools
}
