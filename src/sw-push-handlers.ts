/**
 * Pure functions for service worker push notification handling.
 * Extracted from sw.ts so they can be tested without SW globals.
 */

/**
 * Structured event data sent by the server. Mirrors `PushEventInfo` in
 * `#/features/push-notifications/server/push` — the two sides of the push
 * boundary are deliberately kept as separate declarations so service worker
 * code never imports from a server module.
 */
export interface PushPayloadEvent {
  /** Raw Frigate camera name — the merge identity. */
  camera: string
  /** Number of events in this push (not the running total). */
  count: number
  /** Unique display labels in this push, in first-seen order. */
  labels: string[]
  /** Latest event start time in this push, as unix seconds. */
  timestamp: number
  /** True when this push opens a new activity burst and should alert. */
  burstStart: boolean
}

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parseEvent(value: unknown): PushPayloadEvent | undefined {
  if (!value || typeof value !== 'object') return undefined
  const e = value as Record<string, unknown>
  if (
    typeof e.camera !== 'string' ||
    !e.camera ||
    typeof e.count !== 'number' ||
    typeof e.timestamp !== 'number' ||
    !isStringArray(e.labels) ||
    e.labels.length === 0
  ) {
    return undefined
  }
  return {
    camera: e.camera,
    count: e.count,
    labels: e.labels,
    timestamp: e.timestamp,
    // An absent flag must not silently downgrade an alert into a quiet patch.
    burstStart: e.burstStart !== false,
  }
}

/** Format a unix timestamp to a short HH:MM time string in the device's local timezone. */
function formatLocalTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** Condense a label list to at most three names plus a "+N more" suffix. */
function summarizeLabels(labels: string[]): string {
  return (
    labels.slice(0, 3).join(', ') +
    (labels.length > 3 ? ` +${labels.length - 3} more` : '')
  )
}

/**
 * Build the notification body from a count and label set.
 * Formatting happens on the client so the timestamp uses the device's local
 * timezone and the count can reflect a running total across merged pushes.
 */
export function buildNotificationBody(
  count: number,
  labels: string[],
  timestamp: number,
): string {
  const time = formatLocalTime(timestamp)
  if (count === 1) {
    return `${labels[0]} detected at ${time}`
  }
  return `${count} new events — ${summarizeLabels(labels)} at ${time}`
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
    body: event
      ? buildNotificationBody(event.count, event.labels, event.timestamp)
      : rawBody,
    url: typeof obj.url === 'string' && obj.url ? obj.url : DEFAULT_PAYLOAD.url,
    icon: typeof obj.icon === 'string' && obj.icon ? obj.icon : undefined,
    tag: typeof obj.tag === 'string' && obj.tag ? obj.tag : undefined,
    event,
  }
}

/** Tag used when a payload carries none (e.g. the settings page test push). */
const FALLBACK_TAG = 'camera-event'

/**
 * Running totals for a camera, stashed on the notification's `data` so the
 * next push can accumulate onto whatever is currently on screen. When the user
 * opens or dismisses the notification the browser discards it — and this state
 * with it — which is exactly how the SW learns the burst was acknowledged.
 */
export interface NotificationState {
  camera: string
  count: number
  labels: string[]
  timestamp: number
  url: string
}

/** What to render for one push, plus the state to carry into the next. */
export interface NotificationPlan {
  title: string
  body: string
  url: string
  icon?: string
  tag: string
  /** True when the notification should be patched without re-alerting. */
  silent: boolean
  state: NotificationState | null
}

/**
 * Read the accumulated state off an existing notification's `data`.
 * Returns null when absent or malformed, which the caller treats as
 * "nothing on screen to merge with".
 */
export function readNotificationState(data: unknown): NotificationState | null {
  if (!data || typeof data !== 'object') return null
  const raw = (data as Record<string, unknown>).state
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (
    typeof s.camera !== 'string' ||
    !s.camera ||
    typeof s.count !== 'number' ||
    typeof s.timestamp !== 'number' ||
    typeof s.url !== 'string' ||
    !isStringArray(s.labels)
  ) {
    return null
  }
  return {
    camera: s.camera,
    count: s.count,
    labels: s.labels,
    timestamp: s.timestamp,
    url: s.url,
  }
}

/** Minimal shape of the bits of ServiceWorkerRegistration we need. */
interface NotificationRegistration {
  getNotifications?: (filter: {
    tag: string
  }) => Promise<Array<{ data: unknown }>>
}

/**
 * Find the accumulated state of a notification still on screen for `tag`.
 *
 * Returns null when nothing is displayed — which means the user opened or
 * dismissed it — and also when the browser has no `getNotifications` at all
 * (older Safari). Degrading to null is safe: the push is then treated as a
 * fresh alert rather than a silent patch.
 */
export async function readExistingState(
  registration: NotificationRegistration,
  tag: string,
): Promise<NotificationState | null> {
  try {
    const displayed = await registration.getNotifications?.({ tag })
    if (!displayed) return null
    for (const notification of displayed) {
      const state = readNotificationState(notification.data)
      if (state) return state
    }
    return null
  } catch {
    return null
  }
}

/**
 * Decide how to render an incoming push.
 *
 * A burst start always alerts and starts a fresh count. A continuation merges
 * into the notification still on screen and patches it silently; if nothing is
 * on screen the user has already opened or dismissed the burst, so it alerts
 * again with a fresh count.
 */
export function planNotification(
  payload: PushPayload,
  existing: NotificationState | null,
): NotificationPlan {
  const tag = payload.tag ?? FALLBACK_TAG
  const base = { title: payload.title, icon: payload.icon, tag }

  const event = payload.event
  if (!event) {
    return {
      ...base,
      body: payload.body,
      url: payload.url,
      silent: false,
      state: null,
    }
  }

  const mergeable =
    !event.burstStart && existing !== null && existing.camera === event.camera

  if (!mergeable) {
    return {
      ...base,
      body: payload.body,
      url: payload.url,
      silent: false,
      state: {
        camera: event.camera,
        count: event.count,
        labels: event.labels,
        timestamp: event.timestamp,
        url: payload.url,
      },
    }
  }

  const count = existing.count + event.count
  const labels = [...new Set([...existing.labels, ...event.labels])]
  const timestamp = Math.max(existing.timestamp, event.timestamp)
  // A merged notification covers more than one event, so the single-event deep
  // link no longer represents it — send the user to the list instead.
  const url = '/camera-events'

  return {
    ...base,
    body: buildNotificationBody(count, labels, timestamp),
    url,
    silent: true,
    state: { camera: event.camera, count, labels, timestamp, url },
  }
}

/**
 * Build the options object for showNotification.
 *
 * `renotify` is the inverse of `silent`: a patched notification replaces the
 * one on screen without re-alerting. iOS Safari honours neither flag — there
 * the tag still collapses the entry, and update pushes are paced server-side.
 */
export function buildNotificationOptions(
  plan: NotificationPlan,
): NotificationOptions & { renotify: boolean } {
  return {
    body: plan.body,
    icon: plan.icon ?? '/icon-192.png',
    tag: plan.tag,
    renotify: !plan.silent,
    silent: plan.silent,
    data: { url: plan.url, state: plan.state },
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
