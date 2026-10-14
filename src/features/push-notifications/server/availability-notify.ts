/**
 * Availability policy over Delivery for camera online/offline changes.
 *
 * Unlike `notifyUsersForCamera` (motion events), availability changes are rare,
 * important, state-change events rather than a rapid stream — so there is
 * intentionally no Burst, pacing, or batching here. Every enabled, subscribed
 * device gets every transition; Mute, fan-out and send-error handling are
 * Delivery's job.
 */

import '@tanstack/react-start/server-only'
import type { PushPayload } from './push'
import { formatCameraName } from './push-notify'
import { createDelivery } from './delivery'
import type { Delivery } from './delivery'

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

const defaultDelivery = createDelivery()

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
  options: { delivery?: Delivery } = {},
): Promise<void> {
  await (options.delivery ?? defaultDelivery).deliver({
    logTag: 'availability-notify',
    description: `Camera "${camera}" ${status}`,
    isUserEligible: (userId, store) =>
      store.isCameraAvailabilityEnabledForUser(userId),
    buildPayload: () => buildAvailabilityPayload(camera, status),
  })
}
