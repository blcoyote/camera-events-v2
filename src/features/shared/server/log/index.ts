import '@tanstack/react-start/server-only'
import { SpanStatusCode, isSpanContextValid, trace } from '@opentelemetry/api'

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type Level = keyof typeof LEVELS

const env = process.env.LOG_LEVEL
const threshold = LEVELS[env as Level] ?? LEVELS.info

const RESERVED = new Set([
  'time',
  'level',
  'component',
  'msg',
  'trace_id',
  'span_id',
  'err',
  // JSON.stringify would call it on the whole line and replace the envelope.
  'toJSON',
])

function serialiseError(err: unknown) {
  return err instanceof Error
    ? { name: err.name, message: err.message, stack: err.stack }
    : { message: String(err) }
}

function write(
  level: Level,
  component: string,
  msg: string,
  fields?: Record<string, unknown>,
  err?: unknown,
) {
  if (LEVELS[level] < threshold) return
  const time = new Date().toISOString()
  let out: string
  try {
    const ctx = trace.getActiveSpan()?.spanContext()
    const active = ctx && isSpanContextValid(ctx) ? ctx : undefined
    const line: Record<string, unknown> = {
      time,
      level,
      component,
      msg,
      ...(active && { trace_id: active.traceId, span_id: active.spanId }),
      ...(err !== undefined && { err: serialiseError(err) }),
    }
    for (const [k, v] of Object.entries(fields ?? {}))
      if (!RESERVED.has(k)) line[k] = v
    out = JSON.stringify(line)
  } catch (e) {
    // Logging runs inside catch blocks: never throw. Keep err if it alone is fine.
    let errOut: ReturnType<typeof serialiseError> | undefined
    try {
      if (err !== undefined) errOut = serialiseError(err)
    } catch {}
    out = JSON.stringify({
      time,
      level,
      component: String(component),
      msg: String(msg),
      ...(errOut && { err: errOut }),
      log_error: e instanceof Error ? e.message : 'unserialisable log input',
    })
  }
  console.log(out)
}

export const log = {
  debug: (c: string, m: string, f?: Record<string, unknown>) =>
    write('debug', c, m, f),
  info: (c: string, m: string, f?: Record<string, unknown>) =>
    write('info', c, m, f),
  warn: (c: string, m: string, f?: Record<string, unknown>) =>
    write('warn', c, m, f),
  error(c: string, m: string, err?: unknown, f?: Record<string, unknown>) {
    const span = trace.getActiveSpan()
    if (span) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: m })
      try {
        if (err !== undefined)
          span.recordException(err instanceof Error ? err : String(err))
      } catch {
        // An unprintable error still leaves the span marked ERROR above.
      }
    }
    write('error', c, m, f, err)
  },
}
