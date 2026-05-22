#!/usr/bin/env bun
/**
 * Compares each direct dependency in package.json (dependencies +
 * devDependencies) against the GitHub Advisory Database
 * (https://api.github.com/advisories) and prints any matches.
 *
 * Installed versions are read from node_modules/<name>/package.json so the
 * audit reflects what's actually resolved, not the semver range in
 * package.json. Run `bun install` first if node_modules is stale.
 *
 * Set GITHUB_TOKEN (or GH_TOKEN) for 5000 req/hr; unauthenticated is 60/hr.
 *
 * Exit codes: 0 = clean, 1 = high/critical advisories found, 2 = script error.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

interface InstalledPackage {
  name: string
  version: string
}

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

interface Advisory {
  ghsa_id: string
  cve_id: string | null
  summary: string
  severity: Severity
  html_url: string
  vulnerabilities: Array<{
    package: { ecosystem: string; name: string }
    vulnerable_version_range: string
    patched_versions: string | null
  }>
}

interface Finding {
  pkg: InstalledPackage
  advisory: Advisory
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
}

const COLOR = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
}

const NO_COLOR = !process.stdout.isTTY || process.env.NO_COLOR != null

function color(s: string, c: keyof typeof COLOR): string {
  return NO_COLOR ? s : `${COLOR[c]}${s}${COLOR.reset}`
}

/**
 * Returns the names listed under `dependencies` and `devDependencies` in the
 * given package.json text. Optional/peer deps are intentionally excluded.
 */
export function parseDirectDependencies(pkgJsonText: string): string[] {
  const pkg = JSON.parse(pkgJsonText) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const names = new Set<string>([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ])
  return [...names].sort()
}

/**
 * Reads the resolved version of `name` from node_modules/<name>/package.json.
 * Returns null if the package isn't installed (caller should warn).
 */
function resolveInstalledVersion(name: string, cwd: string): string | null {
  const pkgPath = resolve(cwd, 'node_modules', name, 'package.json')
  if (!existsSync(pkgPath)) return null
  const raw = readFileSync(pkgPath, 'utf8')
  const parsed = JSON.parse(raw) as { version?: string }
  return parsed.version ?? null
}

interface FetchResult {
  advisories: Advisory[]
  rateLimitRemaining: number
  rateLimitReset: number
}

async function fetchAdvisories(
  pkg: InstalledPackage,
  token: string | undefined,
): Promise<FetchResult> {
  const url =
    `https://api.github.com/advisories` +
    `?ecosystem=npm` +
    `&affects=${encodeURIComponent(`${pkg.name}@${pkg.version}`)}` +
    `&per_page=100`

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'camera-events-v2-audit',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { headers })
  const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? '0')
  const reset = Number(res.headers.get('x-ratelimit-reset') ?? '0')

  if (res.status === 403 || res.status === 429) {
    const waitSec = Math.max(0, reset - Math.floor(Date.now() / 1000)) + 1
    throw new RateLimitError(waitSec, await res.text())
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `GitHub API ${res.status} for ${pkg.name}@${pkg.version}: ${body.slice(0, 200)}`,
    )
  }
  const advisories = (await res.json()) as Advisory[]
  return { advisories, rateLimitRemaining: remaining, rateLimitReset: reset }
}

class RateLimitError extends Error {
  constructor(
    public waitSeconds: number,
    public body: string,
  ) {
    super(`Rate limited; reset in ${waitSeconds}s`)
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function runWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<TResult>,
  onProgress?: (done: number, total: number) => void,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length)
  let cursor = 0
  let done = 0
  const total = items.length

  async function pump(): Promise<void> {
    for (;;) {
      const i = cursor++
      if (i >= total) return
      results[i] = await worker(items[i], i)
      done++
      onProgress?.(done, total)
    }
  }

  const runners = Array.from({ length: Math.min(limit, total) }, () => pump())
  await Promise.all(runners)
  return results
}

function formatFinding(finding: Finding): string {
  const { pkg, advisory } = finding
  const sev = advisory.severity.toUpperCase().padEnd(8)
  const sevColor: keyof typeof COLOR =
    advisory.severity === 'critical' || advisory.severity === 'high'
      ? 'red'
      : advisory.severity === 'medium'
        ? 'yellow'
        : 'cyan'
  const matching = advisory.vulnerabilities.find(
    (v) => v.package.ecosystem === 'npm' && v.package.name === pkg.name,
  )
  const range = matching?.vulnerable_version_range ?? 'n/a'
  const patched = matching?.patched_versions ?? 'no fix'

  return [
    `${color(sev, sevColor)} ${color(`${pkg.name}@${pkg.version}`, 'bold')}`,
    `  ${advisory.ghsa_id}${advisory.cve_id ? ` / ${advisory.cve_id}` : ''}: ${advisory.summary}`,
    `  ${color('vulnerable:', 'gray')} ${range}    ${color('patched:', 'gray')} ${patched}`,
    `  ${color(advisory.html_url, 'gray')}`,
  ].join('\n')
}

