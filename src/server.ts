import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import { startMqttSubscriber } from '#/features/push-notifications/server/mqtt'
import { httpRequestDuration } from '#/features/shared/server/metrics'

/** Normalise a URL path to a low-cardinality label (e.g. /api/events/abc123 → /api/events/:id). */
function normalisePath(pathname: string): string {
  return pathname
    .split('/')
    .map((seg) =>
      /^[a-f0-9-]{8,}$|^\d+(\.\d+)?(-\w+)*$/.test(seg) ? ':id' : seg,
    )
    .join('/')
}

// Start MQTT subscriber on server init (runs once at startup)
startMqttSubscriber()

const _fetch = createStartHandler(defaultStreamHandler)

const fetch: typeof _fetch = async (request, ctx) => {
  const start = performance.now()
  const response = await _fetch(request, ctx)
  const duration = (performance.now() - start) / 1000
  const url = new URL(request.url)
  httpRequestDuration.observe(
    {
      method: request.method,
      route: normalisePath(url.pathname),
      status: String(response.status),
    },
    duration,
  )
  return response
}

export default createServerEntry({ fetch })
