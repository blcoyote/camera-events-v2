/**
 * Notification dispatcher — the flush callback for EventBatcher.
 *
 * For each subscribed user, filters events by per-camera preferences,
 * builds the appropriate push payload (single vs. bundled), and sends
 * notifications to all of the user's registered devices.
 */

import type { FrigateEventInfo } from './event-batcher'
import { sendPushNotification, isPushEnabled } from './push'
import type { PushPayload } from './push'
import { getPushStore } from './push-store'

/** Format a camera name for display: replace underscores, title-case words. */
export function formatCameraName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Format a label for display: capitalize first letter. */
export function formatLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Format a unix timestamp to a short HH:MM time string. */
export function formatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** Build the push payload for a single event. */
export function buildSinglePayload(event: FrigateEventInfo): PushPayload {
  const camera = formatCameraName(event.camera)
  const label = formatLabel(event.label)
  const time = formatTime(event.startTime)
  return {
    title: camera,
    body: `${label} detected at ${time}`,
    url: `/camera-events/${event.id}`,
    icon: '/logo192.png',
  }
}

/** Build the push payload for a batch of events from the same camera. */
export function buildBundledPayload(
  camera: string,
  events: FrigateEventInfo[],
): PushPayload {
  const cameraDisplay = formatCameraName(camera)
  const uniqueLabels = [...new Set(events.map((e) => formatLabel(e.label)))]
  const labelSummary =
    uniqueLabels.slice(0, 3).join(', ') +
    (uniqueLabels.length > 3 ? ` +${uniqueLabels.length - 3} more` : '')
  const latestTime = formatTime(Math.max(...events.map((e) => e.startTime)))
  return {
    title: cameraDisplay,
    body: `${events.length} new events \u2014 ${labelSummary} at ${latestTime}`,
    url: '/camera-events',
    icon: '/logo192.png',
  }
}

/**
 * Flush callback: send push notifications for a batch of events from one camera.
 *
 * Called by the EventBatcher when a camera's window expires.
 */
export async function notifyUsersForCamera(
  camera: string,
  events: FrigateEventInfo[],
): Promise<void> {
  if (!isPushEnabled() || events.length === 0) return

  const store = getPushStore()
  const userIds = store.getAllSubscribedUserIds()

  for (const userId of userIds) {
    if (!store.isCameraEnabledForUser(userId, camera)) continue

    const payload =
      events.length === 1
        ? buildSinglePayload(events[0])
        : buildBundledPayload(camera, events)

    const subscriptions = store.getSubscriptionsByUserId(userId)
    for (const sub of subscriptions) {
      try {
        await sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        )
      } catch (err) {
        console.error(
          `[push-notify] Failed to send to ${sub.endpoint}:`,
          err instanceof Error ? err.message : err,
        )
      }
    }
  }
}
