import '@tanstack/react-start/server-only'
import { SpanKind, SpanStatusCode, context } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  defaultResource,
  detectResources,
  resourceAttributesEnvDetector,
  serviceNameEnvDetector,
} from '@opentelemetry/resources'
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace'
import { normaliseMethod, requestKind } from '#/features/shared/server/metrics'
import type { Attributes, Span, Tracer } from '@opentelemetry/api'
import type { SpanProcessor } from '@opentelemetry/sdk-trace'

// Deliberately not the @opentelemetry/api global provider: a tracer fetched
// before a provider is registered stays a permanent no-op (same as metrics).
let provider: TracerProvider | null = null
let tracer: Tracer | null = null

export function startTracing(processor?: SpanProcessor): void {
  if (provider) return
  if (!processor && !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return

  // Makes the active span survive awaits, so logs and child spans correlate.
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  )
  provider = new TracerProvider({
    resource: defaultResource().merge(
      detectResources({
        detectors: [resourceAttributesEnvDetector, serviceNameEnvDetector],
      }),
    ),
    spanProcessors: [
      processor ??
        new BatchSpanProcessor({ exporter: new OTLPTraceExporter() }),
    ],
  })
  tracer = provider.getTracer('camera-events-v2')
}

export async function _resetTracingForTests(): Promise<void> {
  await provider?.shutdown()
  context.disable()
  provider = null
  tracer = null
}

function fail(span: Span, err: unknown) {
  span.setStatus({ code: SpanStatusCode.ERROR })
  try {
    span.recordException(err instanceof Error ? err : String(err))
  } catch {
    // Instrumentation must never throw; the span is still marked ERROR.
  }
}

type SpanOpts = { kind?: SpanKind; root?: boolean }

/** fn receives the span (undefined when tracing is off) to add attributes or status. */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span | undefined) => Promise<T> | T,
  opts: SpanOpts = {},
): Promise<T> {
  if (!tracer) return await fn(undefined)
  return tracer.startActiveSpan(
    name,
    { kind: opts.kind, attributes, root: opts.root },
    async (span) => {
      try {
        return await fn(span)
      } catch (err) {
        fail(span, err)
        throw err
      } finally {
        span.end()
      }
    },
  )
}

/** Same as withSpan for synchronous code, so thrown errors stay synchronous. */
export function withSpanSync<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span | undefined) => T,
  opts: SpanOpts = {},
): T {
  if (!tracer) return fn(undefined)
  return tracer.startActiveSpan(
    name,
    { kind: opts.kind, attributes, root: opts.root },
    (span) => {
      try {
        return fn(span)
      } catch (err) {
        fail(span, err)
        throw err
      } finally {
        span.end()
      }
    },
  )
}

export function withRequestSpan<A extends unknown[]>(
  handler: (req: Request, ...rest: A) => Promise<Response>,
): (req: Request, ...rest: A) => Promise<Response> {
  return async (req, ...rest) => {
    const { pathname } = new URL(req.url)
    const kind = requestKind(pathname)
    if (!tracer || kind === 'asset' || pathname.startsWith('/api/health'))
      return handler(req, ...rest)

    return tracer.startActiveSpan(
      normaliseMethod(req.method),
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.request.method': normaliseMethod(req.method),
          'url.path': pathname,
          'request.kind': kind,
        },
      },
      async (span) => {
        try {
          const res = await handler(req, ...rest)
          span.setAttribute('http.response.status_code', res.status)
          if (res.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR })
          return res
        } catch (err) {
          fail(span, err)
          throw err
        } finally {
          span.end()
        }
      },
    )
  }
}
