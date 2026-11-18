// PreToolUse hook: blocks or asks before destructive Bash commands.
// shortcut: regex over the raw command string (catches `bash -c`, `git -C`, chains),
// not a shell parser; a determined obfuscation (base64, variables) slips through.
import { execSync } from 'node:child_process'

type Verdict = { decision: 'deny' | 'ask'; reason: string }

const SEG = '[^;&|\\n]*' // stay inside one chained command
const TARGET =
  '(?:\\/|\\/\\*|~|~\\/|\\$HOME|\\.|\\.\\.|\\.\\/|\\*)(?=\\s|$|[;&|])'

const rules: Array<[Verdict['decision'], RegExp, string]> = [
  [
    'deny',
    new RegExp(
      `\\bgit\\b${SEG}\\bpush\\b${SEG}(?:\\s-\\w*f|--force|--delete|\\s-d\\b|\\s\\+\\S)`,
    ),
    'Force or delete push',
  ],
  [
    'deny',
    new RegExp(`\\bgit\\b${SEG}\\bpush\\b${SEG}\\b(?:main|master)\\b`),
    'Push to main; open a PR instead',
  ],
  [
    'deny',
    new RegExp(`\\brm\\s${SEG}-\\w*[rR]${SEG}(?:^|\\s)${TARGET}`),
    'rm -rf on a root, home or whole-dir target',
  ],
  [
    'deny',
    /\bdocker\s+(?:volume\s+(?:rm|prune)|system\s+prune)\b/,
    'Docker data removal',
  ],
  [
    'deny',
    new RegExp(
      `\\bdocker\\s+compose\\b${SEG}\\bdown\\b${SEG}(?:\\s-\\w*v|--volumes)`,
    ),
    'compose down -v deletes volumes',
  ],
  [
    'deny',
    /\b(?:rm|mv|unlink|truncate)\b[^;&|\n]*\.db(?:-wal|-shm)?\b/,
    'Deleting or moving a SQLite database',
  ],
  [
    'deny',
    /\bsqlite3\b.*\b(?:DROP|DELETE\s+FROM)\b/i,
    'Destructive SQL on the database',
  ],
  [
    'deny',
    /\bgh\s+api\b[^;&|\n]*(?:-X|--method)[ =]*(?:DELETE|PATCH|PUT|POST)\b/i,
    'Mutating gh api call',
  ],
  ['deny', /\bgh\s+repo\s+delete\b/, 'Deleting a repository'],
  [
    'deny',
    /\b(?:cat|head|tail|less|more|bat|grep|source|cp|mv)\b[^;&|\n]*\.env(?!\.example)\b/,
    'Reading secrets from .env',
  ],
  [
    'deny',
    /\bprintenv\b|\becho\b[^;&|\n]*\$\{?(?:SESSION_SECRET|GOOGLE_CLIENT_SECRET|VAPID\w*)/,
    'Printing secrets',
  ],
  [
    'ask',
    /\bgit\b[^;&|\n]*\breset\s+--hard\b/,
    'git reset --hard discards work',
  ],
  ['ask', /\bgit\b[^;&|\n]*\bbranch\s+-D\b/, 'Force-deleting a branch'],
  ['ask', /\bgit\b[^;&|\n]*\bclean\b/, 'git clean deletes untracked files'],
  [
    'ask',
    /\bgit\b[^;&|\n]*\b(?:checkout|restore)\s+(?:--\s+)?\./,
    'Discarding working-tree changes',
  ],
  ['ask', /\bgit\b[^;&|\n]*\bstash\s+(?:drop|clear)\b/, 'Dropping stashes'],
  ['ask', /\brm\s[^;&|\n]*-\w*[rR]/, 'Recursive delete'],
  ['ask', /\bbd\s+(?:delete|purge|reset)\b/, 'Deleting tracked issues'],
]

const isBareMainPush = (cmd: string, branch: string) =>
  /^(?:main|master)$/.test(branch) && /\bgit\b[^;&|\n]*\bpush\b/.test(cmd)

export function evaluate(command: string, branch: string): Verdict | null {
  if (isBareMainPush(command, branch))
    return { decision: 'deny', reason: 'Push to main; open a PR instead' }
  // The pinned read-only pi5 check is the one ssh the project allows.
  if (
    /\bssh\b[^;&|\n]*pi5/.test(command) &&
    !/docker ps --format/.test(command)
  )
    return { decision: 'ask', reason: 'ssh to the production host' }
  for (const [decision, re, reason] of rules)
    if (re.test(command)) return { decision, reason }
  return null
}

if (import.meta.main) {
  const input = JSON.parse(await Bun.stdin.text())
  const command: string = input.tool_input?.command ?? ''
  let branch = ''
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
    }).trim()
  } catch {}
  const v = evaluate(command, branch)
  if (v?.decision === 'deny') {
    console.error(`Blocked: ${v.reason}. Ask the user to run it themselves.`)
    process.exit(2)
  }
  if (v?.decision === 'ask')
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: v.reason,
        },
      }),
    )
}
