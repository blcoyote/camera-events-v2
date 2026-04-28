#!/usr/bin/env node
/**
 * Verifies that the Bun production bundle (.output/server) does not load
 * better-sqlite3 statically — only behind the runtime branch.
 *
 * The Bun runtime cannot load better-sqlite3 (a native N-API addon, see
 * oven-sh/bun#4290). The fix is in src/features/shared/server/sqlite/
 * which branches on process.versions?.bun and uses bun:sqlite there.
 * This script is a guard rail: if a future change reintroduces a static
 * better-sqlite3 import on the server hot path, this fails CI before it
 * reaches a Bun runtime.
 *
 * Run after `pnpm build`. Exits 0 if clean, 1 with the offending file.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const BUNDLE_ROOT = '.output/server'

if (!existsSync(BUNDLE_ROOT)) {
  console.error(
    `verify-bun-bundle: ${BUNDLE_ROOT} not found — run \`pnpm build\` first`,
  )
  process.exit(2)
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      yield full
    }
  }
}

// Match: import("better-sqlite3") or require("better-sqlite3"), regardless
// of quote style. The driver module uses `await import("better-sqlite3")`
// which is acceptable — it sits behind the Node-runtime branch.
const dynamicImportPattern = /await\s+import\(['"]better-sqlite3['"]\)/
const anyImportPattern =
  /(?:^|[^.])\bimport\(['"]better-sqlite3['"]\)|\brequire\(['"]better-sqlite3['"]\)/

let offenders = []
for (const file of walk(BUNDLE_ROOT)) {
  const src = readFileSync(file, 'utf8')
  if (!anyImportPattern.test(src)) continue
  // Acceptable form: `await import("better-sqlite3")` lives behind the
  // process.versions.bun branch and is never evaluated on Bun.
  // Anything else (top-level static import, plain require) is suspect.
  const cleaned = src.replace(new RegExp(dynamicImportPattern, 'g'), '')
  if (anyImportPattern.test(cleaned)) {
    offenders.push(file)
  }
}

if (offenders.length > 0) {
  console.error(
    'verify-bun-bundle: FAIL — better-sqlite3 imported in a non-dynamic form:',
  )
  for (const f of offenders) console.error('  ' + f)
  console.error(
    "Use the shared SQLite driver at #/features/shared/server/sqlite — don't import better-sqlite3 directly.",
  )
  process.exit(1)
}

console.log(
  'verify-bun-bundle: OK — better-sqlite3 only appears behind dynamic import',
)
