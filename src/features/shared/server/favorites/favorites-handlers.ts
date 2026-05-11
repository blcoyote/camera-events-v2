import '@tanstack/react-start/server-only'
import { requireSession } from '#/features/shared/server/session'
import { isValidEventId } from '#/features/shared/server/frigate/validation'
import {
  retainEvent,
  unretainEvent,
  getEvent,
} from '#/features/shared/server/frigate/client'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { getFavoritesStore } from './favorites-store'

/**
 * Pure handler for toggling a favorite. Exported for unit testing.
 * Calls requireSession() as its first operation — userId never comes from input.
 */
export async function toggleFavoriteHandler({
  eventId,
}: {
  eventId: string
}): Promise<{ favorited: boolean }> {
  const userId = await requireSession()
  if (!isValidEventId(eventId)) {
    throw new Error('Invalid event ID')
  }
  const store = await getFavoritesStore()
  const currentlyFavorited = store.isFavorited(userId, eventId)
  if (currentlyFavorited) {
    store.removeFavorite(userId, eventId)
    if (store.getFavoriteCount(eventId) === 0) {
      try {
        const r = await unretainEvent(eventId)
        if (!r.ok) console.warn('unretain failed', r)
      } catch (e) {
        console.warn('unretain error', e)
      }
    }
  } else {
    store.addFavorite(userId, eventId)
    if (store.getFavoriteCount(eventId) === 1) {
      try {
        const r = await retainEvent(eventId)
        if (!r.ok) console.warn('retain failed', r)
      } catch (e) {
        console.warn('retain error', e)
      }
    }
  }
  return { favorited: !currentlyFavorited }
}

/**
 * Pure handler for fetching the calling user's favorited event IDs.
 * Exported for unit testing.
 */
export async function getUserFavoritedEventIdsHandler(): Promise<string[]> {
  const userId = await requireSession()
  const store = await getFavoritesStore()
  return store.getUserFavoritedEventIds(userId)
}

/**
 * Pure handler for fetching the calling user's favorited Frigate events.
 * Non-ok Frigate results are silently filtered. Exported for unit testing.
 */
export async function getUserFavoritedEventsHandler(): Promise<FrigateEvent[]> {
  const userId = await requireSession()
  const store = await getFavoritesStore()
  const ids = store.getUserFavoritedEventIds(userId)
  const results = await Promise.all(ids.map((id) => getEvent(id)))
  return results.filter((r) => r.ok).map((r) => r.data)
}
