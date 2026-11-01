import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createFavoritesStore } from './favorites-store'
import type { FavoritesStore } from './favorites-store'

// ─── Module mocks (hoisted before imports) ───────────────────────────────────

const mockRequireSession = vi.fn<() => Promise<string>>()
vi.mock('#/features/shared/server/session', () => ({
  requireSession: mockRequireSession,
}))

let _testStore: FavoritesStore | null = null
vi.mock('./favorites-store', async (importOriginal) => {
  const actual = await importOriginal<FavoritesStore>()
  return {
    ...actual,
    getFavoritesStore: vi.fn(() => {
      if (!_testStore) throw new Error('Test store not initialized')
      return Promise.resolve(_testStore)
    }),
  }
})

const mockGetUser = vi.fn()
vi.mock('#/features/shared/server/users/user-store', () => ({
  getUserStore: vi.fn(() => Promise.resolve({ getUser: mockGetUser })),
}))

const mockRetainEvent = vi.fn()
const mockUnretainEvent = vi.fn()
const mockGetEvent = vi.fn()
vi.mock('#/features/shared/server/frigate/client', () => ({
  retainEvent: mockRetainEvent,
  unretainEvent: mockUnretainEvent,
  getEvent: mockGetEvent,
}))

// Import handlers AFTER mocks are set up
const {
  toggleFavoriteHandler,
  retainIfFirst,
  unretainIfLast,
  getUserFavoritedEventIdsHandler,
  getFavoritesPageHandler,
  getReceivedSharesHandler,
  removeReceivedShareHandler,
} = await import('./favorites-handlers')

// ─── Test fixtures ────────────────────────────────────────────────────────────

const VALID_ID = '1713095000.123456-abcdef'
const USER = 'user-google-sub-123'

let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'favorites-fns-test-'))
  _testStore = await createFavoritesStore(path.join(tmpDir, 'test.db'))
  mockRequireSession.mockResolvedValue(USER)
  mockRetainEvent.mockResolvedValue({ ok: true, data: undefined })
  mockUnretainEvent.mockResolvedValue({ ok: true, data: undefined })
})

afterEach(() => {
  _testStore?.close()
  _testStore = null
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.clearAllMocks()
})

// ─── toggleFavoriteHandler ────────────────────────────────────────────────────

describe('toggleFavoriteHandler', () => {
  describe('auth guard', () => {
    it('throws Unauthorized when session is missing', async () => {
      mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
      await expect(
        toggleFavoriteHandler({ eventId: VALID_ID }),
      ).rejects.toThrow('Unauthorized')
    })

    it('writes no DB row when unauthorized', async () => {
      mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
      await expect(
        toggleFavoriteHandler({ eventId: VALID_ID }),
      ).rejects.toThrow()
      expect(_testStore!.countRows('SELECT id FROM event_favorites')).toBe(0)
    })
  })

  describe('input validation', () => {
    it('throws for path-traversal event ID', async () => {
      await expect(
        toggleFavoriteHandler({ eventId: '../etc/passwd' }),
      ).rejects.toThrow('Invalid event ID')
    })

    it('writes no DB row for invalid event ID', async () => {
      await expect(
        toggleFavoriteHandler({ eventId: '../etc/passwd' }),
      ).rejects.toThrow()
      expect(_testStore!.countRows('SELECT id FROM event_favorites')).toBe(0)
    })

    it('throws for empty event ID', async () => {
      await expect(toggleFavoriteHandler({ eventId: '' })).rejects.toThrow(
        'Invalid event ID',
      )
    })
  })

  describe('toggle logic', () => {
    it('first call returns { favorited: true } and persists row', async () => {
      const result = await toggleFavoriteHandler({ eventId: VALID_ID })
      expect(result).toEqual({ favorited: true })
      expect(_testStore!.isFavorited(USER, VALID_ID)).toBe(true)
    })

    it('second call returns { favorited: false } and removes row', async () => {
      await toggleFavoriteHandler({ eventId: VALID_ID })
      const result = await toggleFavoriteHandler({ eventId: VALID_ID })
      expect(result).toEqual({ favorited: false })
      expect(_testStore!.isFavorited(USER, VALID_ID)).toBe(false)
    })

    it('userId comes from requireSession, not from input', async () => {
      mockRequireSession.mockResolvedValue('server-determined-user')
      await toggleFavoriteHandler({ eventId: VALID_ID })
      expect(_testStore!.isFavorited('server-determined-user', VALID_ID)).toBe(
        true,
      )
      expect(_testStore!.isFavorited(USER, VALID_ID)).toBe(false)
    })
  })

  describe('cross-user isolation', () => {
    it('toggling for userA does not affect userB', async () => {
      mockRequireSession.mockResolvedValue('userA')
      await toggleFavoriteHandler({ eventId: VALID_ID })

      mockRequireSession.mockResolvedValue('userB')
      const result = await toggleFavoriteHandler({ eventId: VALID_ID })
      expect(result).toEqual({ favorited: true })
      expect(_testStore!.isFavorited('userA', VALID_ID)).toBe(true)
      expect(_testStore!.isFavorited('userB', VALID_ID)).toBe(true)
    })
  })
})

