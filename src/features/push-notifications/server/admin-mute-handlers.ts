import '@tanstack/react-start/server-only'
import { getUserStore } from '#/features/shared/server/users/user-store'
import { getActiveMuteUntil, applyNotificationMute } from './notification-mute'
import { isValidMuteDurationMs } from '#/features/shared/utils/muteDurations'

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

export async function handleSetNotificationMute(
  userId: string | null,
  body: unknown,
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

  // The body's shape is untrusted (it may be a parsed-but-non-object JSON
  // value like `null`, a string, or an array — see the route, which passes
  // through malformed JSON as `undefined` rather than pre-rejecting it).
  // Read durationMs null-safely so any of those fall through to the normal
  // 400 branch below instead of throwing.
  const durationMs =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).durationMs
      : undefined

  // Authorization is checked before input validation is even attempted, so a
  // non-admin's malformed body never reaches the allowlist check.
  if (!isValidMuteDurationMs(durationMs)) {
    return {
      status: 400,
      body: {
        error:
          'Invalid request: durationMs must be one of the supported mute durations',
      },
    }
  }

  const mutedUntil = await applyNotificationMute(durationMs)
  return {
    status: 200,
    body: { mutedUntil, durationMs },
  }
}
