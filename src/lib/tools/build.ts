import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import { IMAGE_MODELS, VIDEO_MODELS } from '@/lib/models'
import {
  executeCreateComputerSession,
  executeDeleteComputerSession,
  executeGetComputerSessionMessages,
  executeListComputerSessions,
  executeListComputerWorkspaceFiles,
  executeReadComputerWorkspaceFile,
  executeRunComputerGatewayCommand,
  executeUpdateComputerSession,
  executeWriteComputerWorkspaceFile,
} from './computer-executes'
import {
  executeCreateNote,
  executeDeleteNote,
  executeGetNote,
  executeListNotes,
  executeUpdateNote,
} from './notes-executes'
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

/** Resolve hosted computer by user-chosen name, optional Convex id, or default when only one exists. */
const computerTargetSchema = {
  computerName: z
    .string()
    .optional()
    .describe(
      "The user's Overlay computer name (the label they chose). If they have several, use the name they mention. Omit when they only have one ready computer.",
    ),
  computerId: z
    .string()
    .optional()
    .describe('Internal Convex id — optional fallback; prefer computerName when the user names their machine.'),
}

/**
 * Overlay-defined tools only (no Composio, no Gateway perplexity).
 * Ask: knowledge + memory writes + notes read + computer read. Act: full mutations + media.
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

  tools.list_computer_sessions = tool({
    description:
      'List chat sessions on the user\'s Overlay hosted computer (OpenClaw). Use computerName (their instance name) or omit if they only have one ready computer.',
    inputSchema: z.object({ ...computerTargetSchema }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'list_computer_sessions')
      return executeListComputerSessions(options, input)
    },
  })

  tools.get_computer_session_messages = tool({
    description: 'Read transcript messages for one computer chat session (sessionKey from list_computer_sessions).',
    inputSchema: z.object({
      ...computerTargetSchema,
      sessionKey: z.string(),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'get_computer_session_messages')
      return executeGetComputerSessionMessages(options, input)
    },
  })

  tools.list_computer_workspace_files = tool({
    description: 'List files in the OpenClaw workspace on the user\'s hosted computer.',
    inputSchema: z.object({ ...computerTargetSchema }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'list_computer_workspace_files')
      return executeListComputerWorkspaceFiles(options, input)
    },
  })

  tools.read_computer_workspace_file = tool({
    description: 'Read a workspace file by name from the user\'s hosted computer.',
    inputSchema: z.object({
      ...computerTargetSchema,
      name: z.string().describe('File name/path as returned by list_computer_workspace_files'),
    }),
    execute: async (input) => {
      assertOverlayToolAllowedForMode(mode, 'read_computer_workspace_file')
      return executeReadComputerWorkspaceFile(options, input)
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

    tools.create_computer_session = tool({
      description: 'Create a new OpenClaw chat session on the hosted computer.',
      inputSchema: z.object({
        ...computerTargetSchema,
        modelId: z.string().optional().describe('Overlay chat model id to map into OpenClaw'),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'create_computer_session')
        return executeCreateComputerSession(options, input)
      },
    })

    tools.update_computer_session = tool({
      description: 'Update session label or model on the hosted computer.',
      inputSchema: z.object({
        ...computerTargetSchema,
        sessionKey: z.string(),
        modelId: z.string().optional(),
        label: z.string().optional(),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'update_computer_session')
        return executeUpdateComputerSession(options, input)
      },
    })

    tools.delete_computer_session = tool({
      description: 'Delete a computer chat session and its transcript.',
      inputSchema: z.object({
        ...computerTargetSchema,
        sessionKey: z.string(),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'delete_computer_session')
        return executeDeleteComputerSession(options, input)
      },
    })

    tools.write_computer_workspace_file = tool({
      description: 'Write or overwrite a file in the OpenClaw workspace on the hosted computer.',
      inputSchema: z.object({
        ...computerTargetSchema,
        name: z.string(),
        content: z.string(),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'write_computer_workspace_file')
        return executeWriteComputerWorkspaceFile(options, input)
      },
    })

    tools.run_computer_gateway_command = tool({
      description:
        'Send a natural-language instruction to the OpenClaw agent on the hosted computer for the given session. ' +
        'Use only when the user wants work done on their Overlay computer.',
      inputSchema: z.object({
        ...computerTargetSchema,
        sessionKey: z.string(),
        message: z.string(),
      }),
      execute: async (input) => {
        assertOverlayToolAllowedForMode(mode, 'run_computer_gateway_command')
        return executeRunComputerGatewayCommand(options, input)
      },
    })
  }

  return tools
}
