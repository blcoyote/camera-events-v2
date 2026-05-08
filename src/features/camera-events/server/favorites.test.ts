import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createFavoritesStore } from './favorites-store'
import type { FavoritesStore } from './favorites-store'
import {
  handleToggleFavorite,
  handleGetFavoritedEventIds,
  handleGetIsFavorited,
  handleGetFavoriteEvents,
} from './favorites'
import type {
  FrigateRetainClient,
  FrigateEventClient,
} from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

const VALID_ID = '1713095000.123456-abcdef'
const USER = 'user-google-sub-123'

const noopClient: FrigateRetainClient = {
  retainEvent: async () => ({ ok: true, data: undefined }),
  unretainEvent: async () => ({ ok: true, data: undefined }),
}

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
  it('returns error for path-traversal event ID', async () => {
    expect(
      await handleToggleFavorite('../etc/passwd', USER, store, noopClient),
    ).toEqual({
      ok: false,
      error: 'Invalid event ID',
    })
  })

  it('returns error for empty event ID', async () => {
    expect(await handleToggleFavorite('', USER, store, noopClient)).toEqual({
      ok: false,
      error: 'Invalid event ID',
    })
  })

  it('adds favorite and returns isFavorited:true on first call', async () => {
    const result = await handleToggleFavorite(VALID_ID, USER, store, noopClient)
    expect(result).toEqual({ ok: true, isFavorited: true })
    expect(store.isFavorited(USER, VALID_ID)).toBe(true)
  })

  it('removes favorite and returns isFavorited:false on second call', async () => {
    await handleToggleFavorite(VALID_ID, USER, store, noopClient)
    const result = await handleToggleFavorite(VALID_ID, USER, store, noopClient)
    expect(result).toEqual({ ok: true, isFavorited: false })
    expect(store.isFavorited(USER, VALID_ID)).toBe(false)
  })

  it('toggles back to true on third call', async () => {
    await handleToggleFavorite(VALID_ID, USER, store, noopClient)
    await handleToggleFavorite(VALID_ID, USER, store, noopClient)
    const result = await handleToggleFavorite(VALID_ID, USER, store, noopClient)
    expect(result).toEqual({ ok: true, isFavorited: true })
  })

  it('isolates toggle state per user', async () => {
    await handleToggleFavorite(VALID_ID, 'user-a', store, noopClient)
    const result = await handleToggleFavorite(
      VALID_ID,
      'user-b',
      store,
      noopClient,
    )
    expect(result).toEqual({ ok: true, isFavorited: true })
    expect(store.isFavorited('user-a', VALID_ID)).toBe(true)
    expect(store.isFavorited('user-b', VALID_ID)).toBe(true)
  })
})

