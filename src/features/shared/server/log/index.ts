import '@tanstack/react-start/server-only'
import { SpanStatusCode, isSpanContextValid, trace } from '@opentelemetry/api'

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type Level = keyof typeof LEVELS

const env = process.env.LOG_LEVEL
const threshold = LEVELS[env as Level] ?? LEVELS.info

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
  const ctx = trace.getActiveSpan()?.spanContext()
  const active = ctx && isSpanContextValid(ctx) ? ctx : undefined
  // Fields first so the reserved keys below always win.
  const line: Record<string, unknown> = { ...fields }
  for (const k of [
    'time',
    'level',
    'component',
    'msg',
    'trace_id',
    'span_id',
    'err',
  ])
    delete line[k]
  const base = {
    time: new Date().toISOString(),
    level,
    component,
    msg,
    ...(active && { trace_id: active.traceId, span_id: active.spanId }),
    ...(err !== undefined && { err: serialiseError(err) }),
  }
  let out: string
  try {
    out = JSON.stringify({ ...base, ...line })
  } catch (e) {
    // Logging runs inside catch blocks; a bad field must not hide the real error.
    out = JSON.stringify({ ...base, fields_error: String(e) })
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
      if (err !== undefined) {
        span.recordException(err instanceof Error ? err : String(err))
      }
      span.setStatus({ code: SpanStatusCode.ERROR, message: m })
    }
    write('error', c, m, f, err)
  },
}
