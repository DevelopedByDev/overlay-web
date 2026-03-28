import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const pluginRoot = path.join(repoRoot, 'openclaw-plugins', 'overlay')
const outputFile = path.join(repoRoot, 'src', 'lib', 'openclaw-overlay-plugin-bundle.ts')

async function collectFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, baseDirectory)))
      continue
    }

    const relativePath = path.relative(baseDirectory, fullPath).replaceAll(path.sep, '/')
    files.push(relativePath)
  }

  files.sort((a, b) => a.localeCompare(b))
  return files
}

async function main() {
  const packageJson = JSON.parse(await readFile(path.join(pluginRoot, 'package.json'), 'utf8'))
  const files = await collectFiles(pluginRoot)

  const fileEntries = await Promise.all(
    files.map(async (relativePath) => {
      const content = await readFile(path.join(pluginRoot, relativePath), 'utf8')
      return [relativePath, content]
    }),
  )

  const moduleSource = `export const OPENCLAW_OVERLAY_PLUGIN_ID = 'overlay' as const
export const OPENCLAW_OVERLAY_PLUGIN_PACKAGE_NAME = ${JSON.stringify(packageJson.name)} as const
export const OPENCLAW_OVERLAY_PLUGIN_VERSION = ${JSON.stringify(packageJson.version)} as const

export const OPENCLAW_OVERLAY_PLUGIN_FILES = {
${fileEntries
  .map(([relativePath, content]) => `  ${JSON.stringify(relativePath)}: ${JSON.stringify(content)},`)
  .join('\n')}
} as const

export type OpenClawOverlayPluginFilePath = keyof typeof OPENCLAW_OVERLAY_PLUGIN_FILES
`

  await mkdir(path.dirname(outputFile), { recursive: true })
  await writeFile(outputFile, moduleSource, 'utf8')
}

await main()
