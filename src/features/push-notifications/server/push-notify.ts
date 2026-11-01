/**
 * Notification dispatcher — the flush callback for EventBatcher.
 *
 * For each subscribed user, filters events by per-camera preferences, builds a
 * per-camera push payload, and sends it to the user's registered devices. The
 * flush meta decides whether a push alerts (a new activity burst) or silently
 * patches the notification already on screen (a continuation); continuations to
 * Apple endpoints are additionally paced, since iOS re-alerts on every update.
 */

import '@tanstack/react-start/server-only'
import type { DetectionInfo, FlushMeta } from './event-batcher'
import type { PushPayload } from './push'
import { createDelivery } from './delivery'
import type { Delivery } from './delivery'
import { SendThrottle, isAppleEndpoint } from './send-throttle'
import { resolveAppleUpdateIntervalMs } from './env'
import type { PushLocale } from './push-locale'
import { m } from '#/paraglide/messages.js'
import { translateLabel } from '#/features/shared/utils/labels'
import { formatTime } from '#/features/shared/utils/intl'

/** Extract the host of a push endpoint for logging, or 'unknown' if unparseable. */
export function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'unknown'
  }
}

/** Format a camera name for display: replace underscores, title-case words. */
export function formatCameraName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Condense a label list to at most three names plus a "+N more" suffix. */
function summarizeLabels(labels: string[], locale: PushLocale): string {
  const head = labels.slice(0, 3).join(', ')
  return labels.length > 3
    ? m.push_labels_more({ labels: head, more: labels.length - 3 }, { locale })
    : head
}

/**
 * Notification tag for a camera. Per-camera rather than global so cameras
 * alert independently, and so a camera's follow-up pushes replace its own
 * notification instead of stacking or clobbering another camera's.
 */
export function cameraNotificationTag(camera: string): string {
  return `camera-${camera}`
}

/**
 * Whether an event can be deep-linked to its detail page.
 *
 * Frigate writes an event row only once the tracked object has a clip or a
 * snapshot (`should_update_db` in `frigate/events/maintainer.py`), and the
 * `"new"` MQTT message is published *before* that — sometimes long before,
 * and for objects that never move, never enter a required zone, or end as a
 * false positive, never at all. Deep-linking to one of those yields a 404
 * “event doesn't exist” page, so those pushes point at the events list instead.
 */
export function isDeepLinkable(event: DetectionInfo): boolean {
  return event.hasSnapshot || event.hasClip
}

/**
 * Build the push payload for one flush of a camera's events.
 *
 * `body` is a server-rendered fallback for service workers that predate
 * client-side merging; current ones re-derive it from `event` so the count
 * reflects the running total and the time uses the device's timezone.
 */
export function buildCameraPayload(
  camera: string,
  events: DetectionInfo[],
  burstStart: boolean,
  locale: PushLocale,
): PushPayload {
  const labels = [
    ...new Set(events.map((e) => translateLabel(e.label, locale))),
  ]
  const timestamp = Math.max(...events.map((e) => e.startTime))
  const time = formatTime(timestamp, locale)
  const body =
    events.length === 1
      ? m.push_event_single({ label: labels[0], time }, { locale })
      : m.push_event_multi(
          {
            count: events.length,
            labels: summarizeLabels(labels, locale),
            time,
          },
          { locale },
        )

  return {
    title: formatCameraName(camera),
    body,
    locale,
    url:
      events.length === 1 && isDeepLinkable(events[0])
        ? `/camera-events/${events[0].id}`
        : '/camera-events',
    icon: '/icon-192.png',
    tag: cameraNotificationTag(camera),
    event: { camera, count: events.length, labels, timestamp, burstStart },
  }
}

/**
 * Process-wide pacing state for update pushes to Apple endpoints.
 * Tests inject their own instance via `options.throttle`.
 */
const appleUpdateThrottle = new SendThrottle(
  resolveAppleUpdateIntervalMs(process.env),
)

const defaultDelivery = createDelivery()

export interface NotifyOptions {
  /** Override the shared Apple update throttle (tests). */
  throttle?: SendThrottle
  /** Override the clock, in epoch milliseconds (tests). */
  now?: number
  /** Override the Delivery (tests). */
  delivery?: Delivery
}

/**
 * Decide whether one push should go out to one device.
 *
 * Burst starts always send — they are the alert the user is waiting for — and
 * are recorded so the first follow-up waits a full interval. Updates send
 * freely to browsers that honour `silent: true`; for Apple endpoints, where an
 * update still alerts, they are paced by the throttle.
 */
function shouldSendToEndpoint(
  endpoint: string,
  camera: string,
  burstStart: boolean,
  throttle: SendThrottle,
  now: number,
): boolean {
  const key = `${camera}|${endpoint}`
  if (burstStart) {
    throttle.record(key, now)
    return true
  }
  if (!isAppleEndpoint(endpoint)) return true
  return throttle.tryAcquire(key, now)
}

/**
 * Flush callback: send push notifications for a batch of events from one camera.
 *
 * Called by the EventBatcher on each flush. `meta.burstStart` distinguishes the
 * alert that opens an activity burst from the follow-ups that silently patch it.
 */
export async function notifyUsersForCamera(
  camera: string,
  events: DetectionInfo[],
  meta: FlushMeta,
  options: NotifyOptions = {},
): Promise<void> {
  if (events.length === 0) return

  const throttle = options.throttle ?? appleUpdateThrottle

  await (options.delivery ?? defaultDelivery).deliver({
    logTag: 'push-notify',
    description: `Camera "${camera}": ${events.length} event(s)`,
    burst: { key: camera, start: meta.burstStart },
    isUserEligible: (userId, store) => {
      if (store.isCameraEnabledForUser(userId, camera)) return true
      console.log(
        `[push-notify] User ${userId} has camera "${camera}" disabled — skipping`,
      )
      return false
    },
    buildPayload: (burstStart, locale) =>
      buildCameraPayload(camera, events, burstStart, locale),
    allowEndpoint: (endpoint, burstStart, deliveryNow) =>
      shouldSendToEndpoint(
        endpoint,
        camera,
        burstStart,
        throttle,
        options.now ?? deliveryNow,
      ),
    onEndpointSkipped: (endpoint) =>
      console.log(
        `[push-notify] Throttled update to ${endpointHost(endpoint)} for camera "${camera}" — Apple endpoints are paced to avoid re-alerting`,
      ),
  })
}
