/**
 * Frigate event IDs are `<start_time>-<random>`, where `start_time` is the
 * tracked object's start as epoch seconds. That makes an event's age readable
 * straight off the ID, with no call to Frigate — which is what lets the detail
 * page tell "Frigate hasn't saved this yet" from "this is long gone".
 */

/**
 * Epoch milliseconds encoded in a Frigate event ID, or null when the ID does
 * not carry a usable start time.
 */
export function parseEventStartTimeMs(id: string): number | null {
  const separator = id.indexOf('-', 1)
  if (separator <= 0 || separator === id.length - 1) return null

  const seconds = Number(id.slice(0, separator))
  if (!Number.isFinite(seconds) || seconds <= 0) return null

  return seconds * 1000
}
