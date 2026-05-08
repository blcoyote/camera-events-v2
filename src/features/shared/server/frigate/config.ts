/**
 * Result type for all Frigate API client functions.
 * Consuming code pattern-matches on `ok` to handle success/failure.
 */
export type FrigateResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000

/** Minimal Frigate client interface for retain/unretain operations. Defined here
 *  so consumers can depend on the abstraction rather than the concrete client. */
export interface FrigateRetainClient {
  retainEvent: (eventId: string) => Promise<FrigateResult<void>>
  unretainEvent: (eventId: string) => Promise<FrigateResult<void>>
}

/** Minimal Frigate client interface for fetching a single event by ID. */
export interface FrigateEventClient {
  getEvent: (
    eventId: string,
  ) => Promise<FrigateResult<import('./types').FrigateEvent>>
}

/**
 * Read and validate the FRIGATE_URL environment variable.
 * Throws a descriptive error if unset or empty.
 * Strips whitespace and trailing slashes.
 */
export function getFrigateUrl(): string {
  const raw = process.env.FRIGATE_URL
  if (!raw || !raw.trim()) {
    throw new Error(
      'FRIGATE_URL environment variable is required (e.g., http://192.168.1.100:5000)',
    )
  }
  return raw.trim().replace(/\/+$/, '')
}
