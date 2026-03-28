import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Type } from '@sinclair/typebox'
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry'

const PLUGIN_ID = 'overlay'
const DEFAULT_TIMEOUT_MS = 15_000
const ALL_TOOL_GROUPS = ['notes', 'knowledge', 'files', 'memories', 'outputs', 'integrations'] as const

type ToolGroup = (typeof ALL_TOOL_GROUPS)[number]

type OverlayPluginConfig = {
  overlayApiBaseUrl: string
  computerApiToken: string
  enabledToolGroups: ToolGroup[]
  timeoutMs: number
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function normalizeToolGroups(value: unknown): ToolGroup[] {
  if (!Array.isArray(value)) return [...ALL_TOOL_GROUPS]
  const allowed = new Set<ToolGroup>(ALL_TOOL_GROUPS)
  const groups = value
    .map((entry) => (typeof entry === 'string' ? entry : ''))
    .filter((entry): entry is ToolGroup => allowed.has(entry as ToolGroup))
  return groups.length > 0 ? groups : [...ALL_TOOL_GROUPS]
}

function readPluginConfig(api: {
  config?: {
    plugins?: {
      entries?: Record<string, { config?: Record<string, unknown> }>
    }
  }
}): OverlayPluginConfig {
  const entryConfig = api.config?.plugins?.entries?.[PLUGIN_ID]?.config ?? {}
  const rawBaseUrl =
    typeof entryConfig.overlayApiBaseUrl === 'string'
      ? entryConfig.overlayApiBaseUrl
      : process.env.OVERLAY_API_BASE_URL ?? ''
  const rawToken =
    typeof entryConfig.computerApiToken === 'string'
      ? entryConfig.computerApiToken
      : process.env.OVERLAY_COMPUTER_API_TOKEN ?? ''
  const rawTimeout =
    typeof entryConfig.timeoutMs === 'number'
      ? entryConfig.timeoutMs
      : Number.parseInt(String(entryConfig.timeoutMs ?? ''), 10)

  return {
    overlayApiBaseUrl: trimTrailingSlash(rawBaseUrl.trim()),
    computerApiToken: rawToken.trim(),
    enabledToolGroups: normalizeToolGroups(entryConfig.enabledToolGroups),
    timeoutMs:
      Number.isFinite(rawTimeout) && rawTimeout >= 1000 && rawTimeout <= 120_000
        ? rawTimeout
        : DEFAULT_TIMEOUT_MS,
  }
}

function ensureToolGroupEnabled(config: OverlayPluginConfig, group: ToolGroup) {
  if (!config.enabledToolGroups.includes(group)) {
    throw new Error(`Overlay tool group "${group}" is disabled.`)
  }
  if (!config.overlayApiBaseUrl) {
    throw new Error('Overlay plugin is missing overlayApiBaseUrl configuration.')
  }
  if (!config.computerApiToken) {
    throw new Error('Overlay plugin is missing computerApiToken configuration.')
  }
}

async function overlayRequest(
  api: Parameters<Parameters<typeof definePluginEntry>[0]['register']>[0],
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  config: OverlayPluginConfig,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(`${config.overlayApiBaseUrl}/api/computer/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.computerApiToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const text = await response.text()
    const data = text ? (JSON.parse(text) as unknown) : null

    if (!response.ok) {
      const error =
        data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : `Overlay API ${method} ${endpoint} failed with HTTP ${response.status}`
      throw new Error(error)
    }

    return data
  } finally {
    clearTimeout(timeout)
  }
}

async function uploadBinary(
  uploadUrl: string,
  contentType: string,
  data: Uint8Array,
): Promise<string> {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
    },
    body: data,
  })

  const payload = (await response.json()) as { storageId?: string; error?: string }
  if (!response.ok || !payload.storageId) {
    throw new Error(payload.error || 'Failed to upload binary to Overlay storage.')
  }

  return payload.storageId
}

function renderResult(summary: string, data?: unknown) {
  const text =
    data === undefined
      ? summary
      : `${summary}\n\n${JSON.stringify(data, null, 2).slice(0, 12_000)}`
  return { content: [{ type: 'text' as const, text }] }
}

function renderError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown Overlay plugin error'
  return {
    content: [{ type: 'text' as const, text: `Overlay request failed: ${message}` }],
    isError: true,
  }
}

function guessMimeType(filePath: string, fallback?: string): string {
  if (fallback?.trim()) return fallback.trim()
  const extension = path.extname(filePath).toLowerCase()
  switch (extension) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.pdf':
      return 'application/pdf'
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    case '.ppt':
      return 'application/vnd.ms-powerpoint'
    case '.txt':
      return 'text/plain; charset=utf-8'
    case '.md':
      return 'text/markdown; charset=utf-8'
    case '.html':
      return 'text/html; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.zip':
      return 'application/zip'
    default:
      return 'application/octet-stream'
  }
}

function buildPromptContext(config: OverlayPluginConfig): string {
  const groups = config.enabledToolGroups.join(', ')
  return [
    'Overlay plugin is installed on this computer.',
    `Available Overlay tool groups: ${groups}.`,
    'Use overlay_* tools for Overlay notes, knowledge search, files, memories, outputs, and integrations.',
    'Do not claim Overlay tools are unavailable when the overlay_* tool registry is present.',
  ].join(' ')
}

export default definePluginEntry({
  id: PLUGIN_ID,
  name: 'Overlay',
  description: 'Expose Overlay capabilities as native OpenClaw tools.',
  register(api) {
    api.on(
      'before_prompt_build',
      () => ({
        appendSystemContext: buildPromptContext(readPluginConfig(api)),
      }),
      { priority: 10 },
    )

    api.registerTool({
      name: 'overlay_list_notes',
      description: 'List Overlay notes for the current user.',
      parameters: Type.Object({
        projectId: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'notes')
          const query = params.projectId ? `?projectId=${encodeURIComponent(params.projectId)}` : ''
          const result = await overlayRequest(api, 'GET', `/notes${query}`, config)
          return renderResult('Listed Overlay notes.', result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_get_note',
      description: 'Fetch a single Overlay note by noteId.',
      parameters: Type.Object({
        noteId: Type.String(),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'notes')
          const result = await overlayRequest(
            api,
            'GET',
            `/notes?noteId=${encodeURIComponent(params.noteId)}`,
            config,
          )
          return renderResult(`Fetched Overlay note ${params.noteId}.`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_create_note',
      description: 'Create a new Overlay note.',
      parameters: Type.Object({
        title: Type.String(),
        content: Type.String(),
        tags: Type.Optional(Type.Array(Type.String())),
        projectId: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'notes')
          const result = await overlayRequest(api, 'POST', '/notes', config, params)
          return renderResult(`Created Overlay note "${params.title}".`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_update_note',
      description: 'Update an existing Overlay note.',
      parameters: Type.Object({
        noteId: Type.String(),
        title: Type.Optional(Type.String()),
        content: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'notes')
          const result = await overlayRequest(api, 'PATCH', '/notes', config, params)
          return renderResult(`Updated Overlay note ${params.noteId}.`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_delete_note',
      description: 'Delete an Overlay note.',
      parameters: Type.Object({
        noteId: Type.String(),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'notes')
          const result = await overlayRequest(
            api,
            'DELETE',
            `/notes?noteId=${encodeURIComponent(params.noteId)}`,
            config,
          )
          return renderResult(`Deleted Overlay note ${params.noteId}.`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_search_knowledge',
      description: 'Search Overlay knowledge for the current user.',
      parameters: Type.Object({
        query: Type.String(),
        projectId: Type.Optional(Type.String()),
        sourceKind: Type.Optional(Type.Union([Type.Literal('file'), Type.Literal('memory')])),
        kVec: Type.Optional(Type.Number()),
        kLex: Type.Optional(Type.Number()),
        m: Type.Optional(Type.Number()),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'knowledge')
          const result = await overlayRequest(api, 'POST', '/tools/invoke', config, {
            toolName: 'search_knowledge',
            input: params,
          })
          return renderResult(`Searched Overlay knowledge for "${params.query}".`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_list_files',
      description: 'List Overlay files for the current user.',
      parameters: Type.Object({
        projectId: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'files')
          const query = params.projectId ? `?projectId=${encodeURIComponent(params.projectId)}` : ''
          const result = await overlayRequest(api, 'GET', `/files${query}`, config)
          return renderResult('Listed Overlay files.', result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_get_file',
      description: 'Fetch a single Overlay file or folder by fileId.',
      parameters: Type.Object({
        fileId: Type.String(),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'files')
          const result = await overlayRequest(
            api,
            'GET',
            `/files?fileId=${encodeURIComponent(params.fileId)}`,
            config,
          )
          return renderResult(`Fetched Overlay file ${params.fileId}.`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_create_file',
      description: 'Create a text file or folder in Overlay.',
      parameters: Type.Object({
        name: Type.String(),
        type: Type.Union([Type.Literal('file'), Type.Literal('folder')]),
        parentId: Type.Optional(Type.String()),
        content: Type.Optional(Type.String()),
        projectId: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'files')
          const result = await overlayRequest(api, 'POST', '/files', config, params)
          return renderResult(`Created Overlay ${params.type} "${params.name}".`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_update_file',
      description: 'Update an Overlay file name or text content.',
      parameters: Type.Object({
        fileId: Type.String(),
        name: Type.Optional(Type.String()),
        content: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'files')
          const result = await overlayRequest(api, 'PATCH', '/files', config, params)
          return renderResult(`Updated Overlay file ${params.fileId}.`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_delete_file',
      description: 'Delete an Overlay file or folder.',
      parameters: Type.Object({
        fileId: Type.String(),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'files')
          const result = await overlayRequest(
            api,
            'DELETE',
            `/files?fileId=${encodeURIComponent(params.fileId)}`,
            config,
          )
          return renderResult(`Deleted Overlay file ${params.fileId}.`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_list_memories',
      description: 'List Overlay memories for the current user.',
      parameters: Type.Object({}),
      async execute() {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'memories')
          const result = await overlayRequest(api, 'GET', '/memories', config)
          return renderResult('Listed Overlay memories.', result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_create_memory',
      description: 'Create a new Overlay memory.',
      parameters: Type.Object({
        content: Type.String(),
        source: Type.Optional(Type.Union([
          Type.Literal('chat'),
          Type.Literal('note'),
          Type.Literal('manual'),
        ])),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'memories')
          const result = await overlayRequest(api, 'POST', '/memories', config, params)
          return renderResult('Created Overlay memory.', result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_update_memory',
      description: 'Update an Overlay memory.',
      parameters: Type.Object({
        memoryId: Type.String(),
        content: Type.String(),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'memories')
          const result = await overlayRequest(api, 'PATCH', '/memories', config, params)
          return renderResult(`Updated Overlay memory ${params.memoryId}.`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_delete_memory',
      description: 'Delete an Overlay memory.',
      parameters: Type.Object({
        memoryId: Type.String(),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'memories')
          const result = await overlayRequest(
            api,
            'DELETE',
            `/memories?memoryId=${encodeURIComponent(params.memoryId)}`,
            config,
          )
          return renderResult(`Deleted Overlay memory ${params.memoryId}.`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_create_output',
      description: 'Create an Overlay output record from existing storage or URL metadata.',
      parameters: Type.Object({
        type: Type.Optional(Type.String()),
        status: Type.Optional(Type.Union([
          Type.Literal('pending'),
          Type.Literal('completed'),
          Type.Literal('failed'),
        ])),
        prompt: Type.Optional(Type.String()),
        modelId: Type.Optional(Type.String()),
        storageId: Type.Optional(Type.String()),
        url: Type.Optional(Type.String()),
        fileName: Type.Optional(Type.String()),
        mimeType: Type.Optional(Type.String()),
        sizeBytes: Type.Optional(Type.Number()),
        conversationId: Type.Optional(Type.String()),
        turnId: Type.Optional(Type.String()),
        errorMessage: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'outputs')
          const result = await overlayRequest(api, 'POST', '/outputs', config, params)
          return renderResult('Created Overlay output record.', result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_upload_output',
      description: 'Upload a local file into Overlay Outputs.',
      parameters: Type.Object({
        filePath: Type.String(),
        fileName: Type.Optional(Type.String()),
        prompt: Type.Optional(Type.String()),
        type: Type.Optional(Type.String()),
        mimeType: Type.Optional(Type.String()),
        conversationId: Type.Optional(Type.String()),
        turnId: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'outputs')

          const absolutePath = path.resolve(params.filePath)
          const fileBuffer = await fs.readFile(absolutePath)
          const stat = await fs.stat(absolutePath)
          const outputFileName = params.fileName?.trim() || path.basename(absolutePath)
          const mimeType = guessMimeType(outputFileName, params.mimeType)

          const uploadTarget = (await overlayRequest(
            api,
            'POST',
            '/outputs/upload-url',
            config,
            {},
          )) as { uploadUrl?: string }

          if (!uploadTarget.uploadUrl) {
            throw new Error('Overlay did not return an uploadUrl for the output artifact.')
          }

          const storageId = await uploadBinary(uploadTarget.uploadUrl, mimeType, fileBuffer)
          const result = await overlayRequest(api, 'POST', '/outputs', config, {
            type: params.type,
            status: 'completed',
            prompt: params.prompt || outputFileName,
            storageId,
            fileName: outputFileName,
            mimeType,
            sizeBytes: stat.size,
            conversationId: params.conversationId,
            turnId: params.turnId,
          })

          return renderResult(`Uploaded ${outputFileName} to Overlay Outputs.`, result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_list_integrations',
      description: 'List Overlay OAuth integrations connected for the owning user.',
      parameters: Type.Object({}),
      async execute() {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'integrations')
          const result = await overlayRequest(api, 'GET', '/integrations', config)
          return renderResult('Listed Overlay integrations.', result)
        } catch (error) {
          return renderError(error)
        }
      },
    })

    api.registerTool({
      name: 'overlay_execute_integration_tool',
      description: 'Search or execute an Overlay integration tool through the server-side broker.',
      parameters: Type.Object({
        mode: Type.Union([Type.Literal('search'), Type.Literal('execute')]),
        query: Type.Optional(Type.String()),
        name: Type.Optional(Type.String()),
        args: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      }),
      async execute(_toolCallId, params) {
        try {
          const config = readPluginConfig(api)
          ensureToolGroupEnabled(config, 'integrations')
          const result =
            params.mode === 'search'
              ? await overlayRequest(api, 'POST', '/tools/invoke', config, {
                  toolName: 'composio.search_tools',
                  input: {
                    query: params.query ?? '',
                  },
                })
              : await overlayRequest(api, 'POST', '/tools/invoke', config, {
                  toolName: 'composio.execute',
                  input: {
                    name: params.name,
                    args: params.args ?? {},
                  },
                })

          return renderResult(
            params.mode === 'search'
              ? `Searched Overlay integration tools for "${params.query ?? ''}".`
              : `Executed Overlay integration tool ${params.name ?? 'unknown'}.`,
            result,
          )
        } catch (error) {
          return renderError(error)
        }
      },
    })
  },
})
