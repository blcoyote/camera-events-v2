import '@tanstack/react-start/server-only'
import webPush from 'web-push'
import { getPushStore } from './push-store'

/**
 * Structured event data the service worker merges on.
 *
 * The SW re-derives the notification body from these fields so timestamps
 * render in the device's timezone, and accumulates `count`/`labels` across
 * pushes to patch a notification that is still on screen.
 */
export interface PushEventInfo {
  /** Raw Frigate camera name — the merge identity. */
  camera: string
  /** Number of events in this push (not the running total). */
  count: number
  /** Unique display labels in this push, in first-seen order. */
  labels: string[]
  /** Latest event start time in this push, as unix seconds. */
  timestamp: number
  /**
   * True when this push opens a new activity burst. Burst starts alert the
   * user and reset the accumulated count; continuations patch the existing
   * notification silently.
   */
  burstStart: boolean
}

export interface PushPayload {
  title: string
  body: string
  url: string
  icon?: string
  /** Groups notifications so a camera's follow-ups replace rather than stack. */
  tag?: string
  event?: PushEventInfo
}

export interface PushSubscriptionInfo {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT

const _pushEnabled = !!(vapidPublicKey && vapidPrivateKey && vapidSubject)

if (_pushEnabled && vapidSubject && vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
} else {
  console.warn(
    '[push] VAPID keys not configured — push notifications are disabled.\n' +
      '  To enable, set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in your .env file.\n' +
      '  Generate keys with: npx web-push generate-vapid-keys',
  )
}

export function isPushEnabled(): boolean {
  return _pushEnabled
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey ?? null
}

export async function sendPushNotification(
  subscription: PushSubscriptionInfo,
  payload: PushPayload,
): Promise<void> {
  if (!_pushEnabled) {
    throw new Error('Push notifications are not configured')
  }

  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired or invalid — clean up
      const store = await getPushStore()
      store.removeSubscriptionByEndpoint(subscription.endpoint)
      return
    }
    throw err
  }
}