// ─── toggleFavoriteHandler — Frigate retention side effects ──────────────────

describe('toggleFavoriteHandler — retention', () => {
  it('calls retainEvent when this is the first favorite (count becomes 1)', async () => {
    await toggleFavoriteHandler({ eventId: VALID_ID })
    expect(mockRetainEvent).toHaveBeenCalledOnce()
    expect(mockRetainEvent).toHaveBeenCalledWith(VALID_ID)
  })

  it('does NOT call retainEvent when a second user favorites the same event', async () => {
    mockRequireSession.mockResolvedValue('userA')
    await toggleFavoriteHandler({ eventId: VALID_ID })
    mockRetainEvent.mockClear()

    mockRequireSession.mockResolvedValue('userB')
    await toggleFavoriteHandler({ eventId: VALID_ID })
    expect(mockRetainEvent).not.toHaveBeenCalled()
  })

  it('calls unretainEvent when the last favorite is removed (count becomes 0)', async () => {
    await toggleFavoriteHandler({ eventId: VALID_ID })
    await toggleFavoriteHandler({ eventId: VALID_ID })
    expect(mockUnretainEvent).toHaveBeenCalledOnce()
    expect(mockUnretainEvent).toHaveBeenCalledWith(VALID_ID)
  })

  it('does NOT call unretainEvent when a non-last user unfavorites', async () => {
    mockRequireSession.mockResolvedValue('userA')
    await toggleFavoriteHandler({ eventId: VALID_ID })
    mockRequireSession.mockResolvedValue('userB')
    await toggleFavoriteHandler({ eventId: VALID_ID })

    mockUnretainEvent.mockClear()

    mockRequireSession.mockResolvedValue('userA')
    await toggleFavoriteHandler({ eventId: VALID_ID })
    expect(mockUnretainEvent).not.toHaveBeenCalled()
  })

  it('retainEvent throws — handler still returns { favorited: true } without rethrowing', async () => {
    mockRetainEvent.mockRejectedValue(new Error('Frigate unavailable'))
    const result = await toggleFavoriteHandler({ eventId: VALID_ID })
    expect(result).toEqual({ favorited: true })
    expect(_testStore!.isFavorited(USER, VALID_ID)).toBe(true)
  })

  it('unretainEvent returns { ok: false } — handler still returns { favorited: false }', async () => {
    await toggleFavoriteHandler({ eventId: VALID_ID })
    mockUnretainEvent.mockResolvedValue({ ok: false, error: 'HTTP 500' })
    const result = await toggleFavoriteHandler({ eventId: VALID_ID })
    expect(result).toEqual({ favorited: false })
    expect(_testStore!.isFavorited(USER, VALID_ID)).toBe(false)
  })
})

