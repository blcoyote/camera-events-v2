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
  const actual = await importOriginal<typeof import('./favorites-store')>()
  return {
    ...actual,
    getFavoritesStore: vi.fn(() => {
      if (!_testStore) throw new Error('Test store not initialized')
      return Promise.resolve(_testStore)
    }),
  }
})

const mockRetainEvent = vi.fn()
const mockUnretainEvent = vi.fn()
vi.mock('#/features/shared/server/frigate/client', () => ({
  retainEvent: mockRetainEvent,
  unretainEvent: mockUnretainEvent,
  getEvent: vi.fn(),
}))

// Import handlers AFTER mocks are set up
const { toggleFavoriteHandler, getUserFavoritedEventIdsHandler } =
  await import('./favorites-fns')

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
