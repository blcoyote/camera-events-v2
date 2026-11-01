import { createServerFn } from '@tanstack/react-start'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type {
  FrigateEvent,
  GetEventsParams,
} from '#/features/shared/server/frigate/types'
import {
  isValidCameraName,
  isValidEventId,
} from '#/features/shared/server/frigate/validation'
import { pickNeighbors } from '../utils/neighbors'
import type { EventRef } from '../utils/neighbors'

export interface NeighborsInput {
  eventId: string
  camera: string
  startTime: number
}
export interface Neighbors {
  previous: EventRef | null
  next: EventRef | null
}
type GetEvents = (
  params?: GetEventsParams,
) => Promise<FrigateResult<FrigateEvent[]>>

export async function loadCameraNeighbors(
  { eventId, camera, startTime }: NeighborsInput,
  getEvents: GetEvents,
): Promise<Neighbors> {
  if (
    !isValidEventId(eventId) ||
    !isValidCameraName(camera) ||
    !Number.isFinite(startTime)
  ) {
    return { previous: null, next: null }
  }
  // shortcut: next is exact only when < 50 newer events exist; upgrade with Frigate sort=date_asc if that matters.
  const [newer, older] = await Promise.all([
    getEvents({
      cameras: camera,
      after: startTime,
      limit: 50,
      include_thumbnails: false,
    }),
    getEvents({
      cameras: camera,
      before: startTime,
      limit: 2,
      include_thumbnails: false,
    }),
  ])
  return pickNeighbors(
    eventId,
    newer.ok ? newer.data : [],
    older.ok ? older.data : [],
  )
}

export const loadCameraNeighborsFn = createServerFn({ method: 'GET' })
  .validator((data: NeighborsInput) => data)
  .handler(async ({ data }): Promise<Neighbors> => {
    const { requireSession } = await import('#/features/shared/server/session')
    const { getEvents } = await import(
      '#/features/shared/server/frigate/client'
    )
    await requireSession()
    return loadCameraNeighbors(data, getEvents)
  })
