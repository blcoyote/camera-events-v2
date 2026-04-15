import webPush from 'web-push'
import { getPushStore } from './push-store'

export interface PushPayload {
  title: string
  body: string
  url: string
  icon?: string
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
      getPushStore().removeSubscriptionByEndpoint(subscription.endpoint)
      return
    }
    throw err
  }
}
