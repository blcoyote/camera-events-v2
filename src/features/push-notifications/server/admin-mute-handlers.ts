import '@tanstack/react-start/server-only'
import { getUserStore } from '#/features/shared/server/users/user-store'
import {
  NOTIFICATION_MUTE_DURATION_MS,
  getActiveMuteUntil,
  muteAllNotifications,
} from './notification-mute'

interface HandlerResult {
  status: number
  body: Record<string, unknown>
}

export async function handleGetNotificationMute(
  userId: string | null,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  // Admin status is deliberately not carried in the session cookie, so it is
  // re-read from the store on every call rather than trusted from a claim.
  // Check authentication before authorization, as the POST handler does: a
  // signed-in non-admin gets 403, never a 200 that leaks the mute state.
  const isAdmin = (await getUserStore()).isAdmin(userId)
  if (!isAdmin) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const mutedUntil = await getActiveMuteUntil()

  return { status: 200, body: { isAdmin: true, mutedUntil } }
}

export async function handleMuteAllNotifications(
  userId: string | null,
): Promise<HandlerResult> {
  // Check authentication before authorization: an anonymous caller must get
  // 401, and a signed-in non-admin must get 403 — never leak one as the other.
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  // Route-level guards do not protect this endpoint (it is directly callable
  // over HTTP), so the admin check is re-read from the store here too.
  const isAdmin = (await getUserStore()).isAdmin(userId)
  if (!isAdmin) {
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const mutedUntil = await muteAllNotifications()
  return {
    status: 200,
    body: { mutedUntil, durationMs: NOTIFICATION_MUTE_DURATION_MS },
  }
}
