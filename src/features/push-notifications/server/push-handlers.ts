import { isPushEnabled, getVapidPublicKey, sendPushNotification } from './push'
import { getPushStore } from './push-store'
import { getCameras } from '#/features/shared/server/frigate/client'

interface HandlerResult {
  status: number
  body: Record<string, unknown>
}

export function handleVapidPublicKey(): HandlerResult {
  if (!isPushEnabled()) {
    return {
      status: 503,
      body: { error: 'Push notifications are not configured' },
    }
  }
  return { status: 200, body: { publicKey: getVapidPublicKey() } }
}

export async function handleSubscribe(
  userId: string | null,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }
  if (!isPushEnabled()) {
    return {
      status: 503,
      body: { error: 'Push notifications are not configured' },
    }
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  const keys = body.keys as Record<string, string> | undefined
  const p256dh = typeof keys?.p256dh === 'string' ? keys.p256dh : ''
  const auth = typeof keys?.auth === 'string' ? keys.auth : ''

  if (!endpoint || !p256dh || !auth) {
    return {
      status: 400,
      body: { error: 'Invalid subscription: endpoint and keys are required' },
    }
  }

  // Validate endpoint is an HTTPS URL (push services always use HTTPS)
  let parsedUrl: URL
  try {
    parsedUrl = new URL(endpoint)
  } catch {
    return { status: 400, body: { error: 'Invalid subscription endpoint URL' } }
  }
  if (parsedUrl.protocol !== 'https:') {
    return {
      status: 400,
      body: { error: 'Subscription endpoint must use HTTPS' },
    }
  }

  getPushStore().saveSubscription(userId, endpoint, p256dh, auth)
  return { status: 200, body: { ok: true } }
}

export async function handleUnsubscribe(
  userId: string | null,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  if (!endpoint) {
    return {
      status: 400,
      body: { error: 'Invalid request: endpoint is required' },
    }
  }

  getPushStore().removeSubscription(userId, endpoint)
  return { status: 200, body: { ok: true } }
}

export async function handleTest(
  userId: string | null,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }
  if (!isPushEnabled()) {
    return {
      status: 503,
      body: { error: 'Push notifications are not configured' },
    }
  }

  const subscriptions = getPushStore().getSubscriptionsByUserId(userId)
  const payload = {
    title: 'Test Notification',
    body: 'Push notifications are working!',
    url: '/',
  }

  await Promise.allSettled(
    subscriptions.map((sub) =>
      sendPushNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      ),
    ),
  )

  return { status: 200, body: { sent: subscriptions.length } }
}

export async function handleGetPreferences(
  userId: string | null,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  const camerasResult = await getCameras()
  if (!camerasResult.ok) {
    return { status: 502, body: { error: 'Failed to fetch camera list' } }
  }

  const disabledSet = new Set(getPushStore().getDisabledCameras(userId))
  const cameras = camerasResult.data.map((name) => ({
    name,
    enabled: !disabledSet.has(name),
  }))

  return { status: 200, body: { cameras } }
}

export async function handleSetPreference(
  userId: string | null,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  const camera = typeof body.camera === 'string' ? body.camera : ''
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : null

  if (!camera || enabled === null) {
    return {
      status: 400,
      body: {
        error:
          'Invalid request: camera (string) and enabled (boolean) are required',
      },
    }
  }

  getPushStore().setPreference(userId, camera, enabled)
  return { status: 200, body: { ok: true } }
}
