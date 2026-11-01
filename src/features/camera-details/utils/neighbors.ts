import type { FrigateEvent } from '#/features/shared/server/frigate/types'

export interface EventRef {
  id: string
  label: string
  start_time: number
}

const toRef = (e: FrigateEvent): EventRef => ({
  id: e.id,
  label: e.label,
  start_time: e.start_time,
})

export function pickNeighbors(
  eventId: string,
  newer: FrigateEvent[],
  older: FrigateEvent[],
): { previous: EventRef | null; next: EventRef | null } {
  const next = newer
    .filter((e) => e.id !== eventId)
    .reduce<FrigateEvent | null>(
      (a, e) => (!a || e.start_time < a.start_time ? e : a),
      null,
    )
  const previous = older
    .filter((e) => e.id !== eventId)
    .reduce<FrigateEvent | null>(
      (a, e) => (!a || e.start_time > a.start_time ? e : a),
      null,
    )
  return {
    previous: previous && toRef(previous),
    next: next && toRef(next),
  }
}
