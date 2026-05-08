import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { FavoritesStore } from './favorites-store'
import { createFavoritesStore } from './favorites-store'

let store: FavoritesStore
let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'favorites-store-test-'))
  store = await createFavoritesStore(path.join(tmpDir, 'test.db'))
})

afterEach(() => {
  store.close()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('favorites-store table initialization', () => {
  it('creates favorite_events table on init', () => {
    expect(store.tableNames()).toContain('favorite_events')
  })

  it('favorite_events table has correct columns', () => {
    const cols = store.tableColumns('favorite_events')
    expect(cols).toContain('user_id')
    expect(cols).toContain('event_id')
    expect(cols).toContain('created_at')
  })
})

describe('addFavorite', () => {
  it('adds a favorite', () => {
    store.addFavorite('user1', 'event-abc')
    expect(store.isFavorited('user1', 'event-abc')).toBe(true)
  })

  it('is idempotent — double-add does not error or duplicate', () => {
    store.addFavorite('user1', 'event-abc')
    store.addFavorite('user1', 'event-abc')
    expect(
      store.countRows(
        'SELECT * FROM favorite_events WHERE user_id = ? AND event_id = ?',
        'user1',
        'event-abc',
      ),
    ).toBe(1)
  })

  it('allows different users to favorite the same event', () => {
    store.addFavorite('user1', 'event-abc')
    store.addFavorite('user2', 'event-abc')
    expect(store.isFavorited('user1', 'event-abc')).toBe(true)
    expect(store.isFavorited('user2', 'event-abc')).toBe(true)
  })
})

describe('removeFavorite', () => {
  it('removes an existing favorite', () => {
    store.addFavorite('user1', 'event-abc')
    store.removeFavorite('user1', 'event-abc')
    expect(store.isFavorited('user1', 'event-abc')).toBe(false)
  })

  it('does nothing when the entry does not exist', () => {
    store.removeFavorite('user1', 'event-nonexistent')
    // no throw
  })

  it('only removes the matching (user_id, event_id) pair', () => {
    store.addFavorite('user1', 'event-abc')
    store.addFavorite('user2', 'event-abc')
    store.removeFavorite('user1', 'event-abc')
    expect(store.isFavorited('user1', 'event-abc')).toBe(false)
    expect(store.isFavorited('user2', 'event-abc')).toBe(true)
  })
})

describe('isFavorited', () => {
  it('returns false for an unknown event', () => {
    expect(store.isFavorited('user1', 'event-unknown')).toBe(false)
  })

  it('returns false for a different user on a favorited event', () => {
    store.addFavorite('user1', 'event-abc')
    expect(store.isFavorited('user2', 'event-abc')).toBe(false)
  })
})

describe('getFavoritedEventIds', () => {
  it('returns empty array when user has no favorites', () => {
    expect(store.getFavoritedEventIds('user1')).toEqual([])
  })

  it('returns all event IDs favorited by the user', () => {
    store.addFavorite('user1', 'event-abc')
    store.addFavorite('user1', 'event-def')
    const ids = store.getFavoritedEventIds('user1')
    expect(ids).toHaveLength(2)
    expect(ids).toContain('event-abc')
    expect(ids).toContain('event-def')
  })

  it('isolates results per user', () => {
    store.addFavorite('user1', 'event-abc')
    store.addFavorite('user2', 'event-xyz')
    expect(store.getFavoritedEventIds('user1')).toEqual(['event-abc'])
    expect(store.getFavoritedEventIds('user2')).toEqual(['event-xyz'])
  })
})

describe('persistence across close/reopen', () => {
  it('retains favorites after closing and re-opening the database', async () => {
    store.addFavorite('user1', 'event-abc')
    const dbPath = path.join(tmpDir, 'test.db')
    store.close()

    const store2 = await createFavoritesStore(dbPath)
    expect(store2.isFavorited('user1', 'event-abc')).toBe(true)
    store2.close()

    store = await createFavoritesStore(path.join(tmpDir, 'dummy.db'))
  })
})
