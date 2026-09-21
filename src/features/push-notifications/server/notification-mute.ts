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
import { MAX_MUTE_DURATION_MS } from '#/features/shared/utils/muteDurations'

/**
 * Pure: is a stored deadline still in the future at `nowMs`?
 *
 * The upper bound (`nowMs + MAX_MUTE_DURATION_MS`) is what actually delivers
 * the "a corrupt value can never wedge the app into permanent silence"
 * guarantee: a corrupt row can silence the app for at most one maximum
 * window (6 hours), so anything beyond that ceiling is treated as inactive
 * rather than as an active mute. One side effect is a deliberate fail-open
 * choice: a backwards server-clock jump can make a real, in-window deadline
 * read as "too far in the future" and end the mute early — that is accepted,
 * since erring toward delivering notifications is always the safe direction
 * here.
 */
export function isMuteActive(
  muteUntilMs: number | null,
  nowMs: number,
): boolean {
  if (muteUntilMs === null) return false
  return muteUntilMs > nowMs && muteUntilMs <= nowMs + MAX_MUTE_DURATION_MS
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
 * Apply an admin mute. `durationMs` of 0 clears any active mute and resumes
 * notifications immediately. Returns the new deadline, or null when cleared.
 *
 * Does not fail open — a failed write must surface to the caller so the
 * admin knows it did not take effect.
 *
 * `durationMs` is not validated here — the caller (the mute handler) is
 * expected to have already checked it against the shared allowlist in
 * `#/features/shared/utils/muteDurations`.
 */
export async function applyNotificationMute(
  durationMs: number,
  nowMs: number = Date.now(),
): Promise<number | null> {
  const store = await getPushStore()

  if (durationMs === 0) {
    // Writing 0 is how a mute is cleared: `parseMuteUntil('0')` reads back as
    // 0, and `isMuteActive(0, now)` is false because `0 > now` fails — so a
    // stored 0 is indistinguishable from "no mute" on the read path.
    store.setNotificationMuteUntil(0)
    return null
  }

  const until = nowMs + durationMs
  store.setNotificationMuteUntil(until)
  return until
}
