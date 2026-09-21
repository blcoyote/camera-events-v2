import '@tanstack/react-start/server-only'
import { isPushEnabled, getVapidPublicKey, sendPushNotification } from './push'
import { getPushStore } from './push-store'
import { getCameras } from '#/features/shared/server/frigate/client'
import { readBodyField } from './request-body'

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
  body: unknown,
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

  // The body's shape is untrusted (it may be a parsed-but-non-object JSON
  // value like `null`, a string, or an array — see the route, which passes
  // through malformed JSON as `undefined` rather than pre-rejecting it).
  // Read fields null-safely so any of those fall through to the normal 400
  // branch below instead of throwing. `keys` is itself untrusted once read,
  // so it goes through the same helper rather than being cast and indexed.
  const endpointField = readBodyField(body, 'endpoint')
  const endpoint = typeof endpointField === 'string' ? endpointField : ''
  const keys = readBodyField(body, 'keys')
  const p256dhField = readBodyField(keys, 'p256dh')
  const authField = readBodyField(keys, 'auth')
  const p256dh = typeof p256dhField === 'string' ? p256dhField : ''
  const auth = typeof authField === 'string' ? authField : ''

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

  ;(await getPushStore()).saveSubscription(userId, endpoint, p256dh, auth)
  return { status: 200, body: { ok: true } }
}

export async function handleUnsubscribe(
  userId: string | null,
  body: unknown,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  // See handleSubscribe: the body may be a non-object JSON value, so read
  // fields null-safely rather than indexing directly.
  const endpointField = readBodyField(body, 'endpoint')
  const endpoint = typeof endpointField === 'string' ? endpointField : ''
  if (!endpoint) {
    return {
      status: 400,
      body: { error: 'Invalid request: endpoint is required' },
    }
  }

  ;(await getPushStore()).removeSubscription(userId, endpoint)
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

  const subscriptions = (await getPushStore()).getSubscriptionsByUserId(userId)
  const payload = {
    title: 'Test Notification',
    body: 'Push notifications are working!',
    url: '/',
    // Its own tag, so a test push never replaces a live camera notification.
    tag: 'push-test',
  }

  const results = await Promise.allSettled(
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

  const sent = results.filter((r) => r.status === 'fulfilled').length
  return { status: 200, body: { sent } }
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

  const disabledSet = new Set((await getPushStore()).getDisabledCameras(userId))
  const cameras = camerasResult.data.map((name) => ({
    name,
    enabled: !disabledSet.has(name),
  }))

  return { status: 200, body: { cameras } }
}

export async function handleSetPreference(
  userId: string | null,
  body: unknown,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  // See handleSubscribe: the body may be a non-object JSON value, so read
  // fields null-safely rather than indexing directly.
  const cameraField = readBodyField(body, 'camera')
  const enabledField = readBodyField(body, 'enabled')
  const camera = typeof cameraField === 'string' ? cameraField : ''
  const enabled = typeof enabledField === 'boolean' ? enabledField : null

  if (!camera || enabled === null) {
    return {
      status: 400,
      body: {
        error:
          'Invalid request: camera (string) and enabled (boolean) are required',
      },
    }
  }

  const { isValidCameraName } =
    await import('#/features/shared/server/frigate/validation')
  if (!isValidCameraName(camera)) {
    return { status: 400, body: { error: 'Invalid camera name' } }
  }

  ;(await getPushStore()).setPreference(userId, camera, enabled)
  return { status: 200, body: { ok: true } }
}

export async function handleGetAvailabilityPreference(
  userId: string | null,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }
  const enabled = (await getPushStore()).isCameraAvailabilityEnabledForUser(
    userId,
  )
  return { status: 200, body: { enabled } }
}

export async function handleSetAvailabilityPreference(
  userId: string | null,
  body: unknown,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  // See handleSubscribe: the body may be a non-object JSON value, so read
  // fields null-safely rather than indexing directly.
  const enabledField = readBodyField(body, 'enabled')
  const enabled = typeof enabledField === 'boolean' ? enabledField : null
  if (enabled === null) {
    return {
      status: 400,
      body: { error: 'Invalid request: enabled (boolean) is required' },
    }
  }

  ;(await getPushStore()).setCameraAvailabilityPreference(userId, enabled)
  return { status: 200, body: { ok: true } }
}
