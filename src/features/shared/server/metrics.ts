import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client'

export const register = new Registry()

collectDefaultMetrics({ register })

export const mqttEventsReceived = new Counter({
  name: 'mqtt_events_received_total',
  help: 'Total number of Frigate events received via MQTT',
  labelNames: ['camera'] as const,
  registers: [register],
})

export const pushDispatched = new Counter({
  name: 'push_dispatched_total',
  help: 'Total number of push notification dispatch attempts',
  labelNames: ['camera', 'status'] as const,
  registers: [register],
})

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
})

export function getMetricsText(): Promise<string> {
  return register.metrics()
}
