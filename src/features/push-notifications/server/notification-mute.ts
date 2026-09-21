import '@tanstack/react-start/server-only'

/**
 * Global admin "mute all notifications" switch.
 *
 * The deadline itself is stored and read via `push-store.ts`
 * (`getNotificationMuteUntil` / `setNotificationMuteUntil`); this module owns
 * the expiry semantics and exposes the read/write API the rest of the push
 * pipeline uses.
 */

import { getPushStore } from './push-store'

/** How long one admin mute lasts. */
export const NOTIFICATION_MUTE_DURATION_MS = 10 * 60 * 1000

/**
 * Pure: is a stored deadline still in the future at `nowMs`?
 *
 * The upper bound (`nowMs + NOTIFICATION_MUTE_DURATION_MS`) is what actually
 * delivers the "a corrupt value can never wedge the app into permanent
 * silence" guarantee: no legitimate deadline is ever further out than one
 * mute window from now, so anything beyond that ceiling is treated as
 * inactive rather than as an active mute. One side effect is a deliberate
 * fail-open choice: a backwards server-clock jump can make a real, in-window
 * deadline read as "too far in the future" and end the mute early — that is
 * accepted, since erring toward delivering notifications is always the safe
 * direction here.
 */
export function isMuteActive(
  muteUntilMs: number | null,
  nowMs: number,
): boolean {
  if (muteUntilMs === null) return false
  return (
    muteUntilMs > nowMs && muteUntilMs <= nowMs + NOTIFICATION_MUTE_DURATION_MS
  )
}

/**
 * The active mute deadline, or null when nothing is muted right now.
 *
 * Fails open: a broken store reads as "not muted" rather than silencing
 * alerts, since a lapsed or unreadable mute must never block delivery.
 */
export async function getActiveMuteUntil(
  nowMs: number = Date.now(),
): Promise<number | null> {
  try {
    const store = await getPushStore()
    const muteUntil = store.getNotificationMuteUntil()
    return isMuteActive(muteUntil, nowMs) ? muteUntil : null
  } catch (err) {
    console.error(
      '[notification-mute] Failed to read mute state — treating as not muted:',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

/** Are automatic push notifications currently suppressed for everyone? */
export async function areNotificationsMuted(
  nowMs: number = Date.now(),
): Promise<boolean> {
  return (await getActiveMuteUntil(nowMs)) !== null
}

/**
 * Start (or restart) a mute window. Returns the new deadline in epoch ms.
 *
 * Unlike the read path, this does not fail open — a failed mute must surface
 * to the caller so the admin knows it did not take effect.
 */
export async function muteAllNotifications(
  nowMs: number = Date.now(),
): Promise<number> {
  const until = nowMs + NOTIFICATION_MUTE_DURATION_MS
  const store = await getPushStore()
  store.setNotificationMuteUntil(until)
  return until
}