describe('handleToggleFavorite — Frigate retain sync', () => {
  it('calls retainEvent when favoriting', async () => {
    const retainEvent = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const unretainEvent = vi
      .fn()
      .mockResolvedValue({ ok: true, data: undefined })
    const result = await handleToggleFavorite(VALID_ID, USER, store, {
      retainEvent,
      unretainEvent,
    })
    expect(result).toEqual({ ok: true, isFavorited: true })
    expect(retainEvent).toHaveBeenCalledWith(VALID_ID)
    expect(unretainEvent).not.toHaveBeenCalled()
  })

  it('calls retainEvent even if another user already favorited (idempotent)', async () => {
    store.addFavorite('user-other', VALID_ID)
    const retainEvent = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const unretainEvent = vi
      .fn()
      .mockResolvedValue({ ok: true, data: undefined })
    await handleToggleFavorite(VALID_ID, USER, store, {
      retainEvent,
      unretainEvent,
    })
    expect(retainEvent).toHaveBeenCalledWith(VALID_ID)
  })

  it('calls unretainEvent when last user unfavorites', async () => {
    store.addFavorite(USER, VALID_ID)
    const retainEvent = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const unretainEvent = vi
      .fn()
      .mockResolvedValue({ ok: true, data: undefined })
    const result = await handleToggleFavorite(VALID_ID, USER, store, {
      retainEvent,
      unretainEvent,
    })
    expect(result).toEqual({ ok: true, isFavorited: false })
    expect(store.isFavorited(USER, VALID_ID)).toBe(false)
    expect(unretainEvent).toHaveBeenCalledWith(VALID_ID)
    expect(retainEvent).not.toHaveBeenCalled()
  })

  it('does NOT call unretainEvent when another user still has it favorited', async () => {
    store.addFavorite(USER, VALID_ID)
    store.addFavorite('user-other', VALID_ID)
    const retainEvent = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const unretainEvent = vi
      .fn()
      .mockResolvedValue({ ok: true, data: undefined })
    await handleToggleFavorite(VALID_ID, USER, store, {
      retainEvent,
      unretainEvent,
    })
    expect(unretainEvent).not.toHaveBeenCalled()
  })

  it('returns { ok: true } even when retainEvent fails', async () => {
    const retainEvent = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'network error' })
    const unretainEvent = vi
      .fn()
      .mockResolvedValue({ ok: true, data: undefined })
    const result = await handleToggleFavorite(VALID_ID, USER, store, {
      retainEvent,
      unretainEvent,
    })
    expect(result).toEqual({ ok: true, isFavorited: true })
    expect(store.isFavorited(USER, VALID_ID)).toBe(true)
  })

  it('returns { ok: true } even when unretainEvent fails', async () => {
    store.addFavorite(USER, VALID_ID)
    const retainEvent = vi.fn().mockResolvedValue({ ok: true, data: undefined })
    const unretainEvent = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'timeout' })
    const result = await handleToggleFavorite(VALID_ID, USER, store, {
      retainEvent,
      unretainEvent,
    })
    expect(result).toEqual({ ok: true, isFavorited: false })
    expect(store.isFavorited(USER, VALID_ID)).toBe(false)
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

function makeEvent(id: string): FrigateEvent {
  return {
    id,
    label: 'person',
    sub_label: null,
    camera: 'front_porch',
    start_time: 1713095000,
    end_time: 1713095010,
    false_positive: null,
    zones: [],
    thumbnail: '',
    has_clip: false,
    has_snapshot: false,
    retain_indefinitely: false,
    plus_id: null,
    box: null,
    top_score: null,
    data: {
      attributes: [],
      box: [0, 0, 0, 0],
      region: [0, 0, 0, 0],
      score: 0.9,
      top_score: 0.9,
      type: 'object',
    },
  }
}

describe('handleGetFavoriteEvents', () => {
  it('returns empty array when user has no favorites', async () => {
    const client: FrigateEventClient = { getEvent: vi.fn() }
    expect(await handleGetFavoriteEvents(USER, store, client)).toEqual([])
    expect(client.getEvent).not.toHaveBeenCalled()
  })

  it('fetches all favorited events and returns them', async () => {
    store.addFavorite(USER, 'event-aaa')
    store.addFavorite(USER, 'event-bbb')
    const eventA = makeEvent('event-aaa')
    const eventB = makeEvent('event-bbb')
    const getEvent = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: eventA })
      .mockResolvedValueOnce({ ok: true, data: eventB })
    const result = await handleGetFavoriteEvents(USER, store, { getEvent })
    expect(result).toHaveLength(2)
    expect(result).toContainEqual(eventA)
    expect(result).toContainEqual(eventB)
    expect(getEvent).toHaveBeenCalledTimes(2)
  })

  it('silently drops events that Frigate can no longer find', async () => {
    store.addFavorite(USER, 'event-aaa')
    store.addFavorite(USER, 'event-gone')
    const eventA = makeEvent('event-aaa')
    const getEvent = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: eventA })
      .mockResolvedValueOnce({ ok: false, error: 'HTTP 404', status: 404 })
    const result = await handleGetFavoriteEvents(USER, store, { getEvent })
    expect(result).toEqual([eventA])
  })

  it('returns empty array when all fetches fail', async () => {
    store.addFavorite(USER, 'event-gone')
    const getEvent = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'HTTP 404', status: 404 })
    const result = await handleGetFavoriteEvents(USER, store, { getEvent })
    expect(result).toEqual([])
  })
})
