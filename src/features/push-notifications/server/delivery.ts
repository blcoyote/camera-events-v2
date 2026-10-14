import '@tanstack/react-start/server-only'
import type { PushPayload, PushSubscriptionInfo } from './push'
import type { PushStore, PushSubscriptionRow } from './push-store'
import { isPushEnabled, sendPushNotification } from './push'
import { getPushStore } from './push-store'
import { areNotificationsMuted } from './notification-mute'

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'unknown'
  }
}

type DeliveryStore = Pick<
  PushStore,
  | 'getAllSubscribedUserIds'
  | 'isCameraEnabledForUser'
  | 'isCameraAvailabilityEnabledForUser'
> & {
  getSubscriptionsByUserId: (
    userId: string,
  ) => Array<Pick<PushSubscriptionRow, 'endpoint' | 'p256dh' | 'auth'>>
}

/** Everything Delivery touches in the outside world; production defaults wire the real modules. */
export interface DeliveryDeps {
  isPushEnabled: () => boolean
  isMuted: (now: number) => Promise<boolean>
  getStore: () => Promise<DeliveryStore>
  send: (
    subscription: PushSubscriptionInfo,
    payload: PushPayload,
  ) => Promise<void>
  now: () => number
}

export interface DeliveryRequest {
  logTag: string
  description: string
  burst?: { key: string; start: boolean }
  isUserEligible: (userId: string, store: DeliveryStore) => boolean
  buildPayload: (burstStart: boolean) => PushPayload
  allowEndpoint?: (
    endpoint: string,
    burstStart: boolean,
    now: number,
  ) => boolean
  onEndpointSkipped?: (endpoint: string) => void
}

export interface Delivery {
  deliver: (request: DeliveryRequest) => Promise<void>
}

export function createDelivery(
  overrides: Partial<DeliveryDeps> = {},
): Delivery {
  const deps: DeliveryDeps = {
    isPushEnabled,
    isMuted: areNotificationsMuted,
    getStore: getPushStore,
    send: sendPushNotification,
    now: Date.now,
    ...overrides,
  }

  /**
   * Burst keys whose Alert was swallowed by Mute. The next unmuted delivery for
   * such a key is promoted to an Alert, since the user never got one for that
   * Burst. Cleared once an unmuted delivery settles: at least one send succeeded, or none
   * was attempted. Kept if the store read throws or every attempted send fails.
   */
  const swallowed = new Set<string>()

  return {
    async deliver(request) {
      const { logTag, burst } = request
      if (!deps.isPushEnabled()) return

      const now = deps.now()
      if (await deps.isMuted(now)) {
        if (burst?.start) swallowed.add(burst.key)
        console.log(
          `[${logTag}] ${request.description} suppressed — notifications are globally muted`,
        )
        return
      }

      const burstStart = burst ? burst.start || swallowed.has(burst.key) : false

      const store = await deps.getStore()
      const payload = request.buildPayload(burstStart)
      let attempted = 0
      let succeeded = 0

      for (const userId of store.getAllSubscribedUserIds()) {
        if (!request.isUserEligible(userId, store)) continue

        const subscriptions = store.getSubscriptionsByUserId(userId)
        const hosts = subscriptions.map((sub) => hostOf(sub.endpoint))
        console.log(
          `[${logTag}] Pushing to user ${userId} on ${subscriptions.length} device(s): ${hosts.join(', ')}`,
        )
        for (const sub of subscriptions) {
          if (
            request.allowEndpoint &&
            !request.allowEndpoint(sub.endpoint, burstStart, now)
          ) {
            request.onEndpointSkipped?.(sub.endpoint)
            continue
          }
          attempted++
          try {
            await deps.send(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload,
            )
            succeeded++
          } catch (err) {
            console.error(
              `[${logTag}] Failed to send to ${sub.endpoint}:`,
              err instanceof Error ? err.message : err,
            )
          }
        }
      }

      // Settled: someone got the Alert, or nobody was there to alert. Keep the
      // flag only when every attempted send failed.
      if (burst && (attempted === 0 || succeeded > 0)) {
        swallowed.delete(burst.key)
      }
    },
  }
}
