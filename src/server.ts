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
import { paraglideMiddleware } from '#/paraglide/server.js'

// No-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set
startMetrics()

// Start MQTT subscriber on server init (runs once at startup)
startMqttSubscriber()

const handler = createStartHandler(defaultStreamHandler)

// Pass the original request: the URL strategy is unused, and the callback's
// request would only matter for delocalised URLs (redirect-loop risk).
const fetch: typeof handler = withRequestMetrics((req, ...rest) =>
  paraglideMiddleware(req, () => handler(req, ...rest)),
)

export default createServerEntry({ fetch })
