import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createFavoritesStore } from './favorites-store'
import type { FavoritesStore } from './favorites-store'
import {
  handleToggleFavorite,
  handleGetFavoritedEventIds,
  handleGetIsFavorited,
} from './favorites'

const VALID_ID = '1713095000.123456-abcdef'
const USER = 'user-google-sub-123'

let store: FavoritesStore
let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'favorites-test-'))
  store = await createFavoritesStore(path.join(tmpDir, 'test.db'))
})

afterEach(() => {
  store.close()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('handleToggleFavorite', () => {
  it('returns error for path-traversal event ID', () => {
    expect(handleToggleFavorite('../etc/passwd', USER, store)).toEqual({
      ok: false,
      error: 'Invalid event ID',
    })
  })

  it('returns error for empty event ID', () => {
    expect(handleToggleFavorite('', USER, store)).toEqual({
      ok: false,
      error: 'Invalid event ID',
    })
  })

  it('adds favorite and returns isFavorited:true on first call', () => {
    const result = handleToggleFavorite(VALID_ID, USER, store)
    expect(result).toEqual({ ok: true, isFavorited: true })
    expect(store.isFavorited(USER, VALID_ID)).toBe(true)
  })

  it('removes favorite and returns isFavorited:false on second call', () => {
    handleToggleFavorite(VALID_ID, USER, store)
    const result = handleToggleFavorite(VALID_ID, USER, store)
    expect(result).toEqual({ ok: true, isFavorited: false })
    expect(store.isFavorited(USER, VALID_ID)).toBe(false)
  })

  it('toggles back to true on third call', () => {
    handleToggleFavorite(VALID_ID, USER, store)
    handleToggleFavorite(VALID_ID, USER, store)
    const result = handleToggleFavorite(VALID_ID, USER, store)
    expect(result).toEqual({ ok: true, isFavorited: true })
  })

  it('isolates toggle state per user', () => {
    handleToggleFavorite(VALID_ID, 'user-a', store)
    const result = handleToggleFavorite(VALID_ID, 'user-b', store)
    expect(result).toEqual({ ok: true, isFavorited: true })
    expect(store.isFavorited('user-a', VALID_ID)).toBe(true)
    expect(store.isFavorited('user-b', VALID_ID)).toBe(true)
  })
})

describe('handleGetFavoritedEventIds', () => {
  it('returns empty array when user has no favorites', () => {
    expect(handleGetFavoritedEventIds(USER, store)).toEqual([])
  })

  it('returns all favorited event IDs for the user', () => {
    store.addFavorite(USER, 'event-aaa')
    store.addFavorite(USER, 'event-bbb')
    const ids = handleGetFavoritedEventIds(USER, store)
    expect(ids).toHaveLength(2)
    expect(ids).toContain('event-aaa')
    expect(ids).toContain('event-bbb')
  })

  it('isolates results per user', () => {
    store.addFavorite('user-a', 'event-aaa')
    store.addFavorite('user-b', 'event-bbb')
    expect(handleGetFavoritedEventIds('user-a', store)).toEqual(['event-aaa'])
    expect(handleGetFavoritedEventIds('user-b', store)).toEqual(['event-bbb'])
  })
})

describe('handleGetIsFavorited', () => {
  it('returns error for invalid event ID', () => {
    expect(handleGetIsFavorited('../etc/passwd', USER, store)).toEqual({
      ok: false,
      isFavorited: false,
      error: 'Invalid event ID',
    })
  })

  it('returns isFavorited:false for an unfavorited event', () => {
    expect(handleGetIsFavorited(VALID_ID, USER, store)).toEqual({
      ok: true,
      isFavorited: false,
    })
  })

  it('returns isFavorited:true after the event is favorited', () => {
    store.addFavorite(USER, VALID_ID)
    expect(handleGetIsFavorited(VALID_ID, USER, store)).toEqual({
      ok: true,
      isFavorited: true,
    })
  })

  it('returns isFavorited:false after the event is unfavorited', () => {
    store.addFavorite(USER, VALID_ID)
    store.removeFavorite(USER, VALID_ID)
    expect(handleGetIsFavorited(VALID_ID, USER, store)).toEqual({
      ok: true,
      isFavorited: false,
    })
  })
})
