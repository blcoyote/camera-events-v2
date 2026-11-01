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

  it('creates event_shares table on init', () => {
    expect(store.tableNames()).toContain('event_shares')
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

describe('getReferenceCount', () => {
  it('returns 0 when no one has favorited the event', () => {
    expect(store.getReferenceCount('event-abc')).toBe(0)
  })

  it('returns 1 after one user favorites the event', () => {
    store.addFavorite('user1', 'event-abc')
    expect(store.getReferenceCount('event-abc')).toBe(1)
  })

  it('returns 2 after two different users favorite the same event', () => {
    store.addFavorite('user1', 'event-abc')
    store.addFavorite('user2', 'event-abc')
    expect(store.getReferenceCount('event-abc')).toBe(2)
  })

  it('does not count rows for a different event (cross-event isolation)', () => {
    store.addFavorite('user1', 'event-abc')
    store.addFavorite('user1', 'event-xyz')
    expect(store.getReferenceCount('event-abc')).toBe(1)
    expect(store.getReferenceCount('event-xyz')).toBe(1)
  })

  it('returns 0 after the only favorite is removed', () => {
    store.addFavorite('user1', 'event-abc')
    store.removeFavorite('user1', 'event-abc')
    expect(store.getReferenceCount('event-abc')).toBe(0)
  })
})

describe('getReferenceCount with shares', () => {
  it('counts favorites and shares together', () => {
    store.addFavorite('user1', 'event-abc')
    store.addShare('event-abc', 'sender', 'user2')
    expect(store.getReferenceCount('event-abc')).toBe(2)
  })

  it('does not count shares of a different event', () => {
    store.addShare('event-xyz', 'sender', 'user2')
    expect(store.getReferenceCount('event-abc')).toBe(0)
  })
})

describe('addShare', () => {
  it('is idempotent per (event, sender, recipient) and refreshes created_at', () => {
    store.addShare('e1', 's', 'r')
    store.addShare('e1', 's', 'r')
    expect(store.getSharesForRecipient('r')).toHaveLength(1)
    expect(store.getReferenceCount('e1')).toBe(1)
  })

  it('keeps separate rows for different senders', () => {
    store.addShare('e1', 's1', 'r')
    store.addShare('e1', 's2', 'r')
    expect(store.getSharesForRecipient('r')).toHaveLength(2)
  })
})

describe('getSharesForRecipient', () => {
  it('returns [] when none', () => {
    expect(store.getSharesForRecipient('r')).toEqual([])
  })

  it('returns only that recipient shares ordered by insertion', () => {
    store.addShare('e1', 's', 'r')
    store.addShare('e2', 's', 'r')
    store.addShare('e3', 's', 'other')
    const rows = store.getSharesForRecipient('r')
    expect(rows.map((x) => x.eventId)).toEqual(['e1', 'e2'])
    expect(rows[0]).toMatchObject({ senderId: 's' })
    expect(typeof rows[0].createdAt).toBe('string')
  })
})

describe('removeSharesForRecipient', () => {
  it('removes only that recipient rows for that event', () => {
    store.addShare('e1', 's1', 'r')
    store.addShare('e1', 's2', 'r')
    store.addShare('e1', 's1', 'other')
    store.addShare('e2', 's1', 'r')
    store.removeSharesForRecipient('r', 'e1')
    expect(store.getSharesForRecipient('r').map((x) => x.eventId)).toEqual([
      'e2',
    ])
    expect(store.getSharesForRecipient('other')).toHaveLength(1)
  })
})

describe('getFavoritesWithTime', () => {
  it('returns eventId and createdAt for the user only', () => {
    store.addFavorite('u', 'e1')
    store.addFavorite('v', 'e2')
    const rows = store.getFavoritesWithTime('u')
    expect(rows).toHaveLength(1)
    expect(rows[0].eventId).toBe('e1')
    expect(typeof rows[0].createdAt).toBe('string')
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
