import '@tanstack/react-start/server-only'
import { requireSession } from '#/features/shared/server/session'
import { isValidEventId } from '#/features/shared/server/frigate/validation'
import {
  retainEvent,
  unretainEvent,
  getEvent,
} from '#/features/shared/server/frigate/client'
import { getUserStore } from '#/features/shared/server/users/user-store'
import type { FavoriteEntry } from './types'
import { getFavoritesStore } from './favorites-store'
import type { FavoritesStore } from './favorites-store'

/**
 * Retention calls for one event run one at a time, so a retain cannot overtake
 * an in-flight unretain (or vice versa). Each call re-reads the reference count
 * when its turn comes and skips if a later mutation made it obsolete.
 * shortcut: in-process only, fine for the single Bun server; needs a DB lock if we ever scale out.
 */
const retentionTails = new Map<string, Promise<void>>()

function enqueueRetention(
  eventId: string,
  task: () => Promise<void>,
): Promise<void> {
  const run = (retentionTails.get(eventId) ?? Promise.resolve()).then(task)
  const tail = run
    .catch(() => {})
    .then(() => {
      if (retentionTails.get(eventId) === tail) retentionTails.delete(eventId)
    })
  retentionTails.set(eventId, tail)
  return run
}

/** Retain the event in Frigate when it just gained its first reference. */
export async function retainIfFirst(
  store: FavoritesStore,
  eventId: string,
): Promise<void> {
  if (store.getReferenceCount(eventId) !== 1) return
  return enqueueRetention(eventId, async () => {
    if (store.getReferenceCount(eventId) === 0) return
    try {
      const r = await retainEvent(eventId)
      if (!r.ok) console.warn('retain failed', r)
    } catch (e) {
      console.warn('retain error', e)
    }
  })
}

/** Unretain the event in Frigate when it lost its last reference. */
export async function unretainIfLast(
  store: FavoritesStore,
  eventId: string,
): Promise<void> {
  if (store.getReferenceCount(eventId) !== 0) return
  return enqueueRetention(eventId, async () => {
    if (store.getReferenceCount(eventId) !== 0) return
    try {
      const r = await unretainEvent(eventId)
      if (!r.ok) console.warn('unretain failed', r)
    } catch (e) {
      console.warn('unretain error', e)
    }
  })
}

function senderName(
  users: Awaited<ReturnType<typeof getUserStore>>,
  sub: string,
): string | null {
  const u = users.getUser(sub)
  return u ? u.first_name || u.email : null
}

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
    await unretainIfLast(store, eventId)
  } else {
    store.addFavorite(userId, eventId)
    await retainIfFirst(store, eventId)
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
 * Pure handler for the Favorites page: own favorites merged with received
 * shares, newest activity first. Non-ok Frigate results are dropped.
 */
export async function getFavoritesPageHandler(): Promise<FavoriteEntry[]> {
  const userId = await requireSession()
  const store = await getFavoritesStore()
  const users = await getUserStore()

  const byEvent = new Map<
    string,
    { favorited: boolean; senders: string[]; latest: string }
  >()
  const entryFor = (id: string) => {
    const existing = byEvent.get(id)
    if (existing) return existing
    const e = { favorited: false, senders: [] as string[], latest: '' }
    byEvent.set(id, e)
    return e
  }
  for (const f of store.getFavoritesWithTime(userId)) {
    const e = entryFor(f.eventId)
    e.favorited = true
    if (f.createdAt > e.latest) e.latest = f.createdAt
  }
  for (const s of store.getSharesForRecipient(userId)) {
    const e = entryFor(s.eventId)
    if (!e.senders.includes(s.senderId)) e.senders.push(s.senderId)
    if (s.createdAt > e.latest) e.latest = s.createdAt
  }

  const ids = [...byEvent.keys()].sort((a, b) =>
    byEvent.get(b)!.latest.localeCompare(byEvent.get(a)!.latest),
  )
  const results = await Promise.all(ids.map((id) => getEvent(id)))
  const entries: FavoriteEntry[] = []
  results.forEach((r, i) => {
    if (!r.ok) return
    const e = byEvent.get(ids[i])!
    entries.push({
      event: r.data,
      favorited: e.favorited,
      sharedBy: e.senders.map((sub) => senderName(users, sub)),
    })
  })
  return entries
}

/** Sender names (oldest first, deduped) of the caller's shares of one event. */
export async function getReceivedSharesHandler({
  eventId,
}: {
  eventId: string
}): Promise<(string | null)[]> {
  const userId = await requireSession()
  if (!isValidEventId(eventId)) throw new Error('Invalid event ID')
  const store = await getFavoritesStore()
  const users = await getUserStore()
  const senders = new Set(
    store
      .getSharesForRecipient(userId)
      .filter((s) => s.eventId === eventId)
      .map((s) => s.senderId),
  )
  return [...senders].map((sub) => senderName(users, sub))
}

/** Drop the caller's received shares of one event; unretain if now unreferenced. */
export async function removeReceivedShareHandler({
  eventId,
}: {
  eventId: string
}): Promise<void> {
  const userId = await requireSession()
  if (!isValidEventId(eventId)) throw new Error('Invalid event ID')
  const store = await getFavoritesStore()
  // A no-op removal must not unretain: Frigate may hold a retain set outside the app.
  const held = store
    .getSharesForRecipient(userId)
    .some((s) => s.eventId === eventId)
  if (!held) return
  store.removeSharesForRecipient(userId, eventId)
  await unretainIfLast(store, eventId)
}
