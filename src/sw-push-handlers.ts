/**
 * Pure functions for service worker push notification handling.
 * Extracted from sw.ts so they can be tested without SW globals.
 */

export type PushPayloadEvent =
  | { kind: 'single'; label: string; timestamp: number }
  | { kind: 'bundled'; count: number; labels: string; timestamp: number }

export interface PushPayload {
  title: string
  body: string
  url: string
  icon?: string
  tag?: string
  event?: PushPayloadEvent
}

const DEFAULT_PAYLOAD: PushPayload = {
  title: 'Notification',
  body: '',
  url: '/',
}

function parseEvent(value: unknown): PushPayloadEvent | undefined {
  if (!value || typeof value !== 'object') return undefined
  const e = value as Record<string, unknown>
  if (
    e.kind === 'single' &&
    typeof e.label === 'string' &&
    typeof e.timestamp === 'number'
  ) {
    return { kind: 'single', label: e.label, timestamp: e.timestamp }
  }
  if (
    e.kind === 'bundled' &&
    typeof e.count === 'number' &&
    typeof e.labels === 'string' &&
    typeof e.timestamp === 'number'
  ) {
    return {
      kind: 'bundled',
      count: e.count,
      labels: e.labels,
      timestamp: e.timestamp,
    }
  }
  return undefined
}

/** Format a unix timestamp to a short HH:MM time string in the device's local timezone. */
function formatLocalTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Build the notification body from the structured event.
 * Formatting happens on the client so the timestamp uses the device's local timezone.
 */
function buildBodyFromEvent(event: PushPayloadEvent): string {
  if (event.kind === 'single') {
    return `${event.label} detected at ${formatLocalTime(event.timestamp)}`
  }
  return `${event.count} new events — ${event.labels} at ${formatLocalTime(event.timestamp)}`
}

/**
 * Parse the push event data into a typed payload.
 * Falls back to defaults for missing or malformed data.
 * When a structured `event` is present, the body is re-formatted on the
 * client so the timestamp renders in the device's local timezone.
 */
export function parsePushPayload(data: unknown): PushPayload {
  if (!data || typeof data !== 'object') {
    return DEFAULT_PAYLOAD
  }

  const obj = data as Record<string, unknown>
  const event = parseEvent(obj.event)
  const rawBody = typeof obj.body === 'string' ? obj.body : DEFAULT_PAYLOAD.body
  return {
    title:
      typeof obj.title === 'string' && obj.title
        ? obj.title
        : DEFAULT_PAYLOAD.title,
    body: event ? buildBodyFromEvent(event) : rawBody,
    url: typeof obj.url === 'string' && obj.url ? obj.url : DEFAULT_PAYLOAD.url,
    icon: typeof obj.icon === 'string' && obj.icon ? obj.icon : undefined,
    tag: typeof obj.tag === 'string' && obj.tag ? obj.tag : undefined,
    event,
  }
}

/**
 * Build the options object for showNotification.
 */
export function buildNotificationOptions(
  payload: PushPayload,
): NotificationOptions & { renotify: boolean } {
  return {
    body: payload.body,
    icon: payload.icon ?? '/icon-192.png',
    tag: payload.tag ?? 'camera-event',
    renotify: true,
    data: { url: payload.url },
  }
}

/**
 * Extract the click target URL from notification data.
 * Only allows relative paths starting with "/" to prevent open redirect attacks.
 */
export function getNotificationClickUrl(notificationData: unknown): string {
  if (
    notificationData &&
    typeof notificationData === 'object' &&
    'url' in notificationData &&
    typeof (notificationData as Record<string, unknown>).url === 'string'
  ) {
    const url = (notificationData as Record<string, unknown>).url as string
    if (
      url.startsWith('/') &&
      !url.startsWith('//') &&
      !url.startsWith('/\\')
    ) {
      return url
    }
  }
  return '/'
}

const PENDING_NAV_CACHE = 'camera-events-pending-nav-v1'
const PENDING_NAV_KEY = '/__pending-nav'

/**
 * Persist the target URL for the most recent notification click.
 * Stored in Cache Storage so it survives service worker termination between
 * notificationclick firing and the newly-launched window becoming ready —
 * this is the reliable path on iOS standalone PWAs, where openWindow(url)
 * ignores the URL argument and launches the app at its start_url instead.
 */
export async function setPendingNavigationUrl(
  cacheStorage: CacheStorage,
  url: string,
): Promise<void> {
  const cache = await cacheStorage.open(PENDING_NAV_CACHE)
  await cache.put(PENDING_NAV_KEY, new Response(url))
}

/**
 * Read and clear the pending navigation URL, if any.
 * Returns null when no URL is queued or when the queued value is not a safe
 * relative path (defense-in-depth against a tampered cache entry).
 */
export async function popPendingNavigationUrl(
  cacheStorage: CacheStorage,
): Promise<string | null> {
  const cache = await cacheStorage.open(PENDING_NAV_CACHE)
  const response = await cache.match(PENDING_NAV_KEY)
  if (!response) return null
  const url = await response.text()
  await cache.delete(PENDING_NAV_KEY)
  if (
    typeof url === 'string' &&
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !url.startsWith('/\\')
  ) {
    return url
  }
  return null
}
