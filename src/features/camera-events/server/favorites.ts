import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '#/features/shared/server/session'
import { isValidEventId } from '#/features/shared/server/frigate/validation'
import { getFavoritesStore } from './favorites-store'
import type { FavoritesStore } from './favorites-store'

export type ToggleFavoriteResult =
  | { ok: true; isFavorited: boolean }
  | { ok: false; error: string }

export type GetIsFavoritedResult =
  | { ok: true; isFavorited: boolean }
  | { ok: false; isFavorited: false; error: string }

export function handleToggleFavorite(
  eventId: string,
  userId: string,
  store: FavoritesStore,
): ToggleFavoriteResult {
  if (!isValidEventId(eventId)) {
    return { ok: false, error: 'Invalid event ID' }
  }
  if (store.isFavorited(userId, eventId)) {
    store.removeFavorite(userId, eventId)
    return { ok: true, isFavorited: false }
  }
  store.addFavorite(userId, eventId)
  return { ok: true, isFavorited: true }
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
    return handleToggleFavorite(eventId, userId, store)
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