describe('toggleFavoriteHandler — retention with shares', () => {
  it('does NOT call retainEvent when the event already has a share', async () => {
    _testStore!.addShare(VALID_ID, 'sender', 'someone')
    await toggleFavoriteHandler({ eventId: VALID_ID })
    expect(mockRetainEvent).not.toHaveBeenCalled()
  })

  it('does NOT call unretainEvent when unfavoriting while a share remains', async () => {
    await toggleFavoriteHandler({ eventId: VALID_ID })
    _testStore!.addShare(VALID_ID, 'sender', 'someone')
    await toggleFavoriteHandler({ eventId: VALID_ID })
    expect(mockUnretainEvent).not.toHaveBeenCalled()
  })
})

describe('retainIfFirst', () => {
  it('retains when reference count is 1', async () => {
    _testStore!.addFavorite(USER, VALID_ID)
    await retainIfFirst(_testStore!, VALID_ID)
    expect(mockRetainEvent).toHaveBeenCalledWith(VALID_ID)
  })

  it('does not retain when count is not 1', async () => {
    await retainIfFirst(_testStore!, VALID_ID)
    _testStore!.addFavorite('a', VALID_ID)
    _testStore!.addFavorite('b', VALID_ID)
    await retainIfFirst(_testStore!, VALID_ID)
    expect(mockRetainEvent).not.toHaveBeenCalled()
  })

  it('swallows failures', async () => {
    _testStore!.addFavorite(USER, VALID_ID)
    mockRetainEvent.mockRejectedValue(new Error('boom'))
    await expect(retainIfFirst(_testStore!, VALID_ID)).resolves.toBeUndefined()
  })
})

describe('unretainIfLast', () => {
  it('unretains when count is 0', async () => {
    await unretainIfLast(_testStore!, VALID_ID)
    expect(mockUnretainEvent).toHaveBeenCalledWith(VALID_ID)
  })

  it('does not unretain when references remain', async () => {
    _testStore!.addShare(VALID_ID, 's', 'r')
    await unretainIfLast(_testStore!, VALID_ID)
    expect(mockUnretainEvent).not.toHaveBeenCalled()
  })

  it('swallows failures', async () => {
    mockUnretainEvent.mockRejectedValue(new Error('boom'))
    await expect(unretainIfLast(_testStore!, VALID_ID)).resolves.toBeUndefined()
  })
})

// ─── getUserFavoritedEventIdsHandler ─────────────────────────────────────────

describe('getUserFavoritedEventIdsHandler', () => {
  it('throws Unauthorized when session is missing', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    await expect(getUserFavoritedEventIdsHandler()).rejects.toThrow(
      'Unauthorized',
    )
  })

  it('returns empty array for user with no favorites', async () => {
    const result = await getUserFavoritedEventIdsHandler()
    expect(result).toEqual([])
  })

  it('returns only the calling user IDs — cross-user isolation', async () => {
    _testStore!.addFavorite(USER, 'event-1')
    _testStore!.addFavorite(USER, 'event-2')
    _testStore!.addFavorite('other-user', 'event-3')

    const result = await getUserFavoritedEventIdsHandler()
    expect(result).toHaveLength(2)
    expect(result).toContain('event-1')
    expect(result).toContain('event-2')
    expect(result).not.toContain('event-3')
  })

  it('returns empty array when called as a different user who has no favorites', async () => {
    _testStore!.addFavorite(USER, 'event-1')
    mockRequireSession.mockResolvedValue('other-user')

    const result = await getUserFavoritedEventIdsHandler()
    expect(result).toEqual([])
  })
})

// ─── getUserFavoritedEventsHandler ───────────────────────────────────────────

