import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'
import { startMqttSubscriber } from '#/features/push-notifications/server/mqtt'

// Start MQTT subscriber on server init (runs once at startup)
startMqttSubscriber()

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://*.googleusercontent.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

// In production: generate a per-request nonce, apply it to the router (so
// TanStack Router stamps all its injected <script> tags with it), set the
// Content-Security-Policy response header, then hand off to the default
// stream handler. This replaces the static unsafe-inline CSP that was
// previously set via a Traefik middleware label.
const cspStreamHandler =
  process.env.NODE_ENV === 'production'
    ? async ({
        request,
        router,
        responseHeaders,
      }: Parameters<typeof defaultStreamHandler>[0]) => {
        const nonce = generateNonce()
        router.update({ ssr: { nonce } })
        responseHeaders.set('Content-Security-Policy', buildCsp(nonce))
        return defaultStreamHandler({ request, router, responseHeaders })
      }
    : defaultStreamHandler

const fetch = createStartHandler(cspStreamHandler)

export default createServerEntry({ fetch })
