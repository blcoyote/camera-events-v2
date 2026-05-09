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
  it('creates event_favorites table on init', () => {
    expect(store.tableNames()).toContain('event_favorites')
  })
})

describe('addFavorite', () => {
  it('inserts a row for (userId, eventId)', () => {
    store.addFavorite('user1', 'event-abc')
    expect(
      store.countRows(
        'SELECT id FROM event_favorites WHERE user_id = ? AND event_id = ?',
        'user1',
        'event-abc',
      ),
    ).toBe(1)
  })

  it('duplicate add is idempotent — INSERT OR IGNORE produces exactly one row', () => {
    store.addFavorite('user1', 'event-abc')
    store.addFavorite('user1', 'event-abc')
    expect(
      store.countRows(
        'SELECT id FROM event_favorites WHERE user_id = ? AND event_id = ?',
        'user1',
        'event-abc',
      ),
    ).toBe(1)
  })
})

describe('removeFavorite', () => {
  it('deletes the row for (userId, eventId)', () => {
    store.addFavorite('user1', 'event-abc')
    store.removeFavorite('user1', 'event-abc')
    expect(
      store.countRows(
        'SELECT id FROM event_favorites WHERE user_id = ? AND event_id = ?',
        'user1',
        'event-abc',
      ),
    ).toBe(0)
  })

  it('does nothing when row does not exist', () => {
    store.removeFavorite('user1', 'nonexistent')
    // no throw
  })
})

describe('getUserFavoritedEventIds', () => {
  it('returns empty array for user with no favorites', () => {
    expect(store.getUserFavoritedEventIds('user1')).toEqual([])
  })

  it('returns only the requesting user IDs — cross-user isolation', () => {
    store.addFavorite('userA', 'event-1')
    store.addFavorite('userA', 'event-2')
    store.addFavorite('userB', 'event-3')

    const ids = store.getUserFavoritedEventIds('userA')
    expect(ids).toHaveLength(2)
    expect(ids).toContain('event-1')
    expect(ids).toContain('event-2')
    expect(ids).not.toContain('event-3')
  })
})

describe('isFavorited', () => {
  it('returns true when row exists', () => {
    store.addFavorite('user1', 'event-abc')
    expect(store.isFavorited('user1', 'event-abc')).toBe(true)
  })

  it('returns false when row does not exist', () => {
    expect(store.isFavorited('user1', 'nonexistent')).toBe(false)
  })

  it('returns false for a different user', () => {
    store.addFavorite('user1', 'event-abc')
    expect(store.isFavorited('user2', 'event-abc')).toBe(false)
  })
})

describe('persistence across close/reopen', () => {
  it('retains favorites after closing and re-opening the database', async () => {
    store.addFavorite('user1', 'event-abc')
    const dbPath = path.join(tmpDir, 'test.db')
    store.close()

    const store2 = await createFavoritesStore(dbPath)
    expect(store2.getUserFavoritedEventIds('user1')).toContain('event-abc')
    store2.close()

    // Re-assign so afterEach close() does not fail on already-closed db
    store = await createFavoritesStore(path.join(tmpDir, 'dummy.db'))
  })
})
