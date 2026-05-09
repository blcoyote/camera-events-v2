import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist'
import {
  parsePushPayload,
  buildNotificationOptions,
  getNotificationClickUrl,
  setPendingNavigationUrl,
  popPendingNavigationUrl,
} from './sw-push-handlers'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
    readonly clients: Clients
    readonly registration: ServiceWorkerRegistration
    readonly caches: CacheStorage
    readonly location: { origin: string }
    addEventListener: {
      (type: 'push', listener: (event: PushEvent) => void): void
      (
        type: 'notificationclick',
        listener: (event: NotificationEvent) => void,
      ): void
      (type: 'message', listener: (event: ExtendableMessageEvent) => void): void
    }
  }

  interface Clients {
    matchAll: (options?: {
      type?: string
      includeUncontrolled?: boolean
    }) => Promise<WindowClient[]>
    openWindow: (url: string) => Promise<WindowClient | null>
  }

  interface WindowClient {
    readonly url: string
    focus: () => Promise<WindowClient>
    navigate: (url: string) => Promise<WindowClient | null>
    postMessage: (message: unknown) => void
  }

  interface ExtendableMessageEvent extends ExtendableEvent {
    readonly data: unknown
    readonly source: WindowClient | null
  }

  interface PushEvent extends ExtendableEvent {
    readonly data: PushMessageData | null
  }

  interface PushMessageData {
    json: () => unknown
    text: () => string
  }

  interface NotificationEvent extends ExtendableEvent {
    readonly notification: Notification & { data: unknown }
  }

  interface ExtendableEvent extends Event {
    waitUntil: (promise: Promise<unknown>) => void
  }
}

declare const self: WorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) =>
        request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
      }),
    },
    {
      // Cache CSS, JS, and web worker requests with stale-while-revalidate
      matcher: ({ request }) =>
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'worker',
      handler: new StaleWhileRevalidate({
        cacheName: 'static-resources',
        plugins: [new CacheableResponsePlugin({ statuses: [200] })],
      }),
    },
    {
      // Cache images with cache-first strategy
      matcher: ({ request, url }) =>
        request.destination === 'image' && !url.pathname.startsWith('/api/'),
      handler: new CacheFirst({
        cacheName: 'images',
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    {
      // Cache Google Fonts stylesheets
      matcher: ({ url }) => url.origin === 'https://fonts.googleapis.com',
      handler: new StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
      }),
    },
    {
      // Cache Google Fonts webfont files
      matcher: ({ url }) => url.origin === 'https://fonts.gstatic.com',
      handler: new CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          }),
        ],
      }),
    },
  ],
})

serwist.addEventListeners()

// Handle messages from window clients:
//   - SKIP_WAITING: client accepted an update and wants the new SW to activate
//   - CLAIM_NAVIGATION: newly-loaded client is asking for any URL queued by
//     a prior notificationclick. This is how we reliably navigate on iOS
//     standalone PWAs, where openWindow(url) is not honored.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } | null
  if (data?.type === 'SKIP_WAITING') {
    ;(self as unknown as { skipWaiting: () => void }).skipWaiting()
    return
  }
  if (data?.type === 'CLAIM_NAVIGATION') {
    const source = event.source
    if (!source) return
    event.waitUntil(
      (async () => {
        const url = await popPendingNavigationUrl(self.caches)
        if (url) source.postMessage({ type: 'NAVIGATE', url })
      })(),
    )
  }
})

// --- Web Push handlers ---

self.addEventListener('push', (event: PushEvent) => {
  let data: unknown
  try {
    data = event.data?.json()
  } catch {
    data = null
  }

  const payload = parsePushPayload(data)
  const options = buildNotificationOptions(payload)

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const url = getNotificationClickUrl(event.notification.data)

  event.waitUntil(
    (async () => {
      // Queue the URL so the client can claim it on mount. This is the
      // reliable path on iOS, where openWindow(url) launches the PWA at
      // its start_url rather than the requested URL.
      await setPendingNavigationUrl(self.caches, url)

      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const sameOrigin = clientList.filter((client) => {
        try {
          return new URL(client.url).origin === self.location.origin
        } catch {
          return false
        }
      })

      if (sameOrigin.length > 0) {
        const client = sameOrigin[0]
        await client.focus()
        client.postMessage({ type: 'PENDING_NAVIGATION_AVAILABLE' })
        return
      }

      await self.clients.openWindow(url)
    })(),
  )
})
