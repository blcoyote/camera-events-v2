import '@tanstack/react-start/server-only'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import {
  defaultResource,
  detectResources,
  resourceAttributesEnvDetector,
  serviceNameEnvDetector,
} from '@opentelemetry/resources'
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import type { Counter, Histogram } from '@opentelemetry/api'
import type { MetricReader } from '@opentelemetry/sdk-metrics'

// Deliberately not the @opentelemetry/api global provider: a meter fetched
// before a provider is registered stays a permanent no-op.
let provider: MeterProvider | null = null
let instruments: {
  duration: Histogram
  mqttMessages: Counter
  pushSends: Counter
} | null = null
let mqttConnected: (() => boolean) | null = null

const MQTT_TOPICS = new Set([
  'frigate/events',
  'frigate/reviews',
  'frigate/stats',
  'frigate/available',
])

export type PushSendKind = 'motion' | 'availability' | 'share'
export type PushSendOutcome = 'ok' | 'expired' | 'failed'

export function startMetrics(reader?: MetricReader): void {
  if (provider) return
  if (!reader && !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return

  provider = new MeterProvider({
    resource: defaultResource().merge(
      detectResources({
        detectors: [resourceAttributesEnvDetector, serviceNameEnvDetector],
      }),
    ),
    readers: [
      reader ??
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
          exportIntervalMillis: 30_000,
        }),
    ],
  })
  const meter = provider.getMeter('camera-events-v2')
  instruments = {
    duration: meter.createHistogram('http.server.request.duration', {
      unit: 's',
      description: 'Duration of HTTP server requests until response headers',
      // SDK defaults are millisecond-scale; these are the semconv buckets for seconds.
      advice: {
        explicitBucketBoundaries: [
          0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5,
          10,
        ],
      },
    }),
    mqttMessages: meter.createCounter('mqtt.messages', {
      description: 'MQTT messages received from Frigate',
    }),
    pushSends: meter.createCounter('push.sends', {
      description: 'Web Push sends attempted, by Delivery kind and outcome',
    }),
  }
  meter
    .createObservableGauge('mqtt.connected', {
      description: '1 while connected to the MQTT broker, else 0',
    })
    .addCallback((r) => r.observe(mqttConnected?.() ? 1 : 0))
  meter
    .createObservableGauge('process.memory.rss', { unit: 'By' })
    .addCallback((r) => r.observe(process.memoryUsage().rss))
  meter
    .createObservableGauge('process.memory.heap_used', { unit: 'By' })
    .addCallback((r) => r.observe(process.memoryUsage().heapUsed))
}

export async function _resetMetricsForTests(): Promise<void> {
  await provider?.shutdown()
  provider = null
  instruments = null
  mqttConnected = null
}

export function recordMqttMessage(topic: string): void {
  instruments?.mqttMessages.add(1, {
    topic: MQTT_TOPICS.has(topic) ? topic : 'other',
  })
}

/** Order-independent: may be called before or after startMetrics. */
export function observeMqttConnection(isConnected: () => boolean): void {
  mqttConnected = isConnected
}

export function recordPushSend(
  kind: PushSendKind,
  outcome: PushSendOutcome,
): void {
  instruments?.pushSends.add(1, { kind, outcome })
}

// Frigate event IDs contain dots (/camera-events/1700000000.123-abc), so only
// known static-file extensions count as assets.
const ASSET_EXT =
  /\.(js|css|map|png|jpg|jpeg|svg|ico|webp|webmanifest|json|txt|woff2?)$/i

const KNOWN_METHODS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
])

function requestKind(pathname: string) {
  if (pathname.startsWith('/_serverFn')) return 'serverFn'
  if (pathname.startsWith('/api/')) return 'api'
  if (pathname.startsWith('/assets/') || ASSET_EXT.test(pathname))
    return 'asset'
  return 'page'
}

export function withRequestMetrics<A extends unknown[]>(
  handler: (req: Request, ...rest: A) => Promise<Response>,
): (req: Request, ...rest: A) => Promise<Response> {
  return async (req, ...rest) => {
    const start = performance.now()
    let status = 500
    try {
      const res = await handler(req, ...rest)
      status = res.status
      return res
    } finally {
      instruments?.duration.record((performance.now() - start) / 1000, {
        // Client-controlled: unknown verbs collapse to _OTHER (OTel semconv) to bound cardinality.
        'http.request.method': KNOWN_METHODS.has(req.method)
          ? req.method
          : '_OTHER',
        'http.response.status_class': `${Math.floor(status / 100)}xx`,
        'request.kind': requestKind(new URL(req.url).pathname),
      })
    }
  }
}
