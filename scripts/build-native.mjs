#!/usr/bin/env node
// Compile better-sqlite3 from source if the native binding is missing or
// incompatible. Runs as a postinstall hook after every `pnpm install`.
//
// Why: better-sqlite3 has no prebuilt binary for Node 24 (ABI 137). The
// prebuild-install fallback in its own install script is unreliable across
// pnpm's content-addressable store — this hook guarantees compilation.
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'

const require = createRequire(import.meta.url)

try {
  require('better-sqlite3')
  // Binding loaded successfully — nothing to do.
} catch {
  const pkgDir = dirname(require.resolve('better-sqlite3/package.json'))
  console.log('building better-sqlite3 from source...')
  execSync('npx --yes node-gyp rebuild', { cwd: pkgDir, stdio: 'inherit' })
}