function makeEvent(id: string) {
  return {
    id,
    label: 'person',
    sub_label: null,
    camera: 'front_porch',
    start_time: 1713095000,
    end_time: 1713095060,
    false_positive: null,
    zones: [],
    thumbnail: '',
    has_clip: true,
    has_snapshot: true,
    retain_indefinitely: false,
    plus_id: null,
    box: [0.1, 0.1, 0.3, 0.4] as [number, number, number, number],
    top_score: 0.9,
    data: {
      attributes: [],
      box: [0.1, 0.1, 0.3, 0.4] as [number, number, number, number],
      region: [0, 0, 1, 1] as [number, number, number, number],
      score: 0.9,
      top_score: 0.9,
      type: 'object',
    },
  }
}

describe('getFavoritesPageHandler', () => {
  const users: Record<
    string,
    { first_name: string | null; email: string } | null
  > = {}
  beforeEach(() => {
    for (const k of Object.keys(users)) delete users[k]
    mockGetUser.mockImplementation((sub: string) => users[sub] ?? null)
    mockGetEvent.mockImplementation((id: string) =>
      Promise.resolve({ ok: true, data: makeEvent(id) }),
    )
  })

  it('throws Unauthorized before touching stores', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    await expect(getFavoritesPageHandler()).rejects.toThrow('Unauthorized')
    expect(mockGetEvent).not.toHaveBeenCalled()
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('returns [] when nothing favorited or shared', async () => {
    expect(await getFavoritesPageHandler()).toEqual([])
    expect(mockGetEvent).not.toHaveBeenCalled()
  })

  it('favorites only: favorited true, sharedBy empty', async () => {
    _testStore!.addFavorite(USER, 'event-1')
    const result = await getFavoritesPageHandler()
    expect(result).toHaveLength(1)
    expect(result[0].event.id).toBe('event-1')
    expect(result[0].favorited).toBe(true)
    expect(result[0].sharedBy).toEqual([])
  })

  it('shares only: favorited false, sharedBy has sender name', async () => {
    users['alice'] = { first_name: 'Alice', email: 'a@x.dk' }
    _testStore!.addShare('event-1', 'alice', USER)
    const result = await getFavoritesPageHandler()
    expect(result).toHaveLength(1)
    expect(result[0].favorited).toBe(false)
    expect(result[0].sharedBy).toEqual(['Alice'])
  })

  it('favorite and share on same event yield one entry', async () => {
    users['alice'] = { first_name: 'Alice', email: 'a@x.dk' }
    _testStore!.addFavorite(USER, 'event-1')
    _testStore!.addShare('event-1', 'alice', USER)
    const result = await getFavoritesPageHandler()
    expect(result).toHaveLength(1)
    expect(result[0].favorited).toBe(true)
    expect(result[0].sharedBy).toEqual(['Alice'])
    expect(mockGetEvent).toHaveBeenCalledTimes(1)
  })

  it('orders senders oldest first, falls back to email, null for unknown', async () => {
    users['alice'] = { first_name: 'Alice', email: 'a@x.dk' }
    users['bob'] = { first_name: null, email: 'bob@x.dk' }
    vi.spyOn(_testStore!, 'getSharesForRecipient').mockReturnValue([
      { eventId: 'event-1', senderId: 'bob', createdAt: '2026-01-01 10:00:00' },
      {
        eventId: 'event-1',
        senderId: 'ghost',
        createdAt: '2026-01-01 11:00:00',
      },
      {
        eventId: 'event-1',
        senderId: 'alice',
        createdAt: '2026-01-01 12:00:00',
      },
      {
        eventId: 'event-1',
        senderId: 'alice',
        createdAt: '2026-01-01 13:00:00',
      },
    ])
    const result = await getFavoritesPageHandler()
    expect(result[0].sharedBy).toEqual(['bob@x.dk', null, 'Alice'])
  })

  it('sorts by newest of favorite or share time, descending', async () => {
    vi.spyOn(_testStore!, 'getFavoritesWithTime').mockReturnValue([
      { eventId: 'old', createdAt: '2026-01-01 10:00:00' },
      { eventId: 'mid', createdAt: '2026-01-02 10:00:00' },
    ])
    vi.spyOn(_testStore!, 'getSharesForRecipient').mockReturnValue([
      { eventId: 'old', senderId: 'a', createdAt: '2026-01-03 10:00:00' },
      { eventId: 'new', senderId: 'a', createdAt: '2026-01-02 12:00:00' },
    ])
    const result = await getFavoritesPageHandler()
    expect(result.map((e) => e.event.id)).toEqual(['old', 'new', 'mid'])
  })

  it('drops entries whose Frigate event is missing', async () => {
    _testStore!.addFavorite(USER, 'event-1')
    _testStore!.addFavorite(USER, 'event-missing')
    mockGetEvent.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'event-missing'
          ? { ok: false, error: 'HTTP 404', status: 404 }
          : { ok: true, data: makeEvent(id) },
      ),
    )
    const result = await getFavoritesPageHandler()
    expect(result.map((e) => e.event.id)).toEqual(['event-1'])
  })
})

