import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

type RouteEntry = {
  path: string
  methods: string[]
  requestSchema?: string
  responseSchema?: string
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.isFile() && entry.name === 'route.ts' ? [full] : []
  })
}

function routePath(file: string): string {
  const rel = relative(join(process.cwd(), 'src/app/api'), dirname(file))
  return `/${rel.replace(/\\/g, '/').replace(/\[([^\]]+)\]/g, '{$1}')}`
}

function extractMethods(source: string): string[] {
  const matches = [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/g)]
  const constMatches = [...source.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/g)]
  return Array.from(new Set([...matches, ...constMatches].map((match) => match[1]!))).sort()
}

function extractOpenApiNames(source: string): { requestSchema?: string; responseSchema?: string } {
  const names = [...source.matchAll(/\.openapi\('([^']+)'\)/g)].map((match) => match[1]!)
  return {
    requestSchema: names.find((name) => name.endsWith('Request')),
    responseSchema: names.find((name) => name.endsWith('Response')),
  }
}

const routeFiles = walk(join(process.cwd(), 'src/app/api'))
const routes: RouteEntry[] = routeFiles
  .map((file) => {
    const source = readFileSync(file, 'utf8')
    return {
      path: routePath(file),
      methods: extractMethods(source),
      ...extractOpenApiNames(source),
    }
  })
  .filter((entry) => entry.methods.length > 0)
  .sort((a, b) => a.path.localeCompare(b.path))

const paths = Object.fromEntries(
  routes.map((entry) => [
    entry.path,
    Object.fromEntries(
      entry.methods.map((method) => [
        method.toLowerCase(),
        {
          operationId: `${method.toLowerCase()}${entry.path.replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())}`,
          tags: [entry.path.split('/').filter(Boolean)[0] ?? 'api'],
          ...(entry.requestSchema
            ? {
                requestBody: {
                  required: false,
                  content: {
                    'application/json': {
                      schema: { $ref: `#/components/schemas/${entry.requestSchema}` },
                    },
                  },
                },
              }
            : {}),
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: entry.responseSchema
                    ? { $ref: `#/components/schemas/${entry.responseSchema}` }
                    : {},
                },
              },
            },
            default: {
              description: 'Error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      ]),
    ),
  ]),
)

const schemaNames = Array.from(
  new Set(routes.flatMap((entry) => [entry.requestSchema, entry.responseSchema]).filter(Boolean) as string[]),
).sort()

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Overlay API',
    version: '1.0.0',
  },
  paths,
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
        },
        required: ['error'],
      },
      ...Object.fromEntries(schemaNames.map((name) => [name, { type: 'object', additionalProperties: true }])),
    },
  },
}

const output = join(process.cwd(), 'docs-site/api/openapi.json')
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(spec, null, 2)}\n`)
console.log(`Generated ${output} with ${routes.length} routes.`)
