/**
 * Notification dispatcher for camera online/offline availability changes.
 *
 * Unlike `notifyUsersForCamera` (motion events), availability changes are rare,
 * important, state-change events rather than a rapid stream — so there is no
 * batching, throttling, or Apple-specific pacing here. Every enabled,
 * subscribed device gets every transition.
 */

import '@tanstack/react-start/server-only'
import { sendPushNotification, isPushEnabled } from './push'
import type { PushPayload } from './push'
import { getPushStore } from './push-store'
import { formatCameraName } from './push-notify'

export type CameraAvailabilityStatus = 'online' | 'offline'

/**
 * Notification tag for a camera's availability alert — distinct from the
 * motion-event tag (`camera-<name>`) so an offline alert and a motion alert
 * for the same camera never clobber each other.
 */
export function cameraAvailabilityNotificationTag(camera: string): string {
  return `camera-availability-${camera}`
}

/** Build the push payload for a camera's online/offline status change. */
export function buildAvailabilityPayload(
  camera: string,
  status: CameraAvailabilityStatus,
): PushPayload {
  const body =
    status === 'offline'
      ? 'Camera went offline — no frames received'
      : 'Camera is back online'

  return {
    title: formatCameraName(camera),
    body,
    url: '/cameras',
    icon: '/icon-192.png',
    tag: cameraAvailabilityNotificationTag(camera),
  }
}

/**
 * Send a push notification for one camera's availability change to every
 * device of every user who has opted into camera availability alerts.
 *
 * This preference is global and opt-in (default off), unrelated to the
 * per-camera motion-event opt-out preference.
 */
export async function notifyUsersForCameraAvailability(
  camera: string,
  status: CameraAvailabilityStatus,
): Promise<void> {
  if (!isPushEnabled()) return

  const store = await getPushStore()
  const userIds = store.getAllSubscribedUserIds()
  const payload = buildAvailabilityPayload(camera, status)

  for (const userId of userIds) {
    if (!store.isCameraAvailabilityEnabledForUser(userId)) {
      continue
    }

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
          `[availability-notify] Failed to send to ${sub.endpoint}:`,
          err instanceof Error ? err.message : err,
        )
      }
    }
  }
}
