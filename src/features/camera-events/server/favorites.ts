import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '#/features/shared/server/session'
import { isValidEventId } from '#/features/shared/server/frigate/validation'
import {
  retainEvent,
  unretainEvent,
} from '#/features/shared/server/frigate/client'
import { getFavoritesStore } from './favorites-store'
import type { FavoritesStore } from './favorites-store'
import type { FrigateRetainClient } from '#/features/shared/server/frigate/config'

export type { FrigateRetainClient }

export type ToggleFavoriteResult =
  | { ok: true; isFavorited: boolean }
  | { ok: false; error: string }

export type GetIsFavoritedResult =
  | { ok: true; isFavorited: boolean }
  | { ok: false; isFavorited: false; error: string }

async function syncRetentionForEvent(
  eventId: string,
  isFavorited: boolean,
  remainingCount: number,
  frigateClient: FrigateRetainClient,
): Promise<void> {
  if (isFavorited) {
    const r = await frigateClient.retainEvent(eventId)
    if (!r.ok) console.warn(`[favorites] retainEvent failed: ${r.error}`)
  } else if (remainingCount === 0) {
    const r = await frigateClient.unretainEvent(eventId)
    if (!r.ok) console.warn(`[favorites] unretainEvent failed: ${r.error}`)
  }
}

export async function handleToggleFavorite(
  eventId: string,
  userId: string,
  store: FavoritesStore,
  frigateClient: FrigateRetainClient,
): Promise<ToggleFavoriteResult> {
  if (!isValidEventId(eventId)) {
    return { ok: false, error: 'Invalid event ID' }
  }
  const { isFavorited, remainingCount } = store.atomicToggleFavorite(
    userId,
    eventId,
  )
  await syncRetentionForEvent(
    eventId,
    isFavorited,
    remainingCount,
    frigateClient,
  )
  return { ok: true, isFavorited }
}

export function handleGetFavoritedEventIds(
  userId: string,
  store: FavoritesStore,
): string[] {
  return store.getFavoritedEventIds(userId)
}

export function handleGetIsFavorited(
  eventId: string,
  userId: string,
  store: FavoritesStore,
): GetIsFavoritedResult {
  if (!isValidEventId(eventId)) {
    return { ok: false, isFavorited: false, error: 'Invalid event ID' }
  }
  return { ok: true, isFavorited: store.isFavorited(userId, eventId) }
}

export const toggleFavoriteFn = createServerFn({ method: 'POST' })
  .inputValidator((data: string) => data)
  .handler(async ({ data: eventId }) => {
    const userId = await requireSession()
    console.log(
      `[favorites] toggleFavorite eventId=${eventId} userId=${userId}`,
    )
    const store = await getFavoritesStore()
    return handleToggleFavorite(eventId, userId, store, {
      retainEvent,
      unretainEvent,
    })
  })

export const getFavoritedEventIdsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const userId = await requireSession()
    const store = await getFavoritesStore()
    return handleGetFavoritedEventIds(userId, store)
  },
)

export const getIsFavoritedFn = createServerFn({ method: 'GET' })
  .inputValidator((data: string) => data)
  .handler(async ({ data: eventId }) => {
    const userId = await requireSession()
    const store = await getFavoritesStore()
    return handleGetIsFavorited(eventId, userId, store)
  })
