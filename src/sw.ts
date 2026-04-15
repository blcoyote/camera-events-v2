import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist'
import {
  parsePushPayload,
  buildNotificationOptions,
  getNotificationClickUrl,
} from './sw-push-handlers'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
    readonly clients: Clients
    readonly registration: ServiceWorkerRegistration
    addEventListener: {
      (type: 'push', listener: (event: PushEvent) => void): void
      (type: 'notificationclick', listener: (event: NotificationEvent) => void): void
    }
  }

  interface Clients {
    matchAll: (options?: { type?: string; includeUncontrolled?: boolean }) => Promise<WindowClient[]>
    openWindow: (url: string) => Promise<WindowClient | null>
  }

  interface WindowClient {
    focus: () => Promise<WindowClient>
    navigate: (url: string) => Promise<WindowClient | null>
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
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Cache page navigations with network-first strategy
      matcher: ({ request }) => request.mode === 'navigate',
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
      }),
    },
    {
      // Cache images with cache-first strategy
      matcher: ({ request }) => request.destination === 'image',
      handler: new CacheFirst({
        cacheName: 'images',
        plugins: [
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window if one is open
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url)
    }),
  )
})