// ─── received shares ──────────────────────────────────────────────────────────

describe('getReceivedSharesHandler', () => {
  it('throws before touching the store when unauthenticated', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    _testStore = null
    await expect(
      getReceivedSharesHandler({ eventId: VALID_ID }),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects an invalid event id', async () => {
    await expect(
      getReceivedSharesHandler({ eventId: '../etc' }),
    ).rejects.toThrow('Invalid event ID')
  })

  it('returns deduped sender names for the caller only, oldest first', async () => {
    _testStore!.addShare(VALID_ID, 'alice', USER)
    _testStore!.addShare(VALID_ID, 'alice', USER)
    _testStore!.addShare(VALID_ID, 'ghost', USER)
    _testStore!.addShare(VALID_ID, 'bob', 'someone-else')
    mockGetUser.mockImplementation((sub: string) =>
      sub === 'alice' ? { first_name: 'Alice', email: 'a@x.dk' } : null,
    )
    expect(await getReceivedSharesHandler({ eventId: VALID_ID })).toEqual([
      'Alice',
      null,
    ])
  })
})

describe('removeReceivedShareHandler', () => {
  it('throws before touching the store when unauthenticated', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    _testStore = null
    await expect(
      removeReceivedShareHandler({ eventId: VALID_ID }),
    ).rejects.toThrow('Unauthorized')
  })

  it('rejects an invalid event id', async () => {
    await expect(
      removeReceivedShareHandler({ eventId: 'bad id' }),
    ).rejects.toThrow('Invalid event ID')
  })

  it('removes only the caller shares and unretains on last reference', async () => {
    _testStore!.addShare(VALID_ID, 'alice', USER)
    await removeReceivedShareHandler({ eventId: VALID_ID })
    expect(_testStore!.getSharesForRecipient(USER)).toEqual([])
    expect(mockUnretainEvent).toHaveBeenCalledWith(VALID_ID)
  })

  it('keeps other recipients shares and does not unretain', async () => {
    _testStore!.addShare(VALID_ID, 'alice', USER)
    _testStore!.addShare(VALID_ID, 'alice', 'someone-else')
    await removeReceivedShareHandler({ eventId: VALID_ID })
    expect(_testStore!.getSharesForRecipient('someone-else')).toHaveLength(1)
    expect(mockUnretainEvent).not.toHaveBeenCalled()
  })

  it('does not touch Frigate when the caller had no share to remove', async () => {
    await removeReceivedShareHandler({ eventId: VALID_ID })
    expect(mockUnretainEvent).not.toHaveBeenCalled()
  })

  it('does not unretain while the caller still favorites it', async () => {
    _testStore!.addFavorite(USER, VALID_ID)
    _testStore!.addShare(VALID_ID, 'alice', USER)
    await removeReceivedShareHandler({ eventId: VALID_ID })
    expect(mockUnretainEvent).not.toHaveBeenCalled()
  })
})