async function main(): Promise<number> {
  const cwd = process.cwd()
  const pkgJsonPath = resolve(cwd, 'package.json')
  if (!existsSync(pkgJsonPath)) {
    console.error(`package.json not found at ${pkgJsonPath}`)
    return 2
  }

  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!token) {
    console.error(
      color('warn:', 'yellow') +
        ' no GITHUB_TOKEN set — unauthenticated GitHub API is 60 req/hr. ' +
        'Export GITHUB_TOKEN with a fine-grained PAT (no scopes needed) to lift the limit.',
    )
  }

  const names = parseDirectDependencies(readFileSync(pkgJsonPath, 'utf8'))
  const packages: InstalledPackage[] = []
  const missing: string[] = []
  for (const name of names) {
    const version = resolveInstalledVersion(name, cwd)
    if (version) packages.push({ name, version })
    else missing.push(name)
  }

  if (missing.length > 0) {
    console.error(
      color('warn:', 'yellow') +
        ` ${missing.length} direct dependency(ies) not installed — run \`bun install\` to include them:`,
    )
    for (const name of missing.slice(0, 10)) console.error(`  ${name}`)
    if (missing.length > 10) console.error(`  …and ${missing.length - 10} more`)
  }

  console.error(`Auditing ${packages.length} direct dependency(ies)…`)

  const findings: Finding[] = []
  const errors: Array<{ pkg: InstalledPackage; error: Error }> = []
  let lastRemainingLog = Infinity

  await runWithConcurrency(
    packages,
    token ? 8 : 2,
    async (pkg) => {
      // Retry once on transient rate limit.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { advisories, rateLimitRemaining } = await fetchAdvisories(
            pkg,
            token,
          )
          if (
            rateLimitRemaining < lastRemainingLog &&
            rateLimitRemaining % 25 === 0
          ) {
            console.error(
              color(`  rate-limit remaining: ${rateLimitRemaining}`, 'gray'),
            )
            lastRemainingLog = rateLimitRemaining
          }
          for (const a of advisories) findings.push({ pkg, advisory: a })
          return
        } catch (err) {
          if (err instanceof RateLimitError && attempt === 0) {
            const waitMs = Math.min(err.waitSeconds, 60) * 1000
            console.error(
              color(`  rate-limited, sleeping ${waitMs / 1000}s…`, 'yellow'),
            )
            await sleep(waitMs)
            continue
          }
          errors.push({ pkg, error: err as Error })
          return
        }
      }
    },
    (done, total) => {
      if (done % 25 === 0 || done === total) {
        process.stderr.write(`\r  ${done}/${total} checked`)
      }
    },
  )
  process.stderr.write('\n')

  findings.sort((a, b) => {
    const sevDiff =
      SEVERITY_RANK[b.advisory.severity] - SEVERITY_RANK[a.advisory.severity]
    if (sevDiff !== 0) return sevDiff
    return a.pkg.name.localeCompare(b.pkg.name)
  })

  if (errors.length > 0) {
    console.error(
      color(`\n${errors.length} package(s) failed to check:`, 'yellow'),
    )
    for (const { pkg, error } of errors.slice(0, 10)) {
      console.error(`  ${pkg.name}@${pkg.version}: ${error.message}`)
    }
    if (errors.length > 10) console.error(`  …and ${errors.length - 10} more`)
  }

  if (findings.length === 0) {
    console.log(color('\n✓ no advisories found', 'cyan'))
    return errors.length > 0 ? 2 : 0
  }

  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0,
  }
  for (const f of findings) counts[f.advisory.severity]++

  console.log(`\n${color(`${findings.length} advisory match(es):`, 'bold')}`)
  console.log(
    `  critical: ${counts.critical}  high: ${counts.high}  medium: ${counts.medium}  low: ${counts.low}  unknown: ${counts.unknown}\n`,
  )
  for (const f of findings) console.log(formatFinding(f) + '\n')

  return counts.critical + counts.high > 0 ? 1 : 0
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err)
      process.exit(2)
    })
}
