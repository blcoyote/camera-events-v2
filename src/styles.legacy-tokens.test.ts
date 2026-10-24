// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)))
const SELF_PATH = resolve(fileURLToPath(import.meta.url))
const GENERATED_ROUTE_TREE = resolve(SRC_DIR, 'routeTree.gen.ts')
const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.css']

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectSourceFiles(fullPath))
      continue
    }
    if (!SCANNED_EXTENSIONS.some((ext) => fullPath.endsWith(ext))) continue
    if (fullPath === SELF_PATH || fullPath === GENERATED_ROUTE_TREE) continue
    files.push(fullPath)
  }
  return files
}

const sourceFiles = collectSourceFiles(SRC_DIR)

function findOffendingFiles(matcher: (contents: string) => boolean): string[] {
  return sourceFiles
    .filter((file) => matcher(readFileSync(file, 'utf8')))
    .map((file) => relative(resolve(SRC_DIR, '..'), file))
}

const forbiddenLiterals = [
  '--sea-',
  '--lagoon',
  '--palm',
  '--sand',
  '--foam',
  '--chip-',
  '--kicker',
  '--hero-',
  '--accent-emphasis',
  '--accent-muted',
  'island-shell',
  'island-kicker',
  'display-title',
  'data-palette',
  'Fraunces',
  'Manrope',
]

describe('legacy design tokens', () => {
  it.each(forbiddenLiterals)('no source file contains %s', (needle) => {
    const offenders = findOffendingFiles((contents) =>
      contents.includes(needle),
    )
    expect(offenders, `"${needle}" found in: ${offenders.join(', ')}`).toEqual(
      [],
    )
  })

  it('no source file contains a Tailwind dark: variant', () => {
    const offenders = findOffendingFiles((contents) => /\bdark:/.test(contents))
    expect(
      offenders,
      `"dark:" variant found in: ${offenders.join(', ')}`,
    ).toEqual([])
  })
})
