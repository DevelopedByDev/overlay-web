import { access, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatOverlayConfigError,
  getRedactedOverlayRuntimeConfigSummary,
  loadOverlayConfig,
} from '../src/server/config/loadOverlayConfig.ts'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const selfHostingDoc = path.join(docsDir, 'SELF_HOSTING.md')
const configExamplesDir = path.join(docsDir, 'config')

const disallowedExamplePatterns = [
  { label: 'Stripe secret key', pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_]+/i },
  { label: 'Stripe webhook secret', pattern: /\bwhsec_[A-Za-z0-9_]+/i },
  { label: 'Overlay API key secret', pattern: /\bovl_sk_[A-Za-z0-9_]+/i },
  { label: 'known production Convex deployment slug', pattern: /prod:colorful/i },
  { label: 'real-looking Convex cloud URL', pattern: /https:\/\/[a-z0-9-]+\.convex\.cloud/i },
] as const

async function main() {
  let failed = false

  const exampleFiles = await listJsonExamples(configExamplesDir)
  if (exampleFiles.length === 0) {
    console.error('FAIL: docs/config contains no JSON examples')
    process.exit(1)
  }

  for (const file of exampleFiles) {
    const ok = await validateConfigExample(file)
    failed ||= !ok
  }

  for (const file of exampleFiles) {
    const ok = await checkExampleForSecrets(file)
    failed ||= !ok
  }

  const linksOk = await checkLocalMarkdownAnchors(selfHostingDoc)
  failed ||= !linksOk

  if (failed) process.exit(1)
}

async function listJsonExamples(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dir, entry.name))
    .sort()
}

async function validateConfigExample(file: string): Promise<boolean> {
  try {
    const config = await loadOverlayConfig({
      configFilePath: file,
      defaultConfig: {},
      env: {},
    })
    const summary = getRedactedOverlayRuntimeConfigSummary(config)
    const serialized = JSON.stringify(summary)
    if (/(secret|token|apiKey|api_key)/i.test(serialized) && /placeholder|replace_with/i.test(serialized)) {
      throw new Error('Redacted config summary appears to include a placeholder secret')
    }
    console.log(`OK config ${relative(file)} (${config.app.deploymentEnvironment})`)
    return true
  } catch (error) {
    const formatted = formatOverlayConfigError(error)
    console.error(`FAIL config ${relative(file)}: ${formatted.message}`)
    for (const issue of formatted.issues) console.error(`  - ${issue}`)
    return false
  }
}

async function checkExampleForSecrets(file: string): Promise<boolean> {
  const text = await readFile(file, 'utf8')
  let ok = true
  for (const { label, pattern } of disallowedExamplePatterns) {
    const match = pattern.exec(text)
    if (match) {
      ok = false
      console.error(`FAIL secrets ${relative(file)}: ${label} pattern matched "${match[0]}"`)
    }
  }
  if (ok) console.log(`OK secrets ${relative(file)}`)
  return ok
}

async function checkLocalMarkdownAnchors(file: string): Promise<boolean> {
  const text = await readFile(file, 'utf8')
  const links = extractMarkdownLinks(text)
  let ok = true

  for (const href of links) {
    if (isExternalLink(href) || href.startsWith('mailto:')) continue
    const [targetPart, anchorPart] = href.split('#')
    if (!anchorPart) continue

    const targetFile = targetPart
      ? path.resolve(path.dirname(file), decodeURIComponent(targetPart))
      : file

    if (!(await fileExists(targetFile))) {
      ok = false
      console.error(`FAIL links ${relative(file)}: missing target ${href}`)
      continue
    }

    const targetStat = await stat(targetFile)
    if (!targetStat.isFile()) {
      ok = false
      console.error(`FAIL links ${relative(file)}: target is not a file ${href}`)
      continue
    }

    const targetText = await readFile(targetFile, 'utf8')
    const anchors = markdownHeadingAnchors(targetText)
    const expected = decodeURIComponent(anchorPart)
    if (!anchors.has(expected)) {
      ok = false
      console.error(`FAIL links ${relative(file)}: missing anchor #${expected} in ${relative(targetFile)}`)
    }
  }

  if (ok) console.log(`OK links ${relative(file)}`)
  return ok
}

function extractMarkdownLinks(text: string): string[] {
  const withoutCodeBlocks = text.replace(/```[\s\S]*?```/g, '')
  const links: string[] = []
  const markdownLinkPattern = /(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  for (const match of withoutCodeBlocks.matchAll(markdownLinkPattern)) {
    const href = match[1]
    if (href) links.push(href)
  }
  return links
}

function markdownHeadingAnchors(text: string): Set<string> {
  const anchors = new Set<string>()
  const counts = new Map<string, number>()
  for (const line of text.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (!match) continue
    const base = githubAnchor(match[2] ?? '')
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    anchors.add(count === 0 ? base : `${base}-${count}`)
  }
  return anchors
}

function githubAnchor(heading: string): string {
  return heading
    .trim()
    .replace(/`([^`]+)`/g, '$1')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

function isExternalLink(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href)
}

function relative(file: string): string {
  return path.relative(root, file)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
