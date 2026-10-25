import '@tanstack/react-start/server-only'
import { getEvent } from '#/features/shared/server/frigate/client'
import { isValidEventId } from '#/features/shared/server/frigate/validation'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import type { FrigateResult } from '#/features/shared/server/frigate/config'

/** Maximum number of polling rounds. */
export const VERIFY_ATTEMPTS = 8
/** Delay between polling rounds. */
export const VERIFY_INTERVAL_MS = 2_000
/** Overall elapsed-time budget for one verification, in ms. */
export const VERIFY_BUDGET_MS = 15_000
/** Upper bound for a single event lookup, in ms. */
export const VERIFY_LOOKUP_TIMEOUT_MS = 3_000

type EventFetcher = (
  id: string,
  timeoutMs: number,
) => Promise<FrigateResult<FrigateEvent>>

export interface VerifyOptions {
  /** Maximum polling rounds (default {@link VERIFY_ATTEMPTS}). */
  attempts?: number
  /** Delay between rounds in ms (default {@link VERIFY_INTERVAL_MS}). */
  intervalMs?: number
  /** Overall time budget in ms (default {@link VERIFY_BUDGET_MS}). */
  budgetMs?: number
  /** Clock in ms (default `Date.now`). */
  now?: () => number
  /** Event lookup (default Frigate `getEvent`). */
  fetchEvent?: EventFetcher
  /** Delay implementation (default `setTimeout`-based). */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const defaultFetchEvent: EventFetcher = (id, timeoutMs) =>
  getEvent(id, timeoutMs)

/**
 * Wait until Frigate has persisted one of the event ids, returning the first
 * persisted event (in the given order), or null if none appears.
 *
 * `eventIds` may be a function, called at the start of every round so ids
 * added while polling (e.g. by MQTT updates) are picked up. A static array
 * that is empty or has no valid ids returns null immediately; a function
 * yielding no ids in a round simply means nothing to check that round.
 *
 * Polling stops after `attempts` rounds or once `budgetMs` has elapsed,
 * whichever comes first. Each lookup's timeout is
 * `min(VERIFY_LOOKUP_TIMEOUT_MS, remaining budget)` and each sleep is
 * truncated to the remaining budget, so the worst case is bounded by
 * `budgetMs` (an in-flight lookup cannot outlive the deadline).
 *
 * Ids failing `isValidEventId` are never fetched. Lookup failures (404,
 * network errors, thrown exceptions) just mean "not yet".
 */
export async function waitForPersistedEvent(
  eventIds: string[] | (() => string[]),
  options: VerifyOptions = {},
): Promise<FrigateEvent | null> {
  const {
    attempts = VERIFY_ATTEMPTS,
    intervalMs = VERIFY_INTERVAL_MS,
    budgetMs = VERIFY_BUDGET_MS,
    now = Date.now,
    fetchEvent = defaultFetchEvent,
    sleep = defaultSleep,
  } = options

  const readIds = typeof eventIds === 'function' ? eventIds : () => eventIds
  if (typeof eventIds !== 'function' && !eventIds.some(isValidEventId)) {
    return null
  }

  const deadline = now() + budgetMs

  for (let round = 0; round < attempts; round++) {
    if (round > 0) {
      if (now() >= deadline) return null
      await sleep(Math.min(intervalMs, deadline - now()))
    }
    for (const id of readIds().filter(isValidEventId)) {
      if (now() >= deadline) return null
      const timeoutMs = Math.min(VERIFY_LOOKUP_TIMEOUT_MS, deadline - now())
      const event = await lookup(fetchEvent, id, timeoutMs)
      if (event) return event
    }
  }
  return null
}

async function lookup(
  fetchEvent: EventFetcher,
  id: string,
  timeoutMs: number,
): Promise<FrigateEvent | null> {
  try {
    const result = await fetchEvent(id, timeoutMs)
    return result.ok && result.data.id === id ? result.data : null
  } catch {
    return null
  }
}
