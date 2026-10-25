import '@tanstack/react-start/server-only'
import { getEvent } from '#/features/shared/server/frigate/client'
import { isValidEventId } from '#/features/shared/server/frigate/validation'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import type { FrigateResult } from '#/features/shared/server/frigate/config'

/** Number of polling rounds before giving up. */
export const VERIFY_ATTEMPTS = 8
/** Delay between polling rounds. */
export const VERIFY_INTERVAL_MS = 2_000

export interface VerifyOptions {
  /** Polling rounds (default {@link VERIFY_ATTEMPTS}). */
  attempts?: number
  /** Delay between rounds in ms (default {@link VERIFY_INTERVAL_MS}). */
  intervalMs?: number
  /** Event lookup (default Frigate `getEvent`). */
  fetchEvent?: (id: string) => Promise<FrigateResult<FrigateEvent>>
  /** Delay implementation (default `setTimeout`-based). */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const defaultFetchEvent = (id: string): Promise<FrigateResult<FrigateEvent>> =>
  getEvent(id)

/**
 * Wait until Frigate has persisted one of `eventIds`, returning the first
 * persisted event (in the given order), or null if none appears within
 * `attempts` rounds.
 *
 * Ids failing `isValidEventId` are never fetched. Lookup failures (404,
 * network errors, thrown exceptions) just mean "not yet".
 */
export async function waitForPersistedEvent(
  eventIds: string[],
  options: VerifyOptions = {},
): Promise<FrigateEvent | null> {
  const {
    attempts = VERIFY_ATTEMPTS,
    intervalMs = VERIFY_INTERVAL_MS,
    fetchEvent = defaultFetchEvent,
    sleep = defaultSleep,
  } = options

  const ids = eventIds.filter(isValidEventId)
  if (ids.length === 0) return null

  for (let round = 0; round < attempts; round++) {
    if (round > 0) await sleep(intervalMs)
    for (const id of ids) {
      const event = await lookup(fetchEvent, id)
      if (event) return event
    }
  }
  return null
}

async function lookup(
  fetchEvent: (id: string) => Promise<FrigateResult<FrigateEvent>>,
  id: string,
): Promise<FrigateEvent | null> {
  try {
    const result = await fetchEvent(id)
    return result.ok && result.data.id === id ? result.data : null
  } catch {
    return null
  }
}
