import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import { startMqttSubscriber } from '#/features/push-notifications/server/mqtt'
import {
  startMetrics,
  withRequestMetrics,
} from '#/features/shared/server/metrics'
import { startTracing, withRequestSpan } from '#/features/shared/server/tracing'
import { paraglideMiddleware } from '#/paraglide/server.js'

// No-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set
startMetrics()
startTracing() // likewise a no-op unless the endpoint is set

// Start MQTT subscriber on server init (runs once at startup)
startMqttSubscriber()

const handler = createStartHandler(defaultStreamHandler)

// Pass the original request: the URL strategy is unused, and the callback's
// request would only matter for delocalised URLs (redirect-loop risk).
const fetch: typeof handler = withRequestMetrics(
  withRequestSpan((req, ...rest) =>
    paraglideMiddleware(req, () => handler(req, ...rest)),
  ),
)

export default createServerEntry({ fetch })
